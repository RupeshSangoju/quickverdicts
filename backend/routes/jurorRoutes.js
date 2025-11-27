// =============================================
// jurorRoutes.js - Juror Routes
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const {
  authMiddleware,
  requireJuror,
  requireJurorOnboarding,
  requireVerified,
} = require("../middleware/authMiddleware");
const { asyncHandler } = require("../middleware/errorHandler");

// Import controllers
const {
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  deleteAccountHandler,
  getStatsHandler,
} = require("../controllers/jurorController");

// Import models
const Juror = require("../models/Juror");
const Case = require("../models/Case");
const JurorApplication = require("../models/JurorApplication");
const Notification = require("../models/Notification");

/* ===========================================================
   ✅ PUBLIC ROUTES (no authentication required)
   =========================================================== */

/**
 * GET /api/juror/public-check
 * Health check endpoint
 */
router.get("/public-check", (req, res) => {
  res.json({
    success: true,
    message: "Juror routes are accessible",
    timestamp: new Date().toISOString(),
  });
});

/* ===========================================================
   ✅ PROTECTED ROUTES (authentication required)
   All routes below require valid JWT token + juror role
   =========================================================== */

router.use(authMiddleware);
router.use(requireJuror);

/* ===========================================================
   RATE LIMITERS
   =========================================================== */

const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Increased from 10 to 100 for testing multiple jurors applying
  message: {
    success: false,
    error: "Too many applications submitted. Please try again in 1 hour.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes (increased for polling)
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ===========================================================
   DASHBOARD & PROFILE
   =========================================================== */

/**
 * GET /api/juror/dashboard
 * Get juror dashboard with stats and overview
 */
router.get(
  "/dashboard",
  generalLimiter,
  asyncHandler(async (req, res) => {
    const jurorId = req.user.id;

    // Get juror's applications
    const applications = await JurorApplication.getApplicationsByJuror(jurorId);

    // Get application statistics
    const applicationStats = {
      total: applications.length,
      pending: applications.filter((a) => a.Status === "pending").length,
      approved: applications.filter((a) => a.Status === "approved").length,
      rejected: applications.filter((a) => a.Status === "rejected").length,
      withdrawn: applications.filter((a) => a.Status === "withdrawn").length,
    };

    // Get upcoming trials (approved applications)
    const upcomingTrials = applications
      .filter((a) => {
        if (a.Status !== "approved" || !a.ScheduledDate) return false;
        const scheduledDate = new Date(a.ScheduledDate);
        const today = new Date();
        return scheduledDate >= today;
      })
      .slice(0, 5); // Limit to 5

    // Get available cases count (if onboarding completed)
    let availableCasesCount = 0;
    if (req.user.onboardingCompleted) {
      const availableCases = await Case.getAvailableCasesForJurors(
        req.user.county,
        jurorId,
        req.user.state
      );
      availableCasesCount = availableCases.length;
    }

    // Get recent notifications
    let notifications = [];
    try {
      if (Notification && Notification.getByRecipient) {
        notifications = await Notification.getByRecipient(jurorId, "juror", {
          limit: 5,
        });
      }
    } catch (error) {
      console.warn("Could not fetch notifications:", error.message);
    }

    res.json({
      success: true,
      data: {
        juror: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          county: req.user.county,
          state: req.user.state,
          verified: req.user.verified,
          verificationStatus: req.user.verificationStatus,
          onboardingCompleted: req.user.onboardingCompleted,
        },
        applicationStats,
        upcomingTrials,
        availableCasesCount,
        notifications,
      },
    });
  })
);

/**
 * GET /api/juror/profile
 * Get juror profile details
 */
router.get("/profile", generalLimiter, asyncHandler(getProfileHandler));

/**
 * PUT /api/juror/profile
 * Update juror profile
 */
router.put("/profile", generalLimiter, asyncHandler(updateProfileHandler));

/**
 * POST /api/juror/change-password
 * Change juror password
 */
