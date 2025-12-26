// =============================================
// caseRoutes.js - Case Management Routes
// FIXED: Removed duplicate route, proper order
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const {
  authMiddleware,
  requireAttorney,
} = require("../middleware/authMiddleware");
const {
  createCase,
  getAttorneyCases,
  getCaseDetails,
} = require("../controllers/caseController");

// Import database connection
const { poolPromise, sql } = require("../config/db");

// Import models
const Case = require("../models/Case");
const JurorApplication = require("../models/JurorApplication");

// ============================================
// RATE LIMITERS (MUST BE DEFINED FIRST!)
// ============================================

/**
 * Rate limiter for case creation
 * Prevents abuse of case creation endpoint
 */
const caseCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 cases per hour
  message: {
    success: false,
    message: "Too many cases created. Please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General case operations rate limiter
 */
const caseOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 for testing
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// VALIDATION MIDDLEWARE
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
 * Validate case tier
 */
const validateCaseTier = (req, res, next) => {
  const { newTier } = req.body;

  const validTiers = ["tier_1", "tier_2", "tier_3"];

  if (!newTier || !validTiers.includes(newTier)) {
    return res.status(400).json({
      success: false,
      message: `Invalid tier. Must be one of: ${validTiers.join(", ")}`,
    });
  }

  req.validatedTier = newTier;
  next();
};

/**
 * Load case and attach to request
 */
const loadCase = async (req, res, next) => {
  try {
    const caseId = req.validatedCaseId;

    const caseData = await Case.findById(caseId);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    req.caseData = caseData;
    next();
  } catch (error) {
    console.error("Load case error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load case",
    });
  }
};

// ============================================
// AUTHORIZATION MIDDLEWARE
// ============================================

/**
 * Verify attorney owns the case
 */
const verifyAttorneyCaseOwnership = (req, res, next) => {
  if (req.user.type !== "attorney") {
    return res.status(403).json({
      success: false,
      message: "Only attorneys can access this resource",
    });
  }

  if (req.caseData.AttorneyId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Access denied: You do not own this case",
    });
  }

  next();
};

/**
 * Verify case access for any user type
 * Handles different authorization logic for attorneys vs jurors
 */
const verifyCaseAccess = async (req, res, next) => {
  try {
    const caseData = req.caseData;
    const user = req.user;

    // Attorney access
    if (user.type === "attorney") {
      if (caseData.AttorneyId !== user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You do not own this case",
        });
      }
      return next();
    }

    // Juror access
    if (user.type === "juror") {
      // Check if juror has an application for this case
      const application = await JurorApplication.findByJurorAndCase(
        user.id,
        caseData.CaseId
      );

      // If no application exists
      if (!application) {
        // Only allow access to cases in war_room state (for applying)
        if (
          caseData.AdminApprovalStatus !== "approved" ||
          caseData.AttorneyStatus !== "war_room"
        ) {
          return res.status(403).json({
            success: false,
            message: "This case is not available for applications",
          });
        }
        // Allow access for applying
        return next();
      }

      // If application exists but not approved
      if (application.Status !== "approved") {
        return res.status(403).json({
          success: false,
          message: "You are not approved for this case",
        });
      }

      // Application is approved - allow full access
      req.jurorApplication = application;
      return next();
    }

    // Admin access
    if (user.type === "admin") {
      return next();
    }

    // Unknown user type
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  } catch (error) {
    console.error("Case access verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify case access",
    });
  }
};

// ============================================
// CASE ROUTES (AFTER ALL DEPENDENCIES ARE DEFINED!)
// ============================================

/**
 * POST /api/case/cases
 * Create new case (Attorney only)
 */
router.post(
  "/cases",
  caseCreationLimiter,
  authMiddleware,
  requireAttorney,
  createCase
);

/**
 * GET /api/case/cases
 * Get attorney's cases
 * FIXED: Only one definition, after limiters are defined
 */
router.get(
  "/cases",
  caseOperationsLimiter,
  authMiddleware,
  requireAttorney,
  (req, res, next) => {
    console.log("📍 GET /api/case/cases endpoint hit");
    console.log("   User:", req.user?.email, "| Type:", req.user?.type);
    next();
  },
  getAttorneyCases
);

/**
 * GET /api/case/cases/:caseId
 * Get specific case details
 * Accessible to attorneys (own cases), jurors (approved/war_room), and admins
 */
router.get(
  "/cases/:caseId",
  caseOperationsLimiter,
  authMiddleware,
  validateCaseId,
  loadCase,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseData = req.caseData;

      // Include application status if user is a juror
      let applicationStatus = null;
      if (req.user.type === "juror" && req.jurorApplication) {
        applicationStatus = {
          status: req.jurorApplication.Status,
          appliedAt: req.jurorApplication.AppliedAt,
          reviewedAt: req.jurorApplication.ReviewedAt,
        };
      }

      res.json({
        success: true,
        case: caseData,
        applicationStatus,
      });
    } catch (error) {
      console.error("Get case details error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch case details",
      });
    }
  }
);

/**
 * PUT /api/case/cases/:caseId
 * Update case details (Attorney only)
 */
