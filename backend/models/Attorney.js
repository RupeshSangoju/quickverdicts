// =============================================
// Attorney.js - Attorney Model (2025 Refactor)
// =============================================

const { getPool, executeQuery, sql } = require("../config/db");

// ============================================
// VALIDATION HELPERS
// ============================================

function validateAttorneyData(data) {
  const errors = [];

  if (!data.email) errors.push("Email is required");
  if (!data.firstName) errors.push("First name is required");
  if (!data.lastName) errors.push("Last name is required");
  if (!data.phoneNumber) errors.push("Phone number is required");
  if (!data.state) errors.push("State is required");
  if (!data.passwordHash) errors.push("Password is required");

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email)) {
    errors.push("Invalid email format");
  }

  // Phone number basic validation
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (data.phoneNumber && !phoneRegex.test(data.phoneNumber)) {
    errors.push("Invalid phone number format");
  }

  if (errors.length > 0) {
    const err = new Error(`Validation failed: ${errors.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }
}

// ============================================
// CORE QUERIES
// ============================================

async function findByEmail(email) {
  try {
    if (!email) throw new Error("Email is required");

    const normalized = email.toLowerCase().trim();

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("email", sql.NVarChar, normalized).query(`
          SELECT TOP 1
            AttorneyId, IsAttorney, FirstName, MiddleName, LastName,
            LawFirmName, PhoneNumber, State, StateBarNumber,
            OfficeAddress1, OfficeAddress2, County, City, ZipCode,
            Email, PasswordHash, UserAgreementAccepted, AgreementAcceptedAt,
            IsVerified, VerificationStatus, VerifiedAt, 
            TierLevel, IsActive, IsDeleted,
            CreatedAt, UpdatedAt, LastLoginAt
          FROM dbo.Attorneys
          WHERE LOWER(Email) = @email
        `);

      return result.recordset[0] || null;
    });
  } catch (error) {
    console.error("❌ [Attorney.findByEmail] Error:", error.message);
    throw error;
  }
}

async function findById(attorneyId) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) {
      const err = new Error("Valid attorney ID is required");
      err.statusCode = 400;
      throw err;
    }

    return await executeQuery(async (pool) => {
      const result = await pool.request().input("attorneyId", sql.Int, id)
        .query(`
          SELECT 
            AttorneyId, IsAttorney, FirstName, MiddleName, LastName,
            LawFirmName, PhoneNumber, State, StateBarNumber,
            OfficeAddress1, OfficeAddress2, County, City, ZipCode,
            Email, UserAgreementAccepted, AgreementAcceptedAt,
            IsVerified, VerificationStatus, VerifiedAt,
            TierLevel, IsActive, IsDeleted,
            CreatedAt, UpdatedAt, LastLoginAt
          FROM dbo.Attorneys
          WHERE AttorneyId = @attorneyId
        `);

      return result.recordset[0] || null;
    });
  } catch (error) {
    console.error("❌ [Attorney.findById] Error:", error.message);
    throw error;
  }
}

// ============================================
// CREATE & UPDATE
// ============================================

async function createAttorney(data) {
  try {
    validateAttorneyData(data);

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("isAttorney", sql.Bit, true)
        .input("firstName", sql.NVarChar, data.firstName.trim())
        .input("middleName", sql.NVarChar, data.middleName?.trim() || null)
        .input("lastName", sql.NVarChar, data.lastName.trim())
        .input("lawFirmName", sql.NVarChar, data.lawFirmName?.trim() || null)
        .input("phoneNumber", sql.NVarChar, data.phoneNumber.trim())
        .input("state", sql.NVarChar, data.state.trim().toUpperCase())
        .input(
          "stateBarNumber",
          sql.NVarChar,
          data.stateBarNumber?.trim() || null
        )
        .input(
          "officeAddress1",
          sql.NVarChar,
          data.officeAddress1?.trim() || null
        )
        .input(
          "officeAddress2",
          sql.NVarChar,
          data.officeAddress2?.trim() || null
        )
        .input("county", sql.NVarChar, data.county?.trim() || null)
        .input("city", sql.NVarChar, data.city?.trim() || null)
        .input("zipCode", sql.NVarChar, data.zipCode?.trim() || null)
        .input("email", sql.NVarChar, data.email.toLowerCase().trim())
        .input("passwordHash", sql.NVarChar, data.passwordHash)
        .input(
          "userAgreementAccepted",
          sql.Bit,
          data.userAgreementAccepted || false
        ).query(`
          INSERT INTO dbo.Attorneys (
            IsAttorney, FirstName, MiddleName, LastName, LawFirmName, PhoneNumber,
            State, StateBarNumber, OfficeAddress1, OfficeAddress2, County, City,
            ZipCode, Email, PasswordHash, UserAgreementAccepted, AgreementAcceptedAt,
            IsVerified, VerificationStatus, TierLevel, IsActive, IsDeleted,
            CreatedAt, UpdatedAt
          ) VALUES (
            @isAttorney, @firstName, @middleName, @lastName, @lawFirmName, @phoneNumber,
            @state, @stateBarNumber, @officeAddress1, @officeAddress2, @county, @city,
            @zipCode, @email, @passwordHash, @userAgreementAccepted,
            CASE WHEN @userAgreementAccepted = 1 THEN GETUTCDATE() ELSE NULL END,
            0, 'pending', 'free', 1, 0,
            GETUTCDATE(), GETUTCDATE()
          );
          SELECT SCOPE_IDENTITY() AS AttorneyId;
        `);

      return result.recordset[0].AttorneyId;
    });
  } catch (error) {
    console.error("❌ [Attorney.createAttorney] Error:", error.message);
    throw error;
  }
}

async function updateLastLogin(attorneyId) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID is required");

    await executeQuery(async (pool) => {
      await pool.request().input("attorneyId", sql.Int, id).query(`
          UPDATE dbo.Attorneys
          SET LastLoginAt = GETUTCDATE(), UpdatedAt = GETUTCDATE()
          WHERE AttorneyId = @attorneyId
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Attorney.updateLastLogin] Error:", error.message);
    throw error;
  }
}