router.post(
  "/change-password",
  generalLimiter,
  asyncHandler(changePasswordHandler)
);

/**
 * DELETE /api/juror/account
 * Delete (deactivate) juror account
 */
router.delete("/account", generalLimiter, asyncHandler(deleteAccountHandler));

/* ===========================================================
   ONBOARDING
   =========================================================== */

/**
 * GET /api/juror/onboarding
 * Get onboarding tasks status
 */
router.get(
  "/onboarding",
  generalLimiter,
  asyncHandler(async (req, res) => {
    const jurorId = req.user.id;
    const juror = await Juror.findById(jurorId);

    if (!juror) {
      return res.status(404).json({
        success: false,
        error: "Juror not found",
        code: "JUROR_NOT_FOUND",
      });
    }

    const tasks = [
      {
        id: "intro_video",
        title: "Introduction to Quick Verdicts",
        duration: "5 minutes",
        completed: Boolean(juror.IntroVideoCompleted),
        description: "Learn about the platform and your role as a juror",
        order: 1,
      },
      {
        id: "juror_quiz",
        title: "Juror Responsibility Quiz",
        duration: "3 minutes",
        completed: Boolean(juror.JurorQuizCompleted),
        description: "Test your understanding of jury service basics",
        order: 2,
      },
    ];

    const completedCount = tasks.filter((t) => t.completed).length;
    const progress = Math.round((completedCount / tasks.length) * 100);

    res.json({
      success: true,
      data: {
        tasks,
        onboardingCompleted: Boolean(juror.OnboardingCompleted),
        progress,
        completedCount,
        totalTasks: tasks.length,
      },
    });
  })
);

/**
 * POST /api/juror/onboarding/:taskId/complete
 * Mark onboarding task as completed
 */
router.post(
  "/onboarding/:taskId/complete",
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const jurorId = req.user.id;

    // Map taskId to model task types
    const taskMap = {
      intro_video: "intro_video",
      juror_quiz: "juror_quiz",
    };

    const taskType = taskMap[taskId];
    if (!taskType) {
      return res.status(400).json({
        success: false,
        error: "Invalid task ID. Must be 'intro_video' or 'juror_quiz'",
        code: "INVALID_TASK_ID",
      });
    }

    // Mark task as completed
    await Juror.updateTaskCompletion(jurorId, taskType, true);

    // Update overall onboarding status
    await Juror.updateOnboardingStatus(jurorId);

    // Get updated juror data
    const updatedJuror = await Juror.findById(jurorId);

    res.json({
      success: true,
      message: `Task '${taskId}' marked as completed`,
      data: {
        taskId,
        onboardingCompleted: Boolean(updatedJuror.OnboardingCompleted),
      },
    });
  })
);

/* ===========================================================
   CASE DISCOVERY (JOB BOARD)
   =========================================================== */

/**
 * GET /api/juror/cases/available
 * Get available cases for juror to apply to
 */
router.get(
  "/cases/available",
  generalLimiter,
  requireJurorOnboarding,
  requireVerified,
  asyncHandler(async (req, res) => {
    const juror = req.user;
    const { caseType, tier, sortBy } = req.query;

    console.log('🔍 [JUROR JOB BOARD] Request received:', {
      jurorId: juror.id,
      jurorEmail: juror.email,
      jurorCounty: juror.county,
      jurorState: juror.state,
      onboardingCompleted: juror.onboardingCompleted,
      verified: juror.verified,
      filters: { caseType, tier, sortBy }
    });

    // Get available cases in juror's county and state
    let availableCases = await Case.getAvailableCasesForJurors(
      juror.county,
      juror.id,
      juror.state
    );

    console.log('✅ [JUROR JOB BOARD] Query completed:', {
      casesFound: availableCases.length,
      cases: availableCases.map(c => ({
        caseId: c.CaseId,
        title: c.CaseTitle,
        state: c.State,
        county: c.County,
        status: c.AttorneyStatus,
        approval: c.AdminApprovalStatus
      }))
    });

    // Apply filters
    if (caseType) {
      availableCases = availableCases.filter((c) => c.CaseType === caseType);
    }
    if (tier) {
      availableCases = availableCases.filter((c) => c.CaseTier === tier);
    }

    // Sort results
    if (sortBy === "date") {
      availableCases.sort(
        (a, b) => new Date(a.ScheduledDate) - new Date(b.ScheduledDate)
      );
    } else if (sortBy === "payment") {
      availableCases.sort((a, b) => b.PaymentAmount - a.PaymentAmount);
    } else {
      // Default: most recent first
      availableCases.sort(
        (a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)
      );
    }

    res.json({
      success: true,
      data: {
        cases: availableCases,
        total: availableCases.length,
        filters: {
          county: juror.county,
          state: juror.state,
          caseType: caseType || "all",
          tier: tier || "all",
        },
      },
    });
  })
);

