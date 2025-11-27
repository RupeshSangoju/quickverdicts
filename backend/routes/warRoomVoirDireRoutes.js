// =============================================
// warRoomVoirDireRoutes.js - War Room Voir Dire Routes
// FIXED: Added SQL types, validation, authorization, rate limiting
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { poolPromise, sql } = require("../config/db");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireWarRoomAccess } = require("../middleware/warRoomMiddleware");

// Import models
const Case = require("../models/Case");
const Event = require("../models/Event");

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Rate limiter for voir dire modifications
 */
const voirDireModifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 modifications per 15 minutes
  message: {
    success: false,
    message: "Too many voir dire changes. Please try again later.",
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
 * Validate entry ID parameter
 */
const validateEntryId = (req, res, next) => {
  const entryId = parseInt(req.params.entryId, 10);

  if (isNaN(entryId) || entryId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid entry ID is required",
    });
  }

  req.validatedEntryId = entryId;
  next();
};

/**
 * Validate voir dire entry data
 */
const validateVoirDireData = (req, res, next) => {
  const { question, response } = req.body;

  if (
    !question ||
    typeof question !== "string" ||
    question.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid question is required",
    });
  }

  if (question.trim().length > 1000) {
    return res.status(400).json({
      success: false,
      message: "Question too long (max 1000 characters)",
    });
  }

  if (
    !response ||
    typeof response !== "string" ||
    response.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid response is required",
    });
  }

  if (response.trim().length > 2000) {
    return res.status(400).json({
      success: false,
      message: "Response too long (max 2000 characters)",
    });
  }

  // Store validated data
  req.validatedVoirDire = {
    question: question.trim(),
    response: response.trim(),
  };

  next();
};

/**
 * Verify user can access voir dire questions (read access)
 * - Attorneys: can access their own cases
 * - Jurors: can access cases they've applied to or approved cases in their location
 * - Admins: can access all cases
 */
const verifyVoirDireAccess = async (req, res, next) => {
  try {
    const caseId = req.validatedCaseId;
    const user = req.user;

    const caseData = await Case.findById(caseId);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // Admin has full access
    if (user.type === "admin") {
      req.caseData = caseData;
      return next();
    }

    // Attorney must own the case
    if (user.type === "attorney") {
      if (caseData.AttorneyId !== user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You do not own this case",
        });
      }
      req.caseData = caseData;
      return next();
    }

    // ✅ FIXED: Allow jurors to READ voir dire questions for approved cases
    // Jurors need to see Part 2 questions when applying to cases
    if (user.type === "juror") {
      console.log(`🔍 [verifyVoirDireAccess] Juror ${user.id} requesting voir dire for case ${caseId}`);
      console.log(`   Case status: AdminApprovalStatus=${caseData.AdminApprovalStatus}, AttorneyStatus=${caseData.AttorneyStatus}`);

      // Allow access to approved cases in war_room state (accepting applications)
      if (caseData.AdminApprovalStatus === "approved" && caseData.AttorneyStatus === "war_room") {
        console.log(`✅ [verifyVoirDireAccess] Case is approved and in war_room - granting access`);
        req.caseData = caseData;
        return next();
      }

      // Also allow access to cases juror has already applied to
      const JurorApplication = require("../models/JurorApplication");
      const hasApplied = await JurorApplication.hasJurorAppliedToCase(user.id, caseId);
      console.log(`   Has applied: ${hasApplied}`);

      if (hasApplied) {
        console.log(`✅ [verifyVoirDireAccess] Juror has applied - granting access`);
        req.caseData = caseData;
        return next();
      }

      console.log(`❌ [verifyVoirDireAccess] Case not available for juror`);
      return res.status(403).json({
        success: false,
        message: "This case is not available",
      });
    }

    // Unknown user type
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  } catch (error) {
    console.error("Voir dire access verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify access",
    });
  }
};

/**
 * Verify user can modify voir dire (attorney/admin only)
 */
const verifyModifyPermission = (req, res, next) => {
  if (req.user.type !== "attorney" && req.user.type !== "admin") {
    return res.status(403).json({
      success: false,
      message:
        "Only attorneys and administrators can manage voir dire questions",
    });
  }
  next();
};

// ============================================
// WAR ROOM VOIR DIRE ROUTES
// ============================================

/**
 * GET /api/war-room-voir-dire/cases/:caseId/voir-dire
 * Get all voir dire entries for a case
 * FIXED: Added SQL types, validation, authorization
 */