router.put(
  "/cases/:caseId",
  caseOperationsLimiter,
  authMiddleware,
  requireAttorney,
  validateCaseId,
  loadCase,
  verifyAttorneyCaseOwnership,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const updates = req.body;

      // Allowed fields for update
      const allowedFields = [
        "caseTitle",
        "caseDescription",
        "caseType",
        "plaintiffGroups",
        "defendantGroups",
      ];

      // Filter to only allowed fields
      const filteredUpdates = {};
      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      await Case.updateCase(caseId, filteredUpdates);

      res.json({
        success: true,
        message: "Case updated successfully",
      });
    } catch (error) {
      console.error("Update case error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update case",
      });
    }
  }
);

/**
 * POST /api/case/cases/:caseId/upgrade-tier
 * Upgrade case tier (Attorney only)
 */
router.post(
  "/cases/:caseId/upgrade-tier",
  caseOperationsLimiter,
  authMiddleware,
  requireAttorney,
  validateCaseId,
  validateCaseTier,
  loadCase,
  verifyAttorneyCaseOwnership,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const newTier = req.validatedTier;
      const currentTier = req.caseData.CaseTier;

      // Validate tier upgrade (can only upgrade, not downgrade)
      const tierLevels = { tier_1: 1, tier_2: 2, tier_3: 3 };

      if (tierLevels[newTier] <= tierLevels[currentTier]) {
        return res.status(400).json({
          success: false,
          message: "Can only upgrade to a higher tier",
        });
      }

      // Update tier
      await Case.updateCaseStatus(caseId, { caseTier: newTier });

      res.json({
        success: true,
        message: "Case tier upgraded successfully",
        previousTier: currentTier,
        newTier,
      });
    } catch (error) {
      console.error("Upgrade case tier error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upgrade case tier",
      });
    }
  }
);

/**
 * DELETE /api/case/cases/:caseId
 * Delete/cancel case (Attorney only)
 */
router.delete(
  "/cases/:caseId",
  caseOperationsLimiter,
  authMiddleware,
  requireAttorney,
  validateCaseId,
  loadCase,
  verifyAttorneyCaseOwnership,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const caseData = req.caseData;

      // Only allow deletion if case is not in advanced state
      const undeletableStatuses = ["join_trial", "in_trial", "view_details"];

      if (undeletableStatuses.includes(caseData.AttorneyStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete case in current state. Please contact support.",
        });
      }

      // Soft delete by updating status
      await Case.updateCaseStatus(caseId, {
        attorneyStatus: "cancelled",
        adminApprovalStatus: "cancelled",
      });

      res.json({
        success: true,
        message: "Case cancelled successfully",
      });
    } catch (error) {
      console.error("Delete case error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete case",
      });
    }
  }
);

/**
 * GET /api/case/cases/:caseId/documents
 * Get war room documents for a case
 * Accessible to attorneys (own cases), jurors (approved), and admins
 * NOTE: This endpoint fetches WarRoomDocuments (trial documents), not CaseDocuments (filing documents)
 */
router.get(
  "/cases/:caseId/documents",
  caseOperationsLimiter,
  authMiddleware,
  validateCaseId,
  loadCase,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId).query(`
          SELECT
            Id,
            CaseId,
            Type,
            FileName,
            FileUrl,
            Description,
            Size,
            MimeType,
            UploadedAt
          FROM WarRoomDocuments
          WHERE CaseId = @caseId
          ORDER BY UploadedAt DESC
        `);

      res.json({
        success: true,
        documents: result.recordset || [],
      });
    } catch (error) {
      console.error("Get case documents error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch case documents",
      });
    }
  }
);

/**
 * GET /api/case/cases/:caseId/witnesses
 * Get witnesses for a case
 * Accessible to attorneys (own cases), jurors (approved), and admins
 */
router.get(
  "/cases/:caseId/witnesses",
  caseOperationsLimiter,
  authMiddleware,
  validateCaseId,
  loadCase,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(`
          SELECT *
          FROM CaseWitnesses
          WHERE CaseId = @caseId
          ORDER BY OrderIndex ASC
        `);

      res.json({
        success: true,
        witnesses: result.recordset || [],
      });
    } catch (error) {
      console.error("Get case witnesses error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch case witnesses",
      });
    }
  }
);

/**
 * GET /api/case/cases/:caseId/team
 * Get team members for a case
 * Accessible to attorneys (own cases), jurors (approved), and admins
 */
router.get(
  "/cases/:caseId/team",
  caseOperationsLimiter,
  authMiddleware,
  validateCaseId,
  loadCase,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId).query(`
          SELECT
            Id,
            CaseId,
            Name,
            Role,
            Email,
            AddedAt
          FROM WarRoomTeamMembers
          WHERE CaseId = @caseId
          ORDER BY AddedAt DESC
        `);

      res.json({
        success: true,
        team: result.recordset || [],
      });
    } catch (error) {
      console.error("Get case team error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch team members",
      });
    }
  }
);

// ============================================
// ERROR HANDLER
// ============================================

/**
 * Route-specific error handler
 */
router.use((error, req, res, next) => {
  console.error("Case Route Error:", error);

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
