// =============================================
// attorneyRoutes.js - Attorney Routes
// =============================================

const express = require("express");
const router = express.Router();
const {
  authMiddleware,
  requireAttorney,
  requireVerified,
} = require("../middleware/authMiddleware");
const { asyncHandler } = require("../middleware/errorHandler");

// Import controllers
const {
  updateProfileHandler,
  deleteAccountHandler,
  changePasswordHandler,
} = require("../controllers/attorneyController");

// Import models
const Attorney = require("../models/Attorney");
const Case = require("../models/Case");
const JurorApplication = require("../models/JurorApplication");
const Notification = require("../models/Notification");
const CaseReschedule = require("../models/CaseReschedule");
const AttorneyRescheduleRequest = require("../models/AttorneyRescheduleRequest");

/* ===========================================================
   ✅ PUBLIC ROUTES (no authentication required)
   =========================================================== */

/**
 * GET /api/attorney/public-check
 * Health check endpoint
 */
router.get("/public-check", (req, res) => {
  res.json({
    success: true,
    message: "Attorney routes are accessible",
    timestamp: new Date().toISOString(),
  });
});

/* ===========================================================
   ✅ PROTECTED ROUTES (authentication required)
   All routes below this line require valid JWT token
   =========================================================== */

router.use(authMiddleware);
router.use(requireAttorney);

/* ===========================================================
   DASHBOARD & PROFILE
   =========================================================== */

/**
 * GET /api/attorney/dashboard
 * Get attorney dashboard with stats and overview
 */
router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const attorneyId = req.user.id;

    // Get attorney's cases with counts
    const cases = await Case.getCasesByAttorney(attorneyId);

    // Get case statistics
    const caseStats = {
      total: cases.length,
      pending: cases.filter((c) => c.AdminApprovalStatus === "pending").length,
      approved: cases.filter((c) => c.AdminApprovalStatus === "approved")
        .length,
      warRoom: cases.filter((c) => c.AttorneyStatus === "war_room").length,
      joinTrial: cases.filter((c) => c.AttorneyStatus === "join_trial").length,
      completed: cases.filter((c) => c.AttorneyStatus === "completed").length,
    };

    // Get upcoming trials (next 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date(
      today.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    const upcomingTrials = cases
      .filter((c) => {
        if (!c.ScheduledDate) return false;
        const scheduledDate = new Date(c.ScheduledDate);
        return scheduledDate >= today && scheduledDate <= thirtyDaysFromNow;
      })
      .slice(0, 5); // Limit to 5 upcoming

    // Get recent notifications (if Notification model is ready)
    let notifications = [];
    try {
      if (Notification && Notification.getByRecipient) {
        notifications = await Notification.getByRecipient(
          attorneyId,
          "attorney",
          { limit: 5 }
        );
      }
    } catch (error) {
      console.warn("Could not fetch notifications:", error.message);
    }

    res.json({
      success: true,
      data: {
        attorney: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          lawFirmName: req.user.lawFirmName,
          email: req.user.email,
          verified: req.user.verified,
          verificationStatus: req.user.verificationStatus,
          tierLevel: req.user.tierLevel,
        },
        caseStats,
        upcomingTrials,
        notifications,
      },
    });
  })
);

/**
 * GET /api/attorney/profile
 * Get attorney profile details
 */
router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const attorney = await Attorney.findById(req.user.id);

    if (!attorney) {
      return res.status(404).json({
        success: false,
        error: "Attorney profile not found",
        code: "PROFILE_NOT_FOUND",
      });
    }

    // Remove sensitive data
    delete attorney.PasswordHash;

    res.json({
      success: true,
      data: { attorney },
    });
  })
);

/**
 * PUT /api/attorney/profile
 * Update attorney profile
 */
router.put("/profile", asyncHandler(updateProfileHandler));

/**
 * POST /api/attorney/change-password
 * Change attorney password
 */
router.post("/change-password", asyncHandler(changePasswordHandler));

/**
 * DELETE /api/attorney/account
 * Delete (deactivate) attorney account
 */
router.delete("/account", asyncHandler(deleteAccountHandler));

/* ===========================================================
   CASE MANAGEMENT
   =========================================================== */

/**
 * GET /api/attorney/cases
 * Get all cases for the attorney
 */
