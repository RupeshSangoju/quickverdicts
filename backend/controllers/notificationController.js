// =============================================
// notificationController.js - Notification Management
// FIXED: Added defensive programming, authorization checks, better error handling
// =============================================

const Notification = require("../models/Notification");

// ============================================
// NOTIFICATION MANAGEMENT
// ============================================

/**
 * Get notifications for authenticated user
 * FIXED: Added defensive checks and pagination support
 */
async function getNotifications(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id || !req.user.type) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const userType = req.user.type;
    const { unreadOnly, limit = 50, offset = 0 } = req.query;

    // Validate parameters
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100); // Max 100 notifications
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    // ✅ FIX: Pass options object with unreadOnly property instead of just the boolean
    const notifications = await Notification.getNotificationsForUser(
      userId,
      userType,
      {
        unreadOnly: unreadOnly === "true",
        limit: limitNum,
        offset: offsetNum
      }
    );

    // ✅ FIX: Remove duplicate pagination - already handled in the model
    res.json({
      success: true,
      notifications: notifications,
      count: notifications.length,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: notifications.length === limitNum, // If we got a full page, there might be more
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get unread notification count
 * FIXED: Added defensive checks
 */
async function getUnreadCount(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id || !req.user.type) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const userType = req.user.type;

    const count = await Notification.getUnreadNotificationCount(
      userId,
      userType
    );

    res.json({
      success: true,
      count: count || 0,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Mark notification as read
 * FIXED: Added authorization check to prevent users from marking other users' notifications
 */
async function markAsRead(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!notificationId || isNaN(parseInt(notificationId))) {
      return res.status(400).json({
        success: false,
        message: "Valid notification ID is required",
      });
    }

    // FIXED: Verify notification belongs to user before marking as read
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (notification.UserId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to mark this notification as read",
      });
    }

    // Mark as read
    await Notification.markNotificationAsRead(notificationId, userId);

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Mark all notifications as read
 * FIXED: Added defensive checks
 */
async function markAllAsRead(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id || !req.user.type) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const userType = req.user.type;

    const updatedCount = await Notification.markAllNotificationsAsRead(
      userId,
      userType
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
      updatedCount: updatedCount || 0,
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Delete notification
 * NEW: Added endpoint to delete individual notifications
 */
async function deleteNotification(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!notificationId || isNaN(parseInt(notificationId))) {
      return res.status(400).json({
        success: false,
        message: "Valid notification ID is required",
      });
    }

    // Verify notification belongs to user
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (notification.UserId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this notification",
      });
    }

    // Delete notification
    await Notification.deleteNotification(notificationId,userId);

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Delete all read notifications
 * NEW: Added endpoint to clear read notifications
 */
async function deleteAllRead(req, res) {
  try {
    if (!req.user || !req.user.id || !req.user.type) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const userType = req.user.type;

    const deletedCount = await Notification.deleteReadNotifications(
      userId,
      userType
    );

    res.json({
      success: true,
      message: "Read notifications cleared successfully",
      deletedCount: deletedCount || 0,
    });
  } catch (error) {
    console.error("Delete all read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear read notifications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification, // NEW
  deleteAllRead, // NEW
};