/**
 * GET /api/juror/cases/:caseId
 * Get specific case details for application
 */
router.get(
  "/cases/:caseId",
  generalLimiter,
  requireJurorOnboarding,
  requireVerified,
  asyncHandler(async (req, res) => {
    const caseId = parseInt(req.params.caseId, 10);
    const jurorId = req.user.id;

    if (isNaN(caseId) || caseId <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid case ID is required",
        code: "INVALID_CASE_ID",
      });
    }

    const caseData = await Case.findById(caseId);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      });
    }

    // Check if case is available for applications
    if (
      caseData.AdminApprovalStatus !== "approved" ||
      caseData.AttorneyStatus !== "war_room"
    ) {
      return res.status(400).json({
        success: false,
        error: "This case is not currently accepting applications",
        code: "CASE_NOT_AVAILABLE",
      });
    }

    // Check if juror already applied
    const existingApplication = await JurorApplication.findByJurorAndCase(
      jurorId,
      caseId
    );

    // Get application stats
    const applicationStats = await JurorApplication.getApplicationStatsByCase(
      caseId
    );

    res.json({
      success: true,
      data: {
        case: caseData,
        alreadyApplied: !!existingApplication,
        applicationStatus: existingApplication?.Status || null,
        applicationStats,
      },
    });
  })
);

/* ===========================================================
   APPLICATIONS
   =========================================================== */

/**
 * GET /api/juror/applications
 * Get juror's applications
 */
router.get(
  "/applications",
  generalLimiter,
  asyncHandler(async (req, res) => {
    const jurorId = req.user.id;
    const { status } = req.query;

    let applications = await JurorApplication.getApplicationsByJuror(jurorId);

    // Filter by status if provided
    if (status) {
      const validStatuses = Object.values(
        JurorApplication.APPLICATION_STATUSES
      );
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          code: "INVALID_STATUS",
        });
      }
      applications = applications.filter((a) => a.Status === status);
    }

    res.json({
      success: true,
      data: {
        applications,
        total: applications.length,
      },
    });
  })
);

/**
 * GET /api/juror/applications/:applicationId
 * Get specific application details
 */
router.get(
  "/applications/:applicationId",
  generalLimiter,
  asyncHandler(async (req, res) => {
    const jurorId = req.user.id;
    const applicationId = parseInt(req.params.applicationId, 10);

    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid application ID is required",
        code: "INVALID_APPLICATION_ID",
      });
    }

    const application = await JurorApplication.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
        code: "APPLICATION_NOT_FOUND",
      });
    }

    // Verify ownership
    if (application.JurorId !== jurorId) {
      return res.status(403).json({
        success: false,
        error: "You can only view your own applications",
        code: "ACCESS_DENIED",
      });
    }

    res.json({
      success: true,
      data: { application },
    });
  })
);

/**
 * POST /api/juror/applications
 * Submit application for a case
 */
