// =============================================
// caseController.js - Complete Case Management
// FIXED: Added defensive programming, better error handling, transaction support
// =============================================

const Case = require("../models/Case");
const JurorApplication = require("../models/JurorApplication");
const Event = require("../models/Event");
const Notification = require("../models/Notification");
const Verdict = require("../models/Verdict");
const Payment = require("../models/Payment");
const { poolPromise, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

// Standard Part 1 questions (hardcoded for all cases)
// TODO: Move to database configuration table
const VOIR_DIRE_PART_1 = [
  "Do you know or recognize any of the parties involved in this case?",
  "Have you or a close family member ever had a dispute similar to the one in this case?",
  "Do you have any personal or financial interest in the outcome of this case?",
  "Do you have any bias, either for or against one of the parties, that could affect your ability to decide this case fairly?",
  "Is there any reason—personal, emotional, or otherwise—that would prevent you from being fair and impartial in this case?",
  "Do you have any health, time, or other personal issues that would prevent you from fully attending and completing your role as a juror in this case?",
  "Do you believe you can listen to all the evidence presented and base your decision solely on the facts and the law, regardless of personal feelings?",
];

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
 * Get event type for state transition
 */
function getEventTypeForTransition(status) {
  switch (status) {
    case Case.ATTORNEY_CASE_STATES.JOIN_TRIAL:
      return Event.EVENT_TYPES.TRIAL_STARTED;
    case Case.ATTORNEY_CASE_STATES.VIEW_DETAILS:
      return Event.EVENT_TYPES.TRIAL_COMPLETED;
    default:
      return "status_change";
  }
}

// ============================================
// CASE MANAGEMENT (ATTORNEY)
// ============================================

/**
 * Create new case (Attorney submits case)
 * FIXED: Added defensive checks and transaction support
 */
async function createCase(req, res) {
  // FIXED: Defensive check for req.user
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const pool = await poolPromise;
  const transaction = pool.transaction();

  try {
    const attorneyId = req.user.id;
    const { voirDire2Questions, ...restOfBody } = req.body;

    console.log("=== CREATE CASE DEBUG ===");
    console.log("Attorney ID:", attorneyId);
    console.log("Request body received:", {
      caseType: restOfBody.caseType,
      caseJurisdiction: restOfBody.caseJurisdiction,
      caseTier: restOfBody.caseTier,
      state: restOfBody.state,
      county: restOfBody.county,
      caseTitle: restOfBody.caseTitle,
      scheduledDate: restOfBody.scheduledDate,
      scheduledTime: restOfBody.scheduledTime,
      scheduledTimeType: typeof restOfBody.scheduledTime,
      scheduledTimeLength: restOfBody.scheduledTime?.length,
      hasPlaintiffs: !!restOfBody.plaintiffGroups,
      hasDefendants: !!restOfBody.defendantGroups,
      voirDire2Count: Array.isArray(voirDire2Questions) ? voirDire2Questions.length : 0,
    });

    // CRITICAL: Validate and normalize scheduledTime IMMEDIATELY
    if (restOfBody.scheduledTime) {
      const trimmedTime = restOfBody.scheduledTime.trim();
      console.log(`⏰ Raw scheduledTime: "${restOfBody.scheduledTime}" → Trimmed: "${trimmedTime}"`);

      // Validate time format
      const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$/;
      if (!timeRegex.test(trimmedTime)) {
        console.error(`❌ Invalid time format: "${trimmedTime}"`);
        return res.status(400).json({
          success: false,
          message: `Invalid scheduledTime format: "${trimmedTime}". Expected HH:MM (e.g., 09:00, 14:30)`,
        });
      }

      // Normalize to HH:MM:SS format for SQL Server
      const timeParts = trimmedTime.split(':');
      let normalizedTime = trimmedTime;
      if (timeParts.length === 2) {
        normalizedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
      } else if (timeParts.length === 3) {
        normalizedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`;
      }

      console.log(`✅ Normalized scheduledTime: "${trimmedTime}" → "${normalizedTime}"`);
      restOfBody.scheduledTime = normalizedTime;
    }

    // Prepare case data
    const caseData = {
      ...restOfBody,
      attorneyId,
      voirDire1Questions: VOIR_DIRE_PART_1,
      voirDire2Questions: voirDire2Questions || [],
    };

    // Validate required fields with detailed checking
    const requiredFields = [
      "caseType",
      "caseJurisdiction",
      "caseTier",
      "state",
      "county",
      "caseTitle",
      "scheduledDate",
      "scheduledTime",
    ];

    const missingFields = requiredFields.filter((field) => {
      const value = caseData[field];
      const isMissing = !value ||
                        value === "null" ||
                        value === "undefined" ||
                        (typeof value === 'string' && value.trim() === "");

      if (isMissing) {
        console.error(`❌ Missing or invalid field: ${field} = ${JSON.stringify(value)}`);
      }

      return isMissing;
    });

    if (missingFields.length > 0) {
      console.error("❌ Case creation failed - missing fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        missingFields: missingFields,
      });
    }

    // FIXED: Start transaction
    await transaction.begin();

    try {
      // Create the case
      const caseId = await Case.createCase(caseData);
      console.log("Case created with ID:", caseId);

      // Insert Part 2 questions into WarRoomVoirDire table
      if (
        voirDire2Questions &&
        Array.isArray(voirDire2Questions) &&
        voirDire2Questions.length > 0
      ) {
        console.log(
          "Inserting",
          voirDire2Questions.length,
          "questions into WarRoomVoirDire"
        );

        for (const question of voirDire2Questions) {
          if (question && question.trim()) {
            console.log("Inserting question:", question);
            await transaction
              .request()
              .input("caseId", sql.Int, caseId)
              .input("question", sql.NVarChar, question.trim())
              .input("response", sql.NVarChar, "")
              .input("addedBy", sql.Int, attorneyId).query(`
                INSERT INTO WarRoomVoirDire (CaseId, Question, Response, AddedBy, AddedAt)
                VALUES (@caseId, @question, @response, @addedBy, GETUTCDATE())
              `);
          }
        }
        console.log("All questions inserted successfully");
      }

      // Create event for case creation
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_CREATED,
        description: `Case "${caseData.caseTitle}" created and submitted for admin approval`,
        triggeredBy: attorneyId,
        userType: "attorney",
        metadata: {
          caseType: caseData.caseType,
          caseJurisdiction: caseData.caseJurisdiction,
          state: caseData.state,
          county: caseData.county
        },
      });

      // FIXED: Commit transaction
      await transaction.commit();

      res.json({
        success: true,
        message: "Case created successfully and submitted for admin approval",
        caseId,
        status: Case.ATTORNEY_CASE_STATES.PENDING_ADMIN_APPROVAL,
      });
    } catch (error) {
      // FIXED: Rollback on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Create case error:", error);

    // Handle validation errors specifically
    if (error.code === "VALIDATION_ERROR") {
      return res.status(400).json({
        success: false,
        message: "Case validation failed",
        error: error.message,
        validationErrors: error.message.split(": ")[1]?.split(", ") || [],
      });
    }

    // Handle SQL errors
    if (error.code && error.code.startsWith('EREQUEST')) {
      return res.status(500).json({
        success: false,
        message: "Failed to create case",
        error: "Database error occurred. Please check your data and try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create case",
      error: process.env.NODE_ENV === "development" ? error.message : "An unexpected error occurred. Please try again.",
    });
  }
}

/**
 * Get cases for attorney dashboard with filtering
 * FIXED: Added pagination and defensive checks
 */
async function getAttorneyCases(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const attorneyId = req.user.id;
    const { status, page = 1, limit = 50 } = req.query;

    // FIXED: Add pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const cases = await Case.getCasesByAttorney(attorneyId, status);

    // Transform to match frontend expectations
    const transformedCases = cases.map((c) => ({
      Id: c.CaseId,
      PlaintiffGroups: c.PlaintiffGroups,
      DefendantGroups: c.DefendantGroups,
      ScheduledDate: c.ScheduledDate,
      ScheduledTime: c.ScheduledTime,
      attorneyEmail: req.user.email,
      CaseTitle: c.CaseTitle,
      AttorneyStatus: c.AttorneyStatus,
      AdminApprovalStatus: c.AdminApprovalStatus,
      RescheduleRequired: c.RescheduleRequired,
      AlternateSlots: c.AlternateSlots,
      OriginalScheduledDate: c.OriginalScheduledDate,
      OriginalScheduledTime: c.OriginalScheduledTime,
    }));

    // FIXED: Apply pagination
    const paginatedCases = transformedCases.slice(offset, offset + limitNum);

    res.json({
      success: true,
      cases: paginatedCases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: transformedCases.length,
        pages: Math.ceil(transformedCases.length / limitNum),
      },
    });
  } catch (error) {
    console.error("Get attorney cases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve cases",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get single case details for attorney
 * FIXED: Added defensive checks and better error handling
 */
async function getCaseDetails(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const attorneyId = req.user.id;

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
        message: "Access denied - you do not own this case",
      });
    }

    // Get related data in parallel
    const [applications, events] = await Promise.all([
      JurorApplication.getApplicationsByCase(caseId),
      Event.getEventsByCase(caseId),
    ]);

    // Get verdicts if case is in final stage
    let verdicts = [];
    let verdictSummary = null;
    if (caseData.AttorneyStatus === "view_details") {
      [verdicts, verdictSummary] = await Promise.all([
        Verdict.getVerdictsByCase(caseId, true),
        Verdict.getVerdictSummary(caseId),
      ]);
    }

    res.json({
      success: true,
      case: caseData,
      applications,
      events,
      verdicts,
      verdictSummary,
      canTransitionToTrial:
        applications.filter((app) => app.Status === "approved").length >=
        (caseData.RequiredJurors || 7),
    });
  } catch (error) {
    console.error("Get case details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve case details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Transition case to next state (Attorney actions)
 * FIXED: Better validation and error handling
 */
async function transitionCaseState(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const { newStatus } = req.body;
    const attorneyId = req.user.id;

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: "New status is required",
      });
    }

    // Get case data first
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
        message: "Access denied - you do not own this case",
      });
    }

    // Validate transition
    const validation = await Case.validateCaseStateTransition(
      caseId,
      newStatus
    );
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // Update case status
    await Case.updateCaseStatus(caseId, { attorneyStatus: newStatus });

    // Create event
    await Event.createEvent({
      caseId,
      eventType: getEventTypeForTransition(newStatus),
      description: `Case transitioned to ${newStatus}`,
      triggeredBy: attorneyId,
      userType: "attorney",
    });

    // Handle specific transitions
    if (newStatus === Case.ATTORNEY_CASE_STATES.JOIN_TRIAL) {
      // Notify approved jurors that trial is starting
      const approvedJurors = await JurorApplication.getApprovedJurorsForCase(
        caseId
      );
      await Promise.all(
        approvedJurors.map((juror) =>
          Notification.createNotification({
            userId: juror.JurorId,
            userType: "juror",
            caseId,
            type: Notification.NOTIFICATION_TYPES.TRIAL_STARTING,
            title: "Trial Starting Soon",
            message: `The trial for case "${caseData.CaseTitle}" is ready to begin.`,
          })
        )
      );
    } else if (newStatus === Case.ATTORNEY_CASE_STATES.VIEW_DETAILS) {
      // Notify approved jurors to submit verdicts
      const approvedJurors = await JurorApplication.getApprovedJurorsForCase(
        caseId
      );
      await Promise.all(
        approvedJurors.map((juror) =>
          Notification.createNotification({
            userId: juror.JurorId,
            userType: "juror",
            caseId,
            type: Notification.NOTIFICATION_TYPES.VERDICT_NEEDED,
            title: "Verdict Needed",
            message: `Please submit your verdict for case "${caseData.CaseTitle}".`,
          })
        )
      );
    }

    res.json({
      success: true,
      message: `Case status updated to ${newStatus}`,
      newStatus,
    });
  } catch (error) {
    console.error("Transition case state error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update case status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get case events/timeline
 * FIXED: Added defensive checks
 */
async function getCaseEvents(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const attorneyId = req.user.id;

    // Verify attorney owns this case
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
        message: "Access denied - you do not own this case",
      });
    }

    const events = await Event.getEventsByCase(caseId);

    res.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Get case events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve case events",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ============================================
// JUROR CASE FUNCTIONS
// ============================================

/**
 * Get available cases for juror job board
 * FIXED: Added defensive checks and better error handling
 */
async function getJobBoard(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const jurorId = req.user.id;
    const juror = req.user;

    if (!juror.county) {
      return res.status(400).json({
        success: false,
        message: "Juror county information is missing",
      });
    }

    if (!juror.state) {
      return res.status(400).json({
        success: false,
        message: "Juror state information is missing",
      });
    }

    const availableCases = await Case.getAvailableCasesForJurors(
      juror.county,
      juror.id,
      juror.state
    );

    // Filter out cases juror already applied to
    const casesWithApplicationStatus = [];
    for (const caseItem of availableCases) {
      const hasApplied = await JurorApplication.hasJurorAppliedToCase(
        jurorId,
        caseItem.CaseId
      );
      if (!hasApplied) {
        casesWithApplicationStatus.push({
          ...caseItem,
          canApply: true,
        });
      }
    }

    res.json({
      success: true,
      availableCases: casesWithApplicationStatus,
    });
  } catch (error) {
    console.error("Get job board error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve available cases",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get case details for juror (limited info for security)
 * FIXED: Added safe JSON parsing
 */
async function getJurorCaseDetails(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const jurorId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // Check if juror has applied or is approved for this case
    const hasApplied = await JurorApplication.hasJurorAppliedToCase(
      jurorId,
      caseId
    );
    if (!hasApplied) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you have not applied to this case",
      });
    }

    // FIXED: Safe JSON parsing
    res.json({
      success: true,
      case: {
        CaseId: caseData.CaseId,
        CaseTitle: caseData.CaseTitle,
        CaseDescription: caseData.CaseDescription,
        ScheduledDate: caseData.ScheduledDate,
        ScheduledTime: caseData.ScheduledTime,
        PaymentAmount: caseData.PaymentAmount,
        LawFirmName: caseData.LawFirmName,
        VoirDire1Questions: safeJSONParse(
          caseData.VoirDire1Questions,
          VOIR_DIRE_PART_1
        ),
        VoirDire2Questions: safeJSONParse(caseData.VoirDire2Questions, []),
      },
    });
  } catch (error) {
    console.error("Get juror case details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve case details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Apply to case (submit voir dire responses)
 * FIXED: Better validation and error handling
 */
async function applyToCase(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const jurorId = req.user.id;
    const { voirDire1Responses, voirDire2Responses } = req.body;

    // Validate responses provided
    if (!voirDire1Responses || !Array.isArray(voirDire1Responses)) {
      return res.status(400).json({
        success: false,
        message: "Voir dire Part 1 responses are required",
      });
    }

    // Check if already applied
    const hasApplied = await JurorApplication.hasJurorAppliedToCase(
      jurorId,
      caseId
    );
    if (hasApplied) {
      return res.status(400).json({
        success: false,
        message: "You have already applied to this case",
      });
    }

    // Validate that the case is accepting applications
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    if (caseData.AttorneyStatus !== "war_room") {
      return res.status(400).json({
        success: false,
        message: "This case is not currently accepting applications",
      });
    }

    // Create application
    const applicationId = await JurorApplication.createApplication({
      jurorId,
      caseId,
      voirDire1Responses,
      voirDire2Responses,
    });

    // Create event
    await Event.createEvent({
      caseId,
      eventType: Event.EVENT_TYPES.JUROR_APPLIED,
      description: `Juror applied to case`,
      triggeredBy: jurorId,
      userType: "juror",
    });

    // Notify attorney about new application
    await Notification.createNotification({
      userId: caseData.AttorneyId,
      userType: "attorney",
      caseId,
      type: Notification.NOTIFICATION_TYPES.APPLICATION_RECEIVED,
      title: "New Juror Application",
      message: `A new juror has applied to case "${caseData.CaseTitle}"`,
    });

    res.json({
      success: true,
      message:
        "Application submitted successfully. You will be notified of the decision.",
      applicationId,
    });
  } catch (error) {
    console.error("Apply to case error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get juror's case assignments (dashboard)
 * FIXED: Added defensive checks
 */
async function getJurorCases(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const jurorId = req.user.id;

    const applications = await JurorApplication.getApplicationsByJuror(jurorId);

    // Group by status for dashboard display
    const casesByStatus = {
      pending_approval: [],
      awaiting_trial: [],
      join_trial: [],
      give_verdicts: [],
    };

    applications.forEach((app) => {
      let status = "pending_approval";

      if (app.Status === "approved") {
        switch (app.CaseStatus) {
          case "war_room":
            status = "awaiting_trial";
            break;
          case "join_trial":
            status = "join_trial";
            break;
          case "view_details":
            status = "give_verdicts";
            break;
        }
      }

      casesByStatus[status].push({
        ...app,
        jurorStatus: status,
      });
    });

    res.json({
      success: true,
      cases: casesByStatus,
    });
  } catch (error) {
    console.error("Get juror cases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve case assignments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Submit verdict (Juror)
 * FIXED: Better validation and transaction support
 */
async function submitVerdict(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const jurorId = req.user.id;
    const verdictData = {
      caseId,
      jurorId,
      ...req.body,
    };

    // Validate required fields
    if (!verdictData.decision) {
      return res.status(400).json({
        success: false,
        message: "Verdict decision is required",
      });
    }

    // Validate juror is approved for this case
    const applications = await JurorApplication.getApplicationsByCase(caseId);
    const jurorApp = applications.find(
      (app) => app.JurorId === jurorId && app.Status === "approved"
    );

    if (!jurorApp) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to submit a verdict for this case",
      });
    }

    // Check if verdict already submitted
    const hasSubmitted = await Verdict.hasJurorSubmittedVerdict(
      jurorId,
      caseId
    );
    if (hasSubmitted) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted your verdict for this case",
      });
    }

    // Submit verdict
    const verdictId = await Verdict.submitVerdict(verdictData);

    // Get case details for notification
    const caseData = await Case.findById(caseId);

    // Create event and notifications in parallel
    await Promise.all([
      Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.VERDICT_SUBMITTED,
        description: `Juror submitted verdict: ${verdictData.decision}`,
        triggeredBy: jurorId,
        userType: "juror",
        metadata: { verdictId, decision: verdictData.decision },
      }),
      Notification.createNotification({
        userId: caseData.AttorneyId,
        userType: "attorney",
        caseId,
        type: Notification.NOTIFICATION_TYPES.VERDICT_SUBMITTED,
        title: "New Verdict Submitted",
        message: `A juror has submitted their verdict for case "${caseData.CaseTitle}"`,
      }),
    ]);

    // Check if all verdicts are in
    const completionStatus = await Verdict.getVerdictCompletionStatus(caseId);

    if (completionStatus.IsComplete) {
      // All verdicts submitted - notify attorney
      await Notification.createNotification({
        userId: caseData.AttorneyId,
        userType: "attorney",
        caseId,
        type: Notification.NOTIFICATION_TYPES.CASE_COMPLETED,
        title: "All Verdicts Collected",
        message: `All jurors have submitted their verdicts for case "${caseData.CaseTitle}". You can now view the complete results.`,
      });

      // ============================================
      // JUROR PAYMENT PROCESSING
      // ============================================
      try {
        console.log(`[Payment] Starting juror payment processing for case ${caseId}...`);

        // 1. Get all approved jurors for this case
        const allApplications = await JurorApplication.getApplicationsByCase(caseId);
        const approvedJurors = allApplications.filter(app => app.Status === 'approved');

        if (approvedJurors.length === 0) {
          console.warn(`[Payment] No approved jurors found for case ${caseId}`);
        } else {
          console.log(`[Payment] Found ${approvedJurors.length} approved jurors to pay`);

          // 2. Get attorney's original payment (case_filing type)
          const casePayments = await Payment.getPaymentsByCase(caseId);
          const attorneyPayment = casePayments.find(
            p => p.PaymentType === Payment.PAYMENT_TYPES.CASE_FILING &&
                 p.Status === Payment.PAYMENT_STATUSES.COMPLETED
          );

          if (!attorneyPayment) {
            console.error(`[Payment] No completed attorney payment found for case ${caseId}`);
          } else {
            // 3. Calculate per-juror payment amount
            const totalPaymentAmount = parseFloat(attorneyPayment.Amount);
            const perJurorAmount = totalPaymentAmount / approvedJurors.length;

            console.log(`[Payment] Total attorney payment: $${totalPaymentAmount}`);
            console.log(`[Payment] Per-juror payment: $${perJurorAmount.toFixed(2)}`);

            // 4. Create payment records for each approved juror
            const paymentPromises = approvedJurors.map(async (juror) => {
              try {
                // Create payment record
                const paymentId = await Payment.createPayment({
                  caseId: caseId,
                  userId: juror.JurorId,
                  userType: 'juror',
                  amount: perJurorAmount.toFixed(2),
                  paymentMethod: attorneyPayment.PaymentMethod,
                  paymentType: Payment.PAYMENT_TYPES.JUROR_PAYMENT,
                  transactionId: `JUROR-${caseId}-${juror.JurorId}-${Date.now()}`,
                  description: `Payment for case "${caseData.CaseTitle}" - Trial completion`,
                });

                // Mark payment as completed immediately
                await Payment.updatePaymentStatus(
                  paymentId,
                  Payment.PAYMENT_STATUSES.COMPLETED,
                  {
                    transactionId: `JUROR-${caseId}-${juror.JurorId}-${Date.now()}`,
                  }
                );

                // 5. Send notification to juror about payment
                await Notification.createNotification({
                  userId: juror.JurorId,
                  userType: "juror",
                  caseId,
                  type: Notification.NOTIFICATION_TYPES.PAYMENT_RECEIVED,
                  title: "Payment Received",
                  message: `You have been paid $${perJurorAmount.toFixed(2)} for completing trial "${caseData.CaseTitle}". Thank you for your service!`,
                });

                console.log(`[Payment] Successfully paid juror ${juror.JurorId}: $${perJurorAmount.toFixed(2)}`);

                return { jurorId: juror.JurorId, success: true, amount: perJurorAmount };
              } catch (paymentError) {
                console.error(`[Payment] Failed to pay juror ${juror.JurorId}:`, paymentError);
                return { jurorId: juror.JurorId, success: false, error: paymentError.message };
              }
            });

            // Wait for all payments to complete
            const paymentResults = await Promise.all(paymentPromises);
            const successfulPayments = paymentResults.filter(r => r.success).length;
            const failedPayments = paymentResults.filter(r => !r.success).length;

            console.log(`[Payment] Payment processing complete: ${successfulPayments} successful, ${failedPayments} failed`);

            // 6. Update case status to completed
            await Case.updateCaseStatus(caseId, 'completed');
            console.log(`[Payment] Case ${caseId} status updated to completed`);

            // 7. Log payment event
            await Event.logEvent({
              caseId,
              eventType: Event.EVENT_TYPES.PAYMENT_PROCESSED,
              performedBy: 'system',
              performedByType: 'system',
              description: `Juror payments processed: ${successfulPayments} successful, ${failedPayments} failed. Total distributed: $${(successfulPayments * perJurorAmount).toFixed(2)}`,
            });
          }
        }
      } catch (paymentProcessingError) {
        console.error(`[Payment] Critical error during payment processing for case ${caseId}:`, paymentProcessingError);
        // Don't throw - we still want the verdict submission to succeed
        // Payment processing can be retried manually
        await Event.logEvent({
          caseId,
          eventType: Event.EVENT_TYPES.ERROR,
          performedBy: 'system',
          performedByType: 'system',
          description: `Payment processing failed: ${paymentProcessingError.message}`,
        });
      }
    }

    res.json({
      success: true,
      message: "Verdict submitted successfully",
      verdictId,
      allVerdictsReceived: completionStatus.IsComplete,
    });
  } catch (error) {
    console.error("Submit verdict error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit verdict",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get cases needing verdicts for juror
 * FIXED: Added defensive check
 */
async function getCasesNeedingVerdicts(req, res) {
  try {
    // FIXED: Defensive check
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const jurorId = req.user.id;
    const cases = await Verdict.getCasesNeedingVerdicts(jurorId);

    res.json({
      success: true,
      cases,
      count: cases.length,
    });
  } catch (error) {
    console.error("Get cases needing verdicts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve cases needing verdicts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  // Case management
  createCase,
  getAttorneyCases,
  getCaseDetails,
  transitionCaseState,
  getCaseEvents,

  // Juror functions
  getJobBoard,
  getJurorCaseDetails,
  applyToCase,
  getJurorCases,
  submitVerdict,
  getCasesNeedingVerdicts,
};
