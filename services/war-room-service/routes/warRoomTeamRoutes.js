// =============================================
// warRoomTeamRoutes.js - War Room Team Member Routes
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
 * Rate limiter for team member modifications
 */
const teamModifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 modifications per 15 minutes
  message: {
    success: false,
    message: "Too many team member changes. Please try again later.",
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
 * Validate member ID parameter
 */
const validateMemberId = (req, res, next) => {
  const memberId = parseInt(req.params.memberId, 10);

  if (isNaN(memberId) || memberId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid member ID is required",
    });
  }

  req.validatedMemberId = memberId;
  next();
};

/**
 * Validate team member data
 */
const validateTeamMemberData = (req, res, next) => {
  const { name, role, email } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Valid name is required",
    });
  }

  if (name.trim().length > 100) {
    return res.status(400).json({
      success: false,
      message: "Name too long (max 100 characters)",
    });
  }

  if (!role || typeof role !== "string" || role.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Valid role is required",
    });
  }

  if (role.trim().length > 100) {
    return res.status(400).json({
      success: false,
      message: "Role too long (max 100 characters)",
    });
  }

  if (!email || typeof email !== "string") {
    return res.status(400).json({
      success: false,
      message: "Valid email is required",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  if (email.length > 255) {
    return res.status(400).json({
      success: false,
      message: "Email too long (max 255 characters)",
    });
  }

  // Store validated data
  req.validatedTeamMember = {
    name: name.trim(),
    role: role.trim(),
    email: email.trim().toLowerCase(),
  };

  next();
};

/**
 * Verify attorney owns the case or is admin
 */
const verifyTeamAccess = async (req, res, next) => {
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
        message: "Only attorneys can manage team members",
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
    console.error("Team access verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify team access",
    });
  }
};

/**
 * Verify user can modify team (attorney/admin only)
 */
const verifyModifyPermission = (req, res, next) => {
  if (req.user.type !== "attorney" && req.user.type !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only attorneys and administrators can manage team members",
    });
  }
  next();
};

// ============================================
// WAR ROOM TEAM ENDPOINTS
// ============================================

/**
 * GET /api/war-room-team/cases/:caseId/war-room/team
 * Get team members for a case (PRIMARY ENDPOINT)
 * FIXED: Added SQL types, validation, authorization
 */