async function updateTimezoneOffset(attorneyId, timezoneOffset) {
  try {
    const id = parseInt(attorneyId, 10);
    const offset = parseInt(timezoneOffset, 10);

    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID is required");
    if (isNaN(offset)) throw new Error("Valid timezone offset is required");

    await executeQuery(async (pool) => {
      await pool.request()
        .input("attorneyId", sql.Int, id)
        .input("timezoneOffset", sql.Int, offset)
        .query(`
          UPDATE dbo.Attorneys
          SET TimezoneOffset = @timezoneOffset, UpdatedAt = GETUTCDATE()
          WHERE AttorneyId = @attorneyId
        `);
    });

    console.log(`✅ Updated timezone offset for Attorney ${id}: ${offset} minutes`);
    return true;
  } catch (error) {
    console.error("❌ [Attorney.updateTimezoneOffset] Error:", error.message);
    throw error;
  }
}

async function updateVerificationStatus(attorneyId, status) {
  try {
    const id = parseInt(attorneyId, 10);
    const validStatuses = ["pending", "verified", "rejected", "declined"];

    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID required");
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid verification status. Must be one of: ${validStatuses.join(
          ", "
        )}`
      );
    }

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("attorneyId", sql.Int, id)
        .input("status", sql.NVarChar, status).query(`
          UPDATE dbo.Attorneys
          SET VerificationStatus = @status,
              IsVerified = CASE WHEN @status = 'verified' THEN 1 ELSE 0 END,
              VerifiedAt = CASE WHEN @status = 'verified' THEN GETUTCDATE() ELSE NULL END,
              UpdatedAt = GETUTCDATE()
          WHERE AttorneyId = @attorneyId
        `);
    });

    return true;
  } catch (error) {
    console.error(
      "❌ [Attorney.updateVerificationStatus] Error:",
      error.message
    );
    throw error;
  }
}

// ============================================
// VALIDATION CHECKS
// ============================================

async function checkStateBarNumberExists(
  stateBarNumber,
  state,
  excludeId = null
) {
  try {
    if (!stateBarNumber || !state) return false;

    return await executeQuery(async (pool) => {
      const request = pool
        .request()
        .input("stateBarNumber", sql.NVarChar, stateBarNumber.trim())
        .input("state", sql.NVarChar, state.trim().toUpperCase());

      let query = `
        SELECT COUNT(*) AS count
        FROM dbo.Attorneys
        WHERE StateBarNumber = @stateBarNumber 
          AND State = @state
          AND IsDeleted = 0
      `;

      if (excludeId) {
        query += " AND AttorneyId != @excludeId";
        request.input("excludeId", sql.Int, excludeId);
      }

      const result = await request.query(query);
      return result.recordset[0].count > 0;
    });
  } catch (error) {
    console.error(
      "❌ [Attorney.checkStateBarNumberExists] Error:",
      error.message
    );
    throw error;
  }
}

async function checkEmailExists(email, excludeId = null) {
  try {
    if (!email) return false;

    return await executeQuery(async (pool) => {
      const request = pool
        .request()
        .input("email", sql.NVarChar, email.toLowerCase().trim());

      let query = `
        SELECT COUNT(*) AS count
        FROM dbo.Attorneys
        WHERE LOWER(Email) = @email AND IsDeleted = 0
      `;

      if (excludeId) {
        query += " AND AttorneyId != @excludeId";
        request.input("excludeId", sql.Int, excludeId);
      }

      const result = await request.query(query);
      return result.recordset[0].count > 0;
    });
  } catch (error) {
    console.error("❌ [Attorney.checkEmailExists] Error:", error.message);
    throw error;
  }
}

// ============================================
// PASSWORD + PROFILE
// ============================================

async function updatePassword(attorneyId, passwordHash) {
  try {
    if (!attorneyId || !passwordHash) {
      throw new Error("Attorney ID and password hash are required");
    }

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("id", sql.Int, attorneyId)
        .input("passwordHash", sql.NVarChar, passwordHash).query(`
          UPDATE dbo.Attorneys
          SET PasswordHash = @passwordHash, UpdatedAt = GETUTCDATE()
          WHERE AttorneyId = @id AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Attorney.updatePassword] Error:", error.message);
    throw error;
  }
}

