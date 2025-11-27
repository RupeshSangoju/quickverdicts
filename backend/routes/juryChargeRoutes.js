// =============================================
// Jury Charge Routes
// Handles jury charge question builder and management
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { authMiddleware } = require("../middleware/authMiddleware");
const juryChargeController = require("../controllers/juryChargeController");

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
 * Question operations limiter (stricter for create/update/delete)
 */
const questionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: {
    success: false,
    message: "Too many question operations. Please try again later.",
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
// QUESTION CRUD ROUTES
// ============================================

/**
 * POST /api/jury-charge/questions
 * Add a new jury charge question
 * Attorney only
 */
router.post(
  "/questions",
  questionLimiter,
  juryChargeController.addQuestion
);

/**
 * GET /api/jury-charge/questions/:caseId
 * Get all jury charge questions for a case
 * Attorney or Admin
 */
router.get(
  "/questions/:caseId",
  generalLimiter,
  juryChargeController.getJuryChargeQuestions
);

/**
 * PUT /api/jury-charge/questions/:questionId
 * Update a specific question
 * Attorney only
 */
router.put(
  "/questions/:questionId",
  questionLimiter,
  juryChargeController.updateJuryChargeQuestion
);

/**
 * DELETE /api/jury-charge/questions/:questionId
 * Delete a specific question
 * Attorney only
 */
router.delete(
  "/questions/:questionId",
  questionLimiter,
  juryChargeController.deleteJuryChargeQuestion
);

// ============================================
// ADMIN CONTROLS
// ============================================

/**
 * POST /api/jury-charge/release/:caseId
 * Release jury charge to jurors (locks editing)
 * Admin only
 */
router.post(
  "/release/:caseId",
  generalLimiter,
  juryChargeController.releaseToJury
);

/**
 * GET /api/jury-charge/status/:caseId
 * Check if jury charge is locked/released
 */
router.get(
  "/status/:caseId",
  generalLimiter,
  juryChargeController.checkIfLocked
);

// ============================================
// JUROR ROUTES
// ============================================

/**
 * GET /api/jury-charge/juror/:caseId
 * Get jury charge questions for juror to fill out
 * Juror only - must be released first
 */
router.get(
  "/juror/:caseId",
  generalLimiter,
  juryChargeController.getQuestionsForJuror
);

/**
 * POST /api/jury-charge/submit
 * Submit jury charge responses
 * Juror only
 */
router.post(
  "/submit",
  questionLimiter,
  juryChargeController.submitResponses
);

/**
 * GET /api/jury-charge/verdicts/:caseId
 * Get all verdict responses for a case
 * Admin only
 */
router.get(
  "/verdicts/:caseId",
  generalLimiter,
  juryChargeController.getVerdicts
);

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("Jury Charge Route Error:", error);

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
