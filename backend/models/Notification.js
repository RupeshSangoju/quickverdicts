// =============================================
// Notification.js - System Notifications Model
// FIXED: Added SQL type safety, validation, better error handling
// =============================================

const { poolPromise, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

// Notification types
const NOTIFICATION_TYPES = {
  // Case lifecycle
  CASE_SUBMITTED: "case_submitted",
  CASE_APPROVED: "case_approved",
  CASE_REJECTED: "case_rejected",
  CASE_RESCHEDULE_REQUESTED: "case_reschedule_requested",
  CASE_RESCHEDULE_NEEDED: "case_reschedule_needed", // Used when admin rejects and provides alternative slots

  // Application events
  APPLICATION_RECEIVED: "application_received",
  APPLICATION_APPROVED: "application_approved",
  APPLICATION_REJECTED: "application_rejected",

  // Trial events
  WAR_ROOM_READY: "war_room_ready",
  TRIAL_STARTING: "trial_starting",
  TRIAL_STARTED: "trial_started",

  // Verdict events
  VERDICT_NEEDED: "verdict_needed",
  VERDICT_SUBMITTED: "verdict_submitted",
  VERDICT_PUBLISHED: "verdict_published",

  // System events
  CASE_COMPLETED: "case_completed",
  PAYMENT_PROCESSED: "payment_processed",
  PAYMENT_RECEIVED: "payment_received",
  ACCOUNT_VERIFIED: "account_verified",
};

// User types
const USER_TYPES = {
  ATTORNEY: "attorney",
  JUROR: "juror",
  ADMIN: "admin",
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate notification data
 * FIXED: Added validation
 */
function validateNotificationData(data) {
  const errors = [];

  if (!data.userId || isNaN(parseInt(data.userId))) {
    errors.push("Valid user ID is required");
  }
  if (!data.userType || typeof data.userType !== "string") {
    errors.push("User type is required");
  }
  if (!Object.values(USER_TYPES).includes(data.userType)) {
    errors.push(
      `Invalid user type. Must be one of: ${Object.values(USER_TYPES).join(
        ", "
      )}`
    );
  }
  if (!data.type || typeof data.type !== "string") {
    errors.push("Notification type is required");
  }
  if (!data.title || typeof data.title !== "string") {
    errors.push("Title is required");
  }
  if (!data.message || typeof data.message !== "string") {
    errors.push("Message is required");
  }

  if (errors.length > 0) {
    throw new Error(`Notification validation failed: ${errors.join(", ")}`);
  }
}

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

/**
 * Create notification
 * FIXED: Added validation and SQL type safety
 *
 * @param {Object} notificationData - Notification data
 * @returns {Promise<number>} New notification ID
 */
async function createNotification(notificationData) {
  try {
    // Validate notification data
    validateNotificationData(notificationData);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("userId", sql.Int, parseInt(notificationData.userId))
      .input("userType", sql.NVarChar, notificationData.userType.trim())
      .input(
        "caseId",
        sql.Int,
        notificationData.caseId ? parseInt(notificationData.caseId) : null
      )
      .input("type", sql.NVarChar, notificationData.type.trim())
      .input("title", sql.NVarChar, notificationData.title.trim())
      .input("message", sql.NVarChar, notificationData.message.trim()).query(`
        INSERT INTO dbo.Notifications (
          UserId, UserType, CaseId, Type, Title, Message, IsRead, CreatedAt
        ) VALUES (
          @userId, @userType, @caseId, @type, @title, @message, 0, GETUTCDATE()
        );
        SELECT SCOPE_IDENTITY() as NotificationId;
      `);

    return result.recordset[0].NotificationId;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

/**
 * Get notifications for user
 * FIXED: Added SQL type safety and pagination
 *
 * @param {number} userId - User ID
 * @param {string} userType - User type ('attorney', 'juror', 'admin')
 * @param {Object} options - Query options {unreadOnly, limit, offset}
 * @returns {Promise<Array>} Array of notifications
 */
async function getNotificationsForUser(userId, userType, options = {}) {
  try {
    const id = parseInt(userId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid user ID is required");
    }

    if (!Object.values(USER_TYPES).includes(userType)) {
      throw new Error(`Invalid user type: ${userType}`);
    }

    // Validate pagination
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 50));
    const offset = Math.max(0, parseInt(options.offset) || 0);
    const unreadOnly = options.unreadOnly || false;

    const pool = await poolPromise;
    let query = `
      SELECT 
        n.NotificationId,
        n.UserId,
        n.UserType,
        n.CaseId,
        n.Type,
        n.Title,
        n.Message,
        n.IsRead,
        n.ReadAt,
        n.CreatedAt,
        c.CaseTitle,
        c.CaseType,
        c.County
      FROM dbo.Notifications n
      LEFT JOIN dbo.Cases c ON n.CaseId = c.CaseId
      WHERE n.UserId = @userId AND n.UserType = @userType
    `;

    const request = pool
      .request()
      .input("userId", sql.Int, id)
      .input("userType", sql.NVarChar, userType)
      .input("limit", sql.Int, limit)
      .input("offset", sql.Int, offset);

    if (unreadOnly) {
      query += ` AND n.IsRead = 0`;
    }

    query += ` 
      ORDER BY n.CreatedAt DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error getting notifications for user:", error);
    throw error;
  }
}

/**
 * Mark notification as read
 * FIXED: Added SQL type safety and validation
 *
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for security)
 * @returns {Promise<boolean>} Success status
 */
async function markNotificationAsRead(notificationId, userId) {
  try {
    const notifId = parseInt(notificationId, 10);
    const usrId = parseInt(userId, 10);

    if (isNaN(notifId) || notifId <= 0 || isNaN(usrId) || usrId <= 0) {
      throw new Error("Valid notification ID and user ID are required");
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("notificationId", sql.Int, notifId)
      .input("userId", sql.Int, usrId).query(`
        UPDATE dbo.Notifications 
        SET IsRead = 1, ReadAt = GETUTCDATE()
        WHERE NotificationId = @notificationId AND UserId = @userId;
        SELECT @@ROWCOUNT as affected;
      `);

    return result.recordset[0].affected > 0;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

/**
 * Mark all notifications as read for user
 * FIXED: Added SQL type safety and validation
 *
 * @param {number} userId - User ID
 * @param {string} userType - User type
 * @returns {Promise<number>} Number of notifications marked as read
 */
async function markAllNotificationsAsRead(userId, userType) {
  try {
    const id = parseInt(userId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid user ID is required");
    }

    if (!Object.values(USER_TYPES).includes(userType)) {
      throw new Error(`Invalid user type: ${userType}`);
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("userId", sql.Int, id)
      .input("userType", sql.NVarChar, userType).query(`
        UPDATE dbo.Notifications 
        SET IsRead = 1, ReadAt = GETUTCDATE()
        WHERE UserId = @userId AND UserType = @userType AND IsRead = 0;
        SELECT @@ROWCOUNT as affected;
      `);

    return result.recordset[0].affected;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
}

/**
 * Delete notification
 * NEW: Added function to delete specific notification
 *
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for security)
 * @returns {Promise<boolean>} Success status
 */
async function deleteNotification(notificationId, userId) {
  try {
    const notifId = parseInt(notificationId, 10);
    const usrId = parseInt(userId, 10);

    if (isNaN(notifId) || notifId <= 0 || isNaN(usrId) || usrId <= 0) {
      throw new Error("Valid notification ID and user ID are required");
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("notificationId", sql.Int, notifId)
      .input("userId", sql.Int, usrId).query(`
        DELETE FROM dbo.Notifications
        WHERE NotificationId = @notificationId AND UserId = @userId;
        SELECT @@ROWCOUNT as affected;
      `);

    return result.recordset[0].affected > 0;
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

/**
 * Get unread notification count
 * FIXED: Added SQL type safety and validation
 *
 * @param {number} userId - User ID
 * @param {string} userType - User type
 * @returns {Promise<number>} Count of unread notifications
 */
async function getUnreadNotificationCount(userId, userType) {
  try {
    const id = parseInt(userId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid user ID is required");
    }

    if (!Object.values(USER_TYPES).includes(userType)) {
      throw new Error(`Invalid user type: ${userType}`);
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("userId", sql.Int, id)
      .input("userType", sql.NVarChar, userType).query(`
        SELECT COUNT(*) as count
        FROM dbo.Notifications
        WHERE UserId = @userId AND UserType = @userType AND IsRead = 0
      `);

    return result.recordset[0].count;
  } catch (error) {
    console.error("Error getting unread notification count:", error);
    throw error;
  }
}

/**
 * Archive old read notifications (soft delete)
 * FIXED: Changed to archiving instead of hard delete
 *
 * @param {number} daysToKeep - Number of days of notifications to keep (default: 90)
 * @returns {Promise<number>} Number of notifications archived
 */
async function archiveOldNotifications(daysToKeep = 90) {
  try {
    // Validate days - minimum 30 days
    const validDays = Math.max(30, parseInt(daysToKeep) || 90);

    const pool = await poolPromise;
    const result = await pool.request().input("daysToKeep", sql.Int, validDays)
      .query(`
        -- Create archive table if it doesn't exist
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationsArchive')
        BEGIN
          SELECT * INTO dbo.NotificationsArchive FROM dbo.Notifications WHERE 1 = 0;
          ALTER TABLE dbo.NotificationsArchive ADD ArchivedAt DATETIME DEFAULT GETUTCDATE();
        END;

        -- Move old read notifications to archive
        INSERT INTO dbo.NotificationsArchive 
          (NotificationId, UserId, UserType, CaseId, Type, Title, Message, IsRead, ReadAt, CreatedAt)
        SELECT 
          NotificationId, UserId, UserType, CaseId, Type, Title, Message, IsRead, ReadAt, CreatedAt
        FROM dbo.Notifications
        WHERE CreatedAt < DATEADD(day, -@daysToKeep, GETUTCDATE())
          AND IsRead = 1;

        -- Delete archived notifications from main table
        DELETE FROM dbo.Notifications 
        WHERE CreatedAt < DATEADD(day, -@daysToKeep, GETUTCDATE())
          AND IsRead = 1;

        SELECT @@ROWCOUNT as ArchivedCount;
      `);

    return result.recordset[0].ArchivedCount;
  } catch (error) {
    console.error("Error archiving old notifications:", error);
    throw error;
  }
}

/**
 * Delete old notifications (use with caution)
 * FIXED: Added validation and safety checks
 *
 * @param {number} daysToKeep - Number of days of notifications to keep
 * @returns {Promise<number>} Number of notifications deleted
 */
async function deleteOldNotifications(daysToKeep = 90) {
  try {
    // Validate days - minimum 90 days for safety
    const validDays = Math.max(90, parseInt(daysToKeep) || 90);

    const pool = await poolPromise;
    const result = await pool.request().input("daysToKeep", sql.Int, validDays)
      .query(`
        DELETE FROM dbo.Notifications 
        WHERE CreatedAt < DATEADD(day, -@daysToKeep, GETUTCDATE())
          AND IsRead = 1;
        SELECT @@ROWCOUNT as DeletedCount;
      `);

    return result.recordset[0].DeletedCount;
  } catch (error) {
    console.error("Error deleting old notifications:", error);
    throw error;
  }
}

/**
 * Get notifications by type
 * FIXED: Added SQL type safety and pagination
 *
 * @param {string} type - Notification type
 * @param {Object} options - Query options {limit, offset}
 * @returns {Promise<Array>} Array of notifications
 */
async function getNotificationsByType(type, options = {}) {
  try {
    if (!type || typeof type !== "string") {
      throw new Error("Valid notification type is required");
    }

    // Validate pagination
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const offset = Math.max(0, parseInt(options.offset) || 0);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("type", sql.NVarChar, type.trim())
      .input("limit", sql.Int, limit)
      .input("offset", sql.Int, offset).query(`
        SELECT 
          n.NotificationId,
          n.UserId,
          n.UserType,
          n.CaseId,
          n.Type,
          n.Title,
          n.Message,
          n.IsRead,
          n.ReadAt,
          n.CreatedAt,
          c.CaseTitle,
          CASE 
            WHEN n.UserType = 'attorney' THEN a.FirstName + ' ' + a.LastName
            WHEN n.UserType = 'juror' THEN j.Name
            WHEN n.UserType = 'admin' THEN 'Admin'
            ELSE 'Unknown User'
          END as UserName
        FROM dbo.Notifications n
        LEFT JOIN dbo.Cases c ON n.CaseId = c.CaseId
        LEFT JOIN dbo.Attorneys a ON n.UserId = a.AttorneyId AND n.UserType = 'attorney'
        LEFT JOIN dbo.Jurors j ON n.UserId = j.JurorId AND n.UserType = 'juror'
        WHERE n.Type = @type
        ORDER BY n.CreatedAt DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting notifications by type:", error);
    throw error;
  }
}

/**
 * Get notification statistics for admin dashboard
 * FIXED: Added SQL type safety
 *
 * @param {number} days - Number of days to look back (default: 7, max: 365)
 * @returns {Promise<Array>} Notification statistics
 */
async function getNotificationStatistics(days = 7) {
  try {
    // Validate and cap days
    const validDays = Math.min(365, Math.max(1, parseInt(days) || 7));

    const pool = await poolPromise;
    const result = await pool.request().input("days", sql.Int, validDays)
      .query(`
        SELECT 
          Type,
          UserType,
          COUNT(*) as NotificationCount,
          SUM(CASE WHEN IsRead = 1 THEN 1 ELSE 0 END) as ReadCount,
          SUM(CASE WHEN IsRead = 0 THEN 1 ELSE 0 END) as UnreadCount,
          AVG(CASE WHEN IsRead = 1 THEN DATEDIFF(MINUTE, CreatedAt, ReadAt) END) as AvgReadTimeMinutes
        FROM dbo.Notifications 
        WHERE CreatedAt >= DATEADD(day, -@days, GETUTCDATE())
        GROUP BY Type, UserType
        ORDER BY NotificationCount DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting notification statistics:", error);
    throw error;
  }
}

/**
 * Find notification by ID
 * FIXED: Added SQL type safety
 *
 * @param {number} notificationId - Notification ID
 * @returns {Promise<Object|null>} Notification details
 */
async function findById(notificationId) {
  try {
    const id = parseInt(notificationId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid notification ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("notificationId", sql.Int, id)
      .query(`
        SELECT 
          n.*,
          c.CaseTitle,
          c.CaseType
        FROM dbo.Notifications n
        LEFT JOIN dbo.Cases c ON n.CaseId = c.CaseId
        WHERE n.NotificationId = @notificationId
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error finding notification by ID:", error);
    throw error;
  }
}

/**
 * Create bulk notifications for multiple users
 * FIXED: Efficient bulk insert using table-valued parameter approach
 *
 * @param {Array} notificationList - Array of notification objects
 * @returns {Promise<number>} Number of notifications created
 */
async function createBulkNotifications(notificationList) {
  try {
    if (!Array.isArray(notificationList) || notificationList.length === 0) {
      throw new Error("Valid notification list is required");
    }

    // Validate all notifications
    notificationList.forEach((notif) => validateNotificationData(notif));

    const pool = await poolPromise;

    // FIXED: Use bulk insert with VALUES clause instead of loop
    const values = notificationList
      .map((notif, index) => {
        return `(@userId${index}, @userType${index}, @caseId${index}, @type${index}, @title${index}, @message${index}, GETUTCDATE())`;
      })
      .join(",\n");

    const request = pool.request();

    // Add parameters for each notification
    notificationList.forEach((notif, index) => {
      request.input(`userId${index}`, sql.Int, parseInt(notif.userId));
      request.input(`userType${index}`, sql.NVarChar, notif.userType.trim());
      request.input(
        `caseId${index}`,
        sql.Int,
        notif.caseId ? parseInt(notif.caseId) : null
      );
      request.input(`type${index}`, sql.NVarChar, notif.type.trim());
      request.input(`title${index}`, sql.NVarChar, notif.title.trim());
      request.input(`message${index}`, sql.NVarChar, notif.message.trim());
    });

    const result = await request.query(`
      INSERT INTO dbo.Notifications (UserId, UserType, CaseId, Type, Title, Message, CreatedAt)
      VALUES ${values};
      SELECT @@ROWCOUNT as CreatedCount;
    `);

    return result.recordset[0].CreatedCount;
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
}

/**
 * Get recent notifications for all users (admin view)
 * NEW: Added function for admin dashboard
 *
 * @param {Object} options - Query options {limit, offset}
 * @returns {Promise<Array>} Array of recent notifications
 */
async function getRecentNotifications(options = {}) {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 50));
    const offset = Math.max(0, parseInt(options.offset) || 0);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("limit", sql.Int, limit)
      .input("offset", sql.Int, offset).query(`
        SELECT 
          n.*,
          c.CaseTitle,
          CASE 
            WHEN n.UserType = 'attorney' THEN a.FirstName + ' ' + a.LastName
            WHEN n.UserType = 'juror' THEN j.Name
            WHEN n.UserType = 'admin' THEN 'Admin'
            ELSE 'Unknown'
          END as UserName
        FROM dbo.Notifications n
        LEFT JOIN dbo.Cases c ON n.CaseId = c.CaseId
        LEFT JOIN dbo.Attorneys a ON n.UserId = a.AttorneyId AND n.UserType = 'attorney'
        LEFT JOIN dbo.Jurors j ON n.UserId = j.JurorId AND n.UserType = 'juror'
        ORDER BY n.CreatedAt DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting recent notifications:", error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  NOTIFICATION_TYPES,
  USER_TYPES,

  // Create operations
  createNotification,
  createBulkNotifications, // FIXED (now efficient)

  // Read operations
  getNotificationsForUser,
  getUnreadNotificationCount,
  getNotificationsByType,
  getRecentNotifications, // NEW
  findById,

  // Update operations
  markNotificationAsRead,
  markAllNotificationsAsRead,

  // Delete operations
  deleteNotification, // NEW
  archiveOldNotifications, // NEW (replaces deleteOldNotifications as primary)
  deleteOldNotifications, // FIXED (now safer)

  // Statistics
  getNotificationStatistics,
};
