// =============================================
// JurorApplication.js - Juror Application Model
// =============================================

const { getPool, executeQuery, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

const APPLICATION_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
};

// ============================================
// VALIDATION HELPERS
// ============================================

function validateApplicationData(data) {
  const errors = [];

  if (!data.jurorId || isNaN(parseInt(data.jurorId))) {
    errors.push("Valid juror ID is required");
  }
  if (!data.caseId || isNaN(parseInt(data.caseId))) {
    errors.push("Valid case ID is required");
  }

  // Validate voir dire responses if provided
  if (data.voirDire1Responses && !Array.isArray(data.voirDire1Responses)) {
    errors.push("Voir Dire 1 responses must be an array");
  }
  if (data.voirDire2Responses && !Array.isArray(data.voirDire2Responses)) {
    errors.push("Voir Dire 2 responses must be an array");
  }

  if (errors.length > 0) {
    const err = new Error(
      `Application validation failed: ${errors.join(", ")}`
    );
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }
}

function safeJSONParse(jsonString, fallback = []) {
  if (!jsonString) return fallback;
  if (typeof jsonString === "object") return jsonString;

  try {
    return JSON.parse(jsonString) || fallback;
  } catch (error) {
    console.warn("⚠️  JSON parse error:", error.message);
    return fallback;
  }
}

function safeJSONStringify(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value || []);
  } catch (error) {
    console.warn("⚠️  JSON stringify error:", error.message);
    return "[]";
  }
}

// ============================================
// CREATE OPERATIONS
// ============================================

async function createApplication(applicationData) {
  try {
    validateApplicationData(applicationData);

    // Check if juror already applied
    const alreadyApplied = await hasJurorAppliedToCase(
      applicationData.jurorId,
      applicationData.caseId
    );

    if (alreadyApplied) {
      const err = new Error("You have already applied to this case");
      err.code = "DUPLICATE_APPLICATION";
      err.statusCode = 409;
      throw err;
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("jurorId", sql.Int, parseInt(applicationData.jurorId))
        .input("caseId", sql.Int, parseInt(applicationData.caseId))
        .input(
          "voirDire1Responses",
          sql.NVarChar,
          safeJSONStringify(applicationData.voirDire1Responses || [])
        )
        .input(
          "voirDire2Responses",
          sql.NVarChar,
          safeJSONStringify(applicationData.voirDire2Responses || [])
        )
        .input("status", sql.NVarChar, APPLICATION_STATUSES.PENDING).query(`
          INSERT INTO dbo.JurorApplications (
            JurorId, CaseId, VoirDire1Responses, VoirDire2Responses,
            Status, AppliedAt, CreatedAt, UpdatedAt
          ) VALUES (
            @jurorId, @caseId, @voirDire1Responses, @voirDire2Responses,
            @status, GETUTCDATE(), GETUTCDATE(), GETUTCDATE()
          );
          SELECT SCOPE_IDENTITY() as ApplicationId;
        `);

      return result.recordset[0].ApplicationId;
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.createApplication] Error:",
      error.message
    );
    throw error;
  }
}

// ============================================
// READ OPERATIONS
// ============================================

async function findById(applicationId) {
  try {
    const id = parseInt(applicationId, 10);
    if (isNaN(id) || id <= 0) {
      const err = new Error("Valid application ID is required");
      err.statusCode = 400;
      throw err;
    }

    return await executeQuery(async (pool) => {
      const result = await pool.request().input("applicationId", sql.Int, id)
        .query(`
          SELECT 
            ja.*,
            j.Name as JurorName,
            j.Email as JurorEmail,
            j.PhoneNumber as JurorPhone,
            j.County as JurorCounty,
            j.State as JurorState,
            j.AgeRange,
            j.Gender,
            j.Education,
            j.IsVerified as JurorVerified,
            j.OnboardingCompleted,
            c.CaseTitle,
            c.CaseType,
            c.CaseTier,
            c.County as CaseCounty,
            c.ScheduledDate,
            c.ScheduledTime,
            c.PaymentAmount,
            c.AttorneyId,
            c.AttorneyStatus,
            a.FirstName + ' ' + a.LastName as AttorneyName,
            a.Email as AttorneyEmail,
            a.LawFirmName
          FROM dbo.JurorApplications ja
          INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
          INNER JOIN dbo.Cases c ON ja.CaseId = c.CaseId
          INNER JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
          WHERE ja.ApplicationId = @applicationId
        `);

      const app = result.recordset[0];
      if (app) {
        app.VoirDire1Responses = safeJSONParse(app.VoirDire1Responses, []);
        app.VoirDire2Responses = safeJSONParse(app.VoirDire2Responses, []);
      }

      return app || null;
    });
  } catch (error) {
    console.error("❌ [JurorApplication.findById] Error:", error.message);
    throw error;
  }
}

