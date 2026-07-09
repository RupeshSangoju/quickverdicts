// =============================================
// couponRoutes.js - Coupon Management Routes
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { authMiddleware, requireAttorney, requireAdmin } = require("../middleware/authMiddleware");
const CouponCode = require("../models/CouponCode");

// ============================================
// RATE LIMITERS
// ============================================

const couponValidationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 validation attempts per hour per IP
  message: {
    success: false,
    message: "Too many validation attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// PUBLIC ROUTES (No auth required for validation)
// ============================================

/**
 * POST /api/coupons/validate
 * Validate a coupon code for a specific case tier (does NOT increment counter)
 * Request body: { code, caseTier }
 * Response: { isValid, discountAmount?, message? }
 */
router.post("/validate", couponValidationLimiter, async (req, res) => {
  try {
    const { code, caseTier } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    if (!caseTier || typeof caseTier !== "string") {
      return res.status(400).json({
        success: false,
        message: "Case tier is required",
      });
    }

    const result = await CouponCode.validateCoupon(code, caseTier);

    res.json({
      success: result.isValid,
      ...result,
    });
  } catch (error) {
    console.error("Coupon validation error:", error);
    res.status(500).json({
      success: false,
      message: "Coupon validation failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

router.use(authMiddleware);
router.use(requireAdmin);

/**
 * POST /api/coupons/create
 * Create a new coupon (admin only)
 */
router.post("/create", async (req, res) => {
  try {
    const { code, applicableTier, discountAmount, maxRedemptions, expiresAt } = req.body;

    const couponId = await CouponCode.createCoupon({
      code,
      applicableTier,
      discountAmount,
      maxRedemptions,
      expiresAt,
      isActive: true,
    });

    res.json({
      success: true,
      message: "Coupon created successfully",
      couponId,
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create coupon",
    });
  }
});

/**
 * GET /api/coupons/all
 * List all coupons (admin only)
 */
router.get("/all", async (req, res) => {
  try {
    const coupons = await CouponCode.listAllCoupons();

    res.json({
      success: true,
      coupons,
    });
  } catch (error) {
    console.error("List coupons error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list coupons",
    });
  }
});

/**
 * GET /api/coupons/:code
 * Get coupon details (admin only)
 */
router.get("/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const coupon = await CouponCode.getCouponDetails(code);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    res.json({
      success: true,
      coupon,
    });
  } catch (error) {
    console.error("Get coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get coupon",
    });
  }
});

/**
 * PUT /api/coupons/:code
 * Update coupon (admin only)
 */
router.put("/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const { isActive, maxRedemptions, expiresAt } = req.body;

    await CouponCode.updateCoupon(code, {
      isActive,
      maxRedemptions,
      expiresAt,
    });

    res.json({
      success: true,
      message: "Coupon updated successfully",
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update coupon",
    });
  }
});

// ============================================
// EXPORTS
// ============================================

module.exports = router;
