// =============================================
// Verdict Routes
// Handles jury charge verdict submission and aggregation
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { authMiddleware } = require("../middleware/authMiddleware");
const verdictController = require("../controllers/verdictController");

// ============================================
// RATE LIMITERS
// ============================================

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
 * Submission limiter (prevent spam submissions)
 */
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: "Too many submission attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// MIDDLEWARE
// ============================================

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * Attach user role to request for authorization
 */
const attachUserRole = (req, res, next) => {
  if (req.user && req.user.type) {
    req.userRole = req.user.type;
  } else {
    req.userRole = null;
  }
  next();
};

router.use(attachUserRole);

// ============================================
// SUBMISSION ROUTES
// ============================================

/**
 * POST /api/verdicts/submit
 * Submit verdict for a juror
 * Juror only
 * Body: { caseId, jurorId, responses }
 */
router.post(
  "/submit",
  submissionLimiter,
  verdictController.submitVerdict
);

/**
 * POST /api/verdicts/draft
 * Save verdict draft (can be updated later)
 * Juror only
 * Body: { caseId, jurorId, responses }
 */
router.post(
  "/draft",
  generalLimiter,
  verdictController.saveDraft
);

/**
 * GET /api/verdicts/check/:caseId/:jurorId
 * Check if juror has already submitted verdict
 * Juror, Attorney, or Admin
 */
router.get(
  "/check/:caseId/:jurorId",
  generalLimiter,
  verdictController.checkSubmissionStatus
);

// ============================================
// RETRIEVAL ROUTES
// ============================================

/**
 * GET /api/verdicts/:verdictId
 * Get verdict by ID
 * Admin or Attorney only
 */
router.get(
  "/:verdictId",
  generalLimiter,
  verdictController.getVerdictById
);

/**
 * GET /api/verdicts/juror/:caseId/:jurorId
 * Get verdict for a specific juror in a case
 * Juror (own verdict), Attorney, or Admin
 */
router.get(
  "/juror/:caseId/:jurorId",
  generalLimiter,
  verdictController.getVerdictByJuror
);

/**
 * GET /api/verdicts/case/:caseId
 * Get all verdicts for a case
 * Admin or Attorney only
 */
router.get(
  "/case/:caseId",
  generalLimiter,
  verdictController.getVerdictsByCase
);

// ============================================
// STATUS & AGGREGATION ROUTES
// ============================================

/**
 * GET /api/verdicts/status/:caseId
 * Get verdict submission status for a case
 * Returns: { totalJurors, submitted, pending, jurors: [...] }
 * Admin or Attorney only
 */
router.get(
  "/status/:caseId",
  generalLimiter,
  verdictController.getSubmissionStatus
);

/**
 * GET /api/verdicts/results/:caseId
 * Get aggregated results for all verdicts in a case
 * Returns statistical aggregation per question
 * Admin or Attorney only
 */
router.get(
  "/results/:caseId",
  generalLimiter,
  verdictController.getAggregatedResults
);

// ============================================
// ADMIN CONTROLS
// ============================================

/**
 * POST /api/verdicts/publish/:caseId
 * Publish verdict results to attorney
 * Admin only - marks results as published and notifies attorney
 */
router.post(
  "/publish/:caseId",
  generalLimiter,
  verdictController.publishResults
);

/**
 * DELETE /api/verdicts/:verdictId
 * Delete a verdict (admin only, for corrections)
 * Admin only
 */
router.delete(
  "/:verdictId",
  generalLimiter,
  verdictController.deleteVerdict
);

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("Verdict Route Error:", error);

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
