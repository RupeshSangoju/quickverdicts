// =============================================
// TrialMeeting.js - Virtual Trial Meeting Model
// FIXED: Added SQL type safety, validation, better error handling
// =============================================

const { poolPromise, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

const MEETING_STATUSES = {
  CREATED: "created",
  ACTIVE: "active",
  ENDED: "ended",
  CANCELLED: "cancelled",
};

const PARTICIPANT_TYPES = {
  ATTORNEY: "attorney",
  JUROR: "juror",
  ADMIN: "admin",
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate meeting data
 * FIXED: Added validation
 */
function validateMeetingData(data) {
  const errors = [];

  if (!data.caseId || isNaN(parseInt(data.caseId))) {
    errors.push("Valid case ID is required");
  }
  if (!data.threadId || typeof data.threadId !== "string") {
    errors.push("Thread ID is required");
  }
  if (!data.roomId || typeof data.roomId !== "string") {
    errors.push("Room ID is required");
  }

  if (errors.length > 0) {
    throw new Error(`Meeting validation failed: ${errors.join(", ")}`);
  }
}

/**
 * Validate participant data
 * FIXED: Added validation
 */
function validateParticipantData(data) {
  const errors = [];

  if (!data.meetingId || isNaN(parseInt(data.meetingId))) {
    errors.push("Valid meeting ID is required");
  }
  if (!data.userId || isNaN(parseInt(data.userId))) {
    errors.push("Valid user ID is required");
  }
  if (!data.userType || typeof data.userType !== "string") {
    errors.push("User type is required");
  }
  if (!Object.values(PARTICIPANT_TYPES).includes(data.userType)) {
    errors.push(
      `Invalid user type. Must be one of: ${Object.values(
        PARTICIPANT_TYPES
      ).join(", ")}`
    );
  }
  if (!data.displayName || typeof data.displayName !== "string") {
    errors.push("Display name is required");
  }

  if (errors.length > 0) {
    throw new Error(`Participant validation failed: ${errors.join(", ")}`);
  }
}

// ============================================
// MEETING OPERATIONS
// ============================================

/**
 * Create trial meeting
 * FIXED: Added validation, duplicate check, and SQL type safety
 *
 * @param {number} caseId - Case ID
 * @param {string} threadId - ACS thread ID
 * @param {string} roomId - ACS room ID
 * @param {string} chatThreadId - Optional chat thread ID
 * @param {string} chatServiceUserId - Optional chat service user ID
 * @returns {Promise<number>} New meeting ID
 */
async function createMeeting(
  caseId,
  threadId,
  roomId,
  chatThreadId = null,
  chatServiceUserId = null
) {
  try {
    // Validate meeting data
    validateMeetingData({ caseId, threadId, roomId });

    const pool = await poolPromise;

    // Check if meeting already exists for this case
    const existing = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId)).query(`
        SELECT MeetingId 
        FROM dbo.TrialMeetings 
        WHERE CaseId = @caseId AND Status != 'ended' AND Status != 'cancelled'
      `);

    if (existing.recordset.length > 0) {
      throw new Error("Active meeting already exists for this case");
    }

    // Create new meeting
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .input("threadId", sql.NVarChar, threadId.trim())
      .input("roomId", sql.NVarChar, roomId.trim())
      .input("chatThreadId", sql.NVarChar, chatThreadId?.trim() || null)
      .input(
        "chatServiceUserId",
        sql.NVarChar,
        chatServiceUserId?.trim() || null
      )
      .input("status", sql.NVarChar, MEETING_STATUSES.CREATED).query(`
        INSERT INTO dbo.TrialMeetings (
          CaseId, ThreadId, RoomId, ChatThreadId, ChatServiceUserId, Status, CreatedAt
        ) VALUES (
          @caseId, @threadId, @roomId, @chatThreadId, @chatServiceUserId, @status, GETUTCDATE()
        );
        SELECT SCOPE_IDENTITY() as MeetingId;
      `);

    return result.recordset[0].MeetingId;
  } catch (error) {
    console.error("Error creating trial meeting:", error);
    throw error;
  }
}

/**
 * Get meeting by case ID
 * FIXED: Added SQL type safety and validation
 *
 * @param {number} caseId - Case ID
 * @returns {Promise<Object|null>} Meeting record
 */
