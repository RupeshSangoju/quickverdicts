// =============================================
// tierUpgradeRoutes.js - Case Tier Upgrade Routes
// FIXED: Proper middleware, SQL types, validation, rate limiting
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const Stripe = require("stripe");
const { poolPromise, sql } = require("../config/db");
const {
  authMiddleware,
  requireAttorney,
} = require("../middleware/authMiddleware");

// Import models
const Case = require("../models/Case");
const Event = require("../models/Event");
const Notification = require("../models/Notification");

// ============================================
// STRIPE CONFIGURATION
// ============================================

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? Stripe(stripeSecretKey) : null;

// ============================================
// TIER PRICING CONFIGURATION
// ============================================

/**
 * Tier pricing configuration
 * Note: tier_1 is the highest/most expensive tier
 */
const TIER_PRICING = {
  tier_1: {
    price: 350000, // $3,500 in cents
    duration: 2.5,
    name: "Tier 1",
    description: "2.5 hours trial duration",
  },
  tier_2: {
    price: 450000, // $4,500 in cents
    duration: 3.5,
    name: "Tier 2",
    description: "3.5 hours trial duration",
  },
  tier_3: {
    price: 550000, // $5,500 in cents
    duration: 4.5,
    name: "Tier 3",
    description: "4.5 hours trial duration",
  },
};

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Strict rate limiter for tier upgrade payments
 */
const tierUpgradeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 upgrade attempts per hour
  message: {
    success: false,
    message: "Too many upgrade attempts. Please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General operations limiter
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// MIDDLEWARE
// ============================================

router.use(authMiddleware);
router.use(requireAttorney);

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate case ID parameter
 */
const validateCaseId = (req, res, next) => {
  const caseId = parseInt(req.params.caseId, 10);

  if (isNaN(caseId) || caseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid case ID is required",
    });
  }

  req.validatedCaseId = caseId;
  next();
};

/**
 * Validate tier
 */
const validateTier = (tier) => {
  const validTiers = ["tier_1", "tier_2", "tier_3"];
  return validTiers.includes(tier);
};

/**
 * Calculate price difference for upgrade
 */
function calculateUpgradePrice(currentTier, newTier) {
  const currentPrice = TIER_PRICING[currentTier]?.price || 0;
  const newPrice = TIER_PRICING[newTier]?.price || 0;

  return newPrice - currentPrice;
}

/**
 * Validate tier upgrade
 * Returns true if newTier is a valid upgrade from currentTier
 */
function isValidUpgrade(currentTier, newTier) {
  // tier_1 is highest (most expensive), tier_3 is lowest (least expensive)
  const tierOrder = { tier_3: 3, tier_2: 2, tier_1: 1 };

  if (!tierOrder[currentTier] || !tierOrder[newTier]) {
    return false;
  }

  // Can only upgrade to a higher tier (lower number = higher tier/more expensive)
  return tierOrder[newTier] < tierOrder[currentTier];
}

// ============================================
// TIER UPGRADE ROUTES
// ============================================

/**
 * GET /api/tier-upgrade/:caseId/available-upgrades
 * Get available tier upgrades for a case
 * FIXED: Moved before POST to avoid route conflicts
 */
