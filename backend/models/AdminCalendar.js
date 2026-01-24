// =============================================
// AdminCalendar.js - Admin Calendar Model
// FIXED: Added SQL type safety, validation, better error handling
// =============================================

const { poolPromise, sql } = require("../config/db");

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate date format (YYYY-MM-DD)
 * FIXED: Added date validation
 */
function validateDate(dateString) {
  if (!dateString) {
    throw new Error("Date is required");
  }

  // Check format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date;
}

/**
 * Validate time format (HH:MM:SS) and convert to Date object for SQL Server
 * FIXED: Added time validation and conversion to Date object
 */
function validateTime(timeString) {
  if (!timeString) {
    throw new Error("Time is required");
  }

  // Check format
  if (!/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
    throw new Error("Invalid time format. Use HH:MM:SS");
  }

  const [hours, minutes, seconds] = timeString.split(":").map(Number);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new Error("Invalid time values");
  }

  return timeString;
}

/**
 * Convert time string (HH:MM:SS) to Date object for SQL Server TIME type
 * SQL Server's tedious driver requires Date objects for TIME columns
 */
function convertTimeToDateObject(timeString) {
  if (!timeString) {
    throw new Error("Time is required");
  }

  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  const timeDate = new Date();
  timeDate.setHours(hours, minutes, seconds, 0);

  return timeDate;
}

/**
 * Check if date is a weekday
 * FIXED: Better weekend checking
 */
function isWeekday(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6; // Not Sunday (0) or Saturday (6)
}

/**
 * Check if time is within business hours
 * FIXED: Added business hours validation
 */
function isBusinessHours(timeString) {
  const [hours] = timeString.split(":").map(Number);
  return hours >= 9 && hours < 17; // 9 AM to 5 PM
}

// ============================================
// CALENDAR OPERATIONS
// ============================================

/**
 * Check if a time slot is available (not blocked by admin)
 * FIXED: Added SQL type safety and validation
 *
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM:SS format
 * @returns {Promise<boolean>} True if available, false if blocked
 */
async function isSlotAvailable(date, time) {
  try {
    // Validate inputs
    validateDate(date);
    validateTime(time);

    // Convert time string to Date object for SQL Server
    const timeDate = convertTimeToDateObject(time);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("date", sql.Date, date)
      .input("time", sql.Time, timeDate).query(`
        SELECT COUNT(*) as count
        FROM dbo.AdminCalendar
        WHERE BlockedDate = @date
          AND BlockedTime = @time
      `);

    return result.recordset[0].count === 0;
  } catch (error) {
    console.error("Error checking slot availability:", error);
    throw error;
  }
}

/**
 * Get all blocked slots for a date range
 * FIXED: Added SQL type safety and better date handling
 *
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of blocked slots
 */