router.get(
  "/cases/:caseId/war-room/team",
  generalLimiter,
  validateCaseId,
  verifyTeamAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT
            Id,
            CaseId,
            Name,
            Role,
            Email,
            AddedAt
          FROM WarRoomTeamMembers
          WHERE CaseId = @caseId
          ORDER BY AddedAt DESC
        `);

      res.json({
        success: true,
        members: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Fetch team members error:", error);
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
 * GET /api/war-room-team/cases/:caseId/team
 * Get team members (alternative endpoint)
 */
router.get(
  "/cases/:caseId/team",
  generalLimiter,
  validateCaseId,
  requireWarRoomAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT Id, CaseId, Name, Role, Email, AddedAt
          FROM WarRoomTeamMembers
          WHERE CaseId = @caseId
          ORDER BY AddedAt DESC
        `);

      res.json(result.recordset);
    } catch (error) {
      console.error("Fetch team members error:", error);
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
 * POST /api/war-room-team/cases/:caseId/war-room/team
 * Add multiple team members (bulk operation)
 * NEW: Bulk team member addition endpoint matching frontend
 */
router.post(
  "/cases/:caseId/war-room/team",
  teamModifyLimiter,
  validateCaseId,
  verifyTeamAccess,
  verifyModifyPermission,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { teamMembers } = req.body;
      const userId = req.user.id;

      // Validate teamMembers array
      if (!Array.isArray(teamMembers) || teamMembers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "teamMembers array is required",
        });
      }

      if (teamMembers.length > 20) {
        return res.status(400).json({
          success: false,
          message: "Cannot add more than 20 team members at once",
        });
      }

      const pool = await poolPromise;
      const addedMembers = [];
      const errors = [];

      for (const member of teamMembers) {
        try {
          // Validate individual member
          const name = member.Name || member.name;
          const role = member.Role || member.role;
          const email = member.Email || member.email;

          if (!name || !role || !email) {
            errors.push({
              member,
              error: "Missing required fields (Name, Role, Email)",
            });
            continue;
          }

          const trimmedEmail = email.trim().toLowerCase();

          // Check for duplicate
          const duplicateCheck = await pool
            .request()
            .input("caseId", sql.Int, caseId)
            .input("email", sql.NVarChar(255), trimmedEmail).query(`
              SELECT Id FROM WarRoomTeamMembers
              WHERE CaseId = @caseId AND Email = @email
            `);

          if (duplicateCheck.recordset.length > 0) {
            errors.push({
              member,
              error: "Email already exists in team",
            });
            continue;
          }

          // Insert team member
          const result = await pool
            .request()
            .input("caseId", sql.Int, caseId)
            .input("name", sql.NVarChar(100), name.trim())
            .input("role", sql.NVarChar(100), role.trim())
            .input("email", sql.NVarChar(255), trimmedEmail).query(`
              INSERT INTO WarRoomTeamMembers (CaseId, Name, Role, Email, AddedAt)
              VALUES (@caseId, @name, @role, @email, GETUTCDATE());

              SELECT Id, CaseId, Name, Role, Email, AddedAt
              FROM WarRoomTeamMembers
              WHERE Id = SCOPE_IDENTITY();
            `);

          addedMembers.push(result.recordset[0]);
        } catch (error) {
          console.error("Error adding team member:", error);
          errors.push({
            member,
            error: error.message || "Failed to add member",
          });
        }
      }

      // Create event for successfully added members
      if (addedMembers.length > 0) {
        await Event.createEvent({
          caseId,
          eventType: Event.EVENT_TYPES.CASE_UPDATED,
          description: `Added ${addedMembers.length} team member(s)`,
          triggeredBy: userId,
          userType: req.user.type,
        });
      }

      res.json({
        success: true,
        message: `Successfully added ${addedMembers.length} team member(s)`,
        members: addedMembers,
        addedCount: addedMembers.length,
        failedCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Bulk add team members error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add team members",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/war-room-team/cases/:caseId/team
 * Add a team member
 * FIXED: Added validation, duplicate checking, event logging
 */
router.post(
  "/cases/:caseId/team",
  teamModifyLimiter,
  validateCaseId,
  verifyTeamAccess,
  verifyModifyPermission,
  validateTeamMemberData,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { name, role, email } = req.validatedTeamMember;
      const userId = req.user.id;
      const pool = await poolPromise;

      // Check for duplicate email in this case
      const duplicateCheck = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("email", sql.NVarChar(255), email).query(`
          SELECT Id 
          FROM WarRoomTeamMembers
          WHERE CaseId = @caseId AND Email = @email
        `);

      if (duplicateCheck.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Team member with this email already exists",
        });
      }

      // Insert team member
      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("name", sql.NVarChar(100), name)
        .input("role", sql.NVarChar(100), role)
        .input("email", sql.NVarChar(255), email).query(`
          INSERT INTO WarRoomTeamMembers (CaseId, Name, Role, Email, AddedAt)
          VALUES (@caseId, @name, @role, @email, GETUTCDATE());

          SELECT
            Id, CaseId, Name, Role, Email, AddedAt
          FROM WarRoomTeamMembers
          WHERE Id = SCOPE_IDENTITY();
        `);

      const newMember = result.recordset[0];

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Team member added: ${name} (${role})`,
        triggeredBy: userId,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "Team member added successfully",
        member: newMember,
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
 * PUT /api/war-room-team/cases/:caseId/team/:memberId
 * Update a team member
 * NEW: Added update endpoint
 */
router.put(
  "/cases/:caseId/team/:memberId",
  teamModifyLimiter,
  validateCaseId,
  validateMemberId,
  verifyTeamAccess,
  verifyModifyPermission,
  validateTeamMemberData,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const memberId = req.validatedMemberId;
      const { name, role, email } = req.validatedTeamMember;
      const userId = req.user.id;
      const pool = await poolPromise;

      // Check if member exists
      const existingCheck = await pool
        .request()
        .input("memberId", sql.Int, memberId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT Id 
          FROM WarRoomTeamMembers
          WHERE Id = @memberId AND CaseId = @caseId
        `);

      if (existingCheck.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Team member not found",
        });
      }

      // Check for duplicate email (excluding current member)
      const duplicateCheck = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("email", sql.NVarChar(255), email)
        .input("memberId", sql.Int, memberId).query(`
          SELECT Id 
          FROM WarRoomTeamMembers
          WHERE CaseId = @caseId AND Email = @email AND Id != @memberId
        `);

      if (duplicateCheck.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Team member with this email already exists",
        });
      }

      // Update team member
      const result = await pool
        .request()
        .input("memberId", sql.Int, memberId)
        .input("caseId", sql.Int, caseId)
        .input("name", sql.NVarChar(100), name)
        .input("role", sql.NVarChar(100), role)
        .input("email", sql.NVarChar(255), email).query(`
          UPDATE WarRoomTeamMembers
          SET
            Name = @name,
            Role = @role,
            Email = @email
          WHERE Id = @memberId AND CaseId = @caseId;

          SELECT Id, CaseId, Name, Role, Email, AddedAt
          FROM WarRoomTeamMembers
          WHERE Id = @memberId;
        `);

      const updatedMember = result.recordset[0];

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Team member updated: ${name}`,
        triggeredBy: userId,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "Team member updated successfully",
        member: updatedMember,
      });
    } catch (error) {
      console.error("Update team member error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update team member",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/war-room-team/cases/:caseId/team/:memberId
 * Remove a team member
 * FIXED: Added validation and event logging
 */
router.delete(
  "/cases/:caseId/team/:memberId",
  teamModifyLimiter,
  validateCaseId,
  validateMemberId,
  verifyTeamAccess,
  verifyModifyPermission,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const memberId = req.validatedMemberId;
      const userId = req.user.id;
      const pool = await poolPromise;

      // Get member info before deleting (for event logging)
      const memberInfo = await pool
        .request()
        .input("memberId", sql.Int, memberId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT Name, Role
          FROM WarRoomTeamMembers
          WHERE Id = @memberId AND CaseId = @caseId
        `);

      if (memberInfo.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Team member not found",
        });
      }

      const member = memberInfo.recordset[0];

      // Delete team member
      const result = await pool
        .request()
        .input("memberId", sql.Int, memberId)
        .input("caseId", sql.Int, caseId).query(`
          DELETE FROM WarRoomTeamMembers
          WHERE Id = @memberId AND CaseId = @caseId;
          
          SELECT @@ROWCOUNT as DeletedCount;
        `);

      if (result.recordset[0].DeletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Team member not found",
        });
      }

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Team member removed: ${member.Name} (${member.Role})`,
        triggeredBy: userId,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "Team member removed successfully",
      });
    } catch (error) {
      console.error("Delete team member error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove team member",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/war-room-team/cases/:caseId/team/stats
 * Get team statistics
 * NEW: Added stats endpoint
 */
router.get(
  "/cases/:caseId/team/stats",
  generalLimiter,
  validateCaseId,
  verifyTeamAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT 
            COUNT(*) as TotalMembers,
            COUNT(DISTINCT Role) as UniqueRoles
          FROM WarRoomTeamMembers
          WHERE CaseId = @caseId
        `);

      const roleCount = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT 
            Role,
            COUNT(*) as Count
          FROM WarRoomTeamMembers
          WHERE CaseId = @caseId
          GROUP BY Role
          ORDER BY Count DESC
        `);

      res.json({
        success: true,
        stats: {
          totalMembers: result.recordset[0].TotalMembers,
          uniqueRoles: result.recordset[0].UniqueRoles,
          byRole: roleCount.recordset,
        },
      });
    } catch (error) {
      console.error("Get team stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch team statistics",
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
  console.error("War Room Team Route Error:", error);

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
