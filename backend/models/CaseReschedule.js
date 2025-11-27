// =============================================
// CaseReschedule.js - Case Reschedule Request Model
// FIXED: Added SQL type safety, validation, better error handling
// =============================================

const { poolPromise, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

const ATTORNEY_RESPONSE_TYPES = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REQUESTED_DIFFERENT: "requested_different",
  REJECTED: "rejected",
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate reschedule request data
 * FIXED: Added validation
 */
function validateRescheduleData(data) {
  const errors = [];

  if (!data.caseId || isNaN(parseInt(data.caseId))) {
    errors.push("Valid case ID is required");
  }
  if (!data.rejectionReason || data.rejectionReason.trim().length === 0) {
    errors.push("Rejection reason is required");
  }

  if (errors.length > 0) {
    throw new Error(`Reschedule validation failed: ${errors.join(", ")}`);
  }
}

/**
 * Validate time slot
 * FIXED: Added slot validation
 */
function validateTimeSlot(slot) {
  if (!slot || typeof slot !== "object") {
    throw new Error("Time slot must be an object");
  }
  if (!slot.date || !slot.time) {
    throw new Error("Time slot must have date and time");
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  // Validate time format (HH:MM:SS or HH:MM)
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(slot.time)) {
    throw new Error("Invalid time format. Use HH:MM:SS or HH:MM");
  }

  return true;
}

/**
 * Safe JSON parse with fallback
 * FIXED: Added error handling
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
 * Safe JSON stringify
 */
function safeJSONStringify(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value || []);
  } catch (error) {
    console.error("JSON stringify error:", error);
    return "[]";
  }
}

// ============================================
// RESCHEDULE REQUEST OPERATIONS
// ============================================

/**
 * Create a reschedule request when admin rejects case due to scheduling conflict
 * FIXED: Added validation and SQL type safety
 *
 * @param {Object} rescheduleData - Reschedule request data
 * @returns {Promise<number>} RequestId
 */
async function createRescheduleRequest(rescheduleData) {
  try {
    // Validate input
    validateRescheduleData(rescheduleData);

    // Validate suggested slots if provided
    const suggestedSlots = Array.isArray(rescheduleData.suggestedSlots)
      ? rescheduleData.suggestedSlots
      : [];

    if (suggestedSlots.length > 0) {
      suggestedSlots.forEach((slot) => validateTimeSlot(slot));
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(rescheduleData.caseId))
      .input(
        "rejectionReason",
        sql.NVarChar,
        rescheduleData.rejectionReason.trim()
      )
      .input(
        "adminComments",
        sql.NVarChar,
        rescheduleData.adminComments?.trim() || null
      )
      .input("suggestedSlots", sql.NVarChar, safeJSONStringify(suggestedSlots))
      .input("attorneyResponse", sql.NVarChar, ATTORNEY_RESPONSE_TYPES.PENDING)
      .query(`
        INSERT INTO dbo.CaseRescheduleRequests 
          (CaseId, RejectionReason, AdminComments, SuggestedSlots, AttorneyResponse, CreatedAt, UpdatedAt)
        VALUES 
          (@caseId, @rejectionReason, @adminComments, @suggestedSlots, @attorneyResponse, GETUTCDATE(), GETUTCDATE());
        SELECT SCOPE_IDENTITY() as RequestId;
      `);

    return result.recordset[0].RequestId;
  } catch (error) {
    console.error("Error creating reschedule request:", error);
    throw error;
  }
}

/**
 * Get reschedule request by case ID
 * FIXED: Added SQL type safety and better parsing
 *
 * @param {number} caseId - Case ID
 * @returns {Promise<Object|null>} Reschedule request
 */
async function getRescheduleRequestByCase(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("caseId", sql.Int, id).query(`
        SELECT TOP 1 *
        FROM dbo.CaseRescheduleRequests
        WHERE CaseId = @caseId
        ORDER BY CreatedAt DESC
      `);

    const request = result.recordset[0];
    if (request) {
      // Parse JSON fields
      request.SuggestedSlots = safeJSONParse(request.SuggestedSlots, []);
      if (request.SelectedSlot) {
        request.SelectedSlot = safeJSONParse(request.SelectedSlot, null);
      }
    }

    return request || null;
  } catch (error) {
    console.error("Error getting reschedule request:", error);
    throw error;
  }
}

/**
 * Get all pending reschedule requests for attorney
 * FIXED: Added SQL type safety and better parsing
 *
 * @param {number} attorneyId - Attorney ID
 * @returns {Promise<Array>} Reschedule requests
 */
