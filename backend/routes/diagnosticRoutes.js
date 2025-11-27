// =============================================
// diagnosticRoutes.js - Diagnostic Endpoints for Troubleshooting
// =============================================

const express = require("express");
const router = express.Router();
const { poolPromise, sql } = require("../config/db");
const { authMiddleware } = require("../middleware/authMiddleware");

// Apply auth to all diagnostic routes
router.use(authMiddleware);

/**
 * GET /api/diagnostic/case/:caseId/trial-status
 * Check if a case is ready for trial and diagnose any issues
 */
router.get("/case/:caseId/trial-status", async (req, res) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid case ID",
      });
    }

    const pool = await poolPromise;
    const user = req.user;

    // Get case details
    const caseResult = await pool
      .request()
      .input("caseId", sql.Int, caseId).query(`
        SELECT
          CaseId,
          CaseTitle,
          AttorneyId,
          AttorneyStatus,
          AdminApprovalStatus,
          ScheduledDate,
          ScheduledTime,
          CreatedAt,
          UpdatedAt
        FROM dbo.Cases
        WHERE CaseId = @caseId AND IsDeleted = 0
      `);

    if (caseResult.recordset.length === 0) {
      return res.json({
        success: false,
        diagnosis: "CASE_NOT_FOUND",
        message: "Case does not exist or has been deleted",
        caseId,
      });
    }

    const caseData = caseResult.recordset[0];

    // Get trial meeting details
    const meetingResult = await pool
      .request()
      .input("caseId", sql.Int, caseId).query(`
        SELECT
          MeetingId,
          RoomId,
          ChatThreadId,
          ChatServiceUserId,
          Status,
          CreatedAt
        FROM dbo.TrialMeetings
        WHERE CaseId = @caseId
      `);

    const meetingData =
      meetingResult.recordset.length > 0
        ? meetingResult.recordset[0]
        : null;

    // Get juror application count
    const jurorResult = await pool
      .request()
      .input("caseId", sql.Int, caseId).query(`
        SELECT
          COUNT(*) as TotalApplicants,
          SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) as ApprovedCount
        FROM dbo.JurorApplications
        WHERE CaseId = @caseId
      `);

    const jurorStats = jurorResult.recordset[0];

    // Check user's access
    let userAccess = {
      canAccess: false,
      reason: "",
    };

    if (user.type === "admin") {
      userAccess = { canAccess: true, reason: "Admin has full access" };
    } else if (user.type === "attorney") {
      if (caseData.AttorneyId === user.id) {
        if (caseData.AttorneyStatus === "join_trial") {
          userAccess = {
            canAccess: true,
            reason: "Attorney owns case and trial is ready",
          };
        } else {
          userAccess = {
            canAccess: false,
            reason: `Case status is '${caseData.AttorneyStatus}', needs 'join_trial'`,
          };
        }
      } else {
        userAccess = {
          canAccess: false,
          reason: "You do not own this case",
        };
      }
    } else if (user.type === "juror") {
      const jurorAppResult = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("jurorId", sql.Int, user.id).query(`
          SELECT Status
          FROM dbo.JurorApplications
          WHERE CaseId = @caseId AND JurorId = @jurorId
        `);

      if (jurorAppResult.recordset.length === 0) {
        userAccess = {
          canAccess: false,
          reason: "You have not applied to this case",
        };
      } else {
        const appStatus = jurorAppResult.recordset[0].Status;
        if (appStatus === "approved") {
          if (caseData.AttorneyStatus === "join_trial") {
            userAccess = {
              canAccess: true,
              reason: "Juror is approved and trial is ready",
            };
          } else {
            userAccess = {
              canAccess: false,
              reason: `Approved but case status is '${caseData.AttorneyStatus}', needs 'join_trial'`,
            };
          }
        } else {
          userAccess = {
            canAccess: false,
            reason: `Application status is '${appStatus}', needs 'approved'`,
          };
        }
      }
    }

    // Determine overall readiness
    const issues = [];

    if (caseData.AdminApprovalStatus !== "approved") {
      issues.push(
        `Case not approved by admin (status: ${caseData.AdminApprovalStatus})`
      );
    }

    if (caseData.AttorneyStatus !== "join_trial") {
      issues.push(
        `Case attorney status is '${caseData.AttorneyStatus}', needs 'join_trial'`
      );
    }

    if (!meetingData) {
      issues.push("Trial meeting has not been created");
    } else {
      if (!meetingData.RoomId) {
        issues.push("ACS Room ID is missing");
      }
      if (!meetingData.ChatThreadId) {
        issues.push("Chat Thread ID is missing");
      }
      if (!meetingData.ChatServiceUserId) {
        issues.push("Chat Service User ID is missing");
      }
    }

    // ⚠️ DEVELOPMENT: Reduced to 1 juror for faster testing
    if (jurorStats.ApprovedCount < 1) {
      issues.push(
        `Not enough approved jurors (${jurorStats.ApprovedCount}/1 minimum)`
      );
    } else if (jurorStats.ApprovedCount > 7) {
      issues.push(
        `Too many approved jurors (${jurorStats.ApprovedCount}/7 maximum)`
      );
    }

    const isReady = issues.length === 0;

    return res.json({
      success: true,
      ready: isReady,
      case: {
        id: caseData.CaseId,
        title: caseData.CaseTitle,
        attorneyId: caseData.AttorneyId,
        status: caseData.AttorneyStatus,
        adminApproval: caseData.AdminApprovalStatus,
        scheduledDate: caseData.ScheduledDate,
        scheduledTime: caseData.ScheduledTime,
      },
      meeting: meetingData
        ? {
            id: meetingData.MeetingId,
            roomId: meetingData.RoomId,
            chatThreadId: meetingData.ChatThreadId,
            hasServiceUserId: !!meetingData.ChatServiceUserId,
            status: meetingData.Status,
            created: meetingData.CreatedAt,
          }
        : null,
      jurors: {
        total: jurorStats.TotalApplicants,
        approved: jurorStats.ApprovedCount,
      },
      currentUser: {
        id: user.id,
        type: user.type,
        email: user.email,
        access: userAccess,
      },
      issues: issues,
      diagnosis: isReady ? "READY" : "NOT_READY",
      recommendations: isReady
        ? ["Trial is ready to join!"]
        : generateRecommendations(issues, caseData, meetingData),
    });
  } catch (error) {
    console.error("❌ Diagnostic error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to run diagnostics",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * Generate recommendations based on issues
 */
function generateRecommendations(issues, caseData, meetingData) {
  const recommendations = [];

  issues.forEach((issue) => {
    if (issue.includes("not approved by admin")) {
      recommendations.push("Admin needs to approve the case first");
    } else if (issue.includes("attorney status")) {
      if (caseData.AttorneyStatus === "war_room") {
        recommendations.push("Submit the war room to proceed to trial");
      } else if (caseData.AttorneyStatus === "pending") {
        recommendations.push("Wait for admin to approve the case");
      }
    } else if (issue.includes("Trial meeting has not been created")) {
      recommendations.push(
        "Trial meeting needs to be created (should happen automatically on war room submission)"
      );
    } else if (issue.includes("ACS")) {
      recommendations.push(
        "Check ACS configuration and ensure trial meeting creation succeeded"
      );
    } else if (issue.includes("jurors")) {
      if (issue.includes("Not enough")) {
        recommendations.push(
          "Attorney needs to approve at least 1 juror (dev mode: minimum 1 required)"
        );
      } else if (issue.includes("Too many")) {
        recommendations.push(
          "Attorney needs to reject some jurors (maximum 7 allowed)"
        );
      }
    }
  });

  return recommendations;
}

module.exports = router;
