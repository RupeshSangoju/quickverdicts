// =============================================
// jurorApplicationController.js - Juror Application Management
// FIXED: Added defensive programming, safe JSON parsing, better error handling
// =============================================

const JurorApplication = require("../models/JurorApplication");
const Case = require("../models/Case");
const Event = require("../models/Event");
const Notification = require("../models/Notification");

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Safe JSON parse with fallback
 * FIXED: Added error handling for JSON parsing
 */
function safeJSONParse(jsonString, fallback = []) {
  try {
    if (!jsonString) return fallback;
    const parsed = JSON.parse(jsonString);
    return parsed || fallback;
  } catch (error) {
    console.error("JSON parse error:", error);
    return fallback;
  }
}

/**
 * Verify attorney owns case
 * FIXED: Centralized authorization check
 */
async function verifyAttorneyOwnsCase(caseId, attorneyId) {
  const caseData = await Case.findById(caseId);

  if (!caseData) {
    return { authorized: false, error: "Case not found", caseData: null };
  }

  if (caseData.AttorneyId !== attorneyId) {
    return {
      authorized: false,
      error: "Access denied - you do not own this case",
      caseData: null,
    };
  }

  return { authorized: true, error: null, caseData };
}

// ============================================
// APPLICATION MANAGEMENT
// ============================================

/**
 * Get juror applications for a specific case (Attorney War Room)
 * FIXED: Added defensive checks and safe JSON parsing
 */