async function getPendingReschedulesByAttorney(attorneyId) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid attorney ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("attorneyId", sql.Int, id).query(`
        SELECT
          rr.RequestId,
          rr.CaseId,
          rr.RejectionReason,
          rr.AdminComments,
          rr.SuggestedSlots,
          rr.SelectedSlot,
          rr.AttorneyResponse,
          rr.CreatedAt,
          rr.UpdatedAt,
          c.CaseTitle,
          c.ScheduledDate as OriginalDate,
          c.ScheduledTime as OriginalTime,
          c.County,
          c.CaseType
        FROM dbo.CaseRescheduleRequests rr
        INNER JOIN dbo.Cases c ON rr.CaseId = c.CaseId
        WHERE c.AttorneyId = @attorneyId
          AND rr.AttorneyResponse = 'pending'
          AND c.AdminApprovalStatus IN ('pending', 'rejected')
        ORDER BY rr.CreatedAt DESC
      `);

    // Parse JSON fields
    return result.recordset.map((request) => ({
      ...request,
      SuggestedSlots: safeJSONParse(request.SuggestedSlots, []),
      SelectedSlot: request.SelectedSlot
        ? safeJSONParse(request.SelectedSlot, null)
        : null,
    }));
  } catch (error) {
    console.error("Error getting pending reschedules:", error);
    throw error;
  }
}

/**
 * Get all reschedule requests (admin view)
 * NEW: Added function for admin to view all reschedule requests
 *
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} Reschedule requests
 */
async function getAllRescheduleRequests(status = null) {
  try {
    const pool = await poolPromise;
    let query = `
      SELECT 
        rr.RequestId,
        rr.CaseId,
        rr.RejectionReason,
        rr.AdminComments,
        rr.SuggestedSlots,
        rr.SelectedSlot,
        rr.AttorneyResponse,
        rr.CreatedAt,
        rr.UpdatedAt,
        c.CaseTitle,
        c.ScheduledDate as OriginalDate,
        c.ScheduledTime as OriginalTime,
        c.County,
        c.CaseType,
        a.FirstName + ' ' + a.LastName AS AttorneyName,
        a.Email AS AttorneyEmail
      FROM dbo.CaseRescheduleRequests rr
      INNER JOIN dbo.Cases c ON rr.CaseId = c.CaseId
      LEFT JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
    `;

    const request = pool.request();

    if (status) {
      query += ` WHERE rr.AttorneyResponse = @status`;
      request.input("status", sql.NVarChar, status);
    }

    query += ` ORDER BY rr.CreatedAt DESC`;

    const result = await request.query(query);

    // Parse JSON fields
    return result.recordset.map((req) => ({
      ...req,
      SuggestedSlots: safeJSONParse(req.SuggestedSlots, []),
      SelectedSlot: req.SelectedSlot
        ? safeJSONParse(req.SelectedSlot, null)
        : null,
    }));
  } catch (error) {
    console.error("Error getting all reschedule requests:", error);
    throw error;
  }
}

/**
 * Attorney accepts a suggested slot
 * FIXED: Added validation and SQL type safety
 *
 * @param {number} requestId - Request ID
 * @param {Object} selectedSlot - {date, time}
 * @returns {Promise<void>}
 */
async function acceptSuggestedSlot(requestId, selectedSlot) {
  try {
    const id = parseInt(requestId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid request ID is required");
    }

    // Validate selected slot
    validateTimeSlot(selectedSlot);

    const pool = await poolPromise;
    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("selectedSlot", sql.NVarChar, safeJSONStringify(selectedSlot))
      .input("response", sql.NVarChar, ATTORNEY_RESPONSE_TYPES.ACCEPTED).query(`
        UPDATE dbo.CaseRescheduleRequests
        SET 
          AttorneyResponse = @response,
          SelectedSlot = @selectedSlot,
          UpdatedAt = GETUTCDATE()
        WHERE RequestId = @requestId
      `);
  } catch (error) {
    console.error("Error accepting suggested slot:", error);
    throw error;
  }
}

/**
 * Attorney requests different time slots
 * FIXED: Safer SQL and validation
 *
 * @param {number} requestId - Request ID
 * @param {string} message - Message to admin
 * @returns {Promise<void>}
 */
async function requestDifferentSlots(requestId, message) {
  try {
    const id = parseInt(requestId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid request ID is required");
    }

    if (!message || message.trim().length === 0) {
      throw new Error("Message is required");
    }

    if (message.trim().length > 1000) {
      throw new Error("Message too long (max 1000 characters)");
    }

    const pool = await poolPromise;

    // Get current comments
    const currentRequest = await findById(requestId);
    if (!currentRequest) {
      throw new Error("Reschedule request not found");
    }

    // FIXED: Safer comment concatenation
    const newComments = currentRequest.AdminComments
      ? `${currentRequest.AdminComments} | Attorney reply: ${message.trim()}`
      : `Attorney reply: ${message.trim()}`;

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("newComments", sql.NVarChar, newComments)
      .input(
        "response",
        sql.NVarChar,
        ATTORNEY_RESPONSE_TYPES.REQUESTED_DIFFERENT
      ).query(`
        UPDATE dbo.CaseRescheduleRequests
        SET 
          AttorneyResponse = @response,
          AdminComments = @newComments,
          UpdatedAt = GETUTCDATE()
        WHERE RequestId = @requestId
      `);
  } catch (error) {
    console.error("Error requesting different slots:", error);
    throw error;
  }
}

