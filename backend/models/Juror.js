// =============================================
// Juror.js - Juror Model (2025 Refactor)
// =============================================

const { getPool, executeQuery, sql } = require("../config/db");

// ============================================
// VALIDATION HELPERS
// ============================================

function validateJurorData(data) {
  const errors = [];

  // Required fields
  if (!data.name?.trim()) errors.push("Name is required");
  if (!data.email?.trim()) errors.push("Email is required");
  if (!data.phoneNumber?.trim()) errors.push("Phone number is required");
  if (!data.county?.trim()) errors.push("County is required");
  if (!data.state?.trim()) errors.push("State is required");
  if (!data.passwordHash?.trim()) errors.push("Password is required");

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
    const err = new Error(`Juror validation failed: ${errors.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }
}

function safeJSONParse(json, fallback = null) {
  try {
    return typeof json === "string" ? JSON.parse(json) : json || fallback;
  } catch (error) {
    console.warn("⚠️  JSON parse error:", error.message);
    return fallback;
  }
}

function safeJSONStringify(obj) {
  try {
    return typeof obj === "string" ? obj : JSON.stringify(obj);
  } catch (error) {
    console.warn("⚠️  JSON stringify error:", error.message);
    return null;
  }
}

// ============================================
// QUERY OPERATIONS
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
            JurorId, Name, PhoneNumber, Address1, Address2, City, State, 
            ZipCode, County, MaritalStatus, SpouseEmployer, EmployerName, 
            EmployerAddress, YearsInCounty, AgeRange, Gender, Education, 
            PaymentMethod, Email, PasswordHash, CriteriaResponses,
            UserAgreementAccepted, AgreementAcceptedAt,
            IsVerified, VerificationStatus, VerifiedAt,
            IsActive, IsDeleted,
            IntroVideoCompleted, JurorQuizCompleted, OnboardingCompleted,
            ProfileComplete, CreatedAt, UpdatedAt, LastLoginAt
          FROM dbo.Jurors
          WHERE LOWER(Email) = @email
        `);

      const juror = result.recordset[0];
      if (juror?.CriteriaResponses) {
        juror.CriteriaResponses = safeJSONParse(juror.CriteriaResponses);
      }

      return juror || null;
    });
  } catch (error) {
    console.error("❌ [Juror.findByEmail] Error:", error.message);
    throw error;
  }
}

async function findById(jurorId) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) {
      const err = new Error("Valid juror ID is required");
      err.statusCode = 400;
      throw err;
    }

    return await executeQuery(async (pool) => {
      const result = await pool.request().input("jurorId", sql.Int, id).query(`
          SELECT 
            JurorId, Name, PhoneNumber, Address1, Address2, City, State, 
            ZipCode, County, MaritalStatus, SpouseEmployer, EmployerName, 
            EmployerAddress, YearsInCounty, AgeRange, Gender, Education, 
            PaymentMethod, Email, CriteriaResponses,
            UserAgreementAccepted, AgreementAcceptedAt,
            IsVerified, VerificationStatus, VerifiedAt,
            IsActive, IsDeleted,
            IntroVideoCompleted, JurorQuizCompleted, OnboardingCompleted,
            ProfileComplete, CreatedAt, UpdatedAt, LastLoginAt
          FROM dbo.Jurors 
          WHERE JurorId = @jurorId
        `);

      const juror = result.recordset[0];
      if (juror?.CriteriaResponses) {
        juror.CriteriaResponses = safeJSONParse(juror.CriteriaResponses);
      }

      return juror || null;
    });
  } catch (error) {
    console.error("❌ [Juror.findById] Error:", error.message);
    throw error;
  }
}

// ============================================
// CREATE & UPDATE
// ============================================

