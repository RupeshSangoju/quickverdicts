// =============================================
// admin.js - Enhanced Admin Routes
// =============================================

const express = require("express");
const router = express.Router();
const { poolPromise, sql } = require("../config/db");
const {
  authMiddleware,
  requireAdmin,
} = require("../middleware/authMiddleware");

// Import admin controller functions
const {
  getCasesPendingApproval,
  reviewCaseApproval,
  getAllCases,
  getCaseDetailsForAdmin,
  getAttorneysPendingVerification,
  verifyAttorney,
  getJurorsPendingVerification,
  verifyJuror,
  getAdminDashboard,
  getSystemAnalytics,
  getAdminSchedule,
  updateSchedule,
} = require("../controllers/adminController");

// Import models
const Attorney = require("../models/Attorney");
const Juror = require("../models/Juror");
const AdminCalendar = require("../models/AdminCalendar");
const Admin = require("../models/Admin");
const Case = require("../models/Case");
const CaseDocument = require("../models/CaseDocument");
const TrialRecording = require("../models/TrialRecording");
const TrialIncident = require("../models/TrialIncident");

// ============================================
// HELPER FUNCTIONS
// ============================================

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

function isValidDate(dateString) {
  if (!dateString || typeof dateString !== "string") return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// ============================================
// DEBUGGING MIDDLEWARE (TEMPORARY)
// ============================================
// This will help us see what's happening with authentication
router.use((req, res, next) => {
  console.log("=== ADMIN ROUTE DEBUG ===");
  console.log("Path:", req.path);
  console.log("Method:", req.method);
  console.log("Headers:", {
    authorization: req.headers.authorization ? "Present" : "Missing",
    contentType: req.headers["content-type"],
  });
  console.log("========================");
  next();
});

// ============================================
// APPLY AUTHENTICATION TO ALL ROUTES BELOW
// ============================================

router.use(authMiddleware);
router.use(requireAdmin);

// Add error handler for authentication failures
router.use((err, req, res, next) => {
  console.error("Admin route error:", err);
  if (err.name === "UnauthorizedError" || err.status === 401) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: err.message || "Invalid or missing token",
    });
  }
  next(err);
});

// ============================================
// Dashboard & Analytics Routes
// ============================================

// Version check endpoint to verify deployed code
router.get("/version", (req, res) => {
  res.json({
    success: true,
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    features: {
      slotAvailabilityCheck: true,
      caseModelImportFixed: true
    },
    message: "Admin routes with slot availability fix deployed"
  });
});

router.get("/dashboard", getAdminDashboard);
router.get("/analytics", getSystemAnalytics);

router.get("/stats/comprehensive", async (req, res) => {
  try {
    console.log("Fetching comprehensive stats for user:", req.user);
    const stats = await Admin.getDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error fetching comprehensive stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
});

// ============================================
// Admin Notifications Routes
// ============================================

router.get("/notifications", async (req, res) => {
  try {
    const adminId = req.user?.id || req.user?.userId || 1;
    const unreadOnly = req.query.unreadOnly === "true";

    console.log("Fetching notifications for admin:", adminId);

    const notifications = await Admin.getAdminNotifications(
      adminId,
      unreadOnly
    );

    res.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.IsRead).length,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
});

router.post("/notifications/:notificationId/read", async (req, res) => {
  try {
    const notificationId = parseInt(req.params.notificationId, 10);
    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Valid notification ID is required",
      });
    }

    await Admin.markNotificationRead(notificationId);

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
});

router.post("/notifications/read-all", async (req, res) => {
  try {
    const adminId = req.user?.id || req.user?.userId || 1;
    await Admin.markAllNotificationsRead(adminId);

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
});

// ============================================
// Audit Log Routes
// ============================================

router.get("/audit-logs", async (req, res) => {
  try {
    const options = {
      adminId: req.query.adminId,
      targetType: req.query.targetType,
      targetId: req.query.targetId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit || 100,
    };

    const logs = await Admin.getAuditLogs(options);

    res.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
      error: error.message,
    });
  }
});

// ============================================
// Trials Ready to Begin Routes
// ============================================

