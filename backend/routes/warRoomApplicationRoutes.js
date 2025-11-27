// =============================================
// warRoomApplications.js - War Room Application Routes
// FIXED: Added SQL types, validation, authorization, rate limiting
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { poolPromise, sql } = require("../config/db");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireWarRoomAccess } = require("../middleware/warRoomMiddleware");
const jurorApplicationController = require("../controllers/jurorApplicationController");

// Import models
const Case = require("../models/Case");
const JurorApplication = require("../models/JurorApplication");
const Notification = require("../models/Notification");
const Event = require("../models/Event");

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Rate limiter for application updates
 */
const applicationUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 updates per 15 minutes
  message: {
    success: false,
    message: "Too many application updates. Please try again later.",
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
 * Validate application ID parameter
 */
const validateApplicationId = (req, res, next) => {
  const applicationId = parseInt(req.params.applicationId, 10);

  if (isNaN(applicationId) || applicationId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid application ID is required",
    });
  }

  req.validatedApplicationId = applicationId;
  next();
};

/**
 * Validate application status
 */
const validateApplicationStatus = (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ["approved", "rejected", "pending"];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  req.validatedStatus = status;
  next();
};

/**
 * Verify attorney owns the case
 * FIXED: Added authorization check
 */
const verifyAttorneyCaseOwnership = async (req, res, next) => {
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
    if (user.type !== "attorney") {
      return res.status(403).json({
        success: false,
        message: "Only attorneys can manage applications",
      });
    }

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
    next();
  } catch (error) {
    console.error("Case ownership verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify case ownership",
    });
  }
};

/**
 * Safe JSON parse helper
 */
function safeJSONParse(jsonString, fallback = []) {
  if (!jsonString) return fallback;
  if (typeof jsonString === "object") return jsonString;

  try {
    return JSON.parse(jsonString) || fallback;
  } catch (error) {
    console.error("JSON parse error:", error);
    return fallback;
  }
}

// ============================================
// MAIN APPLICATION ENDPOINTS
// ============================================

/**
 * GET /api/war-room-applications/cases/:caseId/applications
 * Get all applications for a case (PRIMARY ENDPOINT)
 * FIXED: Added SQL types, validation, authorization
 */
