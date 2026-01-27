// =============================================
// Admin.js - Admin Model (Refactored & Optimized)
// =============================================

const { getPool, executeQuery, sql } = require("../config/db");

// ============================================
// VALIDATION HELPERS
// ============================================

function validateAdminData(data) {
  const errors = [];

  // Required fields
  if (
    !data.username ||
    typeof data.username !== "string" ||
    !data.username.trim()
  ) {
    errors.push("Username is required");
  }
  if (!data.email || typeof data.email !== "string" || !data.email.trim()) {
    errors.push("Email is required");
  }
  if (!data.passwordHash || typeof data.passwordHash !== "string") {
    errors.push("Password hash is required");
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email)) {
    errors.push("Invalid email format");
  }

  // Username format validation (alphanumeric, underscore, hyphen only)
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  if (data.username && !usernameRegex.test(data.username)) {
    errors.push(
      "Username must be 3-30 characters (letters, numbers, _ or - only)"
    );
  }

  if (errors.length > 0) {
    const err = new Error(`Admin validation failed: ${errors.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }
}

// ============================================
// ADMIN CRUD OPERATIONS
// ============================================

/**
 * Find admin by email
 */
async function findByEmail(email) {
  try {
    if (!email || typeof email !== "string") {
      throw new Error("Valid email is required");
    }

    const normalized = email.toLowerCase().trim();

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("email", sql.NVarChar, normalized).query(`
          SELECT 
            AdminId, Username, Email, PasswordHash, FirstName, LastName,
            PhoneNumber, Role, Permissions, IsActive, IsDeleted,
            CreatedAt, LastLoginAt, UpdatedAt
          FROM dbo.Admins
          WHERE LOWER(Email) = @email AND IsDeleted = 0
        `);

      return result.recordset[0] || null;
    });
  } catch (error) {
    console.error("❌ [Admin.findByEmail] Error:", error.message);
    throw error;
  }
}

/**
 * Find admin by username
 */
async function findByUsername(username) {
  try {
    if (!username || typeof username !== "string") {
      throw new Error("Valid username is required");
    }

    const normalized = username.toLowerCase().trim();

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("username", sql.NVarChar, normalized).query(`
          SELECT 
            AdminId, Username, Email, PasswordHash, FirstName, LastName,
            PhoneNumber, Role, Permissions, IsActive, IsDeleted,
            CreatedAt, LastLoginAt, UpdatedAt
          FROM dbo.Admins
          WHERE LOWER(Username) = @username AND IsDeleted = 0
        `);

      return result.recordset[0] || null;
    });
  } catch (error) {
    console.error("❌ [Admin.findByUsername] Error:", error.message);
    throw error;
  }
}

/**
 * Find admin by ID
 */
async function findById(adminId) {
  try {
    const id = parseInt(adminId, 10);
    if (isNaN(id) || id <= 0) {
      const err = new Error("Valid admin ID is required");
      err.statusCode = 400;
      throw err;
    }

    return await executeQuery(async (pool) => {
      const result = await pool.request().input("adminId", sql.Int, id).query(`
          SELECT 
            AdminId, Username, Email, FirstName, LastName, PhoneNumber,
            Role, Permissions, IsActive, IsDeleted,
            CreatedAt, LastLoginAt, UpdatedAt
          FROM dbo.Admins
          WHERE AdminId = @adminId
        `);

      return result.recordset[0] || null;
    });
  } catch (error) {
    console.error("❌ [Admin.findById] Error:", error.message);
    throw error;
  }
}

/**
 * Create new admin
 */
async function createAdmin(data) {
  try {
    validateAdminData(data);

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("username", sql.NVarChar, data.username.trim())
        .input("email", sql.NVarChar, data.email.toLowerCase().trim())
        .input("passwordHash", sql.NVarChar, data.passwordHash)
        .input("firstName", sql.NVarChar, data.firstName?.trim() || null)
        .input("lastName", sql.NVarChar, data.lastName?.trim() || null)
        .input("phoneNumber", sql.NVarChar, data.phoneNumber?.trim() || null)
        .input("role", sql.NVarChar, data.role?.trim() || "admin")
        .input(
          "permissions",
          sql.NVarChar,
          data.permissions ? JSON.stringify(data.permissions) : null
        )
        .input("isActive", sql.Bit, data.isActive ?? true).query(`
          INSERT INTO dbo.Admins (
            Username, Email, PasswordHash, FirstName, LastName,
            PhoneNumber, Role, Permissions, IsActive, IsDeleted,
            CreatedAt, UpdatedAt
          )
          VALUES (
            @username, @email, @passwordHash, @firstName, @lastName,
            @phoneNumber, @role, @permissions, @isActive, 0,
            GETUTCDATE(), GETUTCDATE()
          );
          SELECT SCOPE_IDENTITY() AS AdminId;
        `);

      return result.recordset[0].AdminId;
    });
  } catch (error) {
    console.error("❌ [Admin.createAdmin] Error:", error.message);
    throw error;
  }
}

/**
 * Update last login timestamp
 */
async function updateLastLogin(adminId) {
  try {
    const id = parseInt(adminId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid admin ID is required");

    await executeQuery(async (pool) => {
      await pool.request().input("adminId", sql.Int, id).query(`
          UPDATE dbo.Admins
          SET LastLoginAt = GETUTCDATE(), UpdatedAt = GETUTCDATE()
          WHERE AdminId = @adminId AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Admin.updateLastLogin] Error:", error.message);
    throw error;
  }
}