router.get(
  "/cases",
  asyncHandler(async (req, res) => {
    const attorneyId = req.user.id;
    const { status, adminApprovalStatus } = req.query;

    const cases = await Case.getCasesByAttorney(attorneyId, {
      status,
      adminApprovalStatus,
    });

    res.json({
      success: true,
      data: { cases, total: cases.length },
    });
  })
);

/**
 * GET /api/attorney/cases/:id
 * Get specific case details
 */
router.get(
  "/cases/:id",
  asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const attorneyId = req.user.id;

    const caseData = await Case.findById(caseId);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      });
    }

    // Verify ownership
    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "You can only access your own cases",
        code: "ACCESS_DENIED",
      });
    }

    // Get application statistics
    const applicationStats = await JurorApplication.getApplicationStatsByCase(
      caseId
    );

    res.json({
      success: true,
      data: {
        case: caseData,
        applicationStats,
      },
    });
  })
);

/**
 * POST /api/attorney/cases
 * Create new case
 */
router.post(
  "/cases",
  requireVerified,
  asyncHandler(async (req, res) => {
    const attorneyId = req.user.id;

    const caseData = {
      ...req.body,
      attorneyId,
    };

    const caseId = await Case.createCase(caseData);

    res.status(201).json({
      success: true,
      message: "Case created successfully",
      data: { caseId },
    });
  })
);

/**
 * PUT /api/attorney/cases/:id
 * Update case details
 */
router.put(
  "/cases/:id",
  asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const attorneyId = req.user.id;

    // Verify ownership
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      });
    }

    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "You can only update your own cases",
        code: "ACCESS_DENIED",
      });
    }

    // Don't allow updates if already in trial
    if (["join_trial", "completed"].includes(caseData.AttorneyStatus)) {
      return res.status(400).json({
        success: false,
        error: "Cannot update case that is in trial or completed",
        code: "INVALID_STATUS",
      });
    }

    await Case.updateCaseDetails(caseId, req.body);

    res.json({
      success: true,
      message: "Case updated successfully",
    });
  })
);

/**
 * PUT /api/attorney/cases/:id/status
 * Update case status (war_room -> join_trial)
 */
router.put(
  "/cases/:id/status",
  asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const attorneyId = req.user.id;
    const { status } = req.body;

    // Verify ownership
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      });
    }

    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "You can only update your own cases",
        code: "ACCESS_DENIED",
      });
    }

    // Validate state transition
    const validation = await Case.validateCaseStateTransition(caseId, status);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.message,
        code: "INVALID_TRANSITION",
      });
    }

    await Case.updateCaseStatus(caseId, { attorneyStatus: status });

    res.json({
      success: true,
      message: "Case status updated successfully",
    });
  })
);

/**
 * DELETE /api/attorney/cases/:id
 * Delete (soft delete) a case
 */
router.delete(
  "/cases/:id",
  asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const attorneyId = req.user.id;

    // Verify ownership
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      });
    }

    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own cases",
        code: "ACCESS_DENIED",
      });
    }

    // Don't allow deletion if in trial
    if (["join_trial", "completed"].includes(caseData.AttorneyStatus)) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete case that is in trial or completed",
        code: "INVALID_STATUS",
      });
    }

    await Case.softDeleteCase(caseId);

    res.json({
      success: true,
      message: "Case deleted successfully",
    });
  })
);

/* ===========================================================
   JUROR APPLICATION MANAGEMENT
   =========================================================== */

/**
 * GET /api/attorney/cases/:caseId/applications
 * Get all applications for a case
 */
router.get(
  "/cases/:caseId/applications",
  asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const attorneyId = req.user.id;
    const { status } = req.query;

    // Verify ownership
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      });
    }

    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "You can only view applications for your own cases",
        code: "ACCESS_DENIED",
      });
    }

    const applications = await JurorApplication.getApplicationsByCase(caseId, {
      status,
    });

    res.json({
      success: true,
      data: { applications, total: applications.length },
    });
  })
);

/**
 * GET /api/attorney/cases/:caseId/applications/:applicationId
 * Get specific application details
 */
router.get(
  "/cases/:caseId/applications/:applicationId",
  asyncHandler(async (req, res) => {
    const { caseId, applicationId } = req.params;
    const attorneyId = req.user.id;

    // Verify case ownership
    const caseData = await Case.findById(caseId);
    if (!caseData || caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        code: "ACCESS_DENIED",
      });
    }

    const application = await JurorApplication.findById(applicationId);

    if (!application || application.CaseId !== parseInt(caseId)) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
        code: "APPLICATION_NOT_FOUND",
      });
    }

    res.json({
      success: true,
      data: { application },
    });
  })
);

