// =============================================
// adminController.js - Admin Case Management
// =============================================

const Case = require("../models/Case");
const JurorApplication = require("../models/JurorApplication");
const Event = require("../models/Event");
const Notification = require("../models/Notification");
const Attorney = require("../models/Attorney");
const Juror = require("../models/Juror");
const AdminCalendar = require("../models/AdminCalendar");
const CaseReschedule = require("../models/CaseReschedule");

/**
 * Get cases pending admin approval
 */
async function getCasesPendingApproval(req, res) {
  try {
    const pendingCases = await Case.getCasesPendingAdminApproval();

    res.json({
      success: true,
      pendingCases,
    });
  } catch (error) {
    console.error("Get pending cases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve pending cases",
    });
  }
}

/**
 * Approve or reject case with structured rejection reasons
 * FIXED: Added req.user null checks and better error handling
 */
async function reviewCaseApproval(req, res) {
  try {
    const { caseId } = req.params;
    const {
      decision,
      rejectionReason,
      comments,
      suggestedSlots,
    } = req.body;

    // FIXED: Defensive check for req.user
    const adminId = req.user?.id || 1; // Fallback to 1 if not authenticated

    // Validate decision
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be 'approved' or 'rejected'",
      });
    }

    // Get case data
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    if (decision === "approved") {
      // APPROVAL FLOW
      // Convert ScheduledTime to HH:MM:SS string (handle both Date objects and strings with microseconds)
      let timeString;

      if (caseData.ScheduledTime instanceof Date) {
        // If it's a Date object, extract time components
        timeString = `${String(caseData.ScheduledTime.getHours()).padStart(2, '0')}:${String(caseData.ScheduledTime.getMinutes()).padStart(2, '0')}:${String(caseData.ScheduledTime.getSeconds()).padStart(2, '0')}`;
      } else if (typeof caseData.ScheduledTime === 'string') {
        // If it's a string, strip microseconds and validate format
        // Format from DB: '03:30:00.0000000' or '03:30:00'
        timeString = caseData.ScheduledTime.split('.')[0]; // Remove microseconds

        // Ensure it's in HH:MM:SS format
        const timeParts = timeString.split(':');
        if (timeParts.length === 3) {
          timeString = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`;
        } else {
          throw new Error(`Invalid time format from database: ${caseData.ScheduledTime}`);
        }
      } else {
        throw new Error(`Unexpected ScheduledTime type: ${typeof caseData.ScheduledTime}`);
      }

      console.log(`🕐 Converting ScheduledTime for calendar block:`, {
        original: caseData.ScheduledTime,
        type: typeof caseData.ScheduledTime,
        isDate: caseData.ScheduledTime instanceof Date,
        converted: timeString
      });

      // Try to block the time slot in admin calendar
      try {
        await AdminCalendar.blockSlotForCase(
          caseId,
          caseData.ScheduledDate.toISOString().split("T")[0],
          timeString
        );
      } catch (blockError) {
        // Handle slot already blocked error gracefully
        if (blockError.message && blockError.message.includes("already blocked")) {
          console.log(`⚠️ Time slot already blocked for case ${caseId}, triggering reschedule flow`);

          // ✅ FIX: Set RescheduleRequired flag in Cases table
          // Note: Using empty array as attorney needs to pick their own slot
          await Case.requestReschedule(caseId, adminId, []);

          // Create reschedule request instead of failing
          await CaseReschedule.createRescheduleRequest({
            caseId,
            rejectionReason: "scheduling_conflict",
            adminComments: "The selected time slot is no longer available. Please choose a different time slot.",
            suggestedSlots: [], // Attorney will need to pick a new slot
          });

          // Notify attorney that rescheduling is needed
          await Notification.createNotification({
            userId: caseData.AttorneyId,
            userType: "attorney",
            caseId,
            type: "case_reschedule_needed",
            title: "Case Needs Rescheduling",
            message: `Your case "${caseData.CaseTitle}" cannot be scheduled at the requested time as the slot is already taken. Please select a different time slot.`,
          });

          // Create event for scheduling conflict
          await Event.createEvent({
            caseId,
            eventType: Event.EVENT_TYPES.ADMIN_REJECTED,
            description: `Scheduling conflict detected - slot already blocked. Attorney notified to reschedule.`,
            triggeredBy: adminId,
            userType: "admin",
          });

          return res.json({
            success: true,
            message: "Scheduling conflict detected. Attorney has been notified to reschedule.",
            decision: "reschedule_requested",
            reason: "Time slot already taken",
            caseStatus: "pending", // Case stays pending until rescheduled
          });
        } else {
          // Other errors should still fail
          throw blockError;
        }
      }

      // If we get here, slot was successfully blocked - proceed with approval
      // Update case status
      await Case.updateCaseStatus(caseId, {
        adminApprovalStatus: "approved",
        adminComments: comments || "Case approved by admin",
        juryChargeStatus: "pending", // Default to pending when approved
      });

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.ADMIN_APPROVED,
        description: `Case approved by admin`,
        triggeredBy: adminId,
        userType: "admin",
      });

      // Notify attorney
      await Notification.createNotification({
        userId: caseData.AttorneyId,
        userType: "attorney",
        caseId,
        type: Notification.NOTIFICATION_TYPES.CASE_APPROVED,
        title: "Case Approved",
        message: `Your case "${caseData.CaseTitle}" has been approved and is now open for juror applications.`,
      });

      return res.json({
        success: true,
        message: "Case approved successfully",
        decision: "approved",
      });
    } else {
      // REJECTION FLOW
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
      }

      // ✅ OPTION 1: Scheduling conflict keeps status as "pending"
      // Other rejection reasons change status to "rejected"
      const isSchedulingConflict = rejectionReason === "scheduling_conflict" &&
                                   suggestedSlots &&
                                   suggestedSlots.length > 0;

      const { poolPromise } = require("../config/db");
      const pool = await poolPromise;

      // Update case - status stays "pending" for scheduling conflicts, "rejected" for others
      await pool
        .request()
        .input("caseId", caseId)
        .input("adminApprovalStatus", isSchedulingConflict ? "pending" : "rejected")
        .input("rejectionReason", rejectionReason)
        .input("comments", comments || "").query(`
          UPDATE dbo.Cases
          SET
            AdminApprovalStatus = @adminApprovalStatus,
            RejectionReason = @rejectionReason,
            AdminComments = @comments,
            UpdatedAt = GETUTCDATE()
          WHERE CaseId = @caseId
        `);

      // If scheduling conflict, create reschedule request
      if (isSchedulingConflict) {
        // ✅ FIX: Set RescheduleRequired flag in Cases table
        await Case.requestReschedule(caseId, adminId, suggestedSlots);

        // Create reschedule request record
        await CaseReschedule.createRescheduleRequest({
          caseId,
          rejectionReason,
          adminComments: comments,
          suggestedSlots,
        });

        // Notify attorney with reschedule options
        await Notification.createNotification({
          userId: caseData.AttorneyId,
          userType: "attorney",
          caseId,
          type: "case_reschedule_needed",
          title: "Case Needs Rescheduling",
          message: `Your case "${caseData.CaseTitle}" conflicts with my schedule. Please review the suggested alternative time slots.`,
        });

        // Create event for scheduling conflict (not a full rejection)
        await Event.createEvent({
          caseId,
          eventType: Event.EVENT_TYPES.ADMIN_REJECTED,
          description: `Admin requested reschedule: ${rejectionReason}`,
          triggeredBy: adminId,
          userType: "admin",
        });

        return res.json({
          success: true,
          message: "Reschedule request sent to attorney. Case stays pending until attorney responds.",
          decision: "reschedule_requested",
          rejectionReason,
          caseStatus: "pending", // ✅ Case stays pending
        });
      } else {
        // Other rejection reasons - this is a FINAL rejection
        await Notification.createNotification({
          userId: caseData.AttorneyId,
          userType: "attorney",
          caseId,
          type: Notification.NOTIFICATION_TYPES.CASE_REJECTED,
          title: "Case Rejected",
          message: `Your case "${
            caseData.CaseTitle
          }" was rejected. Reason: ${getRejectionReasonText(
            rejectionReason
          )}. ${comments ? "Details: " + comments : ""}`,
        });

        // Create event for final rejection
        await Event.createEvent({
          caseId,
          eventType: Event.EVENT_TYPES.ADMIN_REJECTED,
          description: `Case rejected: ${rejectionReason}`,
          triggeredBy: adminId,
          userType: "admin",
        });

        return res.json({
          success: true,
          message: "Case rejected successfully",
          decision: "rejected",
          rejectionReason,
          caseStatus: "rejected", // ✅ Case is fully rejected
        });
      }
    }
  } catch (error) {
    console.error("Review case approval error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process case approval",
      error: error.message,
    });
  }
}

/**
 * Get all cases with filtering for admin dashboard
 * FIXED: Use Case.getAllCases() with timezone conversion
 */
async function getAllCases(req, res) {
  try {
    const { page = 1, limit = 20, adminApprovalStatus, attorneyStatus } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
    };

    if (adminApprovalStatus) {
      options.adminApprovalStatus = adminApprovalStatus;
    }

    if (attorneyStatus) {
      options.attorneyStatus = attorneyStatus;
    }

    // Use Case.getAllCases which has timezone conversion built in
    const result = await Case.getAllCases(options);

    res.json({
      success: true,
      cases: result.cases,
      totalCases: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Get all cases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve cases",
    });
  }
}

/**
 * Get case details for admin
 */
async function getCaseDetailsForAdmin(req, res) {
  try {
    const { caseId } = req.params;

    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // Get all related data
    const applications = await JurorApplication.getApplicationsByCase(caseId);
    const events = await Event.getEventsByCase(caseId);

    res.json({
      success: true,
      case: caseData,
      applications,
      events,
      applicationStats: {
        total: applications.length,
        pending: applications.filter((app) => app.Status === "pending").length,
        approved: applications.filter((app) => app.Status === "approved")
          .length,
        rejected: applications.filter((app) => app.Status === "rejected")
          .length,
      },
    });
  } catch (error) {
    console.error("Get case details for admin error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve case details",
    });
  }
}

/**
 * Get attorneys pending verification
 */
async function getAttorneysPendingVerification(req, res) {
  try {
    const { attorneys } = await Attorney.getAllAttorneys(1, 100);
    const pendingVerification = attorneys.filter(
      (attorney) => !attorney.IsVerified
    );

    res.json({
      success: true,
      attorneys: pendingVerification,
    });
  } catch (error) {
    console.error("Get attorneys pending verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve attorneys pending verification",
    });
  }
}

/**
 * Verify or decline attorney
 * FIXED: Better error handling for email sending failures
 */
async function verifyAttorney(req, res) {
  try {
    const { attorneyId } = req.params;
    const { status = "verified", comments } = req.body;

    // Get attorney details before updating
    const attorney = await Attorney.findById(attorneyId);
    if (!attorney) {
      return res.status(404).json({
        success: false,
        message: "Attorney not found",
      });
    }

    if (status === "declined") {
      // Deactivate the attorney account
      await Attorney.deactivateAttorney(attorneyId);

      // Send decline email with reason - with error handling
      try {
        const { sendAccountDeclinedEmail } = require("../utils/email");
        await sendAccountDeclinedEmail(
          attorney.Email,
          "attorney",
          comments || "Your application did not meet our current requirements."
        );
      } catch (emailError) {
        console.error("Failed to send decline email:", emailError);
        // Continue anyway - account is still declined
      }

      // Create notification
      await Notification.createNotification({
        userId: parseInt(attorneyId),
        userType: "attorney",
        type: "verification_rejected",
        title: "Account Declined",
        message: `Your attorney account has been declined. ${
          comments ? "Reason: " + comments : ""
        }`,
      });

      return res.json({
        success: true,
        message: "Attorney declined and notified successfully",
      });
    } else {
      // Verify the attorney
      await Attorney.updateVerificationStatus(attorneyId, status);

      // Send verification success email - with error handling
      try {
        const { sendAccountVerifiedEmail } = require("../utils/email");
        await sendAccountVerifiedEmail(attorney.Email, "attorney");
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue anyway - account is still verified
      }

      // Notify attorney of verification
      await Notification.createNotification({
        userId: parseInt(attorneyId),
        userType: "attorney",
        type: "verification_approved",
        title: "Account Verified",
        message:
          "Your attorney account has been verified. You can now access all platform features.",
      });

      return res.json({
        success: true,
        message: "Attorney verified successfully",
      });
    }
  } catch (error) {
    console.error("Verify attorney error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify attorney",
    });
  }
}

/**
 * Get jurors pending verification
 */
async function getJurorsPendingVerification(req, res) {
  try {
    const { jurors } = await Juror.getAllJurors(1, 100);
    const pendingVerification = jurors.filter((juror) => !juror.IsVerified);

    res.json({
      success: true,
      jurors: pendingVerification,
    });
  } catch (error) {
    console.error("Get jurors pending verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve jurors pending verification",
    });
  }
}

/**
 * Verify or decline juror
 * FIXED: Better error handling for email sending failures
 */
async function verifyJuror(req, res) {
  try {
    const { jurorId } = req.params;
    const { status = "verified", comments } = req.body;

    // Get juror details before updating
    const juror = await Juror.findById(jurorId);
    if (!juror) {
      return res.status(404).json({
        success: false,
        message: "Juror not found",
      });
    }

    if (status === "declined") {
      // Deactivate the juror account
      await Juror.deactivateJuror(jurorId);

      // Send decline email with reason - with error handling
      try {
        const { sendAccountDeclinedEmail } = require("../utils/email");
        await sendAccountDeclinedEmail(
          juror.Email,
          "juror",
          comments || "Your application did not meet our current requirements."
        );
      } catch (emailError) {
        console.error("Failed to send decline email:", emailError);
        // Continue anyway - account is still declined
      }

      // Create notification
      await Notification.createNotification({
        userId: parseInt(jurorId),
        userType: "juror",
        type: "verification_rejected",
        title: "Account Declined",
        message: `Your juror account has been declined. ${
          comments ? "Reason: " + comments : ""
        }`,
      });

      return res.json({
        success: true,
        message: "Juror declined and notified successfully",
      });
    } else {
      // Verify the juror
      await Juror.updateVerificationStatus(jurorId, status);

      // Send verification success email - with error handling
      try {
        const { sendAccountVerifiedEmail } = require("../utils/email");
        await sendAccountVerifiedEmail(juror.Email, "juror");
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue anyway - account is still verified
      }

      // Notify juror of verification
      await Notification.createNotification({
        userId: parseInt(jurorId),
        userType: "juror",
        type: "verification_approved",
        title: "Account Verified",
        message:
          "Your juror account has been verified. You can now apply to cases.",
      });

      return res.json({
        success: true,
        message: "Juror verified successfully",
      });
    }
  } catch (error) {
    console.error("Verify juror error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify juror",
    });
  }
}

/**
 * Get admin dashboard data
 */
async function getAdminDashboard(req, res) {
  try {
    // Get overview statistics
    const pendingCases = await Case.getCasesPendingAdminApproval();
    const { attorneys } = await Attorney.getAllAttorneys(1, 100);
    const { jurors } = await Juror.getAllJurors(1, 100);
    const recentEvents = await Event.getRecentEvents(10);

    const stats = {
      pendingCases: pendingCases.length,
      totalAttorneys: attorneys.length,
      verifiedAttorneys: attorneys.filter((a) => a.IsVerified).length,
      totalJurors: jurors.length,
      verifiedJurors: jurors.filter((j) => j.IsVerified).length,
      recentActivity: recentEvents.length,
    };

    res.json({
      success: true,
      stats,
      pendingCases: pendingCases, // Show ALL pending cases for admin review
      recentEvents: recentEvents.slice(0, 5), // Latest 5 for dashboard
    });
  } catch (error) {
    console.error("Get admin dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard data",
    });
  }
}

/**
 * Get system analytics
 */
async function getSystemAnalytics(req, res) {
  try {
    const { days = 30 } = req.query;

    const eventStats = await Event.getEventStatistics(days);
    const notificationStats = await Notification.getNotificationStatistics(
      days
    );

    res.json({
      success: true,
      analytics: {
        timeframe: `${days} days`,
        eventStatistics: eventStats,
        notificationStatistics: notificationStats,
      },
    });
  } catch (error) {
    console.error("Get system analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve analytics",
    });
  }
}

/**
 * Get admin schedule (placeholder for future scheduling feature)
 */
async function getAdminSchedule(req, res) {
  try {
    // For now, return a simple schedule - can be enhanced later
    const schedule = {
      today: [],
      upcoming: [],
      availability: "available",
    };

    res.json({
      success: true,
      schedule,
    });
  } catch (error) {
    console.error("Get admin schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve schedule",
    });
  }
}

/**
 * Update admin schedule (placeholder for future scheduling feature)
 */
async function updateSchedule(req, res) {
  try {
    // Placeholder for schedule updates
    res.json({
      success: true,
      message: "Schedule updated successfully",
    });
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update schedule",
    });
  }
}

/**
 * Helper function to convert rejection reason codes to readable text
 */
function getRejectionReasonText(reason) {
  const reasons = {
    scheduling_conflict: "Scheduling conflict - I'm unavailable at this time",
    invalid_case_details:
      "Invalid case details - Information is incomplete or inappropriate",
    missing_documentation:
      "Missing documentation - Required documents not provided",
    jurisdictional_issues:
      "Jurisdictional issues - Case outside platform scope",
    duplicate_submission: "Duplicate submission - This case already exists",
    insufficient_lead_time: "Insufficient lead time - Trial date too soon",
    other: "Other reason",
  };
  return reasons[reason] || reason;
}

module.exports = {
  // Case management
  getCasesPendingApproval,
  reviewCaseApproval,
  getAllCases,
  getCaseDetailsForAdmin,

  // User verification
  getAttorneysPendingVerification,
  verifyAttorney,
  getJurorsPendingVerification,
  verifyJuror,

  // Dashboard and analytics
  getAdminDashboard,
  getSystemAnalytics,

  // Schedule management (placeholder)
  getAdminSchedule,
  updateSchedule,

  // Helper
  getRejectionReasonText,
};