router.get("/trials/ready", async (req, res) => {
  try {
    console.log("Fetching ready trials for user:", req.user);
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        c.CaseId,
        c.CaseTitle,
        c.CaseType,
        c.County,
        a.State,
        c.ScheduledDate,
        c.ScheduledTime,
        c.AttorneyStatus,
        c.PlaintiffGroups,
        c.DefendantGroups,
        c.PaymentAmount,
        a.LawFirmName,
        a.FirstName + ' ' + a.LastName AS AttorneyName,
        a.Email AS AttorneyEmail,
        a.PhoneNumber AS AttorneyPhone,
        tm.RoomId,
        tm.ChatThreadId AS ThreadId,
        tm.Status AS MeetingStatus,
        tm.IsRecording,
        (SELECT COUNT(*)
         FROM dbo.JurorApplications ja
         WHERE ja.CaseId = c.CaseId AND ja.Status = 'approved') AS ApprovedJurorCount,
        (SELECT COUNT(*)
         FROM dbo.CaseWitnesses w
         WHERE w.CaseId = c.CaseId) AS WitnessCount,
        (SELECT COUNT(*)
         FROM dbo.JuryChargeQuestions jcq
         WHERE jcq.CaseId = c.CaseId) AS QuestionCount
      FROM dbo.Cases c
      INNER JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
      LEFT JOIN dbo.TrialMeetings tm ON c.CaseId = tm.CaseId
      WHERE c.AttorneyStatus = 'join_trial'
        AND c.AdminApprovalStatus = 'approved'
        -- ✅ EXCLUDE PAST TRIALS: Only show trials for today (using attorney's timezone)
        AND CAST(c.ScheduledDate AS DATE) = CAST(
          DATEADD(MINUTE, CASE
            -- Eastern Time (UTC-5) = -300 minutes
            WHEN a.State IN ('Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland',
                           'Massachusetts', 'Michigan', 'New Hampshire', 'New Jersey', 'New York',
                           'North Carolina', 'Ohio', 'Pennsylvania', 'Rhode Island', 'South Carolina',
                           'Vermont', 'Virginia', 'West Virginia') THEN -300
            -- Central Time (UTC-6) = -360 minutes
            WHEN a.State IN ('Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Kentucky',
                           'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska',
                           'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas',
                           'Wisconsin') THEN -360
            -- Mountain Time (UTC-7) = -420 minutes
            WHEN a.State IN ('Arizona', 'Colorado', 'Idaho', 'Montana', 'Nevada', 'New Mexico',
                           'Utah', 'Wyoming') THEN -420
            -- Pacific Time (UTC-8) = -480 minutes
            WHEN a.State IN ('California', 'Oregon', 'Washington') THEN -480
            -- Alaska Time (UTC-9) = -540 minutes
            WHEN a.State = 'Alaska' THEN -540
            -- Hawaii Time (UTC-10) = -600 minutes
            WHEN a.State = 'Hawaii' THEN -600
            -- India Standard Time (UTC+5:30) = +330 minutes
            WHEN a.State = 'India' THEN 330
            ELSE 0
          END, GETDATE()) AS DATE)
      ORDER BY c.ScheduledDate ASC, c.ScheduledTime ASC
    `);

    const trials = result.recordset.map((trial) => ({
      ...trial,
      approvedJurorCount: trial.ApprovedJurorCount || 0,
      witnessCount: trial.WitnessCount || 0,
      questionCount: trial.QuestionCount || 0,
      canJoin: !!(trial.RoomId && trial.ThreadId),
    }));

    res.json({
      success: true,
      trials,
      count: trials.length,
    });
  } catch (error) {
    console.error("Error fetching ready trials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ready trials",
      error: error.message,
    });
  }
});

// ============================================
// Calendar Routes
// ============================================

router.get("/calendar/cases-by-date", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Valid date parameter is required (format: YYYY-MM-DD)",
      });
    }

    console.log("Fetching cases for date:", date);
    const pool = await poolPromise;

    const result = await pool.request().input("date", sql.Date, date).query(`
        SELECT
          c.CaseId,
          c.CaseTitle,
          c.CaseType,
          c.County,
          a.State,
          c.ScheduledDate,
          c.ScheduledTime,
          c.AttorneyStatus,
          c.AdminApprovalStatus,
          c.PlaintiffGroups,
          c.DefendantGroups,
          c.PaymentAmount,
          a.LawFirmName,
          a.FirstName + ' ' + a.LastName AS AttorneyName,
          a.Email AS AttorneyEmail,
          a.PhoneNumber AS AttorneyPhone,
          tm.RoomId,
          tm.ChatThreadId AS ThreadId,
          tm.Status AS MeetingStatus,
          (SELECT COUNT(*)
           FROM dbo.JurorApplications ja
           WHERE ja.CaseId = c.CaseId AND ja.Status = 'approved') AS ApprovedJurorCount
        FROM dbo.Cases c
        INNER JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
        LEFT JOIN dbo.TrialMeetings tm ON c.CaseId = tm.CaseId
        WHERE CAST(c.ScheduledDate AS DATE) = @date
          AND c.AdminApprovalStatus = 'approved'
        ORDER BY c.ScheduledTime ASC
      `);

    // Fetch witnesses, jury questions, and juror applications for each case
    const casesWithDetails = await Promise.all(
      result.recordset.map(async (caseItem) => {
        // Fetch witnesses for this case
        const witnessesResult = await pool
          .request()
          .input("caseId", sql.Int, caseItem.CaseId)
          .query(
            "SELECT WitnessId, WitnessName, Email, Side, Description, IsAccepted FROM dbo.CaseWitnesses WHERE CaseId = @caseId ORDER BY OrderIndex ASC"
          );

        // Fetch jury charge questions for this case
        const questionsResult = await pool
          .request()
          .input("caseId", sql.Int, caseItem.CaseId)
          .query(
            "SELECT QuestionId, QuestionText, QuestionType, Options FROM dbo.JuryChargeQuestions WHERE CaseId = @caseId ORDER BY QuestionOrder ASC"
          );

        // Fetch juror applications for this case
        const jurorsResult = await pool
          .request()
          .input("caseId", sql.Int, caseItem.CaseId)
          .query(
            `SELECT
              ja.ApplicationId,
              ja.JurorId,
              ja.Status,
              ja.AppliedAt,
              j.Name as JurorName,
              j.Email as JurorEmail,
              j.County,
              j.State
            FROM dbo.JurorApplications ja
            INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
            WHERE ja.CaseId = @caseId
            ORDER BY ja.AppliedAt DESC`
          );

        // Parse JSON options if present
        const juryQuestions = questionsResult.recordset.map((q) => ({
          ...q,
          Options: q.Options ? safeJSONParse(q.Options, []) : [],
        }));

        return {
          ...caseItem,
          approvedJurorCount: caseItem.ApprovedJurorCount || 0,
          canJoin:
            caseItem.AttorneyStatus === "join_trial" &&
            !!(caseItem.RoomId && caseItem.ThreadId),
          witnesses: witnessesResult.recordset || [],
          juryQuestions: juryQuestions || [],
          jurors: jurorsResult.recordset || [],
        };
      })
    );

    res.json({
      success: true,
      cases: casesWithDetails,
      count: casesWithDetails.length,
      date,
    });
  } catch (error) {
    console.error("Error fetching cases by date:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cases for date",
      error: error.message,
    });
  }
});

router.get("/calendar/blocked", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (
      !startDate ||
      !endDate ||
      !isValidDate(startDate) ||
      !isValidDate(endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid startDate and endDate are required",
      });
    }

    const blockedSlots = await AdminCalendar.getBlockedSlots(
      startDate,
      endDate
    );

    res.json({
      success: true,
      blockedSlots,
    });
  } catch (error) {
    console.error("Error fetching blocked slots:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blocked slots",
      error: error.message,
    });
  }
});

router.get("/calendar/available", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (
      !startDate ||
      !endDate ||
      !isValidDate(startDate) ||
      !isValidDate(endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid startDate and endDate are required",
      });
    }

    const availableSlots = await AdminCalendar.getAvailableSlots(
      startDate,
      endDate
    );

    res.json({
      success: true,
      availableSlots,
    });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available slots",
      error: error.message,
    });
  }
});

router.post("/calendar/block", async (req, res) => {
  try {
    const { blockedDate, blockedTime, reason } = req.body;

    if (!blockedDate || !blockedTime || !isValidDate(blockedDate)) {
      return res.status(400).json({
        success: false,
        message: "Valid blockedDate and blockedTime are required",
      });
    }

    const calendarId = await AdminCalendar.blockSlot({
      blockedDate,
      blockedTime,
      reason: reason || "Manually blocked by admin",
    });

    res.json({
      success: true,
      message: "Time slot blocked successfully",
      calendarId,
    });
  } catch (error) {
    console.error("Error blocking slot:", error);
    res.status(500).json({
      success: false,
      message: "Failed to block time slot",
      error: error.message,
    });
  }
});

router.delete("/calendar/unblock/:calendarId", async (req, res) => {
  try {
    const calendarId = parseInt(req.params.calendarId, 10);

    if (isNaN(calendarId) || calendarId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid calendar ID is required",
      });
    }

    await AdminCalendar.unblockSlot(calendarId);

    res.json({
      success: true,
      message: "Time slot unblocked successfully",
    });
  } catch (error) {
    console.error("Error unblocking slot:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unblock time slot",
      error: error.message,
    });
  }
});

// ============================================
// Case Management Routes
// ============================================

router.get("/cases/pending", getCasesPendingApproval);
router.get("/cases", getAllCases);
router.get("/cases/:caseId", getCaseDetailsForAdmin);
router.post("/cases/:caseId/review", reviewCaseApproval);

// ============================================
// Case Reschedule Routes (Time Slot Conflict Resolution)
// ============================================

/**
 * Check if a time slot is available
 * Called by admin before approving to detect conflicts
 */
router.post("/cases/:caseId/check-slot-availability", async (req, res) => {
  try {
    const { caseId } = req.params;
    console.log(`🔍 [check-slot-availability] Checking slot for case ${caseId}`);

    // Get case data to check its scheduled slot
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // Convert date to YYYY-MM-DD format
    const scheduledDate = caseData.ScheduledDate instanceof Date
      ? caseData.ScheduledDate.toISOString().split("T")[0]
      : caseData.ScheduledDate;

    // Validate that case has a scheduled date
    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        message: "Case has no scheduled date. Please schedule the case before approving.",
      });
    }

    // Convert time to HH:MM:SS format
    let timeString;
    if (caseData.ScheduledTime instanceof Date) {
      timeString = `${String(caseData.ScheduledTime.getHours()).padStart(2, '0')}:${String(caseData.ScheduledTime.getMinutes()).padStart(2, '0')}:${String(caseData.ScheduledTime.getSeconds()).padStart(2, '0')}`;
    } else if (typeof caseData.ScheduledTime === 'string') {
      timeString = caseData.ScheduledTime.split('.')[0]; // Remove microseconds
    }

    // Validate that case has a scheduled time
    if (!timeString || timeString.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Case has no scheduled time. Please schedule the case before approving.",
      });
    }

    // Check slot availability
    const availability = await Case.checkSlotAvailability(scheduledDate, timeString, caseId);

    res.json({
      success: true,
      available: availability.available,
      scheduledDate,
      scheduledTime: timeString,
      conflictingCaseId: availability.conflictingCaseId,
      conflictingCaseTitle: availability.conflictingCaseTitle,
    });
  } catch (error) {
    console.error("Error checking slot availability:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check slot availability",
      error: error.message,
    });
  }
});

/**
 * Admin requests reschedule by providing 3 alternate slots
 * Called when admin detects conflict and picks alternate slots
 */
router.post("/cases/:caseId/request-reschedule", async (req, res) => {
  try {
    const { caseId } = req.params;
    const { alternateSlots } = req.body;

    // Validate input
    if (!Array.isArray(alternateSlots) || alternateSlots.length !== 3) {
      return res.status(400).json({
        success: false,
        message: "Exactly 3 alternate slots are required",
      });
    }

    // Validate each slot has date and time
    for (const slot of alternateSlots) {
      if (!slot.date || !slot.time) {
        return res.status(400).json({
          success: false,
          message: "Each alternate slot must have date and time",
        });
      }
    }

    const adminId = req.user?.id || req.user?.userId || 1;

    // Request reschedule
    await Case.requestReschedule(caseId, adminId, alternateSlots);

    // Get case data for notification
    const caseData = await Case.findById(caseId);

    // Notify attorney
    const Notification = require("../models/Notification");
    await Notification.createNotification({
      userId: caseData.AttorneyId,
      userType: "attorney",
      caseId: parseInt(caseId),
      type: "case_reschedule_needed",
      title: "Case Needs Rescheduling",
      message: `Your case "${caseData.CaseTitle}" time slot is already booked. Please select one of the 3 alternate time slots provided by admin.`,
    });

    // Create event
    const Event = require("../models/Event");
    await Event.createEvent({
      caseId: parseInt(caseId),
      eventType: "admin_requested_reschedule",
      description: `Admin requested reschedule due to time slot conflict. Provided 3 alternate slots.`,
      triggeredBy: adminId,
      userType: "admin",
    });

    res.json({
      success: true,
      message: "Reschedule request sent to attorney successfully",
      alternateSlots,
    });
  } catch (error) {
    console.error("Error requesting reschedule:", error);
    res.status(500).json({
      success: false,
      message: "Failed to request reschedule",
      error: error.message,
    });
  }
});

// ============================================
// Case Documents Routes
// ============================================

router.get("/cases/:caseId/documents", async (req, res) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId) || caseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid case ID is required",
      });
    }

    const documents = await CaseDocument.getDocumentsByCase(caseId);
    const stats = await CaseDocument.getDocumentStats(caseId);

    res.json({
      success: true,
      documents,
      stats,
    });
  } catch (error) {
    console.error("Error fetching case documents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch case documents",
      error: error.message,
    });
  }
});

router.post("/documents/:documentId/verify", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId, 10);
    if (isNaN(documentId) || documentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid document ID is required",
      });
    }

    const adminId = req.user?.id || req.user?.userId || 1;
    await CaseDocument.verifyDocument(documentId, adminId);

    await Admin.logAdminAction(
      adminId,
      "verify_document",
      "document",
      documentId,
      "Document verified",
      req.ip
    );

    res.json({
      success: true,
      message: "Document verified successfully",
    });
  } catch (error) {
    console.error("Error verifying document:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify document",
      error: error.message,
    });
  }
});

// ============================================
// Trial Recording Routes
// ============================================

router.post("/trials/:meetingId/recording/start", async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid meeting ID is required",
      });
    }

    const adminId = req.user?.id || req.user?.userId || 1;

    const isRecording = await TrialRecording.isRecording(meetingId);
    if (isRecording) {
      return res.status(400).json({
        success: false,
        message: "Meeting is already being recorded",
      });
    }

    const TrialMeeting = require("../models/TrialMeeting");
    const meeting = await TrialMeeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    const recordingId = await TrialRecording.startRecording(
      meetingId,
      meeting.CaseId,
      adminId
    );

    await Admin.logAdminAction(
      adminId,
      "start_recording",
      "trial",
      meetingId,
      `Started recording for case ${meeting.CaseId}`,
      req.ip
    );

    res.json({
      success: true,
      message: "Recording started successfully",
      recordingId,
    });
  } catch (error) {
    console.error("Error starting recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start recording",
      error: error.message,
    });
  }
});

router.post("/trials/:meetingId/recording/stop", async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid meeting ID is required",
      });
    }

    const recording = await TrialRecording.getActiveRecording(meetingId);
    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "No active recording found",
      });
    }

    await TrialRecording.stopRecording(recording.RecordingId);

    const adminId = req.user?.id || req.user?.userId || 1;
    await Admin.logAdminAction(
      adminId,
      "stop_recording",
      "trial",
      meetingId,
      `Stopped recording ${recording.RecordingId}`,
      req.ip
    );

    res.json({
      success: true,
      message: "Recording stopped successfully",
    });
  } catch (error) {
    console.error("Error stopping recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop recording",
      error: error.message,
    });
  }
});

router.get("/trials/:meetingId/recording/status", async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid meeting ID is required",
      });
    }

    const isRecording = await TrialRecording.isRecording(meetingId);
    const activeRecording = isRecording
      ? await TrialRecording.getActiveRecording(meetingId)
      : null;

    res.json({
      success: true,
      isRecording,
      recording: activeRecording,
    });
  } catch (error) {
    console.error("Error getting recording status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recording status",
      error: error.message,
    });
  }
});

router.get("/cases/:caseId/recordings", async (req, res) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId) || caseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid case ID is required",
      });
    }

    const recordings = await TrialRecording.getRecordingsByCase(caseId);

    res.json({
      success: true,
      recordings,
    });
  } catch (error) {
    console.error("Error fetching recordings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recordings",
      error: error.message,
    });
  }
});

// ============================================
// Witness Management Routes (Admin)
// ============================================

/**
 * Delete a witness (Admin only)
 * DELETE /api/admin/witnesses/:witnessId
 */
router.delete("/witnesses/:witnessId", async (req, res) => {
  try {
    const witnessId = parseInt(req.params.witnessId, 10);

    if (isNaN(witnessId) || witnessId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid witness ID is required",
      });
    }

    const pool = await poolPromise;

    // Check if witness exists
    const checkResult = await pool
      .request()
      .input("witnessId", sql.Int, witnessId)
      .query("SELECT WitnessId FROM dbo.CaseWitnesses WHERE WitnessId = @witnessId");

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Witness not found",
      });
    }

    // Delete the witness
    await pool
      .request()
      .input("witnessId", sql.Int, witnessId)
      .query("DELETE FROM dbo.CaseWitnesses WHERE WitnessId = @witnessId");

    res.json({
      success: true,
      message: "Witness deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting witness (admin):", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete witness",
      error: error.message,
    });
  }
});

/**
 * Delete a juror application (Admin only)
 * DELETE /api/admin/juror-applications/:applicationId
 */
router.delete("/juror-applications/:applicationId", async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId, 10);

    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid application ID is required",
      });
    }

    const pool = await poolPromise;

    // Check if application exists
    const checkResult = await pool
      .request()
      .input("applicationId", sql.Int, applicationId)
      .query("SELECT ApplicationId FROM dbo.JurorApplications WHERE ApplicationId = @applicationId");

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Juror application not found",
      });
    }

    // Delete the juror application
    await pool
      .request()
      .input("applicationId", sql.Int, applicationId)
      .query("DELETE FROM dbo.JurorApplications WHERE ApplicationId = @applicationId");

    res.json({
      success: true,
      message: "Juror application deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting juror application (admin):", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete juror application",
      error: error.message,
    });
  }
});

// ============================================
// Trial Incident Routes
// ============================================

router.post("/trials/:meetingId/incidents", async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid meeting ID is required",
      });
    }

    const { participantId, incidentType, description, actionTaken, severity } =
      req.body;

    if (!incidentType || !description) {
      return res.status(400).json({
        success: false,
        message: "Incident type and description are required",
      });
    }

    const adminId = req.user?.id || req.user?.userId || 1;

    const incidentId = await TrialIncident.reportIncident({
      meetingId,
      participantId,
      reportedBy: adminId,
      incidentType,
      description,
      actionTaken,
      severity: severity || "medium",
    });

    await Admin.logAdminAction(
      adminId,
      "report_incident",
      "trial",
      meetingId,
      `Reported ${incidentType} incident`,
      req.ip
    );

    res.json({
      success: true,
      message: "Incident reported successfully",
      incidentId,
    });
  } catch (error) {
    console.error("Error reporting incident:", error);
    res.status(500).json({
      success: false,
      message: "Failed to report incident",
      error: error.message,
    });
  }
});

router.get("/trials/:meetingId/incidents", async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid meeting ID is required",
      });
    }

    const incidents = await TrialIncident.getIncidentsByMeeting(meetingId);
    const stats = await TrialIncident.getIncidentStats(meetingId);

    res.json({
      success: true,
      incidents,
      stats,
    });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch incidents",
      error: error.message,
    });
  }
});

// ============================================
// Participant Control Routes
// ============================================

router.post(
  "/trials/:meetingId/participants/:participantId/mute",
  async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId, 10);
      const participantId = parseInt(req.params.participantId, 10);

      if (isNaN(meetingId) || isNaN(participantId)) {
        return res.status(400).json({
          success: false,
          message: "Valid meeting ID and participant ID are required",
        });
      }

      const adminId = req.user?.id || req.user?.userId || 1;
      const pool = await poolPromise;

      await pool
        .request()
        .input("participantId", sql.Int, participantId)
        .input("adminId", sql.Int, adminId).query(`
        UPDATE dbo.TrialParticipants
        SET IsMuted = 1, MutedBy = @adminId, MutedAt = GETUTCDATE()
        WHERE ParticipantId = @participantId
      `);

      await Admin.logAdminAction(
        adminId,
        "mute_participant",
        "trial",
        meetingId,
        `Muted participant ${participantId}`,
        req.ip
      );

      res.json({
        success: true,
        message: "Participant muted successfully",
      });
    } catch (error) {
      console.error("Error muting participant:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mute participant",
        error: error.message,
      });
    }
  }
);

router.post(
  "/trials/:meetingId/participants/:participantId/unmute",
  async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId, 10);

      if (isNaN(participantId)) {
        return res.status(400).json({
          success: false,
          message: "Valid participant ID is required",
        });
      }

      const pool = await poolPromise;
      await pool.request().input("participantId", sql.Int, participantId)
        .query(`
        UPDATE dbo.TrialParticipants
        SET IsMuted = 0, MutedBy = NULL, MutedAt = NULL
        WHERE ParticipantId = @participantId
      `);

      res.json({
        success: true,
        message: "Participant unmuted successfully",
      });
    } catch (error) {
      console.error("Error unmuting participant:", error);
      res.status(500).json({
        success: false,
        message: "Failed to unmute participant",
        error: error.message,
      });
    }
  }
);

router.post(
  "/trials/:meetingId/participants/:participantId/remove",
  async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId, 10);
      const participantId = parseInt(req.params.participantId, 10);
      const { reason } = req.body;

      if (isNaN(meetingId) || isNaN(participantId)) {
        return res.status(400).json({
          success: false,
          message: "Valid meeting ID and participant ID are required",
        });
      }

      const adminId = req.user?.id || req.user?.userId || 1;
      const pool = await poolPromise;

      await pool
        .request()
        .input("participantId", sql.Int, participantId)
        .input("adminId", sql.Int, adminId)
        .input("reason", sql.NVarChar, reason || "Removed by admin").query(`
        UPDATE dbo.TrialParticipants
        SET IsRemoved = 1, 
            RemovedBy = @adminId, 
            RemovedAt = GETUTCDATE(),
            RemovalReason = @reason,
            LeftAt = GETUTCDATE()
        WHERE ParticipantId = @participantId
      `);

      await Admin.logAdminAction(
        adminId,
        "remove_participant",
        "trial",
        meetingId,
        `Removed participant ${participantId}: ${reason}`,
        req.ip
      );

      res.json({
        success: true,
        message: "Participant removed successfully",
      });
    } catch (error) {
      console.error("Error removing participant:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove participant",
        error: error.message,
      });
    }
  }
);

// ============================================
// Attorney Management Routes
// ============================================

router.get("/attorneys", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    console.log("Fetching attorneys - Page:", page, "Limit:", limit);

    const result = await Attorney.getAllAttorneys(page, limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching attorneys:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attorneys",
      error: error.message,
    });
  }
});

router.get("/attorneys/pending", getAttorneysPendingVerification);
router.post("/attorneys/:attorneyId/verify", verifyAttorney);

router.post("/attorneys/:id/verify", async (req, res) => {
  try {
    const attorneyId = parseInt(req.params.id, 10);

    if (isNaN(attorneyId) || attorneyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid attorney ID is required",
      });
    }

    await Attorney.updateVerificationStatus(attorneyId, "verified");

    res.json({
      success: true,
      message: "Attorney verified successfully",
    });
  } catch (error) {
    console.error("Error verifying attorney:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify attorney",
      error: error.message,
    });
  }
});

// ============================================
// Juror Management Routes
// ============================================

router.get("/jurors", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    console.log("Fetching jurors - Page:", page, "Limit:", limit);

    const result = await Juror.getAllJurors({ page, limit });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching jurors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch jurors",
      error: error.message,
    });
  }
});

router.get("/jurors/pending", getJurorsPendingVerification);
router.post("/jurors/:jurorId/verify", verifyJuror);

router.post("/jurors/:id/verify", async (req, res) => {
  try {
    const jurorId = parseInt(req.params.id, 10);

    if (isNaN(jurorId) || jurorId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid juror ID is required",
      });
    }

    await Juror.updateVerificationStatus(jurorId, "verified");

    res.json({
      success: true,
      message: "Juror verified successfully",
    });
  } catch (error) {
    console.error("Error verifying juror:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify juror",
      error: error.message,
    });
  }
});

// ============================================
// Schedule Management Routes
// ============================================

router.get("/schedule", getAdminSchedule);
router.put("/schedule", updateSchedule);

module.exports = router;