router.post(
  "/applications",
  applicationLimiter,
  requireJurorOnboarding,
  requireVerified,
  asyncHandler(async (req, res) => {
    const jurorId = req.user.id;
    const { caseId, voirDire1Responses, voirDire2Responses } = req.body;

    // Validate input
    if (!caseId || isNaN(parseInt(caseId))) {
      return res.status(400).json({
        success: false,
        error: "Valid case ID is required",
        code: "INVALID_INPUT",
      });
    }

    if (!voirDire1Responses || !Array.isArray(voirDire1Responses)) {
      return res.status(400).json({
        success: false,
        error: "Voir Dire Part 1 responses are required",
        code: "INVALID_INPUT",
      });
    }

    // Verify case exists and is available
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      });
    }

    // Check case status
    if (
      caseData.AdminApprovalStatus !== "approved" ||
      caseData.AttorneyStatus !== "war_room"
    ) {
      return res.status(400).json({
        success: false,
        error: "This case is not currently accepting applications",
        code: "CASE_NOT_AVAILABLE",
      });
    }

    // Check if already applied
    const existingApplication = await JurorApplication.findByJurorAndCase(
      jurorId,
      caseId
    );
    if (existingApplication) {
      return res.status(409).json({
        success: false,
        error: "You have already applied to this case",
        code: "DUPLICATE_APPLICATION",
      });
    }

    // Check if case is full (maximum 7 jurors allowed)
    const approvedCount = await Case.getApprovedJurorsCount(caseId);
    if (approvedCount >= 7) {
      return res.status(400).json({
        success: false,
        error: "This case has reached the maximum of 7 jurors",
        code: "CASE_FULL",
      });
    }

    // Create application
    const applicationId = await JurorApplication.createApplication({
      jurorId,
      caseId: parseInt(caseId),
      voirDire1Responses: voirDire1Responses || [],
      voirDire2Responses: voirDire2Responses || [],
    });

    // Notify attorney (if Notification model is ready)
    try {
      if (Notification && Notification.createNotification) {
        await Notification.createNotification({
          userId: caseData.AttorneyId,
          userType: "attorney",
          caseId: parseInt(caseId),
          type: "application_received",
          title: "New Juror Application",
          message: `A juror has applied to your case "${caseData.CaseTitle}"`,
        });
      }
    } catch (error) {
      console.warn("Could not send notification:", error.message);
    }

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: { applicationId },
    });
  })
);

/**
 * PUT /api/juror/applications/:applicationId/withdraw
 * Withdraw application
 */
router.put(
  "/applications/:applicationId/withdraw",
  generalLimiter,
  asyncHandler(async (req, res) => {
    const jurorId = req.user.id;
    const applicationId = parseInt(req.params.applicationId, 10);

    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid application ID is required",
        code: "INVALID_APPLICATION_ID",
      });
    }

    // Verify application exists and belongs to juror
    const application = await JurorApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
        code: "APPLICATION_NOT_FOUND",
      });
    }

    if (application.JurorId !== jurorId) {
      return res.status(403).json({
        success: false,
        error: "You can only withdraw your own applications",
        code: "ACCESS_DENIED",
      });
    }

    // Check if application can be withdrawn
    if (application.Status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Cannot withdraw application with status: ${application.Status}`,
        code: "INVALID_STATUS",
      });
    }

    // Withdraw application
    const success = await JurorApplication.withdrawApplication(
      applicationId,
      jurorId
    );

    if (!success) {
      return res.status(400).json({
        success: false,
        error: "Failed to withdraw application",
        code: "WITHDRAW_FAILED",
      });
    }

    res.json({
      success: true,
      message: "Application withdrawn successfully",
    });
  })
);

/* ===========================================================
   STATISTICS
   =========================================================== */

/**
 * GET /api/juror/stats
 * Get juror statistics
 */
router.get("/stats", generalLimiter, asyncHandler(getStatsHandler));

/* ===========================================================
   ERROR HANDLER
   =========================================================== */

router.use((error, req, res, next) => {
  console.error("❌ [Juror Route Error]:", error);

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Internal server error",
    code: error.code || "INTERNAL_ERROR",
  });
});

module.exports = router;