async function updateTimezoneOffset(adminId, timezoneOffset) {
  try {
    const id = parseInt(adminId, 10);
    const offset = parseInt(timezoneOffset, 10);

    if (isNaN(id) || id <= 0) throw new Error("Valid admin ID is required");
    if (isNaN(offset)) throw new Error("Valid timezone offset is required");

    await executeQuery(async (pool) => {
      await pool.request()
        .input("adminId", sql.Int, id)
        .input("timezoneOffset", sql.Int, offset)
        .query(`
          UPDATE dbo.Admins
          SET TimezoneOffset = @timezoneOffset, UpdatedAt = GETUTCDATE()
          WHERE AdminId = @adminId AND IsDeleted = 0
        `);
    });

    console.log(`✅ Updated timezone offset for Admin ${id}: ${offset} minutes`);
    return true;
  } catch (error) {
    console.error("❌ [Admin.updateTimezoneOffset] Error:", error.message);
    throw error;
  }
}

/**
 * Update admin password
 */
async function updatePassword(adminId, passwordHash) {
  try {
    const id = parseInt(adminId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid admin ID is required");
    if (!passwordHash) throw new Error("Password hash is required");

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("adminId", sql.Int, id)
        .input("passwordHash", sql.NVarChar, passwordHash).query(`
          UPDATE dbo.Admins
          SET PasswordHash = @passwordHash, UpdatedAt = GETUTCDATE()
          WHERE AdminId = @adminId AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Admin.updatePassword] Error:", error.message);
    throw error;
  }
}

/**
 * Update admin profile
 */
async function updateProfile(adminId, data) {
  try {
    const id = parseInt(adminId, 10);
    if (isNaN(id)) throw new Error("Valid admin ID required");

    const allowedFields = {
      firstName: sql.NVarChar,
      lastName: sql.NVarChar,
      phoneNumber: sql.NVarChar,
      email: sql.NVarChar,
    };

    const updates = [];
    const request = (await getPool()).request().input("id", sql.Int, id);

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields[key] !== undefined) {
        const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
        updates.push(`${fieldName} = @${key}`);
        request.input(key, allowedFields[key], value?.trim() || null);
      }
    }

    if (updates.length === 0) {
      throw new Error("No valid fields to update");
    }

    updates.push("UpdatedAt = GETUTCDATE()");

    await request.query(`
      UPDATE dbo.Admins 
      SET ${updates.join(", ")} 
      WHERE AdminId = @id AND IsDeleted = 0
    `);

    return true;
  } catch (error) {
    console.error("❌ [Admin.updateProfile] Error:", error.message);
    throw error;
  }
}

/**
 * Update admin permissions
 */
async function updatePermissions(adminId, permissions) {
  try {
    const id = parseInt(adminId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid admin ID is required");

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("adminId", sql.Int, id)
        .input("permissions", sql.NVarChar, JSON.stringify(permissions)).query(`
          UPDATE dbo.Admins
          SET Permissions = @permissions, UpdatedAt = GETUTCDATE()
          WHERE AdminId = @adminId AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Admin.updatePermissions] Error:", error.message);
    throw error;
  }
}

/**
 * Activate/Deactivate admin
 */
async function setActiveStatus(adminId, isActive) {
  try {
    const id = parseInt(adminId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid admin ID is required");

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("adminId", sql.Int, id)
        .input("isActive", sql.Bit, !!isActive).query(`
          UPDATE dbo.Admins
          SET IsActive = @isActive, UpdatedAt = GETUTCDATE()
          WHERE AdminId = @adminId AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Admin.setActiveStatus] Error:", error.message);
    throw error;
  }
}

/**
 * Soft delete admin
 */
async function softDeleteAdmin(adminId) {
  try {
    const id = parseInt(adminId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid admin ID is required");

    await executeQuery(async (pool) => {
      await pool.request().input("adminId", sql.Int, id).query(`
          UPDATE dbo.Admins
          SET IsDeleted = 1, IsActive = 0, UpdatedAt = GETUTCDATE()
          WHERE AdminId = @adminId
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Admin.softDeleteAdmin] Error:", error.message);
    throw error;
  }
}

// ============================================
// VALIDATION CHECKS
// ============================================

async function checkEmailExists(email, excludeId = null) {
  try {
    if (!email) return false;

    return await executeQuery(async (pool) => {
      const request = pool
        .request()
        .input("email", sql.NVarChar, email.toLowerCase().trim());

      let query = `
        SELECT COUNT(*) AS count
        FROM dbo.Admins
        WHERE LOWER(Email) = @email AND IsDeleted = 0
      `;

      if (excludeId) {
        query += " AND AdminId != @excludeId";
        request.input("excludeId", sql.Int, excludeId);
      }

      const result = await request.query(query);
      return result.recordset[0].count > 0;
    });
  } catch (error) {
    console.error("❌ [Admin.checkEmailExists] Error:", error.message);
    throw error;
  }
}

async function checkUsernameExists(username, excludeId = null) {
  try {
    if (!username) return false;

    return await executeQuery(async (pool) => {
      const request = pool
        .request()
        .input("username", sql.NVarChar, username.toLowerCase().trim());

      let query = `
        SELECT COUNT(*) AS count
        FROM dbo.Admins
        WHERE LOWER(Username) = @username AND IsDeleted = 0
      `;

      if (excludeId) {
        query += " AND AdminId != @excludeId";
        request.input("excludeId", sql.Int, excludeId);
      }

      const result = await request.query(query);
      return result.recordset[0].count > 0;
    });
  } catch (error) {
    console.error("❌ [Admin.checkUsernameExists] Error:", error.message);
    throw error;
  }
}

// ============================================
// ADMIN LISTING
// ============================================

async function getAllAdmins(options = {}) {
  try {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 10));
    const offset = (page - 1) * limit;

    return await executeQuery(async (pool) => {
      const request = pool
        .request()
        .input("limit", sql.Int, limit)
        .input("offset", sql.Int, offset);

      const whereClauses = ["IsDeleted = 0"];

      if (options.isActive !== undefined) {
        whereClauses.push("IsActive = @isActive");
        request.input("isActive", sql.Bit, options.isActive);
      }

      if (options.role) {
        whereClauses.push("Role = @role");
        request.input("role", sql.NVarChar, options.role);
      }

      if (options.search) {
        const searchTerm = `%${options.search}%`;
        whereClauses.push(
          "(Username LIKE @search OR Email LIKE @search OR FirstName LIKE @search OR LastName LIKE @search)"
        );
        request.input("search", sql.NVarChar, searchTerm);
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const query = `
        SELECT 
          AdminId, Username, Email, FirstName, LastName, PhoneNumber,
          Role, IsActive, CreatedAt, LastLoginAt, UpdatedAt
        FROM dbo.Admins
        ${whereClause}
        ORDER BY CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

        SELECT COUNT(*) AS total 
        FROM dbo.Admins 
        ${whereClause};
      `;

      const result = await request.query(query);

      return {
        admins: result.recordsets[0],
        total: result.recordsets[1][0].total,
        page,
        limit,
        totalPages: Math.ceil(result.recordsets[1][0].total / limit),
      };
    });
  } catch (error) {
    console.error("❌ [Admin.getAllAdmins] Error:", error.message);
    throw error;
  }
}

// ============================================
// AUDIT LOGGING
// ============================================

async function logAdminAction(
  adminId,
  action,
  targetType,
  targetId,
  details = null,
  ipAddress = null
) {
  try {
    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("adminId", sql.Int, parseInt(adminId))
        .input("action", sql.NVarChar, action)
        .input("targetType", sql.NVarChar, targetType)
        .input("targetId", sql.Int, targetId ? parseInt(targetId) : null)
        .input("details", sql.NVarChar, details)
        .input("ipAddress", sql.NVarChar, ipAddress).query(`
          INSERT INTO dbo.AdminAuditLog (
            AdminId, Action, TargetType, TargetId, Details, IPAddress, Timestamp
          )
          VALUES (
            @adminId, @action, @targetType, @targetId, @details, @ipAddress, GETUTCDATE()
          )
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Admin.logAdminAction] Error:", error.message);
    // Don't throw - audit logging failure shouldn't break the main operation
    return false;
  }
}

/**
 * Retrieve audit logs with filters
 */
async function getAuditLogs(options = {}) {
  try {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(options.limit) || 100));
    const offset = (page - 1) * limit;

    return await executeQuery(async (pool) => {
      const request = pool
        .request()
        .input("limit", sql.Int, limit)
        .input("offset", sql.Int, offset);

      const whereClauses = ["1=1"];

      if (options.adminId) {
        whereClauses.push("aal.AdminId = @adminId");
        request.input("adminId", sql.Int, parseInt(options.adminId));
      }
      if (options.action) {
        whereClauses.push("aal.Action = @action");
        request.input("action", sql.NVarChar, options.action);
      }
      if (options.targetType) {
        whereClauses.push("aal.TargetType = @targetType");
        request.input("targetType", sql.NVarChar, options.targetType);
      }
      if (options.targetId) {
        whereClauses.push("aal.TargetId = @targetId");
        request.input("targetId", sql.Int, parseInt(options.targetId));
      }
      if (options.startDate) {
        whereClauses.push("aal.Timestamp >= @startDate");
        request.input("startDate", sql.DateTime, new Date(options.startDate));
      }
      if (options.endDate) {
        whereClauses.push("aal.Timestamp <= @endDate");
        request.input("endDate", sql.DateTime, new Date(options.endDate));
      }

      const whereClause = whereClauses.join(" AND ");

      const query = `
        SELECT 
          aal.*, 
          a.Username AS AdminUsername, 
          a.Email AS AdminEmail,
          a.FirstName AS AdminFirstName,
          a.LastName AS AdminLastName
        FROM dbo.AdminAuditLog aal
        LEFT JOIN dbo.Admins a ON aal.AdminId = a.AdminId
        WHERE ${whereClause}
        ORDER BY aal.Timestamp DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

        SELECT COUNT(*) AS total
        FROM dbo.AdminAuditLog aal
        WHERE ${whereClause};
      `;

      const result = await request.query(query);

      return {
        logs: result.recordsets[0],
        total: result.recordsets[1][0].total,
        page,
        limit,
        totalPages: Math.ceil(result.recordsets[1][0].total / limit),
      };
    });
  } catch (error) {
    console.error("❌ [Admin.getAuditLogs] Error:", error.message);
    throw error;
  }
}

// ============================================
// ADMIN DASHBOARD STATISTICS
// ============================================

async function getDashboardStats() {
  try {
    return await executeQuery(async (pool) => {
      const result = await pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM dbo.Attorneys WHERE IsVerified = 1 AND IsDeleted = 0 AND IsActive = 1) AS VerifiedAttorneys,
          (SELECT COUNT(*) FROM dbo.Attorneys WHERE IsVerified = 0 AND IsDeleted = 0 AND IsActive = 1) AS PendingAttorneys,
          (SELECT COUNT(*) FROM dbo.Jurors WHERE IsVerified = 1 AND IsDeleted = 0 AND IsActive = 1) AS VerifiedJurors,
          (SELECT COUNT(*) FROM dbo.Jurors WHERE IsVerified = 0 AND IsDeleted = 0 AND IsActive = 1) AS PendingJurors,
          (SELECT COUNT(*) FROM dbo.Cases WHERE AdminApprovalStatus = 'pending' AND IsDeleted = 0) AS PendingCases,
          (SELECT COUNT(*) FROM dbo.Cases WHERE AdminApprovalStatus = 'approved' AND IsDeleted = 0) AS ApprovedCases,
          (SELECT COUNT(*) FROM dbo.TrialMeetings WHERE Status = 'active') AS ActiveTrials,
          (SELECT COUNT(*) FROM dbo.TrialMeetings WHERE Status = 'created') AS ScheduledTrials,
          (SELECT COUNT(*) FROM dbo.Notifications WHERE IsRead = 0 AND UserType = 'admin') AS UnreadNotifications,
          (SELECT COUNT(*)
           FROM dbo.Cases c
           LEFT JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
           WHERE c.IsDeleted = 0
             AND CAST(c.ScheduledDate AS DATE) = CAST(
             DATEADD(MINUTE, CASE
               WHEN a.State IN ('Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'New Hampshire', 'New Jersey', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'Vermont', 'Virginia', 'West Virginia') THEN -300
               WHEN a.State IN ('Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska', 'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas', 'Wisconsin') THEN -360
               WHEN a.State IN ('Arizona', 'Colorado', 'Idaho', 'Montana', 'New Mexico', 'Utah', 'Wyoming') THEN -420
               WHEN a.State IN ('California', 'Nevada', 'Oregon', 'Washington') THEN -480
               WHEN a.State = 'Alaska' THEN -540
               WHEN a.State = 'Hawaii' THEN -600
               WHEN a.State = 'India' THEN 330
               ELSE 0
             END, GETDATE()) AS DATE)
          ) AS TodaysTrials,
          (SELECT COUNT(*) FROM dbo.Admins WHERE IsActive = 1 AND IsDeleted = 0) AS ActiveAdmins
      `);

      return result.recordset[0];
    });
  } catch (error) {
    console.error("❌ [Admin.getDashboardStats] Error:", error.message);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core queries
  findByEmail,
  findByUsername,
  findById,
  createAdmin,

  // Updates
  updateLastLogin,
  updateTimezoneOffset,
  updatePassword,
  updateProfile,
  updatePermissions,
  setActiveStatus,
  softDeleteAdmin,

  // Validation
  checkEmailExists,
  checkUsernameExists,

  // Listing
  getAllAdmins,

  // Audit
  logAdminAction,
  getAuditLogs,

  // Dashboard
  getDashboardStats,
};