async function findByJurorAndCase(jurorId, caseId) {
  try {
    const jurId = parseInt(jurorId, 10);
    const csId = parseInt(caseId, 10);

    if (isNaN(jurId) || jurId <= 0 || isNaN(csId) || csId <= 0) {
      throw new Error("Valid juror ID and case ID are required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("jurorId", sql.Int, jurId)
        .input("caseId", sql.Int, csId).query(`
          SELECT * FROM dbo.JurorApplications
          WHERE JurorId = @jurorId AND CaseId = @caseId
        `);

      const app = result.recordset[0];
      if (app) {
        app.VoirDire1Responses = safeJSONParse(app.VoirDire1Responses, []);
        app.VoirDire2Responses = safeJSONParse(app.VoirDire2Responses, []);
      }

      return app || null;
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.findByJurorAndCase] Error:",
      error.message
    );
    throw error;
  }
}

async function getApplicationsByCase(caseId, options = {}) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    return await executeQuery(async (pool) => {
      const request = pool.request().input("caseId", sql.Int, id);

      let query = `
        SELECT 
          ja.ApplicationId,
          ja.JurorId,
          ja.CaseId,
          ja.VoirDire1Responses,
          ja.VoirDire2Responses,
          ja.Status,
          ja.ReviewedBy,
          ja.ReviewedAt,
          ja.ReviewComments,
          ja.AppliedAt,
          ja.CreatedAt,
          ja.UpdatedAt,
          j.Name as JurorName,
          j.Email as JurorEmail,
          j.PhoneNumber,
          j.County,
          j.State,
          j.AgeRange,
          j.Gender,
          j.Education,
          j.IsVerified as JurorVerified,
          j.OnboardingCompleted
        FROM dbo.JurorApplications ja
        INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
        WHERE ja.CaseId = @caseId
      `;

      if (options.status) {
        const validStatuses = Object.values(APPLICATION_STATUSES);
        if (!validStatuses.includes(options.status)) {
          throw new Error(
            `Invalid status. Must be one of: ${validStatuses.join(", ")}`
          );
        }
        query += ` AND ja.Status = @status`;
        request.input("status", sql.NVarChar, options.status);
      }

      query += ` ORDER BY ja.AppliedAt ASC`;

      const result = await request.query(query);

      // Parse JSON fields
      return result.recordset.map((app) => ({
        ...app,
        VoirDire1Responses: safeJSONParse(app.VoirDire1Responses, []),
        VoirDire2Responses: safeJSONParse(app.VoirDire2Responses, []),
      }));
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.getApplicationsByCase] Error:",
      error.message
    );
    throw error;
  }
}

async function getApplicationsByJuror(jurorId) {
  try {
    const id = parseInt(jurorId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid juror ID is required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool.request().input("jurorId", sql.Int, id).query(`
          SELECT 
            ja.ApplicationId,
            ja.JurorId,
            ja.CaseId,
            ja.VoirDire1Responses,
            ja.VoirDire2Responses,
            ja.Status,
            ja.ReviewedBy,
            ja.ReviewedAt,
            ja.ReviewComments,
            ja.AppliedAt,
            ja.CreatedAt,
            ja.UpdatedAt,
            c.CaseTitle,
            c.CaseDescription,
            c.CaseType,
            c.CaseTier,
            c.County,
            c.ScheduledDate,
            c.ScheduledTime,
            c.PaymentAmount,
            c.AttorneyStatus,
            c.AdminApprovalStatus,
            a.FirstName + ' ' + a.LastName as AttorneyName,
            a.LawFirmName,
            a.Email as AttorneyEmail
          FROM dbo.JurorApplications ja
          INNER JOIN dbo.Cases c ON ja.CaseId = c.CaseId
          INNER JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
          WHERE ja.JurorId = @jurorId
          ORDER BY ja.AppliedAt DESC
        `);

      // Parse JSON fields
      return result.recordset.map((app) => ({
        ...app,
        VoirDire1Responses: safeJSONParse(app.VoirDire1Responses, []),
        VoirDire2Responses: safeJSONParse(app.VoirDire2Responses, []),
      }));
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.getApplicationsByJuror] Error:",
      error.message
    );
    throw error;
  }
}

