// =============================================
// witnessRoutes.js - Witness Management Routes
// FIXED: Added rate limiting, validation, proper authorization
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const witnessController = require("../controllers/witnessController");
const {
  authMiddleware,
  requireAttorney,
} = require("../middleware/authMiddleware");

// Import models for authorization
const Case = require("../models/Case");

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Rate limiter for witness modifications
 */
const witnessModifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 modifications per 15 minutes
  message: {
    success: false,
    message: "Too many witness modifications. Please try again later.",
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

/**
 * Export rate limiter
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 exports per hour
  message: {
    success: false,
    message: "Too many export requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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
 * Validate witness ID parameter
 */
const validateWitnessId = (req, res, next) => {
  const witnessId = parseInt(req.params.witnessId, 10);

  if (isNaN(witnessId) || witnessId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid witness ID is required",
    });
  }

  req.validatedWitnessId = witnessId;
  next();
};

/**
 * Verify attorney owns the case or user is admin
 * For read operations (GET)
 */
const verifyWitnessReadAccess = async (req, res, next) => {
  try {
    const caseId = req.validatedCaseId;
    const user = req.user;

    // Admin has full access
    if (user.type === "admin") {
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }
      req.caseData = caseData;
      return next();
    }

    // Attorney must own the case
    if (user.type === "attorney") {
      const caseData = await Case.findById(caseId);

      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }

      if (caseData.AttorneyId !== user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You do not own this case",
        });
      }

      req.caseData = caseData;
      return next();
    }

    // Jurors can view witnesses for approved cases only
    if (user.type === "juror") {
      const JurorApplication = require("../models/JurorApplication");
      const application = await JurorApplication.findByJurorAndCase(
        user.id,
        caseId
      );

      if (!application || application.Status !== "approved") {
        return res.status(403).json({
          success: false,
          message: "Access denied: You are not approved for this case",
        });
      }

      req.caseData = await Case.findById(caseId);
      return next();
    }

    // Other user types not allowed
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  } catch (error) {
    console.error("Witness read access verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify access",
    });
  }
};

/**
 * Verify attorney owns the case (for write operations)
 */
const verifyWitnessWriteAccess = async (req, res, next) => {
  try {
    const caseId = req.validatedCaseId || req.validatedWitnessId;
    const user = req.user;

    // Admin has full access
    if (user.type === "admin") {
      return next();
    }

    // Only attorneys can modify witnesses
    if (user.type !== "attorney") {
      return res.status(403).json({
        success: false,
        message: "Only attorneys can modify witnesses",
      });
    }

    // For witness update/delete, get case from witness first
    if (req.validatedWitnessId && !req.validatedCaseId) {
      const Witness = require("../models/Witness");
      const witness = await Witness.findById(req.validatedWitnessId);

      if (!witness) {
        return res.status(404).json({
          success: false,
          message: "Witness not found",
        });
      }

      req.validatedCaseId = witness.CaseId;
    }

    const caseData = await Case.findById(req.validatedCaseId);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    if (caseData.AttorneyId !== user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You do not own this case",
      });
    }

    req.caseData = caseData;
    next();
  } catch (error) {
    console.error("Witness write access verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify access",
    });
  }
};

/**
 * Require attorney or admin role
 */
const requireAttorneyOrAdmin = (req, res, next) => {
  if (req.user.type === "attorney" || req.user.type === "admin") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied: Attorney or Admin role required",
    });
  }
};

// ============================================
// WITNESS ROUTES
// ============================================

/**
 * GET /api/witnesses/:caseId/witnesses/export/text
 * Export witnesses as text (Attorney/Admin only)
 * FIXED: Moved before /:witnessId to avoid route conflict
 */
router.get(
  "/:caseId/witnesses/export/text",
  exportLimiter,
  authMiddleware,
  validateCaseId,
  requireAttorneyOrAdmin,
  verifyWitnessReadAccess,
  witnessController.exportAsText
);

/**
 * GET /api/witnesses/:caseId/witnesses/stats
 * Get witness statistics for a case
 * NEW: Added stats endpoint - placed before /:witnessId
 */
router.get(
  "/:caseId/witnesses/stats",
  generalLimiter,
  authMiddleware,
  validateCaseId,
  verifyWitnessReadAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const Witness = require("../models/Witness");

      const witnesses = await Witness.findByCaseId(caseId);

      const stats = {
        total: witnesses.length,
        byType: witnesses.reduce((acc, w) => {
          const type = w.Type || "Unknown";
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}),
        byParty: witnesses.reduce((acc, w) => {
          const party = w.Party || "Unknown";
          acc[party] = (acc[party] || 0) + 1;
          return acc;
        }, {}),
      };

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("Get witness stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch witness statistics",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/witnesses/:caseId/witnesses/:witnessId
 * Get single witness details
 * NEW: Added single witness endpoint
 */
router.get(
  "/:caseId/witnesses/:witnessId",
  generalLimiter,
  authMiddleware,
  validateCaseId,
  validateWitnessId,
  verifyWitnessReadAccess,
  async (req, res) => {
    try {
      const witnessId = req.validatedWitnessId;
      const caseId = req.validatedCaseId;

      const Witness = require("../models/Witness");
      const witness = await Witness.findById(witnessId);

      if (!witness || witness.CaseId !== caseId) {
        return res.status(404).json({
          success: false,
          message: "Witness not found",
        });
      }

      res.json({
        success: true,
        witness,
      });
    } catch (error) {
      console.error("Get witness error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch witness",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/witnesses/:caseId/witnesses
 * Get all witnesses for a case
 * FIXED: Added validation and proper authorization
 */
router.get(
  "/:caseId/witnesses",
  generalLimiter,
  authMiddleware,
  validateCaseId,
  verifyWitnessReadAccess,
  witnessController.getWitnesses
);

/**
 * POST /api/witnesses/:caseId/witnesses
 * Save witnesses for a case (create or bulk update)
 * FIXED: Added validation and authorization
 */
router.post(
  "/:caseId/witnesses",
  witnessModifyLimiter,
  authMiddleware,
  requireAttorney,
  validateCaseId,
  verifyWitnessWriteAccess,
  witnessController.saveWitnesses
);

/**
 * PUT /api/witnesses/witnesses/:witnessId
 * Update a single witness
 * FIXED: Added validation and authorization
 */
router.put(
  "/witnesses/:witnessId",
  witnessModifyLimiter,
  authMiddleware,
  requireAttorney,
  validateWitnessId,
  verifyWitnessWriteAccess,
  witnessController.updateWitness
);

/**
 * DELETE /api/witnesses/witnesses/:witnessId
 * Delete a witness
 * FIXED: Added validation and authorization
 */
router.delete(
  "/witnesses/:witnessId",
  witnessModifyLimiter,
  authMiddleware,
  requireAttorney,
  validateWitnessId,
  verifyWitnessWriteAccess,
  witnessController.deleteWitness
);

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("Witness Route Error:", error);

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