async function getMeetingByCaseId(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("caseId", sql.Int, id).query(`
        SELECT 
          tm.MeetingId,
          tm.CaseId,
          tm.ThreadId,
          tm.RoomId,
          tm.ChatThreadId,
          tm.ChatServiceUserId,
          tm.Status,
          tm.CreatedAt,
          tm.StartedAt,
          tm.EndedAt,
          c.CaseTitle,
          c.County,
          (SELECT COUNT(*) FROM dbo.TrialParticipants WHERE MeetingId = tm.MeetingId) as ParticipantCount
        FROM dbo.TrialMeetings tm
        LEFT JOIN dbo.Cases c ON tm.CaseId = c.CaseId
        WHERE tm.CaseId = @caseId
        ORDER BY tm.CreatedAt DESC
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error getting meeting by case ID:", error);
    throw error;
  }
}

/**
 * Get meeting by ID
 * NEW: Added function to get meeting by ID
 *
 * @param {number} meetingId - Meeting ID
 * @returns {Promise<Object|null>} Meeting record
 */
async function findById(meetingId) {
  try {
    const id = parseInt(meetingId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid meeting ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("meetingId", sql.Int, id).query(`
        SELECT 
          tm.*,
          c.CaseTitle,
          c.County,
          (SELECT COUNT(*) FROM dbo.TrialParticipants WHERE MeetingId = tm.MeetingId) as ParticipantCount
        FROM dbo.TrialMeetings tm
        LEFT JOIN dbo.Cases c ON tm.CaseId = c.CaseId
        WHERE tm.MeetingId = @meetingId
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error finding meeting by ID:", error);
    throw error;
  }
}

/**
 * Update meeting status
 * FIXED: Safer SQL and validation
 *
 * @param {number} meetingId - Meeting ID
 * @param {string} status - New status
 * @returns {Promise<void>}
 */
async function updateMeetingStatus(meetingId, status) {
  try {
    const id = parseInt(meetingId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid meeting ID is required");
    }

    const validStatuses = Object.values(MEETING_STATUSES);
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    const pool = await poolPromise;
    const request = pool
      .request()
      .input("meetingId", sql.Int, id)
      .input("status", sql.NVarChar, status);

    // Build query safely based on status
    let query = "UPDATE dbo.TrialMeetings SET Status = @status";

    if (status === MEETING_STATUSES.ACTIVE) {
      query += ", StartedAt = GETUTCDATE()";
    } else if (
      status === MEETING_STATUSES.ENDED ||
      status === MEETING_STATUSES.CANCELLED
    ) {
      query += ", EndedAt = GETUTCDATE()";
    }

    query += " WHERE MeetingId = @meetingId";

    await request.query(query);
  } catch (error) {
    console.error("Error updating meeting status:", error);
    throw error;
  }
}

/**
 * Add participant to meeting
 * FIXED: Added validation and duplicate check
 *
 * @param {number} meetingId - Meeting ID
 * @param {number} userId - User ID
 * @param {string} userType - User type (attorney, juror, admin)
 * @param {string} displayName - Display name
 * @param {string} acsUserId - Azure Communication Services user ID
 * @returns {Promise<number>} Participant ID
 */
async function addParticipant(
  meetingId,
  userId,
  userType,
  displayName,
  acsUserId
) {
  try {
    // Validate participant data
    validateParticipantData({ meetingId, userId, userType, displayName });

    const pool = await poolPromise;

    // Check if participant already exists
    const existing = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId))
      .input("userId", sql.Int, parseInt(userId))
      .input("userType", sql.NVarChar, userType).query(`
        SELECT ParticipantId 
        FROM dbo.TrialParticipants 
        WHERE MeetingId = @meetingId 
          AND UserId = @userId 
          AND UserType = @userType
          AND LeftAt IS NULL
      `);

    if (existing.recordset.length > 0) {
      // Participant already in meeting
      return existing.recordset[0].ParticipantId;
    }

    // Add new participant
    const result = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId))
      .input("userId", sql.Int, parseInt(userId))
      .input("userType", sql.NVarChar, userType.trim())
      .input("displayName", sql.NVarChar, displayName.trim())
      .input("acsUserId", sql.NVarChar, acsUserId?.trim() || null).query(`
        INSERT INTO dbo.TrialParticipants (
          MeetingId, UserId, UserType, DisplayName, AcsUserId, JoinedAt
        ) VALUES (
          @meetingId, @userId, @userType, @displayName, @acsUserId, GETUTCDATE()
        );
        SELECT SCOPE_IDENTITY() as ParticipantId;
      `);

    return result.recordset[0].ParticipantId;
  } catch (error) {
    console.error("Error adding participant:", error);
    throw error;
  }
}

/**
 * Mark participant as left
 * NEW: Added function to mark participant as left
 *
 * @param {number} participantId - Participant ID
 * @returns {Promise<void>}
 */
async function removeParticipant(participantId) {
  try {
    const id = parseInt(participantId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid participant ID is required");
    }

    const pool = await poolPromise;
    await pool.request().input("participantId", sql.Int, id).query(`
        UPDATE dbo.TrialParticipants
        SET LeftAt = GETUTCDATE()
        WHERE ParticipantId = @participantId AND LeftAt IS NULL
      `);
  } catch (error) {
    console.error("Error removing participant:", error);
    throw error;
  }
}