async function getApprovedJurorsForCase(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("caseId", sql.Int, id)
        .input("status", sql.NVarChar, APPLICATION_STATUSES.APPROVED).query(`
          SELECT 
            ja.ApplicationId,
            ja.JurorId,
            ja.CaseId,
            ja.VoirDire1Responses,
            ja.VoirDire2Responses,
            ja.Status,
            ja.ReviewedBy,
            ja.ReviewedAt,
            ja.AppliedAt,
            j.Name as JurorName,
            j.Email as JurorEmail,
            j.PhoneNumber,
            j.County,
            j.State,
            j.AgeRange,
            j.Gender,
            j.Education
          FROM dbo.JurorApplications ja
          INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
          WHERE ja.CaseId = @caseId AND ja.Status = @status
          ORDER BY ja.ReviewedAt ASC
        `);

      // Parse JSON fields
      return result.recordset.map((app) => ({
        ...app,
        VoirDire1Responses: safeJSONParse(app.VoirDire1Responses, []),
        VoirDire2Responses: safeJSONParse(app.VoirDire2Responses, []),
      }));
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.getApprovedJurorsForCase] Error:",
      error.message
    );
    throw error;
  }
}

async function getPendingApplicationsCount(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("caseId", sql.Int, id)
        .input("status", sql.NVarChar, APPLICATION_STATUSES.PENDING).query(`
          SELECT COUNT(*) as count
          FROM dbo.JurorApplications
          WHERE CaseId = @caseId AND Status = @status
        `);

      return result.recordset[0].count;
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.getPendingApplicationsCount] Error:",
      error.message
    );
    throw error;
  }
}

async function getApplicationStatsByCase(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool.request().input("caseId", sql.Int, id).query(`
          SELECT 
            COUNT(*) as Total,
            SUM(CASE WHEN Status = 'pending' THEN 1 ELSE 0 END) as Pending,
            SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) as Approved,
            SUM(CASE WHEN Status = 'rejected' THEN 1 ELSE 0 END) as Rejected,
            SUM(CASE WHEN Status = 'withdrawn' THEN 1 ELSE 0 END) as Withdrawn
          FROM dbo.JurorApplications
          WHERE CaseId = @caseId
        `);

      return result.recordset[0];
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.getApplicationStatsByCase] Error:",
      error.message
    );
    throw error;
  }
}

async function hasJurorAppliedToCase(jurorId, caseId) {
  try {
    const jurId = parseInt(jurorId, 10);
    const csId = parseInt(caseId, 10);

    if (isNaN(jurId) || jurId <= 0 || isNaN(csId) || csId <= 0) {
      return false; // Invalid IDs
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("jurorId", sql.Int, jurId)
        .input("caseId", sql.Int, csId).query(`
          SELECT COUNT(*) as count
          FROM dbo.JurorApplications
          WHERE JurorId = @jurorId AND CaseId = @caseId
        `);

      return result.recordset[0].count > 0;
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.hasJurorAppliedToCase] Error:",
      error.message
    );
    return false; // Fail safe
  }
}

// ============================================
// UPDATE OPERATIONS
// ============================================

async function updateApplicationStatus(
  applicationId,
  status,
  reviewedBy,
  comments = null
) {
  try {
    const id = parseInt(applicationId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid application ID is required");
    }

    const validStatuses = Object.values(APPLICATION_STATUSES);
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    const reviewerId = reviewedBy ? parseInt(reviewedBy, 10) : null;
    if (reviewedBy && (isNaN(reviewerId) || reviewerId <= 0)) {
      throw new Error("Valid reviewer ID is required");
    }

    await executeQuery(async (pool) => {
      await pool
        .request()
        .input("applicationId", sql.Int, id)
        .input("status", sql.NVarChar, status)
        .input("reviewedBy", sql.Int, reviewerId)
        .input("comments", sql.NVarChar, comments?.trim() || null).query(`
          UPDATE dbo.JurorApplications 
          SET Status = @status,
              ReviewedBy = @reviewedBy,
              ReviewedAt = GETUTCDATE(),
              ReviewComments = @comments,
              UpdatedAt = GETUTCDATE()
          WHERE ApplicationId = @applicationId
        `);
    });

    return true;
  } catch (error) {
    console.error(
      "❌ [JurorApplication.updateApplicationStatus] Error:",
      error.message
    );
    throw error;
  }
}