/**
 * PUT /api/attorney/cases/:caseId/applications/:applicationId/approve
 * Approve juror application
 */
router.put(
  "/cases/:caseId/applications/:applicationId/approve",
  asyncHandler(async (req, res) => {
    const { caseId, applicationId } = req.params;
    const attorneyId = req.user.id;
    const { comments } = req.body;

    // Verify case ownership
    const caseData = await Case.findById(caseId);
    if (!caseData || caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        code: "ACCESS_DENIED",
      });
    }

    // Check if case still needs jurors
    const approvedCount = await Case.getApprovedJurorsCount(caseId);
    const requiredJurors = caseData.RequiredJurors || 7;

    if (approvedCount >= requiredJurors) {
      return res.status(400).json({
        success: false,
        error: `Case already has the required ${requiredJurors} jurors`,
        code: "JURORS_FULL",
      });
    }

    await JurorApplication.updateApplicationStatus(
      applicationId,
      JurorApplication.APPLICATION_STATUSES.APPROVED,
      attorneyId,
      comments
    );

    res.json({
      success: true,
      message: "Application approved successfully",
    });
  })
);

/**
 * PUT /api/attorney/cases/:caseId/applications/:applicationId/reject
 * Reject juror application
 */
router.put(
  "/cases/:caseId/applications/:applicationId/reject",
  asyncHandler(async (req, res) => {
    const { caseId, applicationId } = req.params;
    const attorneyId = req.user.id;
    const { comments } = req.body;

    // Verify case ownership
    const caseData = await Case.findById(caseId);
    if (!caseData || caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        code: "ACCESS_DENIED",
      });
    }

    await JurorApplication.updateApplicationStatus(
      applicationId,
      JurorApplication.APPLICATION_STATUSES.REJECTED,
      attorneyId,
      comments
    );

    res.json({
      success: true,
      message: "Application rejected successfully",
    });
  })
);

/**
 * POST /api/attorney/cases/:caseId/applications/batch-approve
 * Approve multiple applications at once
 */
router.post(
  "/cases/:caseId/applications/batch-approve",
  asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const attorneyId = req.user.id;
    const { applicationIds, comments } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Application IDs array is required",
        code: "INVALID_INPUT",
      });
    }

    // Verify case ownership
    const caseData = await Case.findById(caseId);
    if (!caseData || caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        code: "ACCESS_DENIED",
      });
    }

    // Check if we can approve this many
    const approvedCount = await Case.getApprovedJurorsCount(caseId);
    const requiredJurors = caseData.RequiredJurors || 7;
    const slotsAvailable = requiredJurors - approvedCount;

    if (slotsAvailable <= 0) {
      return res.status(400).json({
        success: false,
        error: "Case already has all required jurors",
        code: "JURORS_FULL",
      });
    }

    if (applicationIds.length > slotsAvailable) {
      return res.status(400).json({
        success: false,
        error: `Can only approve ${slotsAvailable} more juror(s)`,
        code: "EXCEEDS_REQUIRED_JURORS",
      });
    }

    const affected = await JurorApplication.batchApproveApplications(
      applicationIds,
      attorneyId,
      comments
    );

    res.json({
      success: true,
      message: `Successfully approved ${affected} application(s)`,
      data: { approved: affected },
    });
  })
);

/* ===========================================================
   STATISTICS & REPORTS
   =========================================================== */

/**
 * GET /api/attorney/stats
 * Get attorney statistics
 */
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const attorneyId = req.user.id;

    const cases = await Case.getCasesByAttorney(attorneyId);

    const stats = {
      totalCases: cases.length,
      pendingApproval: cases.filter((c) => c.AdminApprovalStatus === "pending")
        .length,
      approvedCases: cases.filter((c) => c.AdminApprovalStatus === "approved")
        .length,
      rejectedCases: cases.filter((c) => c.AdminApprovalStatus === "rejected")
        .length,
      warRoomCases: cases.filter((c) => c.AttorneyStatus === "war_room").length,
      activeCases: cases.filter((c) => c.AttorneyStatus === "join_trial")
        .length,
      completedCases: cases.filter((c) => c.AttorneyStatus === "completed")
        .length,
    };

    res.json({
      success: true,
      data: { stats },
    });
  })
);