async function getBlockedSlots(startDate, endDate) {
  try {
    // Validate inputs
    const start = validateDate(startDate);
    const end = validateDate(endDate);

    if (start > end) {
      throw new Error("Start date must be before or equal to end date");
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("startDate", sql.Date, startDate)
      .input("endDate", sql.Date, endDate).query(`
        SELECT
          ac.CalendarId,
          ac.BlockedDate,
          CONVERT(VARCHAR(8), ac.BlockedTime, 108) as BlockedTime,
          ac.Duration,
          ac.CaseId,
          ac.Reason,
          ac.CreatedAt,
          c.CaseTitle,
          c.AttorneyStatus
        FROM dbo.AdminCalendar ac
        LEFT JOIN dbo.Cases c ON ac.CaseId = c.CaseId
        WHERE ac.BlockedDate BETWEEN @startDate AND @endDate
        ORDER BY ac.BlockedDate, ac.BlockedTime
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting blocked slots:", error);
    throw error;
  }
}

/**
 * Block a time slot (manual or for approved case)
 * FIXED: Added duplicate checking and validation
 *
 * @param {Object} slotData - Slot blocking data
 * @param {string} slotData.blockedDate - Date in YYYY-MM-DD format
 * @param {string} slotData.blockedTime - Time in HH:MM:SS format
 * @param {number} slotData.duration - Duration in minutes (default: 480)
 * @param {number} slotData.caseId - Optional case ID
 * @param {string} slotData.reason - Optional reason
 * @param {boolean} slotData.skipBusinessHoursCheck - Skip business hours validation (for case approvals)
 * @returns {Promise<number>} CalendarId
 */
async function blockSlot(slotData) {
  try {
    // Validate required fields
    if (!slotData.blockedDate || !slotData.blockedTime) {
      throw new Error("Date and time are required");
    }

    // Validate date and time
    const date = validateDate(slotData.blockedDate);
    validateTime(slotData.blockedTime);

    // Convert time string to Date object for SQL Server
    const timeDate = convertTimeToDateObject(slotData.blockedTime);

    // Debug logging
    console.log(`🔍 Blocking slot for ${slotData.blockedDate} ${slotData.blockedTime}`);
    console.log(`   - Parsed date: ${date.toISOString()}`);
    console.log(`   - Day of week: ${date.getDay()} (0=Sun, 1=Mon, ..., 6=Sat)`);
    console.log(`   - skipBusinessHoursCheck: ${slotData.skipBusinessHoursCheck}`);
    console.log(`   - isWeekday: ${isWeekday(date)}`);

    // Check if it's a weekday (only for manual blocks, not case approvals)
    if (!slotData.skipBusinessHoursCheck && !isWeekday(date)) {
      throw new Error("Cannot block slots on weekends");
    }

    // Check if it's within business hours (only for manual blocks, not case approvals)
    if (!slotData.skipBusinessHoursCheck && !isBusinessHours(slotData.blockedTime)) {
      throw new Error(
        "Can only block slots during business hours (9 AM - 5 PM)"
      );
    }

    // Validate duration
    const duration = slotData.duration || 480; // 8 hours default
    if (duration < 30 || duration > 480) {
      throw new Error("Duration must be between 30 and 480 minutes");
    }

    const pool = await poolPromise;

    // FIXED: Check if slot is already blocked
    const existing = await pool
      .request()
      .input("date", sql.Date, slotData.blockedDate)
      .input("time", sql.Time, timeDate).query(`
        SELECT CalendarId
        FROM dbo.AdminCalendar
        WHERE BlockedDate = @date AND BlockedTime = @time
      `);

    if (existing.recordset.length > 0) {
      throw new Error("This time slot is already blocked");
    }

    // Insert the blocked slot
    const result = await pool
      .request()
      .input("blockedDate", sql.Date, slotData.blockedDate)
      .input("blockedTime", sql.Time, timeDate)
      .input("duration", sql.Int, duration)
      .input("caseId", sql.Int, slotData.caseId || null)
      .input("reason", sql.NVarChar, slotData.reason || null).query(`
        INSERT INTO dbo.AdminCalendar
          (BlockedDate, BlockedTime, Duration, CaseId, Reason, CreatedAt)
        VALUES
          (@blockedDate, @blockedTime, @duration, @caseId, @reason, GETUTCDATE());
        SELECT SCOPE_IDENTITY() as CalendarId;
      `);

    return result.recordset[0].CalendarId;
  } catch (error) {
    console.error("Error blocking slot:", error);
    throw error;
  }
}

/**
 * Remove a blocked slot
 * FIXED: Added validation and better error handling
 *
 * @param {number} calendarId - Calendar ID to remove
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function unblockSlot(calendarId) {
  try {
    if (!calendarId || isNaN(parseInt(calendarId))) {
      throw new Error("Valid calendar ID is required");
    }

    const pool = await poolPromise;

    // Check if slot exists
    const existing = await pool
      .request()
      .input("calendarId", sql.Int, calendarId).query(`
        SELECT CalendarId, CaseId 
        FROM dbo.AdminCalendar 
        WHERE CalendarId = @calendarId
      `);

    if (existing.recordset.length === 0) {
      return false; // Slot doesn't exist
    }

    // Delete the slot
    await pool.request().input("calendarId", sql.Int, calendarId).query(`
        DELETE FROM dbo.AdminCalendar
        WHERE CalendarId = @calendarId
      `);

    return true;
  } catch (error) {
    console.error("Error unblocking slot:", error);
    throw error;
  }
}

/**
 * Block slot when case is approved
 * FIXED: Added validation and skip business hours check
 *
 * @param {number} caseId - Case ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM:SS format
 * @returns {Promise<number>} CalendarId
 */
async function blockSlotForCase(caseId, date, time) {
  try {
    if (!caseId || isNaN(parseInt(caseId))) {
      throw new Error("Valid case ID is required");
    }

    return await blockSlot({
      blockedDate: date,
      blockedTime: time,
      duration: 480, // 8 hours
      caseId: caseId,
      reason: "Approved case trial scheduled",
      skipBusinessHoursCheck: true, // Allow any time for case approvals
    });
  } catch (error) {
    console.error("Error blocking slot for case:", error);
    throw error;
  }
}

/**
 * Unblock slots for a case (when case is cancelled/rejected)
 * NEW: Added function to unblock case slots
 *
 * @param {number} caseId - Case ID
 * @returns {Promise<number>} Number of slots unblocked
 */
async function unblockSlotsForCase(caseId) {
  try {
    if (!caseId || isNaN(parseInt(caseId))) {
      throw new Error("Valid case ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("caseId", sql.Int, caseId).query(`
        DELETE FROM dbo.AdminCalendar
        WHERE CaseId = @caseId;
        SELECT @@ROWCOUNT as DeletedCount;
      `);

    return result.recordset[0].DeletedCount;
  } catch (error) {
    console.error("Error unblocking slots for case:", error);
    throw error;
  }
}

/**
 * Get all available slots for a date range
 * FIXED: Better date handling and validation
 *
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Available time slots
 */
async function getAvailableSlots(startDate, endDate) {
  try {
    // Validate inputs
    const start = validateDate(startDate);
    const end = validateDate(endDate);

    if (start > end) {
      throw new Error("Start date must be before or equal to end date");
    }

    // Check date range is not too large (max 90 days)
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      throw new Error("Date range cannot exceed 90 days");
    }

    // Get all blocked slots first
    const blockedSlots = await getBlockedSlots(startDate, endDate);

    // Define available time slots (business hours: 9 AM - 5 PM, 30-minute intervals)
    const timeSlots = [
      "09:00:00",
      "09:30:00",
      "10:00:00",
      "10:30:00",
      "11:00:00",
      "11:30:00",
      "12:00:00",
      "12:30:00",
      "13:00:00",
      "13:30:00",
      "14:00:00",
      "14:30:00",
      "15:00:00",
      "15:30:00",
      "16:00:00",
      "16:30:00",
      "17:00:00",
    ];

    // Generate all dates in range
    const availableSlots = [];
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];

      // Skip weekends
      if (isWeekday(current)) {
        timeSlots.forEach((time) => {
          const isBlocked = blockedSlots.some((slot) => {
            const blockedDateStr =
              slot.BlockedDate instanceof Date
                ? slot.BlockedDate.toISOString().split("T")[0]
                : slot.BlockedDate;
            return blockedDateStr === dateStr && slot.BlockedTime === time;
          });

          if (!isBlocked) {
            availableSlots.push({
              date: dateStr,
              time: time,
              available: true,
              dayOfWeek: current.toLocaleDateString("en-US", {
                weekday: "long",
              }),
            });
          }
        });
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    return availableSlots;
  } catch (error) {
    console.error("Error getting available slots:", error);
    throw error;
  }
}

/**
 * Get slots blocked for a specific case
 * NEW: Added function to get case-specific blocks
 *
 * @param {number} caseId - Case ID
 * @returns {Promise<Array>} Blocked slots for the case
 */
async function getSlotsForCase(caseId) {
  try {
    if (!caseId || isNaN(parseInt(caseId))) {
      throw new Error("Valid case ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("caseId", sql.Int, caseId).query(`
        SELECT
          CalendarId,
          BlockedDate,
          CONVERT(VARCHAR(8), BlockedTime, 108) as BlockedTime,
          Duration,
          Reason,
          CreatedAt
        FROM dbo.AdminCalendar
        WHERE CaseId = @caseId
        ORDER BY BlockedDate, BlockedTime
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting slots for case:", error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core operations
  isSlotAvailable,
  getBlockedSlots,
  blockSlot,
  unblockSlot,

  // Case-specific operations
  blockSlotForCase,
  unblockSlotsForCase, // NEW
  getSlotsForCase, // NEW

  // Availability
  getAvailableSlots,
};
