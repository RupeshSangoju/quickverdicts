// =============================================
// warRoomInfoRoutes.js - War Room Info Routes
// FIXED: Proper database connection, SQL types, validation, authorization
// NOTE: This route stores legacy JSON data. Consider migrating to proper tables.
// =============================================

const express = require("express");
const router = express.Router();
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { poolPromise, sql } = require("../config/db");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireWarRoomAccess } = require("../middleware/warRoomMiddleware");
const { uploadToBlob } = require("../utils/azureBlob");

// Import models
const Case = require("../models/Case");
const Event = require("../models/Event");
const Notification = require("../models/Notification");
const { sendNotificationEmail } = require("../utils/email");
const { createTrialMeeting } = require("./trialRoutes");

// ============================================
// MULTER CONFIGURATION
// ============================================

const upload = multer({
  limits: {
    fileSize: 4 * 1024 * 1024 * 1024, // 4GB limit - Allow large video files and document bundles
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/png",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Upload rate limiter
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    message: "Too many uploads. Please try again later.",
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
// MIDDLEWARE
// ============================================

// Apply authentication to all routes
router.use(authMiddleware);

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
 * Verify attorney owns the case or is admin
 */
const verifyCaseAccess = async (req, res, next) => {
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
        message: "Only attorneys can manage war room info",
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
    console.error("Case access verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify case access",
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

/**
 * Ensure WarRoomInfo row exists for a case
 * Creates empty row if it doesn't exist
 */
async function ensureWarRoomInfoExists(pool, caseId) {
  try {
    const checkResult = await pool
      .request()
      .input("caseId", sql.Int, caseId)
      .query(`SELECT CaseId FROM WarRoomInfo WHERE CaseId = @caseId`);

    if (checkResult.recordset.length === 0) {
      // Create empty war room info
      await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("teamMembers", sql.NVarChar(sql.MAX), "[]")
        .input("documents", sql.NVarChar(sql.MAX), "[]")
        .input("voirDire", sql.NVarChar(sql.MAX), "[]")
        .query(`
          INSERT INTO WarRoomInfo (CaseId, TeamMembers, Documents, VoirDire, CreatedAt, UpdatedAt)
          VALUES (@caseId, @teamMembers, @documents, @voirDire, GETUTCDATE(), GETUTCDATE())
        `);
      console.log(`✅ Initialized WarRoomInfo for case ${caseId}`);
    }
  } catch (error) {
    console.error(`Failed to ensure WarRoomInfo exists for case ${caseId}:`, error);
    // Don't throw - let the calling function handle it
  }
}

/**
 * Validate team member data
 */
const validateTeamMember = (req, res, next) => {
  const { name, role, email } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Valid name is required",
    });
  }

  if (!role || typeof role !== "string" || role.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Valid role is required",
    });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Valid email is required",
    });
  }

  next();
};

// ============================================
// TEAM MEMBER ROUTES
// ============================================

/**
 * GET /api/war-room-info/cases/:caseId/war-room/team
 * Get team members for a case
 * FIXED: Added SQL types, validation, authorization
 */