async function updateProfile(attorneyId, data) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id)) throw new Error("Valid attorney ID required");

    const allowedFields = {
      firstName: sql.NVarChar,
      middleName: sql.NVarChar,
      lastName: sql.NVarChar,
      lawFirmName: sql.NVarChar,
      phoneNumber: sql.NVarChar,
      officeAddress1: sql.NVarChar,
      officeAddress2: sql.NVarChar,
      city: sql.NVarChar,
      county: sql.NVarChar,
      zipCode: sql.NVarChar,
      stateBarNumber: sql.NVarChar,
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
      UPDATE dbo.Attorneys 
      SET ${updates.join(", ")} 
      WHERE AttorneyId = @id AND IsDeleted = 0
    `);

    return true;
  } catch (error) {
    console.error("❌ [Attorney.updateProfile] Error:", error.message);
    throw error;
  }
}

// ============================================
// TIER MANAGEMENT (NEW)
// ============================================

async function updateTier(attorneyId, tierLevel) {
  try {
    const id = parseInt(attorneyId, 10);
    const validTiers = ["free", "basic", "professional", "enterprise"];

    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID required");
    if (!validTiers.includes(tierLevel)) {
      throw new Error(
        `Invalid tier level. Must be one of: ${validTiers.join(", ")}`
      );
    }

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("attorneyId", sql.Int, id)
        .input("tierLevel", sql.NVarChar, tierLevel).query(`
          UPDATE dbo.Attorneys
          SET TierLevel = @tierLevel, UpdatedAt = GETUTCDATE()
          WHERE AttorneyId = @attorneyId AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Attorney.updateTier] Error:", error.message);
    throw error;
  }
}

// ============================================
// ACCOUNT STATUS (NEW)
// ============================================

async function deactivateAccount(attorneyId) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID required");

    await executeQuery(async (pool) => {
      await pool.request().input("attorneyId", sql.Int, id).query(`
          UPDATE dbo.Attorneys
          SET IsActive = 0, UpdatedAt = GETUTCDATE()
          WHERE AttorneyId = @attorneyId
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Attorney.deactivateAccount] Error:", error.message);
    throw error;
  }
}

async function reactivateAccount(attorneyId) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID required");

    await executeQuery(async (pool) => {
      await pool.request().input("attorneyId", sql.Int, id).query(`
          UPDATE dbo.Attorneys
          SET IsActive = 1, UpdatedAt = GETUTCDATE()
          WHERE AttorneyId = @attorneyId AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Attorney.reactivateAccount] Error:", error.message);
    throw error;
  }
}