router.get(
  "/cases/:caseId/voir-dire",
  generalLimiter,
  validateCaseId,
  verifyVoirDireAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      console.log(`📋 [GET voir-dire] Fetching custom questions for case ${caseId} by user type: ${req.user.type}`);

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT
            Id,
            CaseId,
            Question,
            Response,
            AddedBy,
            AddedAt,
            UpdatedAt
          FROM WarRoomVoirDire
          WHERE CaseId = @caseId
          ORDER BY AddedAt DESC
        `);

      console.log(`✅ [GET voir-dire] Found ${result.recordset.length} custom questions for case ${caseId}`);

      res.json({
        success: true,
        entries: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Fetch voir dire error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch voir dire entries",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/war-room-voir-dire/cases/:caseId/voir-dire/:entryId
 * Get single voir dire entry
 * NEW: Added single entry endpoint
 */
router.get(
  "/cases/:caseId/voir-dire/:entryId",
  generalLimiter,
  validateCaseId,
  validateEntryId,
  verifyVoirDireAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const entryId = req.validatedEntryId;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("entryId", sql.Int, entryId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT 
            Id, CaseId, Question, Response, AddedBy, AddedAt, UpdatedAt
          FROM WarRoomVoirDire
          WHERE Id = @entryId AND CaseId = @caseId
        `);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Voir dire entry not found",
        });
      }

      res.json({
        success: true,
        entry: result.recordset[0],
      });
    } catch (error) {
      console.error("Fetch voir dire entry error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch voir dire entry",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/war-room-voir-dire/cases/:caseId/voir-dire
 * Add voir dire question/response
 * FIXED: Added validation and event logging
 */
router.post(
  "/cases/:caseId/voir-dire",
  voirDireModifyLimiter,
  validateCaseId,
  verifyVoirDireAccess,
  verifyModifyPermission,
  validateVoirDireData,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { question, response } = req.validatedVoirDire;
      const userId = req.user.id;
      const pool = await poolPromise;

      // Insert voir dire entry
      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("question", sql.NVarChar(1000), question)
        .input("response", sql.NVarChar(2000), response)
        .input("addedBy", sql.Int, userId).query(`
          INSERT INTO WarRoomVoirDire (CaseId, Question, Response, AddedBy, AddedAt, UpdatedAt)
          VALUES (@caseId, @question, @response, @addedBy, GETUTCDATE(), GETUTCDATE());
          
          SELECT 
            Id, CaseId, Question, Response, AddedBy, AddedAt, UpdatedAt
          FROM WarRoomVoirDire
          WHERE Id = SCOPE_IDENTITY();
        `);

      const newEntry = result.recordset[0];

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Voir dire entry added: ${question.substring(0, 50)}${
          question.length > 50 ? "..." : ""
        }`,
        triggeredBy: userId,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "Voir dire entry added successfully",
        entry: newEntry,
      });
    } catch (error) {
      console.error("Add voir dire error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add voir dire entry",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * PUT /api/war-room-voir-dire/cases/:caseId/voir-dire/:entryId
 * Update voir dire entry
 * NEW: Added update endpoint
 */
router.put(
  "/cases/:caseId/voir-dire/:entryId",
  voirDireModifyLimiter,
  validateCaseId,
  validateEntryId,
  verifyVoirDireAccess,
  verifyModifyPermission,
  validateVoirDireData,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const entryId = req.validatedEntryId;
      const { question, response } = req.validatedVoirDire;
      const userId = req.user.id;
      const pool = await poolPromise;

      // Check if entry exists
      const existingCheck = await pool
        .request()
        .input("entryId", sql.Int, entryId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT Id 
          FROM WarRoomVoirDire
          WHERE Id = @entryId AND CaseId = @caseId
        `);

      if (existingCheck.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Voir dire entry not found",
        });
      }

      // Update entry
      const result = await pool
        .request()
        .input("entryId", sql.Int, entryId)
        .input("caseId", sql.Int, caseId)
        .input("question", sql.NVarChar(1000), question)
        .input("response", sql.NVarChar(2000), response).query(`
          UPDATE WarRoomVoirDire
          SET 
            Question = @question,
            Response = @response,
            UpdatedAt = GETUTCDATE()
          WHERE Id = @entryId AND CaseId = @caseId;
          
          SELECT 
            Id, CaseId, Question, Response, AddedBy, AddedAt, UpdatedAt
          FROM WarRoomVoirDire
          WHERE Id = @entryId;
        `);

      const updatedEntry = result.recordset[0];

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Voir dire entry updated: ${question.substring(0, 50)}${
          question.length > 50 ? "..." : ""
        }`,
        triggeredBy: userId,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "Voir dire entry updated successfully",
        entry: updatedEntry,
      });
    } catch (error) {
      console.error("Update voir dire error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update voir dire entry",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/war-room-voir-dire/cases/:caseId/voir-dire/:entryId
 * Remove a voir dire entry
 * FIXED: Added validation and event logging
 */
router.delete(
  "/cases/:caseId/voir-dire/:entryId",
  voirDireModifyLimiter,
  validateCaseId,
  validateEntryId,
  verifyVoirDireAccess,
  verifyModifyPermission,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const entryId = req.validatedEntryId;
      const userId = req.user.id;
      const pool = await poolPromise;

      // Get entry info before deleting (for event logging)
      const entryInfo = await pool
        .request()
        .input("entryId", sql.Int, entryId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT Question
          FROM WarRoomVoirDire
          WHERE Id = @entryId AND CaseId = @caseId
        `);

      if (entryInfo.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Voir dire entry not found",
        });
      }

      const entry = entryInfo.recordset[0];

      // Delete entry
      const result = await pool
        .request()
        .input("entryId", sql.Int, entryId)
        .input("caseId", sql.Int, caseId).query(`
          DELETE FROM WarRoomVoirDire
          WHERE Id = @entryId AND CaseId = @caseId;
          
          SELECT @@ROWCOUNT as DeletedCount;
        `);

      if (result.recordset[0].DeletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Voir dire entry not found",
        });
      }

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Voir dire entry deleted: ${entry.Question.substring(
          0,
          50
        )}${entry.Question.length > 50 ? "..." : ""}`,
        triggeredBy: userId,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "Voir dire entry removed successfully",
      });
    } catch (error) {
      console.error("Delete voir dire error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove voir dire entry",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/war-room-voir-dire/cases/:caseId/voir-dire/stats
 * Get voir dire statistics
 * NEW: Added stats endpoint
 */
router.get(
  "/cases/:caseId/voir-dire/stats",
  generalLimiter,
  validateCaseId,
  verifyVoirDireAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT 
            COUNT(*) as TotalEntries,
            AVG(LEN(Question)) as AvgQuestionLength,
            AVG(LEN(Response)) as AvgResponseLength,
            MAX(AddedAt) as LastAddedAt
          FROM WarRoomVoirDire
          WHERE CaseId = @caseId
        `);

      res.json({
        success: true,
        stats: {
          totalEntries: result.recordset[0].TotalEntries,
          avgQuestionLength: Math.round(
            result.recordset[0].AvgQuestionLength || 0
          ),
          avgResponseLength: Math.round(
            result.recordset[0].AvgResponseLength || 0
          ),
          lastAddedAt: result.recordset[0].LastAddedAt,
        },
      });
    } catch (error) {
      console.error("Get voir dire stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch voir dire statistics",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/war-room-voir-dire/cases/:caseId/voir-dire/bulk
 * Bulk add voir dire entries
 * NEW: Added bulk insert endpoint
 */
router.post(
  "/cases/:caseId/voir-dire/bulk",
  voirDireModifyLimiter,
  validateCaseId,
  verifyVoirDireAccess,
  verifyModifyPermission,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { entries } = req.body; // Array of {question, response}
      const userId = req.user.id;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Entries array is required",
        });
      }

      if (entries.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Maximum 50 entries per bulk insert",
        });
      }

      // Validate each entry
      for (const entry of entries) {
        if (!entry.question || !entry.response) {
          return res.status(400).json({
            success: false,
            message: "Each entry must have question and response",
          });
        }
      }

      const pool = await poolPromise;
      const transaction = pool.transaction();

      try {
        await transaction.begin();

        const insertedIds = [];

        for (const entry of entries) {
          const result = await transaction
            .request()
            .input("caseId", sql.Int, caseId)
            .input("question", sql.NVarChar(1000), entry.question.trim())
            .input("response", sql.NVarChar(2000), entry.response.trim())
            .input("addedBy", sql.Int, userId).query(`
              INSERT INTO WarRoomVoirDire (CaseId, Question, Response, AddedBy, AddedAt, UpdatedAt)
              VALUES (@caseId, @question, @response, @addedBy, GETUTCDATE(), GETUTCDATE());
              
              SELECT SCOPE_IDENTITY() as EntryId;
            `);

          insertedIds.push(result.recordset[0].EntryId);
        }

        await transaction.commit();

        // Create event
        await Event.createEvent({
          caseId,
          eventType: Event.EVENT_TYPES.CASE_UPDATED,
          description: `${entries.length} voir dire entries added in bulk`,
          triggeredBy: userId,
          userType: req.user.type,
        });

        res.json({
          success: true,
          message: `${entries.length} voir dire entries added successfully`,
          insertedIds,
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error("Bulk add voir dire error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to bulk add voir dire entries",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("War Room Voir Dire Route Error:", error);

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