router.get(
  "/cases/:caseId/war-room/team",
  generalLimiter,
  validateCaseId,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      // Ensure WarRoomInfo row exists
      await ensureWarRoomInfoExists(pool, caseId);

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(`SELECT TeamMembers FROM WarRoomInfo WHERE CaseId = @caseId`);

      if (result.recordset.length === 0) {
        return res.json({
          success: true,
          members: [],
          count: 0,
        });
      }

      const teamMembers = safeJSONParse(result.recordset[0].TeamMembers, []);

      res.json({
        success: true,
        members: teamMembers,
        count: teamMembers.length,
      });
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch team members",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/war-room-info/cases/:caseId/team
 * Add team member
 * FIXED: Added validation and proper error handling
 */
router.post(
  "/cases/:caseId/team",
  generalLimiter,
  validateCaseId,
  verifyCaseAccess,
  validateTeamMember,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { name, role, email } = req.body;
      const pool = await poolPromise;

      // Get existing war room info
      let result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(
          `SELECT TeamMembers, Documents, VoirDire FROM WarRoomInfo WHERE CaseId = @caseId`
        );

      let teamMembers = [];
      let documents = [];
      let voirDireArr = [];

      if (result.recordset.length > 0) {
        const row = result.recordset[0];
        teamMembers = safeJSONParse(row.TeamMembers, []);
        documents = safeJSONParse(row.Documents, []);
        voirDireArr = safeJSONParse(row.VoirDire, []);
      }

      // Check for duplicate
      const isDuplicate = teamMembers.some(
        (member) =>
          member.Email === email ||
          (member.Name === name && member.Role === role)
      );

      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          message: "Team member already exists",
        });
      }

      // Add new team member
      teamMembers.push({
        Name: name.trim(),
        Role: role.trim(),
        Email: email?.trim() || null,
        AddedAt: new Date().toISOString(),
      });

      // Upsert
      if (result.recordset.length === 0) {
        await pool
          .request()
          .input("caseId", sql.Int, caseId)
          .input(
            "teamMembers",
            sql.NVarChar(sql.MAX),
            JSON.stringify(teamMembers)
          )
          .input("documents", sql.NVarChar(sql.MAX), JSON.stringify(documents))
          .input("voirDire", sql.NVarChar(sql.MAX), JSON.stringify(voirDireArr))
          .query(`
            INSERT INTO WarRoomInfo (CaseId, TeamMembers, Documents, VoirDire, CreatedAt, UpdatedAt)
            VALUES (@caseId, @teamMembers, @documents, @voirDire, GETUTCDATE(), GETUTCDATE())
          `);
      } else {
        await pool
          .request()
          .input("caseId", sql.Int, caseId)
          .input(
            "teamMembers",
            sql.NVarChar(sql.MAX),
            JSON.stringify(teamMembers)
          ).query(`
            UPDATE WarRoomInfo
            SET TeamMembers = @teamMembers, UpdatedAt = GETUTCDATE()
            WHERE CaseId = @caseId
          `);
      }

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Team member added: ${name} (${role})`,
        triggeredBy: req.user.id,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "Team member added successfully",
        member: { Name: name, Role: role, Email: email },
      });
    } catch (error) {
      console.error("Add team member error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add team member",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/war-room-info/cases/:caseId/team
 * Get team list (alternative endpoint)
 */
router.get(
  "/cases/:caseId/team",
  generalLimiter,
  validateCaseId,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(`SELECT TeamMembers FROM WarRoomInfo WHERE CaseId = @caseId`);

      if (result.recordset.length === 0) {
        return res.json([]);
      }

      const teamMembers = safeJSONParse(result.recordset[0].TeamMembers, []);
      res.json(teamMembers);
    } catch (error) {
      console.error("Get team error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch team",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// DOCUMENT ROUTES (Legacy - use warRoomDocumentRoutes.js instead)
// ============================================

/**
 * GET /api/war-room-info/cases/:caseId/war-room/documents
 * Get documents for a case
 */
router.get(
  "/cases/:caseId/war-room/documents",
  generalLimiter,
  validateCaseId,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      // Ensure WarRoomInfo row exists
      await ensureWarRoomInfoExists(pool, caseId);

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(`SELECT Documents FROM WarRoomInfo WHERE CaseId = @caseId`);

      if (result.recordset.length === 0) {
        return res.json({
          success: true,
          documents: [],
          count: 0,
        });
      }

      const documents = safeJSONParse(result.recordset[0].Documents, []);

      // Transform to match frontend expectations
      const transformedDocs = documents.map((doc, index) => ({
        Id: index + 1,
        FileName: doc.name,
        Description: doc.description || "",
        FileUrl: doc.fileUrl,
      }));

      res.json({
        success: true,
        documents: transformedDocs,
        count: transformedDocs.length,
      });
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch documents",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/war-room-info/cases/:caseId/war-room/documents
 * Upload document
 * NOTE: This is legacy. Use warRoomDocumentRoutes.js for new implementations
 */
router.post(
  "/cases/:caseId/war-room/documents",
  uploadLimiter,
  validateCaseId,
  verifyCaseAccess,
  upload.single("file"),
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { description } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const pool = await poolPromise;

      // Get existing data
      let result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(
          `SELECT TeamMembers, Documents, VoirDire FROM WarRoomInfo WHERE CaseId = @caseId`
        );

      let teamMembers = [];
      let documents = [];
      let voirDireArr = [];

      if (result.recordset.length > 0) {
        const row = result.recordset[0];
        teamMembers = safeJSONParse(row.TeamMembers, []);
        documents = safeJSONParse(row.Documents, []);
        voirDireArr = safeJSONParse(row.VoirDire, []);
      }

      // Upload file to Azure Blob
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const fileBuffer = req.file.buffer;
      const fileUrl = await uploadToBlob(fileBuffer, fileName, mimeType);

      // Add document
      documents.push({
        name: fileName,
        description: description || "",
        fileUrl,
        uploadedAt: new Date().toISOString(),
      });

      // Upsert
      if (result.recordset.length === 0) {
        await pool
          .request()
          .input("caseId", sql.Int, caseId)
          .input(
            "teamMembers",
            sql.NVarChar(sql.MAX),
            JSON.stringify(teamMembers)
          )
          .input("documents", sql.NVarChar(sql.MAX), JSON.stringify(documents))
          .input("voirDire", sql.NVarChar(sql.MAX), JSON.stringify(voirDireArr))
          .query(`
            INSERT INTO WarRoomInfo (CaseId, TeamMembers, Documents, VoirDire, CreatedAt, UpdatedAt)
            VALUES (@caseId, @teamMembers, @documents, @voirDire, GETUTCDATE(), GETUTCDATE())
          `);
      } else {
        await pool
          .request()
          .input("caseId", sql.Int, caseId)
          .input("documents", sql.NVarChar(sql.MAX), JSON.stringify(documents))
          .query(`
            UPDATE WarRoomInfo
            SET Documents = @documents, UpdatedAt = GETUTCDATE()
            WHERE CaseId = @caseId
          `);
      }

      res.json({
        success: true,
        message: "Document uploaded successfully",
      });
    } catch (error) {
      console.error("Upload document error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload document",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/war-room-info/cases/:caseId/war-room/documents/:docId
 * Delete document
 */
router.delete(
  "/cases/:caseId/war-room/documents/:docId",
  generalLimiter,
  validateCaseId,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { docId } = req.params;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(`SELECT Documents FROM WarRoomInfo WHERE CaseId = @caseId`);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No war room info found",
        });
      }

      let documents = safeJSONParse(result.recordset[0].Documents, []);
      const docIndex = parseInt(docId) - 1;

      if (docIndex < 0 || docIndex >= documents.length) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      // Remove document
      const removedDoc = documents.splice(docIndex, 1)[0];

      await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("documents", sql.NVarChar(sql.MAX), JSON.stringify(documents))
        .query(`
          UPDATE WarRoomInfo
          SET Documents = @documents, UpdatedAt = GETUTCDATE()
          WHERE CaseId = @caseId
        `);

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete document",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// WAR ROOM SUBMISSION
// ============================================

/**
 * POST /api/war-room-info/cases/:caseId/war-room/submit
 * Submit war room
 * FIXED: Added validation and event logging
 */
router.post(
  "/cases/:caseId/war-room/submit",
  generalLimiter,
  validateCaseId,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      // Check approved juror count (minimum 5, maximum 7)
      const jurorCountResult = await pool
        .request()
        .input("caseId", sql.Int, caseId).query(`
          SELECT COUNT(*) as ApprovedCount
          FROM JurorApplications
          WHERE CaseId = @caseId AND Status = 'approved'
        `);

      const approvedCount = jurorCountResult.recordset[0].ApprovedCount;

      // ✅ PRODUCTION: Require 5-7 jurors for real trials
      if (approvedCount < 5) {
        return res.status(400).json({
          success: false,
          message: `Cannot submit war room: You need at least 5 approved jurors (currently have ${approvedCount})`,
          code: "INSUFFICIENT_JURORS",
          requiredJurors: 5,
          currentJurors: approvedCount,
        });
      }

      if (approvedCount > 7) {
        return res.status(400).json({
          success: false,
          message: `Cannot submit war room: Maximum 7 jurors allowed (currently have ${approvedCount})`,
          code: "TOO_MANY_JURORS",
          maxJurors: 7,
          currentJurors: approvedCount,
        });
      }

      // ✅ Get case details for notifications
      const caseDetails = await pool.request().input("caseId", sql.Int, caseId).query(`
        SELECT
          c.CaseId, c.CaseTitle, c.ScheduledDate, c.ScheduledTime,
          c.AttorneyId, c.County, c.CaseType, c.AttorneyStatus,
          a.FirstName, a.LastName, a.Email as AttorneyEmail, a.LawFirmName
        FROM Cases c
        INNER JOIN Attorneys a ON c.AttorneyId = a.AttorneyId
        WHERE c.CaseId = @caseId
      `);

      if (caseDetails.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }

      const caseData = caseDetails.recordset[0];

      // ✅ Check if war room already submitted
      if (caseData.AttorneyStatus !== 'war_room') {
        return res.status(400).json({
          success: false,
          message: `War room has already been submitted. Current status: ${caseData.AttorneyStatus}`,
          code: "ALREADY_SUBMITTED",
          currentStatus: caseData.AttorneyStatus,
        });
      }

      const attorneyName = `${caseData.FirstName} ${caseData.LastName}`;

      // Format trial date and time for messages
      const trialDate = new Date(caseData.ScheduledDate).toLocaleDateString("en-US", {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const trialTime = caseData.ScheduledTime;

      // ✅ Update case status to awaiting_trial (PRODUCTION)
      // War room will become accessible 1 hour before trial via scheduler
      await pool.request().input("caseId", sql.Int, caseId).query(`
          UPDATE Cases
          SET AttorneyStatus = 'awaiting_trial', UpdatedAt = GETUTCDATE()
          WHERE CaseId = @caseId
        `);

      // ✅ Create trial meeting (ACS Room + Chat Thread)
      console.log("Creating trial meeting for case:", caseId);
      try {
        await createTrialMeeting(caseId);
        console.log("✅ Trial meeting created successfully for case:", caseId);
      } catch (meetingError) {
        console.error("❌ Error creating trial meeting:", meetingError);
        // Log error but continue with submission - meeting can be created later
      }

      // ✅ Get all approved jurors
      const jurors = await pool.request().input("caseId", sql.Int, caseId).query(`
        SELECT j.JurorId, j.Email, j.Name
        FROM JurorApplications ja
        INNER JOIN Jurors j ON ja.JurorId = j.JurorId
        WHERE ja.CaseId = @caseId AND ja.Status = 'approved'
      `);

      // ✅ Get all team members
      const teamMembers = await pool.request().input("caseId", sql.Int, caseId).query(`
        SELECT Email, Name, Role
        FROM WarRoomTeamMembers
        WHERE CaseId = @caseId
      `);

      // ✅ Get all admins
      const admins = await pool.request().query(`
        SELECT AdminId, Email,
               COALESCE(FirstName + ' ' + LastName, Username, 'Admin') as Name
        FROM Admins
        WHERE IsActive = 1
      `);

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.WAR_ROOM_SUBMITTED,
        description: `War room submitted with ${approvedCount} approved jurors - awaiting trial`,
        triggeredBy: req.user.id,
        userType: req.user.type,
      });

      // ✅ Send notifications and emails to approved jurors
      const jurorNotifications = [];
      for (const juror of jurors.recordset) {
        try {
          // Create notification
          await Notification.createNotification({
            userId: juror.JurorId,
            userType: 'juror',
            caseId: caseId,
            type: Notification.NOTIFICATION_TYPES.WAR_ROOM_READY,
            title: 'War Room Submitted - Trial Preparation',
            message: `The attorney has submitted the war room for "${caseData.CaseTitle}". Your trial is scheduled for ${trialDate} at ${trialTime}. The war room will be accessible 1 hour before the trial begins.`
          });

          // Send email
          const emailContent = `
            <h2 style="color: #16305B; margin-top: 0;">War Room Submitted</h2>
            <p style="color: #666; line-height: 1.6;">Dear ${juror.Name},</p>
            <p style="color: #666; line-height: 1.6;">
              The attorney has completed all preparations for the trial <strong>"${caseData.CaseTitle}"</strong>.
            </p>
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #16a34a; margin: 0; font-size: 16px;">
                <strong>📅 Trial Date:</strong> ${trialDate}
              </p>
              <p style="color: #16a34a; margin: 10px 0 0 0; font-size: 16px;">
                <strong>🕐 Trial Time:</strong> ${trialTime}
              </p>
            </div>
            <p style="color: #666; line-height: 1.6;">
              <strong>Important:</strong> The war room will become accessible <strong>1 hour before</strong> the trial begins.
              You will receive another notification when it's time to join.
            </p>
            <p style="color: #666; line-height: 1.6;">
              Please be prepared and available at the scheduled time.
            </p>
            <p style="color: #666; line-height: 1.6;">
              Best regards,<br/>
              Quick Verdicts Team
            </p>
          `;

          await sendNotificationEmail(
            juror.Email,
            'War Room Submitted - Trial Scheduled',
            emailContent
          );

          jurorNotifications.push({ jurorId: juror.JurorId, status: 'sent' });
        } catch (error) {
          console.error(`Failed to notify juror ${juror.JurorId}:`, error);
          jurorNotifications.push({ jurorId: juror.JurorId, status: 'failed', error: error.message });
        }
      }

      // ✅ Send notifications and emails to team members
      for (const member of teamMembers.recordset) {
        try {
          const emailContent = `
            <h2 style="color: #16305B; margin-top: 0;">War Room Submitted</h2>
            <p style="color: #666; line-height: 1.6;">Dear ${member.Name},</p>
            <p style="color: #666; line-height: 1.6;">
              The attorney ${attorneyName} has submitted the war room for <strong>"${caseData.CaseTitle}"</strong>.
            </p>
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #16a34a; margin: 0; font-size: 16px;">
                <strong>📅 Trial Date:</strong> ${trialDate}
              </p>
              <p style="color: #16a34a; margin: 10px 0 0 0; font-size: 16px;">
                <strong>🕐 Trial Time:</strong> ${trialTime}
              </p>
              <p style="color: #16a34a; margin: 10px 0 0 0; font-size: 14px;">
                <strong>Your Role:</strong> ${member.Role}
              </p>
            </div>
            <p style="color: #666; line-height: 1.6;">
              All preparations are complete. The trial is ready to proceed as scheduled.
            </p>
            <p style="color: #666; line-height: 1.6;">
              Best regards,<br/>
              Quick Verdicts Team
            </p>
          `;

          await sendNotificationEmail(
            member.Email,
            'War Room Submitted - Trial Scheduled',
            emailContent
          );
        } catch (error) {
          console.error(`Failed to notify team member ${member.Email}:`, error);
        }
      }

      // ✅ Send notification and email to attorney
      try {
        await Notification.createNotification({
          userId: caseData.AttorneyId,
          userType: 'attorney',
          caseId: caseId,
          type: Notification.NOTIFICATION_TYPES.WAR_ROOM_READY,
          title: 'War Room Submitted Successfully',
          message: `Your war room for "${caseData.CaseTitle}" has been submitted successfully. Trial scheduled for ${trialDate} at ${trialTime}.`
        });

        const attorneyEmailContent = `
          <h2 style="color: #16305B; margin-top: 0;">War Room Submitted Successfully</h2>
          <p style="color: #666; line-height: 1.6;">Dear ${attorneyName},</p>
          <p style="color: #666; line-height: 1.6;">
            Your war room for <strong>"${caseData.CaseTitle}"</strong> has been successfully submitted.
          </p>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 25px 0; border-radius: 4px;">
            <p style="color: #16a34a; margin: 0; font-size: 16px;">
              <strong>✓ War Room Status:</strong> Submitted
            </p>
            <p style="color: #16a34a; margin: 10px 0 0 0; font-size: 16px;">
              <strong>📅 Trial Date:</strong> ${trialDate}
            </p>
            <p style="color: #16a34a; margin: 10px 0 0 0; font-size: 16px;">
              <strong>🕐 Trial Time:</strong> ${trialTime}
            </p>
            <p style="color: #16a34a; margin: 10px 0 0 0; font-size: 16px;">
              <strong>👥 Approved Jurors:</strong> ${approvedCount}
            </p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            All ${approvedCount} approved jurors and your team members have been notified about the trial schedule.
          </p>
          <p style="color: #666; line-height: 1.6;">
            The trial will begin automatically 15 minutes before the scheduled time.
          </p>
          <p style="color: #666; line-height: 1.6;">
            Best regards,<br/>
            Quick Verdicts Team
          </p>
        `;

        await sendNotificationEmail(
          caseData.AttorneyEmail,
          'War Room Submitted Successfully',
          attorneyEmailContent
        );
      } catch (error) {
        console.error('Failed to notify attorney:', error);
      }

      // ✅ Send notification and email to all admins
      for (const admin of admins.recordset) {
        try {
          await Notification.createNotification({
            userId: admin.AdminId,
            userType: 'admin',
            caseId: caseId,
            type: Notification.NOTIFICATION_TYPES.WAR_ROOM_READY,
            title: 'Attorney Submitted War Room',
            message: `Attorney ${attorneyName} has submitted the war room for "${caseData.CaseTitle}". The jury charge form and all case materials are ready. Trial scheduled for ${trialDate} at ${trialTime}.`
          });

          const adminEmailContent = `
            <h2 style="color: #16305B; margin-top: 0;">War Room Submitted</h2>
            <p style="color: #666; line-height: 1.6;">Hello Admin,</p>
            <p style="color: #666; line-height: 1.6;">
              Attorney <strong>${attorneyName}</strong> from ${caseData.LawFirmName || 'their law firm'} has submitted the war room for case <strong>"${caseData.CaseTitle}"</strong>.
            </p>
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #1e40af; margin: 0; font-size: 16px;">
                <strong>📋 Case Details:</strong>
              </p>
              <p style="color: #1e40af; margin: 10px 0 0 0; font-size: 14px;">
                Case ID: ${caseId}
              </p>
              <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 14px;">
                Type: ${caseData.CaseType} | County: ${caseData.County}
              </p>
              <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 14px;">
                Trial Date: ${trialDate} at ${trialTime}
              </p>
              <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 14px;">
                Approved Jurors: ${approvedCount}
              </p>
            </div>
            <p style="color: #666; line-height: 1.6;">
              <strong>What this means:</strong>
            </p>
            <ul style="color: #666; line-height: 1.6;">
              <li>The attorney has completed uploading all case documents</li>
              <li>Team members and witness details have been finalized</li>
              <li>The jury charge questions have been prepared and are ready</li>
              <li>All ${approvedCount} jurors have been notified of the trial schedule</li>
            </ul>
            <p style="color: #666; line-height: 1.6;">
              The case is now in "Awaiting Trial" status and will automatically transition to "Join Trial" 15 minutes before the scheduled time.
            </p>
            <p style="color: #666; line-height: 1.6;">
              Best regards,<br/>
              Quick Verdicts System
            </p>
          `;

          await sendNotificationEmail(
            admin.Email,
            `War Room Submitted - ${caseData.CaseTitle}`,
            adminEmailContent
          );
        } catch (error) {
          console.error(`Failed to notify admin ${admin.AdminId}:`, error);
        }
      }

      res.json({
        success: true,
        message: "War room submitted successfully. All participants have been notified.",
        caseStatus: "awaiting_trial",
        trialDate: trialDate,
        trialTime: trialTime,
        notifications: {
          jurors: jurorNotifications.length,
          teamMembers: teamMembers.recordset.length,
          admins: admins.recordset.length,
        },
      });
    } catch (error) {
      console.error("Submit war room error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit war room",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/war-room-info/cases/:caseId/war-room/jury-charge-completed
 * Mark jury charge question building as completed by attorney
 * NOTE: This signals to admin that attorney has finished editing questions
 * Admin must still release questions to jurors via separate endpoint
 */
router.post(
  "/cases/:caseId/war-room/jury-charge-completed",
  generalLimiter,
  validateCaseId,
  verifyCaseAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      // NOTE: Status remains 'pending' - only admin can set to 'completed' via release endpoint
      // This endpoint just notifies admin that attorney has finished editing

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: "Attorney signaled jury charge questions are ready for admin review",
        triggeredBy: req.user.id,
        userType: req.user.type,
      });

      // Get case data for notifications
      const caseResult = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(`
          SELECT c.CaseTitle, c.AttorneyId, a.FirstName, a.LastName
          FROM Cases c
          INNER JOIN Attorneys a ON c.AttorneyId = a.AttorneyId
          WHERE c.CaseId = @caseId
        `);

      const caseData = caseResult.recordset[0];
      const attorneyName = `${caseData.FirstName} ${caseData.LastName}`;

      // Get question count
      const questionResult = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(`
          SELECT COUNT(*) as QuestionCount
          FROM JuryChargeQuestions
          WHERE CaseId = @caseId
        `);

      const questionCount = questionResult.recordset[0].QuestionCount;

      // Notify all admins that jury charge is ready for review
      const admins = await pool.request().query(`
        SELECT AdminId, Email,
               COALESCE(FirstName + ' ' + LastName, Username, 'Admin') as Name
        FROM Admins
        WHERE IsActive = 1
      `);

      for (const admin of admins.recordset) {
        try {
          await Notification.createNotification({
            userId: admin.AdminId,
            userType: 'admin',
            caseId: caseId,
            type: Notification.NOTIFICATION_TYPES.CASE_UPDATED,
            title: 'Jury Charge Ready for Review',
            message: `Attorney ${attorneyName} has completed building ${questionCount} jury charge question(s) for "${caseData.CaseTitle}". Ready for your review and release to jurors.`
          });
        } catch (error) {
          console.error(`Failed to notify admin ${admin.AdminId}:`, error);
        }
      }

      res.json({
        success: true,
        message: "Jury charge questions submitted for admin review",
        questionCount,
      });
    } catch (error) {
      console.error("Mark jury charge completed error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark jury charge as completed",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// LEGACY ROUTES (For Backwards Compatibility)
// ============================================

/**
 * GET /api/war-room-info/cases/:caseId/warroom-info
 * Get all war room info for a case (legacy)
 */
router.get(
  "/cases/:caseId/warroom-info",
  generalLimiter,
  validateCaseId,
  requireWarRoomAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(
          `SELECT TeamMembers, Documents, VoirDire FROM WarRoomInfo WHERE CaseId = @caseId`
        );

      if (result.recordset.length === 0) {
        return res.json({
          TeamMembers: [],
          Documents: [],
          VoirDire: [],
        });
      }

      const row = result.recordset[0];
      res.json({
        TeamMembers: safeJSONParse(row.TeamMembers, []),
        Documents: safeJSONParse(row.Documents, []),
        VoirDire: safeJSONParse(row.VoirDire, []),
      });
    } catch (error) {
      console.error("Get war room info error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/war-room-info/cases/:caseId/warroom-info
 * Add or update war room info (legacy)
 */
router.post(
  "/cases/:caseId/warroom-info",
  uploadLimiter,
  validateCaseId,
  requireWarRoomAccess,
  upload.single("file"),
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { teamMember, document, voirDire, description } = req.body;
      const pool = await poolPromise;

      let result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(
          `SELECT TeamMembers, Documents, VoirDire FROM WarRoomInfo WHERE CaseId = @caseId`
        );

      let teamMembers = [];
      let documents = [];
      let voirDireArr = [];

      if (result.recordset.length > 0) {
        const row = result.recordset[0];
        teamMembers = safeJSONParse(row.TeamMembers, []);
        documents = safeJSONParse(row.Documents, []);
        voirDireArr = safeJSONParse(row.VoirDire, []);
      }

      // Handle document upload
      if (req.file) {
        const fileName = req.file.originalname;
        const mimeType = req.file.mimetype;
        const fileBuffer = req.file.buffer;
        const fileUrl = await uploadToBlob(fileBuffer, fileName, mimeType);
        documents.push({ name: fileName, description, fileUrl });
      } else if (document) {
        documents.push(document);
      }

      if (teamMember) teamMembers.push(teamMember);
      if (voirDire) voirDireArr.push(voirDire);

      // Upsert
      if (result.recordset.length === 0) {
        await pool
          .request()
          .input("caseId", sql.Int, caseId)
          .input(
            "teamMembers",
            sql.NVarChar(sql.MAX),
            JSON.stringify(teamMembers)
          )
          .input("documents", sql.NVarChar(sql.MAX), JSON.stringify(documents))
          .input("voirDire", sql.NVarChar(sql.MAX), JSON.stringify(voirDireArr))
          .query(`
            INSERT INTO WarRoomInfo (CaseId, TeamMembers, Documents, VoirDire, CreatedAt, UpdatedAt)
            VALUES (@caseId, @teamMembers, @documents, @voirDire, GETUTCDATE(), GETUTCDATE())
          `);
      } else {
        await pool
          .request()
          .input("caseId", sql.Int, caseId)
          .input(
            "teamMembers",
            sql.NVarChar(sql.MAX),
            JSON.stringify(teamMembers)
          )
          .input("documents", sql.NVarChar(sql.MAX), JSON.stringify(documents))
          .input("voirDire", sql.NVarChar(sql.MAX), JSON.stringify(voirDireArr))
          .query(`
            UPDATE WarRoomInfo
            SET TeamMembers = @teamMembers,
                Documents = @documents,
                VoirDire = @voirDire,
                UpdatedAt = GETUTCDATE()
            WHERE CaseId = @caseId
          `);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update war room info error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/war-room-info/cases/:caseId/warroom-info/documents/:docName
 * Delete document by name (legacy)
 */
router.delete(
  "/cases/:caseId/warroom-info/documents/:docName",
  generalLimiter,
  validateCaseId,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { docName } = req.params;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .query(`SELECT Documents FROM WarRoomInfo WHERE CaseId = @caseId`);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          error: "No war room info found for this case",
        });
      }

      let documents = safeJSONParse(result.recordset[0].Documents, []);
      const updatedDocs = documents.filter((doc) => doc.name !== docName);

      if (updatedDocs.length === documents.length) {
        return res.status(404).json({ error: "Document not found" });
      }

      await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("documents", sql.NVarChar(sql.MAX), JSON.stringify(updatedDocs))
        .query(`
          UPDATE WarRoomInfo
          SET Documents = @documents, UpdatedAt = GETUTCDATE()
          WHERE CaseId = @caseId
        `);

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("War Room Info Route Error:", error);

  // Handle multer errors
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

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
