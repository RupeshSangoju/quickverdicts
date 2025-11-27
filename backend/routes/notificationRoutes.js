// =============================================
// notificationRoutes.js - Notification Routes
// CRITICAL FIX: Remove requireAttorney - notifications work for BOTH attorneys and jurors
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

// ⚠️ CRITICAL: Only import authMiddleware, NOT requireAttorney!
const { authMiddleware } = require("../middleware/authMiddleware");

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} = require("../controllers/notificationController");

// ============================================
// RATE LIMITERS
// ============================================

const notificationReadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: {
    success: false,
    message: "Too many notification requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

const notificationWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many notification updates. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// MIDDLEWARE - CRITICAL FIX
// ============================================

// ✅ CORRECT: Use authMiddleware which allows BOTH attorneys AND jurors
// ❌ WRONG: Do NOT use requireAttorney here!
router.use(authMiddleware);

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

const validateNotificationId = (req, res, next) => {
  const notificationId = parseInt(req.params.notificationId, 10);

  if (isNaN(notificationId) || notificationId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid notification ID is required",
    });
  }

  req.validatedNotificationId = notificationId;
  next();
};

const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  if (page < 1) {
    return res.status(400).json({
      success: false,
      message: "Page must be at least 1",
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: "Limit must be between 1 and 100",
    });
  }

  req.pagination = { page, limit };
  next();
};

const validateNotificationFilter = (req, res, next) => {
  const { type, read } = req.query;

  if (type) {
    const validTypes = [
      "case_submitted",
      "case_approved",
      "case_rejected",
      "application_received",
      "application_approved",
      "application_rejected",
      "trial_starting",
      "trial_completed",
      "payment_processed",
      "war_room_ready",
      "case_reschedule_requested",
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid notification type. Valid types: ${validTypes.join(
          ", "
        )}`,
      });
    }
  }

  if (read !== undefined) {
    if (read !== "true" && read !== "false") {
      return res.status(400).json({
        success: false,
        message: "Read filter must be 'true' or 'false'",
      });
    }
  }

  next();
};

// ============================================
// NOTIFICATION ROUTES
// All routes below use authMiddleware (from router.use above)
// which allows BOTH attorneys and jurors
// ============================================

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 * ✅ Available to both attorneys and jurors
 */
router.get(
  "/unread-count",
  notificationReadLimiter,
  getUnreadCount
);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put("/read-all", notificationWriteLimiter, markAllAsRead);

/**
 * DELETE /api/notifications/delete-all-read
 * Delete all read notifications
 */
router.delete(
  "/delete-all-read",
  notificationWriteLimiter,
  deleteAllRead
);

/**
 * GET /api/notifications
 * Get all notifications for authenticated user
 * ✅ Available to both attorneys and jurors
 */
router.get(
  "/",
  notificationReadLimiter,
  validatePagination,
  validateNotificationFilter,
  getNotifications
);

/**
 * GET /api/notifications/:notificationId
 * Get specific notification details
 */
router.get(
  "/:notificationId",
  notificationReadLimiter,
  validateNotificationId,
  async (req, res) => {
    try {
      const notificationId = req.validatedNotificationId;
      const userId = req.user.id;

      const Notification = require("../models/Notification");
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      // Verify user owns this notification
      if (notification.UserId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.json({
        success: true,
        notification,
      });
    } catch (error) {
      console.error("Get notification error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch notification",
      });
    }
  }
);

/**
 * PUT /api/notifications/:notificationId/read
 * Mark specific notification as read
 */
router.put(
  "/:notificationId/read",
  notificationWriteLimiter,
  validateNotificationId,
  markAsRead
);

/**
 * DELETE /api/notifications/:notificationId
 * Delete specific notification
 */
router.delete(
  "/:notificationId",
  notificationWriteLimiter,
  validateNotificationId,
  deleteNotification
);

/**
 * POST /api/notifications/:notificationId/unread
 * Mark notification as unread
 */
router.post(
  "/:notificationId/unread",
  notificationWriteLimiter,
  validateNotificationId,
  async (req, res) => {
    try {
      const notificationId = req.validatedNotificationId;
      const userId = req.user.id;

      const Notification = require("../models/Notification");

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
          message: "Access denied",
        });
      }

      await Notification.markAsUnread(notificationId);

      res.json({
        success: true,
        message: "Notification marked as unread",
      });
    } catch (error) {
      console.error("Mark notification as unread error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark notification as unread",
      });
    }
  }
);

/**
 * GET /api/notifications/stats
 * Get notification statistics
 */
router.get(
  "/stats",
  notificationReadLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const userType = req.user.type;

      const Notification = require("../models/Notification");
      const stats = await Notification.getNotificationStats(userId, userType);

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("Get notification stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch notification statistics",
      });
    }
  }
);

/**
 * GET /api/notifications/health
 * Health check for notification service
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "notifications",
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("Notification Route Error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

// ============================================
// EXPORTS
// ============================================

module.exports = router;
