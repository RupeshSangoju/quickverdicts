// =============================================
// Event.js - Case Events and Timeline Model
// FIXED: Added SQL type safety, validation, better error handling
// =============================================

const { poolPromise, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

// Event types
const EVENT_TYPES = {
  // Case lifecycle
  CASE_CREATED: "case_created",
  CASE_SUBMITTED: "case_submitted",
  CASE_UPDATED: "case_updated",

  // Admin actions
  ADMIN_APPROVED: "admin_approved",
  ADMIN_REJECTED: "admin_rejected",
  ADMIN_REQUESTED_RESCHEDULE: "admin_requested_reschedule",

  // Juror actions
  JUROR_APPLIED: "juror_applied",
  JUROR_APPROVED: "juror_approved",
  JUROR_REJECTED: "juror_rejected",

  // Trial lifecycle
  WAR_ROOM_OPENED: "war_room_opened",
  WAR_ROOM_SUBMITTED: "war_room_submitted",
  TRIAL_STARTED: "trial_started",
  TRIAL_COMPLETED: "trial_completed",

  // Verdict actions
  VERDICT_SUBMITTED: "verdict_submitted",
  VERDICT_PUBLISHED: "verdict_published",

  // Payment events
  PAYMENT_PROCESSED: "payment_processed",
  PAYMENT_FAILED: "payment_failed",

  // System events
  ERROR: "error",
};

// User types
const USER_TYPES = {
  ATTORNEY: "attorney",
  JUROR: "juror",
  ADMIN: "admin",
  SYSTEM: "system",
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate event data
 * FIXED: Added validation
 */
function validateEventData(eventData) {
  const errors = [];

  if (!eventData.caseId || isNaN(parseInt(eventData.caseId))) {
    errors.push("Valid case ID is required");
  }
  if (!eventData.eventType || typeof eventData.eventType !== "string") {
    errors.push("Event type is required");
  }
  if (!eventData.description || typeof eventData.description !== "string") {
    errors.push("Event description is required");
  }
  if (
    eventData.userType &&
    !Object.values(USER_TYPES).includes(eventData.userType)
  ) {
    errors.push(
      `Invalid user type. Must be one of: ${Object.values(USER_TYPES).join(
        ", "
      )}`
    );
  }

  if (errors.length > 0) {
    throw new Error(`Event validation failed: ${errors.join(", ")}`);
  }
}

/**
 * Safe JSON handling
 * FIXED: Added error handling
 */
function safeJSONParse(jsonString, fallback = {}) {
  if (!jsonString) return fallback;
  if (typeof jsonString === "object") return jsonString;

  try {
    return JSON.parse(jsonString) || fallback;
  } catch (error) {
    console.error("JSON parse error:", error);
    return fallback;
  }
}

function safeJSONStringify(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value || {});
  } catch (error) {
    console.error("JSON stringify error:", error);
    return "{}";
  }
}

// ============================================
// EVENT OPERATIONS
// ============================================

/**
 * Create new event
 * FIXED: Added validation and SQL type safety
 *
 * @param {Object} eventData - Event data
 * @param {number} eventData.caseId - Case ID
 * @param {string} eventData.eventType - Event type from EVENT_TYPES
 * @param {string} eventData.description - Event description
 * @param {number} eventData.triggeredBy - Optional user ID who triggered event
 * @param {string} eventData.userType - Optional user type (attorney, juror, admin, system)
 * @param {Object} eventData.metadata - Optional metadata object
 * @returns {Promise<number>} New event ID
 */
async function createEvent(eventData) {
  try {
    // Validate event data
    validateEventData(eventData);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(eventData.caseId))
      .input("eventType", sql.NVarChar, eventData.eventType.trim())
      .input("description", sql.NVarChar, eventData.description.trim())
      .input(
        "triggeredBy",
        sql.Int,
        eventData.triggeredBy ? parseInt(eventData.triggeredBy) : null
      )
      .input("userType", sql.NVarChar, eventData.userType?.trim() || null)
      .input(
        "metadata",
        sql.NVarChar,
        safeJSONStringify(eventData.metadata || {})
      ).query(`
        INSERT INTO dbo.Events (
          CaseId, EventType, Description, TriggeredBy, UserType,
          Metadata, CreatedAt
        ) VALUES (
          @caseId, @eventType, @description, @triggeredBy, @userType,
          @metadata, GETUTCDATE()
        );
        SELECT SCOPE_IDENTITY() as EventId;
      `);

    return result.recordset[0].EventId;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
}