/**
 * GET /api/attorney/reschedule-requests
 * Get pending reschedule requests for attorney (cases needing reschedule)
 */
router.get(
  "/reschedule-requests",
  asyncHandler(async (req, res) => {
    const attorneyId = req.user.id;

    const rescheduleCases = await Case.getRescheduleCasesForAttorney(attorneyId);

    res.json({
      success: true,
      count: rescheduleCases.length,
      rescheduleRequests: rescheduleCases,
      data: rescheduleCases,
    });
  })
);

/**
 * POST /api/attorney/cases/:caseId/confirm-reschedule
 * Attorney confirms one of the 3 alternate slots provided by admin
 */
router.post(
  "/cases/:caseId/confirm-reschedule",
  asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { selectedSlot } = req.body;
    const attorneyId = req.user.id;

    // Validate request
    if (!selectedSlot || !selectedSlot.date || !selectedSlot.time) {
      return res.status(400).json({
        success: false,
        message: "Selected slot with date and time is required",
      });
    }

    // Get case to verify attorney owns it and needs reschedule
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (!caseData.RescheduleRequired) {
      return res.status(400).json({
        success: false,
        message: "This case does not require rescheduling",
      });
    }

    // Confirm the reschedule (this will check slot availability and move to war_room)
    try {
      await Case.confirmReschedule(caseId, selectedSlot);
      console.log(`✅ Case ${caseId} rescheduled successfully to ${selectedSlot.date} ${selectedSlot.time}`);
    } catch (error) {
      // Handle slot unavailable error
      if (error.code === "SLOT_UNAVAILABLE") {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "SLOT_UNAVAILABLE",
          conflictingCaseId: error.conflictingCaseId,
        });
      }
      throw error;
    }

    // Create a success notification for attorney
    await Notification.createNotification({
      userId: attorneyId,
      userType: "attorney",
      caseId: parseInt(caseId),
      type: Notification.NOTIFICATION_TYPES.CASE_APPROVED,
      title: "Case Rescheduled and Approved",
      message: `Your case "${caseData.CaseTitle}" has been rescheduled to ${selectedSlot.date} at ${selectedSlot.time} and moved to War Room.`,
    });

    // Get first active admin to send notification
    const Admin = require("../models/Admin");
    const adminsResult = await Admin.getAllAdmins({ isActive: true, limit: 1 });
    const firstAdmin = adminsResult.admins[0];

    if (firstAdmin) {
      // Notify admin that attorney accepted reschedule
      await Notification.createNotification({
        userId: firstAdmin.AdminId,
        userType: "admin",
        caseId: parseInt(caseId),
        type: "reschedule_confirmed",
        title: "Attorney Confirmed Reschedule",
        message: `Attorney confirmed reschedule for case "${caseData.CaseTitle}" to ${selectedSlot.date} at ${selectedSlot.time}. Case moved to War Room.`,
      });
    }

    res.json({
      success: true,
      message: "Case rescheduled successfully and moved to War Room",
      selectedSlot,
    });
  })
);

/**
 * POST /api/attorney/reschedule-requests/:requestId/request-different
 * Request different time slots
 */
router.post(
  "/reschedule-requests/:requestId/request-different",
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { message } = req.body;
    const attorneyId = req.user.id;

    // Validate request
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // Get the reschedule request to verify ownership
    const rescheduleRequest = await CaseReschedule.findById(requestId);
    if (!rescheduleRequest) {
      return res.status(404).json({
        success: false,
        message: "Reschedule request not found",
      });
    }

    // Get case to verify attorney owns it
    const caseData = await Case.findById(rescheduleRequest.CaseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Update reschedule request with attorney's message
    await CaseReschedule.requestDifferentSlots(requestId, message);

    // Get first active admin to send notification
    const Admin = require("../models/Admin");
    const adminsResult = await Admin.getAllAdmins({ isActive: true, limit: 1 });
    const firstAdmin = adminsResult.admins[0];

    if (firstAdmin) {
      // Notify admin
      await Notification.createNotification({
        userId: firstAdmin.AdminId,
        userType: "admin",
        caseId: rescheduleRequest.CaseId,
        type: "reschedule_feedback",
        title: "Attorney Requested Different Times",
        message: `Attorney requests different times for case "${caseData.CaseTitle}". Message: ${message}`,
      });
    }

    res.json({
      success: true,
      message: "Your request has been sent to the admin",
    });
  })
);