async function softDeleteAccount(attorneyId) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID required");

    await executeQuery(async (pool) => {
      await pool.request().input("attorneyId", sql.Int, id).query(`
          UPDATE dbo.Attorneys
          SET IsDeleted = 1, IsActive = 0, UpdatedAt = GETUTCDATE()
          WHERE AttorneyId = @attorneyId
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Attorney.softDeleteAccount] Error:", error.message);
    throw error;
  }
}

// ============================================
// LIST + STATS
// ============================================

async function getAllAttorneys(options = {}) {
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

      if (options.verificationStatus) {
        whereClauses.push("VerificationStatus = @status");
        request.input("status", sql.NVarChar, options.verificationStatus);
      }

      if (options.state) {
        whereClauses.push("State = @state");
        request.input("state", sql.NVarChar, options.state.toUpperCase());
      }

      if (options.tierLevel) {
        whereClauses.push("TierLevel = @tierLevel");
        request.input("tierLevel", sql.NVarChar, options.tierLevel);
      }

      if (options.isActive !== undefined) {
        whereClauses.push("IsActive = @isActive");
        request.input("isActive", sql.Bit, options.isActive);
      }

      if (options.search) {
        const searchTerm = `%${options.search}%`;
        whereClauses.push(
          "(FirstName LIKE @search OR LastName LIKE @search OR Email LIKE @search OR LawFirmName LIKE @search OR StateBarNumber LIKE @search)"
        );
        request.input("search", sql.NVarChar, searchTerm);
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Map frontend sort fields to database columns
      const sortFieldMap = {
        name: "(FirstName + ' ' + ISNULL(MiddleName + ' ', '') + LastName)",
        email: "Email",
        lawFirm: "LawFirmName",
        status: "VerificationStatus",
        date: "CreatedAt",
        default: "CreatedAt",
      };

      const sortBy = options.sortBy || "default";
      const sortOrder =
        options.sortOrder && options.sortOrder.toUpperCase() === "ASC"
          ? "ASC"
          : "DESC";
      const sortColumn = sortFieldMap[sortBy] || sortFieldMap.default;

      const query = `
        SELECT
          AttorneyId, FirstName, MiddleName, LastName, Email, PhoneNumber,
          State, LawFirmName, StateBarNumber,
          VerificationStatus, IsVerified, TierLevel, IsActive,
          CreatedAt, LastLoginAt, UpdatedAt
        FROM dbo.Attorneys
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

        SELECT COUNT(*) AS total
        FROM dbo.Attorneys
        ${whereClause};
      `;

      const result = await request.query(query);

      return {
        attorneys: result.recordsets[0],
        total: result.recordsets[1][0].total,
        page,
        limit,
        totalPages: Math.ceil(result.recordsets[1][0].total / limit),
      };
    });
  } catch (error) {
    console.error("❌ [Attorney.getAllAttorneys] Error:", error.message);
    throw error;
  }
}

async function getAttorneyStats() {
  try {
    return await executeQuery(async (pool) => {
      const result = await pool.request().query(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN VerificationStatus = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN VerificationStatus = 'verified' THEN 1 ELSE 0 END) AS verified,
          SUM(CASE WHEN VerificationStatus = 'rejected' THEN 1 ELSE 0 END) AS rejected,
          SUM(CASE WHEN VerificationStatus = 'declined' THEN 1 ELSE 0 END) AS declined,
          SUM(CASE WHEN TierLevel = 'free' THEN 1 ELSE 0 END) AS freeTier,
          SUM(CASE WHEN TierLevel = 'basic' THEN 1 ELSE 0 END) AS basicTier,
          SUM(CASE WHEN TierLevel = 'professional' THEN 1 ELSE 0 END) AS professionalTier,
          SUM(CASE WHEN TierLevel = 'enterprise' THEN 1 ELSE 0 END) AS enterpriseTier
        FROM dbo.Attorneys
        WHERE IsDeleted = 0
      `);

      return result.recordset[0];
    });
  } catch (error) {
    console.error("❌ [Attorney.getAttorneyStats] Error:", error.message);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core queries
  findByEmail,
  findById,
  createAttorney,

  // Updates
  updateLastLogin,
  updateTimezoneOffset,
  updateVerificationStatus,
  updatePassword,
  updateProfile,
  updateTier,

  // Validation
  checkStateBarNumberExists,
  checkEmailExists,

  // Account management
  deactivateAccount,
  reactivateAccount,
  softDeleteAccount,

  // Lists and stats
  getAllAttorneys,
  getAttorneyStats,
};