async function createJuror(data) {
  try {
    validateJurorData(data);

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("name", sql.NVarChar, data.name.trim())
        .input("phoneNumber", sql.NVarChar, data.phoneNumber.trim())
        .input("address1", sql.NVarChar, data.address1?.trim() || null)
        .input("address2", sql.NVarChar, data.address2?.trim() || null)
        .input("city", sql.NVarChar, data.city?.trim() || null)
        .input("state", sql.NVarChar, data.state.trim().toUpperCase())
        .input("zipCode", sql.NVarChar, data.zipCode?.trim() || null)
        .input("county", sql.NVarChar, data.county.trim())
        .input(
          "maritalStatus",
          sql.NVarChar,
          data.maritalStatus?.trim() || null
        )
        .input(
          "spouseEmployer",
          sql.NVarChar,
          data.spouseEmployer?.trim() || null
        )
        .input("employerName", sql.NVarChar, data.employerName?.trim() || null)
        .input(
          "employerAddress",
          sql.NVarChar,
          data.employerAddress?.trim() || null
        )
        .input("yearsInCounty", sql.Int, parseInt(data.yearsInCounty) || null)
        .input("ageRange", sql.NVarChar, data.ageRange?.trim() || null)
        .input("gender", sql.NVarChar, data.gender?.trim() || null)
        .input("education", sql.NVarChar, data.education?.trim() || null)
        .input(
          "paymentMethod",
          sql.NVarChar,
          data.paymentMethod?.trim() || null
        )
        .input("email", sql.NVarChar, data.email.toLowerCase().trim())
        .input("passwordHash", sql.NVarChar, data.passwordHash)
        .input(
          "criteriaResponses",
          sql.NVarChar,
          data.criteriaResponses
            ? safeJSONStringify(data.criteriaResponses)
            : null
        )
        .input(
          "userAgreementAccepted",
          sql.Bit,
          data.userAgreementAccepted || false
        ).query(`
          INSERT INTO dbo.Jurors (
            Name, PhoneNumber, Address1, Address2, City, State, ZipCode, County,
            MaritalStatus, SpouseEmployer, EmployerName, EmployerAddress, YearsInCounty,
            AgeRange, Gender, Education, PaymentMethod, Email, PasswordHash,
            CriteriaResponses, UserAgreementAccepted, AgreementAcceptedAt, 
            IsVerified, VerificationStatus, IsActive, IsDeleted,
            IntroVideoCompleted, JurorQuizCompleted, OnboardingCompleted, ProfileComplete,
            CreatedAt, UpdatedAt
          ) VALUES (
            @name, @phoneNumber, @address1, @address2, @city, @state, @zipCode, @county,
            @maritalStatus, @spouseEmployer, @employerName, @employerAddress, @yearsInCounty,
            @ageRange, @gender, @education, @paymentMethod, @email, @passwordHash,
            @criteriaResponses, @userAgreementAccepted,
            CASE WHEN @userAgreementAccepted = 1 THEN GETUTCDATE() ELSE NULL END,
            0, 'pending', 1, 0, 0, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
          );
          SELECT SCOPE_IDENTITY() AS JurorId;
        `);

      return result.recordset[0].JurorId;
    });
  } catch (error) {
    console.error("❌ [Juror.createJuror] Error:", error.message);
    throw error;
  }
}

// ============================================
// VERIFICATION & TASKS
// ============================================

async function updateLastLogin(jurorId) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");

    await executeQuery(async (pool) => {
      await pool.request().input("jurorId", sql.Int, id).query(`
          UPDATE dbo.Jurors
          SET LastLoginAt = GETUTCDATE(), UpdatedAt = GETUTCDATE()
          WHERE JurorId = @jurorId
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Juror.updateLastLogin] Error:", error.message);
    throw error;
  }
}

async function updateVerificationStatus(jurorId, status) {
  try {
    const id = parseInt(jurorId, 10);
    const validStatuses = ["pending", "verified", "rejected"];

    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");
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
        .input("id", sql.Int, id)
        .input("status", sql.NVarChar, status).query(`
          UPDATE dbo.Jurors
          SET VerificationStatus = @status,
              IsVerified = CASE WHEN @status = 'verified' THEN 1 ELSE 0 END,
              VerifiedAt = CASE WHEN @status = 'verified' THEN GETUTCDATE() ELSE NULL END,
              UpdatedAt = GETUTCDATE()
          WHERE JurorId = @id
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Juror.updateVerificationStatus] Error:", error.message);
    throw error;
  }
}

async function updateTaskCompletion(jurorId, task, completed = true) {
  try {
    const validTasks = {
      intro_video: "IntroVideoCompleted",
      juror_quiz: "JurorQuizCompleted",
      onboarding: "OnboardingCompleted",
      profile: "ProfileComplete",
    };

    if (!validTasks[task]) {
      throw new Error(
        `Invalid task type. Must be one of: ${Object.keys(validTasks).join(
          ", "
        )}`
      );
    }

    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("completed", sql.Bit, completed)
        .input("id", sql.Int, id).query(`
          UPDATE dbo.Jurors
          SET ${validTasks[task]} = @completed, UpdatedAt = GETUTCDATE()
          WHERE JurorId = @id AND IsDeleted = 0
        `);
    });

    // Auto-update onboarding status if all prerequisites are met
    if (task === "intro_video" || task === "juror_quiz") {
      await updateOnboardingStatus(jurorId);
    }

    return true;
  } catch (error) {
    console.error("❌ [Juror.updateTaskCompletion] Error:", error.message);
    throw error;
  }
}