/**
 * Attorney rejects reschedule (withdraws case)
 * NEW: Added function for attorney to reject reschedule
 *
 * @param {number} requestId - Request ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<void>}
 */
async function rejectReschedule(requestId, reason) {
  try {
    const id = parseInt(requestId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid request ID is required");
    }

    const pool = await poolPromise;

    // Get current comments
    const currentRequest = await findById(requestId);
    if (!currentRequest) {
      throw new Error("Reschedule request not found");
    }

    const newComments = currentRequest.AdminComments
      ? `${currentRequest.AdminComments} | Attorney withdrew case: ${
          reason?.trim() || "No reason provided"
        }`
      : `Attorney withdrew case: ${reason?.trim() || "No reason provided"}`;

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("newComments", sql.NVarChar, newComments)
      .input("response", sql.NVarChar, ATTORNEY_RESPONSE_TYPES.REJECTED).query(`
        UPDATE dbo.CaseRescheduleRequests
        SET 
          AttorneyResponse = @response,
          AdminComments = @newComments,
          UpdatedAt = GETUTCDATE()
        WHERE RequestId = @requestId
      `);
  } catch (error) {
    console.error("Error rejecting reschedule:", error);
    throw error;
  }
}

/**
 * Get reschedule request by ID
 * FIXED: Added SQL type safety and parsing
 *
 * @param {number} requestId - Request ID
 * @returns {Promise<Object|null>} Reschedule request
 */
async function findById(requestId) {
  try {
    const id = parseInt(requestId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid request ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("requestId", sql.Int, id).query(`
        SELECT *
        FROM dbo.CaseRescheduleRequests
        WHERE RequestId = @requestId
      `);

    const request = result.recordset[0];
    if (request) {
      // Parse JSON fields
      request.SuggestedSlots = safeJSONParse(request.SuggestedSlots, []);
      if (request.SelectedSlot) {
        request.SelectedSlot = safeJSONParse(request.SelectedSlot, null);
      }
    }

    return request || null;
  } catch (error) {
    console.error("Error finding reschedule request:", error);
    throw error;
  }
}

/**
 * Soft delete reschedule request (mark as resolved)
 * FIXED: Changed to soft delete instead of hard delete
 *
 * @param {number} requestId - Request ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteRescheduleRequest(requestId) {
  try {
    const id = parseInt(requestId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid request ID is required");
    }

    const pool = await poolPromise;

    // FIXED: Soft delete - mark as resolved instead of hard delete
    const result = await pool.request().input("requestId", sql.Int, id).query(`
        UPDATE dbo.CaseRescheduleRequests
        SET 
          AttorneyResponse = 'resolved',
          UpdatedAt = GETUTCDATE()
        WHERE RequestId = @requestId;
        SELECT @@ROWCOUNT as affected;
      `);

    return result.recordset[0].affected > 0;
  } catch (error) {
    console.error("Error deleting reschedule request:", error);
    throw error;
  }
}

/**
 * Get reschedule statistics
 * NEW: Added statistics function
 *
 * @returns {Promise<Object>} Reschedule statistics
 */
async function getRescheduleStatistics() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as Total,
        SUM(CASE WHEN AttorneyResponse = 'pending' THEN 1 ELSE 0 END) as Pending,
        SUM(CASE WHEN AttorneyResponse = 'accepted' THEN 1 ELSE 0 END) as Accepted,
        SUM(CASE WHEN AttorneyResponse = 'requested_different' THEN 1 ELSE 0 END) as RequestedDifferent,
        SUM(CASE WHEN AttorneyResponse = 'rejected' THEN 1 ELSE 0 END) as Rejected,
        SUM(CASE WHEN AttorneyResponse = 'resolved' THEN 1 ELSE 0 END) as Resolved
      FROM dbo.CaseRescheduleRequests
    `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error getting reschedule statistics:", error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Create operations
  createRescheduleRequest,

  // Read operations
  getRescheduleRequestByCase,
  getPendingReschedulesByAttorney,
  getAllRescheduleRequests, // NEW
  findById,

  // Update operations
  acceptSuggestedSlot,
  requestDifferentSlots,
  rejectReschedule, // NEW

  // Delete operations
  deleteRescheduleRequest, // Now soft delete

  // Statistics
  getRescheduleStatistics, // NEW

  // Constants
  ATTORNEY_RESPONSE_TYPES,
};