/* ===========================================================
   ATTORNEY-INITIATED RESCHEDULE (NEW FEATURE)
   =========================================================== */

/**
 * POST /api/attorney/cases/:caseId/request-reschedule
 * Attorney requests to reschedule a case from war room
 * Request body: { newScheduledDate, newScheduledTime, reason, attorneyComments }
 */
router.post(
  "/cases/:caseId/request-reschedule",
  asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const attorneyId = req.user.id;
    const { newScheduledDate, newScheduledTime, reason, attorneyComments } = req.body;

    console.log(`📝 [Attorney Reschedule Request] Case ${caseId} by Attorney ${attorneyId}`);

    // Validate inputs
    if (!newScheduledDate || !newScheduledTime) {
      return res.status(400).json({
        success: false,
        message: "New scheduled date and time are required",
      });
    }

    // Get case to verify ownership and get original schedule
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // Verify attorney owns this case
    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reschedule this case",
      });
    }

    // Allow reschedule for cases in war_room, awaiting_trial, or join_trial status
    const allowedStatuses = ["war_room", "awaiting_trial", "join_trial"];
    if (!allowedStatuses.includes(caseData.AttorneyStatus)) {
      return res.status(400).json({
        success: false,
        message: "Case must be in war room, awaiting trial, or join trial status to request reschedule",
      });
    }

    // Ensure case has a scheduled date and time before allowing reschedule
    if (!caseData.ScheduledDate || !caseData.ScheduledTime) {
      return res.status(400).json({
        success: false,
        message: "Case must have a scheduled date and time before you can request a reschedule. Please set the trial schedule first.",
      });
    }

    // Check if there's already a pending reschedule request for this case
    const hasPending = await AttorneyRescheduleRequest.hasPendingRequest(caseId);
    if (hasPending) {
      return res.status(400).json({
        success: false,
        message: "There is already a pending reschedule request for this case",
      });
    }

    // Create reschedule request
    const requestId = await AttorneyRescheduleRequest.createRescheduleRequest({
      caseId: parseInt(caseId),
      attorneyId,
      newScheduledDate,
      newScheduledTime,
      originalScheduledDate: caseData.ScheduledDate,
      originalScheduledTime: caseData.ScheduledTime,
      reason,
      attorneyComments,
    });

    // Create notification for all admins
    try {
      // Get all admins
      const { executeQuery, sql } = require("../config/db");
      const adminIds = await executeQuery(async (pool) => {
        const result = await pool.request().query(`
          SELECT AdminId FROM dbo.Admins WHERE IsActive = 1
        `);
        return result.recordset.map(a => a.AdminId);
      });

      // Create notification for each admin
      for (const adminId of adminIds) {
        await Notification.create({
          userId: adminId,
          userType: "admin",
          caseId: parseInt(caseId),
          type: "attorney_reschedule_request",
          title: "New Reschedule Request",
          message: `Attorney has requested to reschedule case "${caseData.CaseTitle}" from ${caseData.ScheduledDate} to ${newScheduledDate}`,
        });
      }
    } catch (notifError) {
      console.error("Error creating admin notifications:", notifError);
      // Continue even if notification fails
    }

    res.json({
      success: true,
      message: "Reschedule request submitted successfully. Admin will review your request.",
      requestId,
    });
  })
);

/**
 * GET /api/attorney/cases/:caseId/reschedule-status
 * Get reschedule request status for a case
 */
router.get(
  "/cases/:caseId/reschedule-status",
  asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const attorneyId = req.user.id;

    // Get case to verify ownership
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // Verify attorney owns this case
    if (caseData.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this case",
      });
    }

    // Get latest reschedule request for this case
    const rescheduleRequest = await AttorneyRescheduleRequest.findByCaseId(caseId);

    res.json({
      success: true,
      rescheduleRequest,
    });
  })
);

/* ===========================================================
   ERROR HANDLER
   =========================================================== */
router.use((error, req, res, next) => {
  console.error("❌ [Attorney Route Error]:", error);

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Internal server error",
    code: error.code || "INTERNAL_ERROR",
  });
});

module.exports = router;