async function updateOnboardingStatus(jurorId) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");

    await executeQuery(async (pool) => {
      await pool.request().input("id", sql.Int, id).query(`
          UPDATE dbo.Jurors
          SET OnboardingCompleted = CASE 
                WHEN IntroVideoCompleted = 1 AND JurorQuizCompleted = 1 THEN 1 
                ELSE 0 
              END,
              UpdatedAt = GETUTCDATE()
          WHERE JurorId = @id AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Juror.updateOnboardingStatus] Error:", error.message);
    throw error;
  }
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

async function updateJurorProfile(jurorId, data) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id)) throw new Error("Valid juror ID required");

    const allowedFields = {
      name: sql.NVarChar,
      email: sql.NVarChar,
      phoneNumber: sql.NVarChar,
      address1: sql.NVarChar,
      address2: sql.NVarChar,
      city: sql.NVarChar,
      state: sql.NVarChar,
      zipCode: sql.NVarChar,
      county: sql.NVarChar,
      paymentMethod: sql.NVarChar,
      maritalStatus: sql.NVarChar,
      spouseEmployer: sql.NVarChar,
      employerName: sql.NVarChar,
      employerAddress: sql.NVarChar,
      yearsInCounty: sql.Int,
      ageRange: sql.NVarChar,
      gender: sql.NVarChar,
      education: sql.NVarChar,
    };

    const updates = [];
    const request = (await getPool()).request().input("id", sql.Int, id);

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields[key] !== undefined) {
        const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
        updates.push(`${fieldName} = @${key}`);

        if (allowedFields[key] === sql.Int) {
          request.input(key, allowedFields[key], parseInt(value) || null);
        } else {
          request.input(key, allowedFields[key], value?.trim() || null);
        }
      }
    }

    if (updates.length === 0) {
      throw new Error("No valid fields to update");
    }

    updates.push("UpdatedAt = GETUTCDATE()");

    await request.query(`
      UPDATE dbo.Jurors 
      SET ${updates.join(", ")} 
      WHERE JurorId = @id AND IsDeleted = 0
    `);

    return true;
  } catch (error) {
    console.error("❌ [Juror.updateJurorProfile] Error:", error.message);
    throw error;
  }
}

async function updatePassword(jurorId, passwordHash) {
  try {
    if (!passwordHash) throw new Error("Password hash is required");

    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("passwordHash", sql.NVarChar, passwordHash).query(`
          UPDATE dbo.Jurors
          SET PasswordHash = @passwordHash, UpdatedAt = GETUTCDATE()
          WHERE JurorId = @id AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Juror.updatePassword] Error:", error.message);
    throw error;
  }
}

async function updateCriteriaResponses(jurorId, criteriaResponses) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input(
          "criteriaResponses",
          sql.NVarChar,
          safeJSONStringify(criteriaResponses)
        ).query(`
          UPDATE dbo.Jurors
          SET CriteriaResponses = @criteriaResponses, UpdatedAt = GETUTCDATE()
          WHERE JurorId = @id AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Juror.updateCriteriaResponses] Error:", error.message);
    throw error;
  }
}

// ============================================
// VALIDATION CHECKS (NEW)
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
        FROM dbo.Jurors
        WHERE LOWER(Email) = @email AND IsDeleted = 0
      `;

      if (excludeId) {
        query += " AND JurorId != @excludeId";
        request.input("excludeId", sql.Int, excludeId);
      }

      const result = await request.query(query);
      return result.recordset[0].count > 0;
    });
  } catch (error) {
    console.error("❌ [Juror.checkEmailExists] Error:", error.message);
    throw error;
  }
}

// ============================================
// ACCOUNT STATUS (NEW)
// ============================================

async function deactivateJuror(jurorId) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");

    await executeQuery(async (pool) => {
      await pool.request().input("id", sql.Int, id).query(`
          UPDATE dbo.Jurors
          SET IsActive = 0, UpdatedAt = GETUTCDATE()
          WHERE JurorId = @id
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Juror.deactivateJuror] Error:", error.message);
    throw error;
  }
}

async function reactivateJuror(jurorId) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");

    await executeQuery(async (pool) => {
      await pool.request().input("id", sql.Int, id).query(`
          UPDATE dbo.Jurors
          SET IsActive = 1, UpdatedAt = GETUTCDATE()
          WHERE JurorId = @id AND IsDeleted = 0
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Juror.reactivateJuror] Error:", error.message);
    throw error;
  }
}

