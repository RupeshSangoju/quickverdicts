// =============================================
// AttorneyRescheduleRequest.js - Attorney-Initiated Reschedule Request Model
// Description: Handles attorney requests to reschedule cases from war room
// =============================================

const { getPool, executeQuery, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

const RESCHEDULE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

// ============================================
// VALIDATION HELPERS
// ============================================

function validateRescheduleRequestData(data) {
  const errors = [];

  if (!data.caseId || isNaN(parseInt(data.caseId))) {
    errors.push("Valid case ID is required");
  }
  if (!data.attorneyId || isNaN(parseInt(data.attorneyId))) {
    errors.push("Valid attorney ID is required");
  }
  if (!data.newScheduledDate) {
    errors.push("New scheduled date is required");
  }
  if (!data.newScheduledTime) {
    errors.push("New scheduled time is required");
  }
  if (!data.originalScheduledDate) {
    errors.push("Original scheduled date is required");
  }
  if (!data.originalScheduledTime) {
    errors.push("Original scheduled time is required");
  }

  if (errors.length > 0) {
    const err = new Error(`Validation failed: ${errors.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }
}

// ============================================
// CREATE
// ============================================

/**
 * Create a new attorney-initiated reschedule request
 * @param {Object} data - Reschedule request data
 * @returns {Promise<number>} RequestId
 */
async function createRescheduleRequest(data) {
  try {
    validateRescheduleRequestData(data);

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("caseId", sql.Int, parseInt(data.caseId))
        .input("attorneyId", sql.Int, parseInt(data.attorneyId))
        .input("newScheduledDate", sql.Date, data.newScheduledDate)
        .input("newScheduledTime", sql.VarChar, data.newScheduledTime)
        .input("originalScheduledDate", sql.Date, data.originalScheduledDate)
        .input("originalScheduledTime", sql.VarChar, data.originalScheduledTime)
        .input("reason", sql.NVarChar, data.reason?.trim() || null)
        .input("attorneyComments", sql.NVarChar, data.attorneyComments?.trim() || null)
        .input("status", sql.NVarChar, RESCHEDULE_STATUS.PENDING)
        .query(`
          INSERT INTO dbo.AttorneyRescheduleRequests (
            CaseId, AttorneyId, NewScheduledDate, NewScheduledTime,
            OriginalScheduledDate, OriginalScheduledTime,
            Reason, AttorneyComments, Status,
            CreatedAt, UpdatedAt
          )
          VALUES (
            @caseId, @attorneyId, @newScheduledDate, @newScheduledTime,
            @originalScheduledDate, @originalScheduledTime,
            @reason, @attorneyComments, @status,
            GETUTCDATE(), GETUTCDATE()
          );
          SELECT SCOPE_IDENTITY() AS RequestId;
        `);

      const requestId = result.recordset[0].RequestId;
      console.log(`✅ [AttorneyRescheduleRequest.createRescheduleRequest] Created request ${requestId} for case ${data.caseId}`);
      return requestId;
    });
  } catch (error) {
    console.error("❌ [AttorneyRescheduleRequest.createRescheduleRequest] Error:", error.message);
    throw error;
  }
}

// ============================================
// READ
// ============================================

/**
 * Get reschedule request by ID
 * @param {number} requestId - Request ID
 * @returns {Promise<Object|null>} Reschedule request
 */
async function findById(requestId) {
  try {
    const id = parseInt(requestId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid request ID is required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("requestId", sql.Int, id)
        .query(`
          SELECT
            arr.*,
            c.CaseTitle,
            c.CaseDescription,
            a.FirstName + ' ' + a.LastName AS AttorneyName,
            a.Email AS AttorneyEmail,
            adm.FirstName + ' ' + adm.LastName AS AdminName,
            adm.Email AS AdminEmail
          FROM dbo.AttorneyRescheduleRequests arr
          INNER JOIN dbo.Cases c ON arr.CaseId = c.CaseId
          INNER JOIN dbo.Attorneys a ON arr.AttorneyId = a.AttorneyId
          LEFT JOIN dbo.Admins adm ON arr.AdminId = adm.AdminId
          WHERE arr.RequestId = @requestId
        `);

      return result.recordset[0] || null;
    });
  } catch (error) {
    console.error("❌ [AttorneyRescheduleRequest.findById] Error:", error.message);
    throw error;
  }
}

/**
 * Get reschedule request by case ID
 * @param {number} caseId - Case ID
 * @returns {Promise<Object|null>} Latest reschedule request for the case
 */
async function findByCaseId(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("caseId", sql.Int, id)
        .query(`
          SELECT TOP 1
            arr.*,
            c.CaseTitle,
            c.CaseDescription,
            a.FirstName + ' ' + a.LastName AS AttorneyName,
            a.Email AS AttorneyEmail,
            adm.FirstName + ' ' + adm.LastName AS AdminName,
            adm.Email AS AdminEmail
          FROM dbo.AttorneyRescheduleRequests arr
          INNER JOIN dbo.Cases c ON arr.CaseId = c.CaseId
          INNER JOIN dbo.Attorneys a ON arr.AttorneyId = a.AttorneyId
          LEFT JOIN dbo.Admins adm ON arr.AdminId = adm.AdminId
          WHERE arr.CaseId = @caseId
          ORDER BY arr.CreatedAt DESC
        `);

      return result.recordset[0] || null;
    });
  } catch (error) {
    console.error("❌ [AttorneyRescheduleRequest.findByCaseId] Error:", error.message);
    throw error;
  }
}

/**
 * Get all pending reschedule requests (for admin)
 * @returns {Promise<Array>} Array of pending reschedule requests
 */
async function getPendingRequests() {
  try {
    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("status", sql.NVarChar, RESCHEDULE_STATUS.PENDING)
        .query(`
          SELECT
            arr.*,
            c.CaseTitle,
            c.CaseDescription,
            c.County,
            c.State,
            c.CaseType,
            a.FirstName + ' ' + a.LastName AS AttorneyName,
            a.Email AS AttorneyEmail,
            a.LawFirmName,
            (SELECT COUNT(*) FROM dbo.JurorApplications ja
             WHERE ja.CaseId = arr.CaseId AND ja.Status = 'approved') AS ApprovedJurors
          FROM dbo.AttorneyRescheduleRequests arr
          INNER JOIN dbo.Cases c ON arr.CaseId = c.CaseId
          INNER JOIN dbo.Attorneys a ON arr.AttorneyId = a.AttorneyId
          WHERE arr.Status = @status
          ORDER BY arr.CreatedAt ASC
        `);

      return result.recordset;
    });
  } catch (error) {
    console.error("❌ [AttorneyRescheduleRequest.getPendingRequests] Error:", error.message);
    throw error;
  }
}

/**
 * Get all reschedule requests for an attorney
 * @param {number} attorneyId - Attorney ID
 * @returns {Promise<Array>} Array of reschedule requests
 */
async function getByAttorneyId(attorneyId) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid attorney ID is required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("attorneyId", sql.Int, id)
        .query(`
          SELECT
            arr.*,
            c.CaseTitle,
            c.CaseDescription,
            adm.FirstName + ' ' + adm.LastName AS AdminName
          FROM dbo.AttorneyRescheduleRequests arr
          INNER JOIN dbo.Cases c ON arr.CaseId = c.CaseId
          LEFT JOIN dbo.Admins adm ON arr.AdminId = adm.AdminId
          WHERE arr.AttorneyId = @attorneyId
          ORDER BY arr.CreatedAt DESC
        `);

      return result.recordset;
    });
  } catch (error) {
    console.error("❌ [AttorneyRescheduleRequest.getByAttorneyId] Error:", error.message);
    throw error;
  }
}

// ============================================
// UPDATE
// ============================================

/**
 * Approve reschedule request
 * @param {number} requestId - Request ID
 * @param {number} adminId - Admin ID who approved
 * @param {string} adminComments - Optional admin comments
 * @returns {Promise<boolean>} Success status
 */
async function approveRequest(requestId, adminId, adminComments = null) {
  try {
    const reqId = parseInt(requestId, 10);
    const admId = parseInt(adminId, 10);

    if (isNaN(reqId) || reqId <= 0) {
      throw new Error("Valid request ID is required");
    }
    if (isNaN(admId) || admId <= 0) {
      throw new Error("Valid admin ID is required");
    }

    return await executeQuery(async (pool) => {
      await pool
        .request()
        .input("requestId", sql.Int, reqId)
        .input("adminId", sql.Int, admId)
        .input("status", sql.NVarChar, RESCHEDULE_STATUS.APPROVED)
        .input("adminComments", sql.NVarChar, adminComments?.trim() || null)
        .query(`
          UPDATE dbo.AttorneyRescheduleRequests
          SET
            Status = @status,
            AdminId = @adminId,
            AdminComments = @adminComments,
            RespondedAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
          WHERE RequestId = @requestId
        `);

      console.log(`✅ [AttorneyRescheduleRequest.approveRequest] Approved request ${reqId} by admin ${admId}`);
      return true;
    });
  } catch (error) {
    console.error("❌ [AttorneyRescheduleRequest.approveRequest] Error:", error.message);
    throw error;
  }
}

/**
 * Reject reschedule request
 * @param {number} requestId - Request ID
 * @param {number} adminId - Admin ID who rejected
 * @param {string} adminComments - Admin comments explaining rejection
 * @returns {Promise<boolean>} Success status
 */
async function rejectRequest(requestId, adminId, adminComments) {
  try {
    const reqId = parseInt(requestId, 10);
    const admId = parseInt(adminId, 10);

    if (isNaN(reqId) || reqId <= 0) {
      throw new Error("Valid request ID is required");
    }
    if (isNaN(admId) || admId <= 0) {
      throw new Error("Valid admin ID is required");
    }
    if (!adminComments || adminComments.trim().length === 0) {
      throw new Error("Admin comments are required for rejection");
    }

    return await executeQuery(async (pool) => {
      await pool
        .request()
        .input("requestId", sql.Int, reqId)
        .input("adminId", sql.Int, admId)
        .input("status", sql.NVarChar, RESCHEDULE_STATUS.REJECTED)
        .input("adminComments", sql.NVarChar, adminComments.trim())
        .query(`
          UPDATE dbo.AttorneyRescheduleRequests
          SET
            Status = @status,
            AdminId = @adminId,
            AdminComments = @adminComments,
            RespondedAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
          WHERE RequestId = @requestId
        `);

      console.log(`✅ [AttorneyRescheduleRequest.rejectRequest] Rejected request ${reqId} by admin ${admId}`);
      return true;
    });
  } catch (error) {
    console.error("❌ [AttorneyRescheduleRequest.rejectRequest] Error:", error.message);
    throw error;
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if a case has pending reschedule request
 * @param {number} caseId - Case ID
 * @returns {Promise<boolean>} True if has pending request
 */
async function hasPendingRequest(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("caseId", sql.Int, id)
        .input("status", sql.NVarChar, RESCHEDULE_STATUS.PENDING)
        .query(`
          SELECT COUNT(*) AS count
          FROM dbo.AttorneyRescheduleRequests
          WHERE CaseId = @caseId AND Status = @status
        `);

      return result.recordset[0].count > 0;
    });
  } catch (error) {
    console.error("❌ [AttorneyRescheduleRequest.hasPendingRequest] Error:", error.message);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Create
  createRescheduleRequest,

  // Read
  findById,
  findByCaseId,
  getPendingRequests,
  getByAttorneyId,

  // Update
  approveRequest,
  rejectRequest,

  // Helpers
  hasPendingRequest,

  // Constants
  RESCHEDULE_STATUS,
};