router.get(
  "/cases/:caseId/applications",
  generalLimiter,
  authMiddleware,
  validateCaseId,
  verifyAttorneyCaseOwnership,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT 
            ja.ApplicationId,
            ja.JurorId,
            j.Name as JurorName,
            j.Email as JurorEmail,
            j.County,
            j.State,
            ja.Status,
            ja.VoirDire1Responses,
            ja.VoirDire2Responses,
            ja.AppliedAt,
            ja.ReviewedAt,
            ja.ReviewedBy
          FROM dbo.JurorApplications ja
          INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
          WHERE ja.CaseId = @caseId
          ORDER BY ja.AppliedAt DESC
        `);

      // Parse JSON fields safely
      const applications = result.recordset.map((app) => ({
        ...app,
        VoirDire1Responses: safeJSONParse(app.VoirDire1Responses, []),
        VoirDire2Responses: safeJSONParse(app.VoirDire2Responses, []),
      }));

      res.json({
        success: true,
        applications,
        count: applications.length,
        summary: {
          total: applications.length,
          pending: applications.filter((app) => app.Status === "pending")
            .length,
          approved: applications.filter((app) => app.Status === "approved")
            .length,
          rejected: applications.filter((app) => app.Status === "rejected")
            .length,
        },
      });
    } catch (error) {
      console.error("Get applications error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch applications",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/war-room-applications/cases/:caseId/applications/:applicationId
 * Get single application details
 * FIXED: Added validation and authorization
 */
router.get(
  "/cases/:caseId/applications/:applicationId",
  generalLimiter,
  authMiddleware,
  validateCaseId,
  validateApplicationId,
  verifyAttorneyCaseOwnership,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const applicationId = req.validatedApplicationId;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("applicationId", sql.Int, applicationId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT 
            ja.ApplicationId,
            ja.JurorId,
            j.Name as JurorName,
            j.Email as JurorEmail,
            j.PhoneNumber as JurorPhone,
            j.County,
            j.State,
            ja.Status,
            ja.VoirDire1Responses,
            ja.VoirDire2Responses,
            ja.AppliedAt,
            ja.ReviewedAt,
            ja.ReviewedBy
          FROM dbo.JurorApplications ja
          INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
          WHERE ja.ApplicationId = @applicationId AND ja.CaseId = @caseId
        `);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }

      const application = {
        ...result.recordset[0],
        VoirDire1Responses: safeJSONParse(
          result.recordset[0].VoirDire1Responses,
          []
        ),
        VoirDire2Responses: safeJSONParse(
          result.recordset[0].VoirDire2Responses,
          []
        ),
      };

      res.json({
        success: true,
        application,
      });
    } catch (error) {
      console.error("Get application details error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch application details",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * PATCH /api/war-room-applications/cases/:caseId/applications/:applicationId
 * Update application status (approve/reject)
 * FIXED: Added validation, authorization, notifications
 */
router.patch(
  "/cases/:caseId/applications/:applicationId",
  applicationUpdateLimiter,
  authMiddleware,
  validateCaseId,
  validateApplicationId,
  validateApplicationStatus,
  verifyAttorneyCaseOwnership,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const applicationId = req.validatedApplicationId;
      const status = req.validatedStatus;
      const attorneyId = req.user.id;
      const pool = await poolPromise;

      // Get application details
      const appResult = await pool
        .request()
        .input("applicationId", sql.Int, applicationId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT ApplicationId, JurorId, Status
          FROM dbo.JurorApplications
          WHERE ApplicationId = @applicationId AND CaseId = @caseId
        `);

      if (appResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }

      const previousStatus = appResult.recordset[0].Status;
      const jurorId = appResult.recordset[0].JurorId;

      // Update the application status
      await pool
        .request()
        .input("applicationId", sql.Int, applicationId)
        .input("caseId", sql.Int, caseId)
        .input("status", sql.NVarChar(50), status)
        .input("reviewedBy", sql.Int, attorneyId).query(`
          UPDATE dbo.JurorApplications
          SET 
            Status = @status, 
            ReviewedAt = GETUTCDATE(),
            ReviewedBy = @reviewedBy,
            UpdatedAt = GETUTCDATE()
          WHERE ApplicationId = @applicationId AND CaseId = @caseId
        `);

      // Create notification for juror if status changed
      if (previousStatus !== status) {
        const caseData = req.caseData;
        const notificationType =
          status === "approved"
            ? Notification.NOTIFICATION_TYPES.APPLICATION_APPROVED
            : status === "rejected"
            ? Notification.NOTIFICATION_TYPES.APPLICATION_REJECTED
            : Notification.NOTIFICATION_TYPES.APPLICATION_UPDATED;

        const notificationMessage =
          status === "approved"
            ? `Congratulations! Your application for "${caseData.CaseTitle}" has been approved.`
            : status === "rejected"
            ? `Your application for "${caseData.CaseTitle}" was not selected at this time.`
            : `Your application status for "${caseData.CaseTitle}" has been updated.`;

        await Notification.createNotification({
          userId: jurorId,
          userType: Notification.USER_TYPES.JUROR,
          caseId,
          type: notificationType,
          title: `Application ${
            status.charAt(0).toUpperCase() + status.slice(1)
          }`,
          message: notificationMessage,
        });

        // Create event
        await Event.createEvent({
          caseId,
          eventType: Event.EVENT_TYPES.CASE_UPDATED,
          description: `Juror application ${status}`,
          triggeredBy: attorneyId,
          userType: "attorney",
        });
      }

      res.json({
        success: true,
        message: `Application ${status} successfully`,
        previousStatus,
        newStatus: status,
      });
    } catch (error) {
      console.error("Update application status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update application status",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/war-room-applications/cases/:caseId/applications/bulk-update
 * Bulk update application statuses
 * NEW: Added bulk update endpoint
 */
router.post(
  "/cases/:caseId/applications/bulk-update",
  applicationUpdateLimiter,
  authMiddleware,
  validateCaseId,
  verifyAttorneyCaseOwnership,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { applications } = req.body; // Array of {applicationId, status}
      const attorneyId = req.user.id;

      if (!Array.isArray(applications) || applications.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Applications array is required",
        });
      }

      // Validate all applications
      const validStatuses = ["approved", "rejected", "pending"];
      for (const app of applications) {
        if (
          !app.applicationId ||
          !app.status ||
          !validStatuses.includes(app.status)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Each application must have valid applicationId and status",
          });
        }
      }

      const pool = await poolPromise;
      const transaction = pool.transaction();

      try {
        await transaction.begin();

        const updateResults = [];

        for (const app of applications) {
          await transaction
            .request()
            .input("applicationId", sql.Int, app.applicationId)
            .input("caseId", sql.Int, caseId)
            .input("status", sql.NVarChar(50), app.status)
            .input("reviewedBy", sql.Int, attorneyId).query(`
              UPDATE dbo.JurorApplications
              SET 
                Status = @status, 
                ReviewedAt = GETUTCDATE(),
                ReviewedBy = @reviewedBy,
                UpdatedAt = GETUTCDATE()
              WHERE ApplicationId = @applicationId AND CaseId = @caseId
            `);

          updateResults.push({
            applicationId: app.applicationId,
            status: app.status,
          });
        }

        await transaction.commit();

        res.json({
          success: true,
          message: `${applications.length} applications updated successfully`,
          updates: updateResults,
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error("Bulk update error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update applications",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// LEGACY WAR ROOM ENDPOINTS
// (For backwards compatibility)
// ============================================

/**
 * GET /api/war-room-applications/cases/:caseId/war-room/applications
 * Legacy endpoint - redirects to main endpoint
 */
router.get(
  "/cases/:caseId/war-room/applications",
  generalLimiter,
  authMiddleware,
  requireWarRoomAccess,
  jurorApplicationController.getApplicationsForCase
);

/**
 * GET /api/war-room-applications/cases/:caseId/war-room/applications/statistics
 * Get application statistics
 */
router.get(
  "/cases/:caseId/war-room/applications/statistics",
  generalLimiter,
  authMiddleware,
  requireWarRoomAccess,
  jurorApplicationController.getApplicationStatistics
);

/**
 * GET /api/war-room-applications/cases/:caseId/war-room/applications/:applicationId
 * Legacy application details endpoint
 */
router.get(
  "/cases/:caseId/war-room/applications/:applicationId",
  generalLimiter,
  authMiddleware,
  requireWarRoomAccess,
  jurorApplicationController.getApplicationDetails
);

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("War Room Application Route Error:", error);

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