/**
 * Get participants for meeting
 * FIXED: Added SQL type safety and enhanced data
 *
 * @param {number} meetingId - Meeting ID
 * @returns {Promise<Array>} Array of participants
 */
async function getParticipants(meetingId) {
  try {
    const id = parseInt(meetingId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid meeting ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("meetingId", sql.Int, id).query(`
        SELECT 
          tp.ParticipantId,
          tp.MeetingId,
          tp.UserId,
          tp.UserType,
          tp.DisplayName,
          tp.AcsUserId,
          tp.JoinedAt,
          tp.LeftAt,
          CASE 
            WHEN tp.LeftAt IS NULL THEN 1 
            ELSE 0 
          END as IsActive,
          DATEDIFF(MINUTE, tp.JoinedAt, ISNULL(tp.LeftAt, GETUTCDATE())) as DurationMinutes
        FROM dbo.TrialParticipants tp
        WHERE tp.MeetingId = @meetingId
        ORDER BY tp.JoinedAt DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting participants:", error);
    throw error;
  }
}

/**
 * Get active participants for meeting
 * NEW: Added function to get only active participants
 *
 * @param {number} meetingId - Meeting ID
 * @returns {Promise<Array>} Array of active participants
 */
async function getActiveParticipants(meetingId) {
  try {
    const id = parseInt(meetingId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid meeting ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("meetingId", sql.Int, id).query(`
        SELECT 
          tp.*,
          DATEDIFF(MINUTE, tp.JoinedAt, GETUTCDATE()) as DurationMinutes
        FROM dbo.TrialParticipants tp
        WHERE tp.MeetingId = @meetingId AND tp.LeftAt IS NULL
        ORDER BY tp.JoinedAt DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting active participants:", error);
    throw error;
  }
}

/**
 * Get meeting statistics
 * NEW: Added statistics function
 *
 * @param {number} meetingId - Meeting ID
 * @returns {Promise<Object>} Meeting statistics
 */
async function getMeetingStatistics(meetingId) {
  try {
    const id = parseInt(meetingId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid meeting ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("meetingId", sql.Int, id).query(`
        SELECT 
          COUNT(*) as TotalParticipants,
          SUM(CASE WHEN LeftAt IS NULL THEN 1 ELSE 0 END) as ActiveParticipants,
          SUM(CASE WHEN UserType = 'attorney' THEN 1 ELSE 0 END) as AttorneyCount,
          SUM(CASE WHEN UserType = 'juror' THEN 1 ELSE 0 END) as JurorCount,
          SUM(CASE WHEN UserType = 'admin' THEN 1 ELSE 0 END) as AdminCount,
          AVG(DATEDIFF(MINUTE, JoinedAt, ISNULL(LeftAt, GETUTCDATE()))) as AvgDurationMinutes
        FROM dbo.TrialParticipants
        WHERE MeetingId = @meetingId
      `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error getting meeting statistics:", error);
    throw error;
  }
}

/**
 * Get all meetings with filters
 * NEW: Added function to get all meetings
 *
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Array of meetings
 */
async function getAllMeetings(options = {}) {
  try {
    const pool = await poolPromise;
    let query = `
      SELECT 
        tm.*,
        c.CaseTitle,
        c.County,
        (SELECT COUNT(*) FROM dbo.TrialParticipants WHERE MeetingId = tm.MeetingId) as ParticipantCount
      FROM dbo.TrialMeetings tm
      LEFT JOIN dbo.Cases c ON tm.CaseId = c.CaseId
      WHERE 1=1
    `;

    const request = pool.request();

    if (options.status) {
      query += " AND tm.Status = @status";
      request.input("status", sql.NVarChar, options.status);
    }

    if (options.startDate) {
      query += " AND tm.CreatedAt >= @startDate";
      request.input("startDate", sql.DateTime, options.startDate);
    }

    if (options.endDate) {
      query += " AND tm.CreatedAt <= @endDate";
      request.input("endDate", sql.DateTime, options.endDate);
    }

    query += " ORDER BY tm.CreatedAt DESC";

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error getting all meetings:", error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  MEETING_STATUSES,
  PARTICIPANT_TYPES,

  // Meeting operations
  createMeeting,
  getMeetingByCaseId,
  findById, // NEW
  updateMeetingStatus,
  getAllMeetings, // NEW

  // Participant operations
  addParticipant,
  removeParticipant, // NEW
  getParticipants,
  getActiveParticipants, // NEW

  // Statistics
  getMeetingStatistics, // NEW
};