async function getApplicationsForCase(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const attorneyId = req.user.id;
    const { status } = req.query; // 'pending', 'approved', 'rejected', or all

    // Verify attorney owns this case
    const { authorized, error, caseData } = await verifyAttorneyOwnsCase(
      caseId,
      attorneyId
    );
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: error,
      });
    }

    const applications = await JurorApplication.getApplicationsByCase(
      caseId,
      status
    );

    // FIXED: Safe JSON parsing
    const applicationsWithParsedResponses = applications.map((app) => ({
      ...app,
      VoirDire1Responses: safeJSONParse(app.VoirDire1Responses, []),
      VoirDire2Responses: safeJSONParse(app.VoirDire2Responses, []),
    }));

    res.json({
      success: true,
      applications: applicationsWithParsedResponses,
      totalCount: applications.length,
      pendingCount: applications.filter((app) => app.Status === "pending")
        .length,
      approvedCount: applications.filter((app) => app.Status === "approved")
        .length,
      rejectedCount: applications.filter((app) => app.Status === "rejected")
        .length,
    });
  } catch (error) {
    console.error("Get applications for case error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve applications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Review juror application (Approve/Reject)
 * FIXED: Added defensive checks and strict equality
 */
async function reviewApplication(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId, applicationId } = req.params;
    const { decision, comments } = req.body;
    const attorneyId = req.user.id;

    // Validate decision
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be either "approved" or "rejected"',
      });
    }

    // Verify attorney owns this case
    const { authorized, error, caseData } = await verifyAttorneyOwnsCase(
      caseId,
      attorneyId
    );
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: error,
      });
    }

    // Get application details
    const application = await JurorApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // FIXED: Use strict equality
    if (parseInt(application.CaseId) !== parseInt(caseId)) {
      return res.status(400).json({
        success: false,
        message: "Application does not belong to this case",
      });
    }

    // Check if application is already processed
    if (application.Status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Application has already been ${application.Status}`,
      });
    }

    // Check if we already have enough approved jurors (for approvals only)
    if (decision === "approved") {
      const currentApprovedCount = await Case.getApprovedJurorsCount(caseId);
      if (currentApprovedCount >= caseData.RequiredJurors) {
        return res.status(400).json({
          success: false,
          message: `Case already has the required ${caseData.RequiredJurors} jurors`,
        });
      }
    }

    // Update application status
    await JurorApplication.updateApplicationStatus(
      applicationId,
      decision,
      attorneyId,
      comments
    );

    // Create event and notification in parallel
    await Promise.all([
      Event.createEvent({
        caseId,
        eventType:
          decision === "approved"
            ? Event.EVENT_TYPES.JUROR_APPROVED
            : Event.EVENT_TYPES.JUROR_REJECTED,
        description: `Juror application ${decision}${
          comments ? ": " + comments : ""
        }`,
        triggeredBy: attorneyId,
        userType: "attorney",
        metadata: { jurorId: application.JurorId, applicationId },
      }),
      Notification.createNotification({
        userId: application.JurorId,
        userType: "juror",
        caseId,
        type:
          decision === "approved"
            ? Notification.NOTIFICATION_TYPES.APPLICATION_APPROVED
            : Notification.NOTIFICATION_TYPES.APPLICATION_REJECTED,
        title: `Application ${
          decision === "approved" ? "Approved" : "Rejected"
        }`,
        message:
          decision === "approved"
            ? `Congratulations! You've been selected for the case "${caseData.CaseTitle}".`
            : `Your application for case "${
                caseData.CaseTitle
              }" was not selected.${comments ? " Reason: " + comments : ""}`,
      }),
    ]);

    // Check if case now has enough jurors to proceed
    const newApprovedCount = await Case.getApprovedJurorsCount(caseId);
    const canProceedToTrial = newApprovedCount >= caseData.RequiredJurors;

    res.json({
      success: true,
      message: `Application ${decision} successfully`,
      decision,
      canProceedToTrial,
      approvedJurorsCount: newApprovedCount,
      requiredJurors: caseData.RequiredJurors,
    });
  } catch (error) {
    console.error("Review application error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get voir dire questions for case application
 * FIXED: Added safe JSON parsing
 */
async function getVoirDireQuestions(req, res) {
  try {
    const { caseId } = req.params;

    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // FIXED: Safe JSON parsing
    const voirDire1Questions = safeJSONParse(caseData.VoirDire1Questions, []);
    const voirDire2Questions = safeJSONParse(caseData.VoirDire2Questions, []);

    res.json({
      success: true,
      voirDire1Questions,
      voirDire2Questions,
      caseTitle: caseData.CaseTitle,
    });
  } catch (error) {
    console.error("Get voir dire questions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve questions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Bulk approve/reject applications
 * FIXED: Better error handling and validation
 */
async function bulkReviewApplications(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const { applicationIds, decision, comments } = req.body;
    const attorneyId = req.user.id;

    // Validate inputs
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Application IDs array is required and must not be empty",
      });
    }

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be either "approved" or "rejected"',
      });
    }

    // Verify attorney owns this case
    const { authorized, error, caseData } = await verifyAttorneyOwnsCase(
      caseId,
      attorneyId
    );
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: error,
      });
    }

    const results = {
      processed: 0,
      errors: [],
      skipped: [],
    };

    // Get current approved count once
    let currentApprovedCount = await Case.getApprovedJurorsCount(caseId);

    // Process each application
    for (const applicationId of applicationIds) {
      try {
        const application = await JurorApplication.findById(applicationId);

        // Validate application exists and belongs to case
        if (!application) {
          results.errors.push(`Application ${applicationId} not found`);
          continue;
        }

        // FIXED: Use strict equality
        if (parseInt(application.CaseId) !== parseInt(caseId)) {
          results.errors.push(
            `Application ${applicationId} does not belong to this case`
          );
          continue;
        }

        // Skip if already processed
        if (application.Status !== "pending") {
          results.skipped.push(
            `Application ${applicationId} already ${application.Status}`
          );
          continue;
        }

        // Check juror limits for approvals
        if (decision === "approved") {
          if (currentApprovedCount >= caseData.RequiredJurors) {
            results.errors.push(
              `Case already has enough jurors (stopped at application ${applicationId})`
            );
            break;
          }
        }

        // Update application
        await JurorApplication.updateApplicationStatus(
          applicationId,
          decision,
          attorneyId,
          comments
        );

        // Create event and notification in parallel
        await Promise.all([
          Event.createEvent({
            caseId,
            eventType:
              decision === "approved"
                ? Event.EVENT_TYPES.JUROR_APPROVED
                : Event.EVENT_TYPES.JUROR_REJECTED,
            description: `Juror application ${decision} (bulk action)${
              comments ? ": " + comments : ""
            }`,
            triggeredBy: attorneyId,
            userType: "attorney",
            metadata: {
              jurorId: application.JurorId,
              applicationId,
              bulkAction: true,
            },
          }),
          Notification.createNotification({
            userId: application.JurorId,
            userType: "juror",
            caseId,
            type:
              decision === "approved"
                ? Notification.NOTIFICATION_TYPES.APPLICATION_APPROVED
                : Notification.NOTIFICATION_TYPES.APPLICATION_REJECTED,
            title: `Application ${
              decision === "approved" ? "Approved" : "Rejected"
            }`,
            message:
              decision === "approved"
                ? `Congratulations! You've been selected for the case "${caseData.CaseTitle}".`
                : `Your application for case "${
                    caseData.CaseTitle
                  }" was not selected.${
                    comments ? " Reason: " + comments : ""
                  }`,
          }),
        ]);

        results.processed++;

        // Increment approved count if we approved this application
        if (decision === "approved") {
          currentApprovedCount++;
        }
      } catch (appError) {
        console.error(
          `Error processing application ${applicationId}:`,
          appError
        );
        results.errors.push(
          `Failed to process application ${applicationId}: ${appError.message}`
        );
      }
    }

    res.json({
      success: true,
      message: `Bulk ${decision} completed`,
      results,
      finalApprovedCount: currentApprovedCount,
      requiredJurors: caseData.RequiredJurors,
    });
  } catch (error) {
    console.error("Bulk review applications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process bulk review",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get application statistics for a case
 * FIXED: Added defensive checks
 */
async function getApplicationStatistics(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const attorneyId = req.user.id;

    // Verify attorney owns this case
    const { authorized, error, caseData } = await verifyAttorneyOwnsCase(
      caseId,
      attorneyId
    );
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: error,
      });
    }

    const applications = await JurorApplication.getApplicationsByCase(caseId);

    const statistics = {
      totalApplications: applications.length,
      pendingApplications: applications.filter(
        (app) => app.Status === "pending"
      ).length,
      approvedApplications: applications.filter(
        (app) => app.Status === "approved"
      ).length,
      rejectedApplications: applications.filter(
        (app) => app.Status === "rejected"
      ).length,
      requiredJurors: caseData.RequiredJurors || 7,
      canProceedToTrial:
        applications.filter((app) => app.Status === "approved").length >=
        (caseData.RequiredJurors || 7),
      applicationsByCounty: {},
    };

    // Group applications by county
    applications.forEach((app) => {
      const county = app.County || "Unknown";
      if (!statistics.applicationsByCounty[county]) {
        statistics.applicationsByCounty[county] = 0;
      }
      statistics.applicationsByCounty[county]++;
    });

    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    console.error("Get application statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve application statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get application details by ID
 * FIXED: Added defensive checks and safe JSON parsing
 */
async function getApplicationDetails(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { applicationId } = req.params;
    const attorneyId = req.user.id;

    const application = await JurorApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Verify attorney owns the case
    if (application.AttorneyId !== attorneyId) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you do not own this case",
      });
    }

    // FIXED: Safe JSON parsing
    const applicationWithParsedResponses = {
      ...application,
      VoirDire1Responses: safeJSONParse(application.VoirDire1Responses, []),
      VoirDire2Responses: safeJSONParse(application.VoirDire2Responses, []),
    };

    res.json({
      success: true,
      application: applicationWithParsedResponses,
    });
  } catch (error) {
    console.error("Get application details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve application details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  getApplicationsForCase,
  reviewApplication,
  getVoirDireQuestions,
  bulkReviewApplications,
  getApplicationStatistics,
  getApplicationDetails,
};