router.get(
  "/:caseId/available-upgrades",
  generalLimiter,
  validateCaseId,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const attorneyId = req.user.id;
      const pool = await poolPromise;

      // Get current case tier
      const caseResult = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("attorneyId", sql.Int, attorneyId).query(`
          SELECT CaseTier, AttorneyStatus
          FROM dbo.Cases
          WHERE CaseId = @caseId AND AttorneyId = @attorneyId
        `);

      if (caseResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Case not found or access denied",
        });
      }

      const currentTier = caseResult.recordset[0].CaseTier;
      const attorneyStatus = caseResult.recordset[0].AttorneyStatus;

      // Check if case can be upgraded (not in advanced stages)
      const nonUpgradeableStatuses = [
        "join_trial",
        "in_trial",
        "view_details",
        "completed",
      ];
      const canUpgradeStatus = !nonUpgradeableStatuses.includes(attorneyStatus);

      const availableUpgrades = [];

      // Determine available upgrades based on current tier
      if (currentTier === "tier_3") {
        availableUpgrades.push({
          tier: "tier_2",
          ...TIER_PRICING.tier_2,
          priceDifference: calculateUpgradePrice(currentTier, "tier_2"),
        });
        availableUpgrades.push({
          tier: "tier_1",
          ...TIER_PRICING.tier_1,
          priceDifference: calculateUpgradePrice(currentTier, "tier_1"),
        });
      } else if (currentTier === "tier_2") {
        availableUpgrades.push({
          tier: "tier_1",
          ...TIER_PRICING.tier_1,
          priceDifference: calculateUpgradePrice(currentTier, "tier_1"),
        });
      }
      // tier_1 has no upgrades available

      res.json({
        success: true,
        currentTier,
        currentTierInfo: TIER_PRICING[currentTier],
        availableUpgrades,
        canUpgrade: availableUpgrades.length > 0 && canUpgradeStatus,
        upgradeRestriction: !canUpgradeStatus
          ? "Cannot upgrade case in current status"
          : null,
      });
    } catch (error) {
      console.error("Error fetching available upgrades:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch available upgrades",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/tier-upgrade/:caseId/tier-upgrade-history
 * Get tier upgrade history for a case
 */
router.get(
  "/:caseId/tier-upgrade-history",
  generalLimiter,
  validateCaseId,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const attorneyId = req.user.id;
      const pool = await poolPromise;

      // Verify case ownership
      const caseCheck = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("attorneyId", sql.Int, attorneyId).query(`
          SELECT CaseId FROM dbo.Cases
          WHERE CaseId = @caseId AND AttorneyId = @attorneyId
        `);

      if (caseCheck.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Case not found or access denied",
        });
      }

      // Get upgrade history
      const historyResult = await pool
        .request()
        .input("caseId", sql.Int, caseId).query(`
          SELECT 
            UpgradeId,
            FromTier,
            ToTier,
            PriceDifference,
            PaymentIntentId,
            CreatedAt
          FROM dbo.TierUpgrades
          WHERE CaseId = @caseId
          ORDER BY CreatedAt DESC
        `);

      const history = historyResult.recordset.map((upgrade) => ({
        ...upgrade,
        fromTierInfo: TIER_PRICING[upgrade.FromTier],
        toTierInfo: TIER_PRICING[upgrade.ToTier],
      }));

      res.json({
        success: true,
        history,
        count: history.length,
      });
    } catch (error) {
      console.error("Error fetching tier upgrade history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch tier upgrade history",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/tier-upgrade/:caseId/upgrade-tier
 * Upgrade case tier with payment processing
 * FIXED: Added validation, SQL types, better error handling
 */
router.post(
  "/:caseId/upgrade-tier",
  tierUpgradeLimiter,
  validateCaseId,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { newTier, paymentMethodId } = req.body;
      const attorneyId = req.user.id;

      // Validate new tier
      if (!newTier || !validateTier(newTier)) {
        return res.status(400).json({
          success: false,
          message: "Valid tier is required (tier_1, tier_2, or tier_3)",
        });
      }

      const pool = await poolPromise;

      // 1. Get current case data
      const caseResult = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("attorneyId", sql.Int, attorneyId).query(`
          SELECT CaseId, AttorneyId, CaseTier, AttorneyStatus, PaymentStatus
          FROM dbo.Cases
          WHERE CaseId = @caseId AND AttorneyId = @attorneyId
        `);

      if (caseResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Case not found or access denied",
        });
      }

      const currentCase = caseResult.recordset[0];
      const currentTier = currentCase.CaseTier;

      // Check if already at requested tier
      if (currentTier === newTier) {
        return res.status(400).json({
          success: false,
          message: "Case is already at the requested tier",
        });
      }

      // 2. Validate the upgrade
      if (!isValidUpgrade(currentTier, newTier)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid tier upgrade. You can only upgrade to a higher tier (tier_1 is highest).",
        });
      }

      // Check if case can be upgraded
      const nonUpgradeableStatuses = [
        "join_trial",
        "in_trial",
        "view_details",
        "completed",
      ];
      if (nonUpgradeableStatuses.includes(currentCase.AttorneyStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot upgrade case in current status. Please contact support.",
        });
      }

      // 3. Calculate price difference
      const priceDifference = calculateUpgradePrice(currentTier, newTier);

      if (priceDifference <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid upgrade: new tier must be more expensive than current tier",
        });
      }

      // 4. Process payment if Stripe is configured
      let paymentIntentId = null;

      if (!stripe) {
        return res.status(503).json({
          success: false,
          message: "Payment service not available",
        });
      }

      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          message: "Payment method is required for tier upgrade",
        });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: priceDifference,
          currency: "usd",
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
          metadata: {
            caseId: caseId.toString(),
            attorneyId: attorneyId.toString(),
            type: "tier_upgrade",
            fromTier: currentTier,
            toTier: newTier,
          },
          description: `Tier upgrade for case ${caseId} from ${TIER_PRICING[currentTier].name} to ${TIER_PRICING[newTier].name}`,
        });

        paymentIntentId = paymentIntent.id;

        if (paymentIntent.status !== "succeeded") {
          return res.status(400).json({
            success: false,
            message: "Payment processing failed",
            paymentStatus: paymentIntent.status,
          });
        }
      } catch (stripeError) {
        console.error("Stripe payment failed:", stripeError);
        return res.status(400).json({
          success: false,
          message: "Payment processing failed: " + stripeError.message,
        });
      }

      // 5. Update the case tier
      await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("newTier", sql.NVarChar(50), newTier).query(`
          UPDATE dbo.Cases
          SET CaseTier = @newTier,
              UpdatedAt = GETUTCDATE()
          WHERE CaseId = @caseId
        `);

      // 6. Record the tier upgrade transaction
      await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("attorneyId", sql.Int, attorneyId)
        .input("fromTier", sql.NVarChar(50), currentTier)
        .input("toTier", sql.NVarChar(50), newTier)
        .input("priceDifference", sql.Decimal(10, 2), priceDifference / 100) // Convert cents to dollars
        .input("paymentIntentId", sql.NVarChar(255), paymentIntentId).query(`
          INSERT INTO dbo.TierUpgrades (
            CaseId, AttorneyId, FromTier, ToTier, 
            PriceDifference, PaymentIntentId, CreatedAt
          )
          VALUES (
            @caseId, @attorneyId, @fromTier, @toTier,
            @priceDifference, @paymentIntentId, GETUTCDATE()
          )
        `);

      // 7. Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Case tier upgraded from ${TIER_PRICING[currentTier].name} to ${TIER_PRICING[newTier].name}`,
        triggeredBy: attorneyId,
        userType: "attorney",
      });

      // 8. Get first active admin and notify
      const Admin = require("../models/Admin");
      const adminsResult = await Admin.getAllAdmins({ isActive: true, limit: 1 });
      const firstAdmin = adminsResult.admins[0];

      if (firstAdmin) {
        await Notification.createNotification({
          userId: firstAdmin.AdminId,
          userType: Notification.USER_TYPES.ADMIN,
          caseId,
          type: Notification.NOTIFICATION_TYPES.CASE_UPDATED,
          title: "Case Tier Upgraded",
          message: `Case tier upgraded from ${TIER_PRICING[currentTier].name} to ${TIER_PRICING[newTier].name}`,
        });
      }

      // 9. Send success response
      res.json({
        success: true,
        message: `Case tier successfully upgraded from ${TIER_PRICING[currentTier].name} to ${TIER_PRICING[newTier].name}`,
        upgrade: {
          previousTier: currentTier,
          newTier: newTier,
          pricePaid: priceDifference / 100, // Convert to dollars
          newTierInfo: TIER_PRICING[newTier],
          paymentIntentId,
        },
      });
    } catch (error) {
      console.error("Error upgrading case tier:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upgrade case tier",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// HEALTH CHECK
// ============================================

router.get("/health", (req, res) => {
  const isConfigured = !!stripe;

  res.json({
    success: true,
    status: isConfigured ? "healthy" : "degraded",
    service: "tier-upgrade",
    configured: isConfigured,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("Tier Upgrade Route Error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

// ============================================
// EXPORTS
// ============================================

module.exports = router;