async function withdrawApplication(applicationId, jurorId) {
  try {
    const appId = parseInt(applicationId, 10);
    const jurId = parseInt(jurorId, 10);

    if (isNaN(appId) || appId <= 0 || isNaN(jurId) || jurId <= 0) {
      throw new Error("Valid application ID and juror ID are required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("applicationId", sql.Int, appId)
        .input("jurorId", sql.Int, jurId)
        .input("status", sql.NVarChar, APPLICATION_STATUSES.WITHDRAWN).query(`
          UPDATE dbo.JurorApplications 
          SET Status = @status,
              UpdatedAt = GETUTCDATE()
          WHERE ApplicationId = @applicationId 
            AND JurorId = @jurorId
            AND Status = 'pending';
          SELECT @@ROWCOUNT as affected;
        `);

      return result.recordset[0].affected > 0;
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.withdrawApplication] Error:",
      error.message
    );
    throw error;
  }
}

async function batchApproveApplications(
  applicationIds,
  reviewedBy,
  comments = null
) {
  try {
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      throw new Error("Valid application IDs array is required");
    }

    const reviewerId = parseInt(reviewedBy, 10);
    if (isNaN(reviewerId) || reviewerId <= 0) {
      throw new Error("Valid reviewer ID is required");
    }

    // Validate all IDs
    const validIds = applicationIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id) && id > 0);

    if (validIds.length === 0) {
      throw new Error("No valid application IDs provided");
    }

    // Limit batch size for safety
    if (validIds.length > 50) {
      throw new Error("Cannot approve more than 50 applications at once");
    }

    return await executeQuery(async (pool) => {
      // Use parameterized query instead of string concatenation
      const idParams = validIds.map((_, i) => `@id${i}`).join(",");
      const request = pool
        .request()
        .input("reviewedBy", sql.Int, reviewerId)
        .input("status", sql.NVarChar, APPLICATION_STATUSES.APPROVED)
        .input("comments", sql.NVarChar, comments?.trim() || null);

      // Add each ID as a parameter
      validIds.forEach((id, i) => {
        request.input(`id${i}`, sql.Int, id);
      });

      const result = await request.query(`
        UPDATE dbo.JurorApplications 
        SET Status = @status,
            ReviewedBy = @reviewedBy,
            ReviewedAt = GETUTCDATE(),
            ReviewComments = @comments,
            UpdatedAt = GETUTCDATE()
        WHERE ApplicationId IN (${idParams})
          AND Status = 'pending';
        SELECT @@ROWCOUNT as affected;
      `);

      return result.recordset[0].affected;
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.batchApproveApplications] Error:",
      error.message
    );
    throw error;
  }
}

async function batchRejectApplications(
  applicationIds,
  reviewedBy,
  comments = null
) {
  try {
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      throw new Error("Valid application IDs array is required");
    }

    const reviewerId = parseInt(reviewedBy, 10);
    if (isNaN(reviewerId) || reviewerId <= 0) {
      throw new Error("Valid reviewer ID is required");
    }

    const validIds = applicationIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id) && id > 0);

    if (validIds.length === 0) {
      throw new Error("No valid application IDs provided");
    }

    if (validIds.length > 50) {
      throw new Error("Cannot reject more than 50 applications at once");
    }

    return await executeQuery(async (pool) => {
      const idParams = validIds.map((_, i) => `@id${i}`).join(",");
      const request = pool
        .request()
        .input("reviewedBy", sql.Int, reviewerId)
        .input("status", sql.NVarChar, APPLICATION_STATUSES.REJECTED)
        .input("comments", sql.NVarChar, comments?.trim() || null);

      validIds.forEach((id, i) => {
        request.input(`id${i}`, sql.Int, id);
      });

      const result = await request.query(`
        UPDATE dbo.JurorApplications 
        SET Status = @status,
            ReviewedBy = @reviewedBy,
            ReviewedAt = GETUTCDATE(),
            ReviewComments = @comments,
            UpdatedAt = GETUTCDATE()
        WHERE ApplicationId IN (${idParams})
          AND Status = 'pending';
        SELECT @@ROWCOUNT as affected;
      `);

      return result.recordset[0].affected;
    });
  } catch (error) {
    console.error(
      "❌ [JurorApplication.batchRejectApplications] Error:",
      error.message
    );
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  APPLICATION_STATUSES,

  // Create operations
  createApplication,

  // Read operations
  findById,
  findByJurorAndCase,
  getApplicationsByCase,
  getApplicationsByJuror,
  getApprovedJurorsForCase,
  getPendingApplicationsCount,
  getApplicationStatsByCase,
  hasJurorAppliedToCase,

  // Update operations
  updateApplicationStatus,
  withdrawApplication,
  batchApproveApplications,
  batchRejectApplications, // NEW
};