async function softDeleteJuror(jurorId) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid juror ID required");

    await executeQuery(async (pool) => {
      await pool.request().input("id", sql.Int, id).query(`
          UPDATE dbo.Jurors
          SET IsDeleted = 1, IsActive = 0, UpdatedAt = GETUTCDATE()
          WHERE JurorId = @id
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Juror.softDeleteJuror] Error:", error.message);
    throw error;
  }
}

// ============================================
// LISTING + STATISTICS
// ============================================

async function getActiveJurorsByCounty(county, limit = 50) {
  try {
    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("county", sql.NVarChar, county.trim())
        .input("limit", sql.Int, Math.min(100, Math.max(1, limit))).query(`
          SELECT TOP(@limit)
            JurorId, Name, Email, County, State, 
            VerificationStatus, IsVerified, OnboardingCompleted, 
            CreatedAt, LastLoginAt
          FROM dbo.Jurors
          WHERE County = @county 
            AND IsActive = 1 
            AND IsVerified = 1 
            AND OnboardingCompleted = 1
            AND IsDeleted = 0
          ORDER BY CreatedAt DESC
        `);

      return result.recordset;
    });
  } catch (error) {
    console.error("❌ [Juror.getActiveJurorsByCounty] Error:", error.message);
    throw error;
  }
}

async function getAllJurors(options = {}) {
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

      if (options.county) {
        whereClauses.push("County = @county");
        request.input("county", sql.NVarChar, options.county);
      }

      if (options.state) {
        whereClauses.push("State = @state");
        request.input("state", sql.NVarChar, options.state.toUpperCase());
      }

      if (options.verificationStatus) {
        whereClauses.push("VerificationStatus = @status");
        request.input("status", sql.NVarChar, options.verificationStatus);
      }

      if (options.isActive !== undefined) {
        whereClauses.push("IsActive = @isActive");
        request.input("isActive", sql.Bit, options.isActive);
      }

      if (options.onboardingCompleted !== undefined) {
        whereClauses.push("OnboardingCompleted = @onboarding");
        request.input("onboarding", sql.Bit, options.onboardingCompleted);
      }

      if (options.search) {
        const searchTerm = `%${options.search}%`;
        whereClauses.push("(Name LIKE @search OR Email LIKE @search)");
        request.input("search", sql.NVarChar, searchTerm);
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const query = `
        SELECT 
          JurorId, Name, Email, County, State, PhoneNumber,
          VerificationStatus, IsVerified, IsActive,
          OnboardingCompleted, IntroVideoCompleted, JurorQuizCompleted, ProfileComplete,
          CreatedAt, LastLoginAt, UpdatedAt
        FROM dbo.Jurors
        ${whereClause}
        ORDER BY CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

        SELECT COUNT(*) AS total 
        FROM dbo.Jurors 
        ${whereClause};
      `;

      const result = await request.query(query);

      return {
        jurors: result.recordsets[0],
        total: result.recordsets[1][0].total,
        page,
        limit,
        totalPages: Math.ceil(result.recordsets[1][0].total / limit),
      };
    });
  } catch (error) {
    console.error("❌ [Juror.getAllJurors] Error:", error.message);
    throw error;
  }
}

async function getJurorStatistics() {
  try {
    return await executeQuery(async (pool) => {
      const result = await pool.request().query(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN IsActive = 1 AND IsDeleted = 0 THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN IsActive = 0 OR IsDeleted = 1 THEN 1 ELSE 0 END) AS inactive,
          SUM(CASE WHEN VerificationStatus = 'pending' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN VerificationStatus = 'verified' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS verified,
          SUM(CASE WHEN VerificationStatus = 'rejected' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS rejected,
          SUM(CASE WHEN OnboardingCompleted = 1 AND IsDeleted = 0 THEN 1 ELSE 0 END) AS onboardingCompleted,
          SUM(CASE WHEN IntroVideoCompleted = 1 AND IsDeleted = 0 THEN 1 ELSE 0 END) AS introVideoCompleted,
          SUM(CASE WHEN JurorQuizCompleted = 1 AND IsDeleted = 0 THEN 1 ELSE 0 END) AS jurorQuizCompleted
        FROM dbo.Jurors
        WHERE IsDeleted = 0
      `);

      return result.recordset[0];
    });
  } catch (error) {
    console.error("❌ [Juror.getJurorStatistics] Error:", error.message);
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
  createJuror,

  // Updates
  updateLastLogin,
  updateVerificationStatus,
  updateTaskCompletion,
  updateOnboardingStatus,
  updateJurorProfile,
  updatePassword,
  updateCriteriaResponses,

  // Validation
  checkEmailExists,

  // Account management
  deactivateJuror,
  reactivateJuror,
  softDeleteJuror,

  // Listings and stats
  getActiveJurorsByCounty,
  getAllJurors,
  getJurorStatistics,
};