/**
 * Get events by case ID
 * FIXED: Added SQL type safety and metadata parsing
 *
 * @param {number} caseId - Case ID
 * @returns {Promise<Array>} Array of events ordered by creation time
 */
async function getEventsByCase(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("caseId", sql.Int, id).query(`
        SELECT 
          e.EventId,
          e.CaseId,
          e.EventType,
          e.Description,
          e.TriggeredBy,
          e.UserType,
          e.Metadata,
          e.CreatedAt,
          CASE 
            WHEN e.UserType = 'attorney' THEN a.FirstName + ' ' + a.LastName
            WHEN e.UserType = 'juror' THEN j.Name
            WHEN e.UserType = 'admin' THEN 'Admin'
            ELSE 'System'
          END as TriggeredByName,
          CASE 
            WHEN e.UserType = 'attorney' THEN a.Email
            WHEN e.UserType = 'juror' THEN j.Email
            ELSE NULL
          END as TriggeredByEmail
        FROM dbo.Events e
        LEFT JOIN dbo.Attorneys a ON e.TriggeredBy = a.AttorneyId AND e.UserType = 'attorney'
        LEFT JOIN dbo.Jurors j ON e.TriggeredBy = j.JurorId AND e.UserType = 'juror'
        WHERE e.CaseId = @caseId
        ORDER BY e.CreatedAt ASC
      `);

    // Parse metadata
    return result.recordset.map((event) => ({
      ...event,
      Metadata: safeJSONParse(event.Metadata, {}),
    }));
  } catch (error) {
    console.error("Error getting events by case:", error);
    throw error;
  }
}

/**
 * Get recent events for dashboard
 * FIXED: Added SQL type safety and validation
 *
 * @param {number} limit - Number of events to return (max 100)
 * @returns {Promise<Array>} Array of recent events
 */
async function getRecentEvents(limit = 10) {
  try {
    // Validate and cap limit
    const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const pool = await poolPromise;
    const result = await pool.request().input("limit", sql.Int, validLimit)
      .query(`
        SELECT TOP (@limit)
          e.EventId,
          e.CaseId,
          e.EventType,
          e.Description,
          e.TriggeredBy,
          e.UserType,
          e.Metadata,
          e.CreatedAt,
          c.CaseTitle,
          c.County,
          c.CaseType,
          CASE 
            WHEN e.UserType = 'attorney' THEN a.FirstName + ' ' + a.LastName
            WHEN e.UserType = 'juror' THEN j.Name
            WHEN e.UserType = 'admin' THEN 'Admin'
            ELSE 'System'
          END as TriggeredByName
        FROM dbo.Events e
        INNER JOIN dbo.Cases c ON e.CaseId = c.CaseId
        LEFT JOIN dbo.Attorneys a ON e.TriggeredBy = a.AttorneyId AND e.UserType = 'attorney'
        LEFT JOIN dbo.Jurors j ON e.TriggeredBy = j.JurorId AND e.UserType = 'juror'
        ORDER BY e.CreatedAt DESC
      `);

    // Parse metadata
    return result.recordset.map((event) => ({
      ...event,
      Metadata: safeJSONParse(event.Metadata, {}),
    }));
  } catch (error) {
    console.error("Error getting recent events:", error);
    throw error;
  }
}

/**
 * Get events by user (attorney or juror)
 * FIXED: Added SQL type safety and pagination
 *
 * @param {number} userId - User ID
 * @param {string} userType - 'attorney' or 'juror'
 * @param {Object} options - Query options {limit, offset}
 * @returns {Promise<Array>} Array of user's events
 */
