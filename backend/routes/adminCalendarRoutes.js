// =============================================
// adminCalendarRoutes.js - Admin Calendar Routes
// FIXED: Added authentication, validation, better route structure
// =============================================

const express = require("express");
const router = express.Router();
const {
  authMiddleware,
  requireAdmin,
} = require("../middleware/authMiddleware");

// Import admin calendar controller functions
const {
  getBlockedSlots,
  getAvailableSlots,
  blockSlot,
  unblockSlot,
  checkSlotAvailability,
  getCasesByDate,
} = require("../controllers/adminCalendarController");

// ============================================
// MIDDLEWARE
// ============================================

// Apply authentication to ALL routes (attorneys and admins both need to be logged in)
router.use(authMiddleware);
// Note: requireAdmin is applied selectively below for admin-only operations

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Validate date query parameters
 * FIXED: Added validation middleware
 */
const validateDateParams = (req, res, next) => {
  const { startDate, endDate, date } = req.query;

  // Helper to validate date format (YYYY-MM-DD)
  const isValidDate = (dateString) => {
    if (!dateString || typeof dateString !== "string") return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const dateObj = new Date(dateString);
    return dateObj instanceof Date && !isNaN(dateObj);
  };

  // For range queries (blocked, available)
  if (startDate || endDate) {
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Both startDate and endDate are required",
      });
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // Ensure startDate is before endDate
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "startDate must be before or equal to endDate",
      });
    }
  }

  // For single date queries (cases-by-date)
  if (date && !isValidDate(date)) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format. Use YYYY-MM-DD",
    });
  }

  next();
};

/**
 * Validate calendar ID parameter
 * FIXED: Added ID validation
 */
const validateCalendarId = (req, res, next) => {
  const calendarId = parseInt(req.params.calendarId, 10);

  if (isNaN(calendarId) || calendarId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid calendar ID is required",
    });
  }

  req.calendarId = calendarId; // Attach validated ID
  next();
};

/**
 * Validate block slot request body
 * FIXED: Added request validation
 */
const validateBlockSlotBody = (req, res, next) => {
  const { blockedDate, blockedTime } = req.body;

  if (!blockedDate || !blockedTime) {
    return res.status(400).json({
      success: false,
      message: "blockedDate and blockedTime are required",
    });
  }

  // Validate date format
  const isValidDate = (dateString) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const dateObj = new Date(dateString);
    return dateObj instanceof Date && !isNaN(dateObj);
  };

  if (!isValidDate(blockedDate)) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format. Use YYYY-MM-DD",
    });
  }

  // Validate time format (HH:MM or HH:MM:SS)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
  if (!timeRegex.test(blockedTime)) {
    return res.status(400).json({
      success: false,
      message: "Invalid time format. Use HH:MM or HH:MM:SS",
    });
  }

  next();
};

// ============================================
// QUERY ROUTES (GET)
// ============================================

/**
 * GET /api/admin-calendar/blocked
 * Get blocked time slots within a date range
 */
router.get("/blocked", validateDateParams, getBlockedSlots);

/**
 * GET /api/admin-calendar/available
 * Get available time slots within a date range
 */
router.get("/available", validateDateParams, getAvailableSlots);

/**
 * GET /api/admin-calendar/check
 * Check if a specific time slot is available
 * Query params: date, time
 */
router.get("/check", checkSlotAvailability);

/**
 * GET /api/admin-calendar/cases-by-date
 * Get all cases scheduled for a specific date with full details
 * Query params: date (YYYY-MM-DD)
 * ADMIN ONLY
 */
router.get("/cases-by-date", requireAdmin, validateDateParams, getCasesByDate);

// ============================================
// MUTATION ROUTES (POST, PUT, DELETE)
// ADMIN ONLY - These routes modify calendar data
// ============================================

/**
 * POST /api/admin-calendar/block
 * Manually block a time slot
 * Body: { blockedDate, blockedTime, reason? }
 * ADMIN ONLY
 */
router.post("/block", requireAdmin, validateBlockSlotBody, blockSlot);

/**
 * DELETE /api/admin-calendar/unblock/:calendarId
 * Unblock a time slot
 * FIXED: Changed route to /unblock/:calendarId to avoid conflicts
 * ADMIN ONLY
 */
router.delete("/unblock/:calendarId", requireAdmin, validateCalendarId, unblockSlot);

// ============================================
// ERROR HANDLER
// ============================================

/**
 * Route-specific error handler
 * Catches any errors not handled by individual routes
 */
router.use((error, req, res, next) => {
  console.error("Admin Calendar Route Error:", error);

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