async function getEventsByUser(userId, userType, options = {}) {
  try {
    const id = parseInt(userId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid user ID is required");
    }

    if (!Object.values(USER_TYPES).includes(userType)) {
      throw new Error(`Invalid user type: ${userType}`);
    }

    // Validate pagination
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const offset = Math.max(0, parseInt(options.offset) || 0);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("userId", sql.Int, id)
      .input("userType", sql.NVarChar, userType)
      .input("limit", sql.Int, limit)
      .input("offset", sql.Int, offset).query(`
        SELECT 
          e.EventId,
          e.CaseId,
          e.EventType,
          e.Description,
          e.TriggeredBy,
          e.UserType,
          e.Metadata,
          e.CreatedAt,
          c.CaseTitle,
          CASE 
            WHEN e.UserType = 'attorney' THEN a.FirstName + ' ' + a.LastName
            WHEN e.UserType = 'juror' THEN j.Name
            WHEN e.UserType = 'admin' THEN 'Admin'
            ELSE 'System'
          END as TriggeredByName
        FROM dbo.Events e
        INNER JOIN dbo.Cases c ON e.CaseId = c.CaseId
        LEFT JOIN dbo.Attorneys a ON e.TriggeredBy = a.AttorneyId AND e.UserType = 'attorney'
        LEFT JOIN dbo.Jurors j ON e.TriggeredBy = j.JurorId AND e.UserType = 'juror'
        WHERE e.TriggeredBy = @userId AND e.UserType = @userType
        ORDER BY e.CreatedAt DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    // Parse metadata
    return result.recordset.map((event) => ({
      ...event,
      Metadata: safeJSONParse(event.Metadata, {}),
    }));
  } catch (error) {
    console.error("Error getting events by user:", error);
    throw error;
  }
}

/**
 * Get events by type
 * FIXED: Added SQL type safety and pagination
 *
 * @param {string} eventType - Event type to filter by
 * @param {Object} options - Query options {limit, offset}
 * @returns {Promise<Array>} Array of events of specified type
 */
async function getEventsByType(eventType, options = {}) {
  try {
    if (!eventType || typeof eventType !== "string") {
      throw new Error("Valid event type is required");
    }

    // Validate pagination
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const offset = Math.max(0, parseInt(options.offset) || 0);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("eventType", sql.NVarChar, eventType.trim())
      .input("limit", sql.Int, limit)
      .input("offset", sql.Int, offset).query(`
        SELECT 
          e.EventId,
          e.CaseId,
          e.EventType,
          e.Description,
          e.TriggeredBy,
          e.UserType,
          e.Metadata,
          e.CreatedAt,
          c.CaseTitle,
          CASE 
            WHEN e.UserType = 'attorney' THEN a.FirstName + ' ' + a.LastName
            WHEN e.UserType = 'juror' THEN j.Name
            WHEN e.UserType = 'admin' THEN 'Admin'
            ELSE 'System'
          END as TriggeredByName
        FROM dbo.Events e
        INNER JOIN dbo.Cases c ON e.CaseId = c.CaseId
        LEFT JOIN dbo.Attorneys a ON e.TriggeredBy = a.AttorneyId AND e.UserType = 'attorney'
        LEFT JOIN dbo.Jurors j ON e.TriggeredBy = j.JurorId AND e.UserType = 'juror'
        WHERE e.EventType = @eventType
        ORDER BY e.CreatedAt DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    // Parse metadata
    return result.recordset.map((event) => ({
      ...event,
      Metadata: safeJSONParse(event.Metadata, {}),
    }));
  } catch (error) {
    console.error("Error getting events by type:", error);
    throw error;
  }
}

/**
 * Get event statistics for admin dashboard
 * FIXED: Added SQL type safety
 *
 * @param {number} days - Number of days to look back (default: 7, max: 365)
 * @returns {Promise<Array>} Event statistics
 */
async function getEventStatistics(days = 7) {
  try {
    // Validate and cap days
    const validDays = Math.min(365, Math.max(1, parseInt(days) || 7));

    const pool = await poolPromise;
    const result = await pool.request().input("days", sql.Int, validDays)
      .query(`
        SELECT 
          EventType,
          COUNT(*) as EventCount,
          COUNT(DISTINCT CaseId) as UniqueCases,
          COUNT(DISTINCT TriggeredBy) as UniqueUsers,
          MIN(CreatedAt) as FirstEventAt,
          MAX(CreatedAt) as LastEventAt
        FROM dbo.Events 
        WHERE CreatedAt >= DATEADD(day, -@days, GETUTCDATE())
        GROUP BY EventType
        ORDER BY EventCount DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting event statistics:", error);
    throw error;
  }
}

/**
 * Get event count by date range
 * NEW: Added function for time-series data
 *
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Events grouped by date
 */
async function getEventCountByDateRange(startDate, endDate) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("startDate", sql.Date, startDate)
      .input("endDate", sql.Date, endDate).query(`
        SELECT 
          CAST(CreatedAt AS DATE) as EventDate,
          EventType,
          COUNT(*) as EventCount
        FROM dbo.Events
        WHERE CreatedAt >= @startDate AND CreatedAt <= @endDate
        GROUP BY CAST(CreatedAt AS DATE), EventType
        ORDER BY EventDate ASC, EventType
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting event count by date range:", error);
    throw error;
  }
}

/**
 * Archive old events (soft delete by moving to archive table)
 * FIXED: Changed to archiving instead of hard delete
 *
 * @param {number} daysToKeep - Number of days of events to keep (default: 365)
 * @returns {Promise<number>} Number of events archived
 */
async function archiveOldEvents(daysToKeep = 365) {
  try {
    // Validate days
    const validDays = Math.max(30, parseInt(daysToKeep) || 365); // Minimum 30 days

    const pool = await poolPromise;
    const result = await pool.request().input("daysToKeep", sql.Int, validDays)
      .query(`
        -- Create archive table if it doesn't exist
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventsArchive')
        BEGIN
          SELECT * INTO dbo.EventsArchive FROM dbo.Events WHERE 1 = 0;
          ALTER TABLE dbo.EventsArchive ADD ArchivedAt DATETIME DEFAULT GETUTCDATE();
        END;

        -- Move old events to archive
        INSERT INTO dbo.EventsArchive (EventId, CaseId, EventType, Description, TriggeredBy, UserType, Metadata, CreatedAt)
        SELECT EventId, CaseId, EventType, Description, TriggeredBy, UserType, Metadata, CreatedAt
        FROM dbo.Events
        WHERE CreatedAt < DATEADD(day, -@daysToKeep, GETUTCDATE());

        -- Delete archived events from main table
        DELETE FROM dbo.Events 
        WHERE CreatedAt < DATEADD(day, -@daysToKeep, GETUTCDATE());

        SELECT @@ROWCOUNT as ArchivedCount;
      `);

    return result.recordset[0].ArchivedCount;
  } catch (error) {
    console.error("Error archiving old events:", error);
    throw error;
  }
}

/**
 * Delete old events (for cleanup - use with caution)
 * FIXED: Added validation and better error handling
 *
 * @param {number} daysToKeep - Number of days of events to keep
 * @returns {Promise<number>} Number of events deleted
 */
async function deleteOldEvents(daysToKeep = 365) {
  try {
    // Validate days - minimum 365 days for safety
    const validDays = Math.max(365, parseInt(daysToKeep) || 365);

    const pool = await poolPromise;
    const result = await pool.request().input("daysToKeep", sql.Int, validDays)
      .query(`
        DELETE FROM dbo.Events 
        WHERE CreatedAt < DATEADD(day, -@daysToKeep, GETUTCDATE());
        SELECT @@ROWCOUNT as DeletedCount;
      `);

    return result.recordset[0].DeletedCount;
  } catch (error) {
    console.error("Error deleting old events:", error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  EVENT_TYPES,
  USER_TYPES,

  // Create operations
  createEvent,

  // Read operations
  getEventsByCase,
  getRecentEvents,
  getEventsByUser,
  getEventsByType,

  // Statistics
  getEventStatistics,
  getEventCountByDateRange, // NEW

  // Maintenance
  archiveOldEvents, // NEW (replaces deleteOldEvents as primary method)
  deleteOldEvents, // FIXED (now safer with minimum 365 days)
};
