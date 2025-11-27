// =============================================
// scheduleTrial.js - Schedule Trial Routes (Legacy)
// FIXED: SQL type safety, validation, better structure
// NOTE: Consider migrating to Case model methods
// =============================================

const express = require("express");
const router = express.Router();
const { poolPromise, sql } = require("../config/db");
const rateLimit = require("express-rate-limit");
const {
  authMiddleware,
  requireAttorney,
} = require("../middleware/authMiddleware");

// ============================================
// RATE LIMITERS
// ============================================

const scheduleTrialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 schedule attempts per hour
  message: {
    success: false,
    message: "Too many scheduling attempts. Please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// MIDDLEWARE
// ============================================

// All routes require authentication and attorney access
router.use(authMiddleware);
router.use(requireAttorney);

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate schedule trial request
 */
const validateScheduleTrialRequest = (req, res, next) => {
  const {
    county,
    caseType,
    caseTier,
    caseDescription,
    paymentMethod,
    paymentAmount,
    plaintiffGroups,
    defendantGroups,
    scheduledDate,
    scheduledTime,
    name,
    email,
  } = req.body;

  const errors = [];

  // Required fields
  if (!county || typeof county !== "string") {
    errors.push("County is required");
  }
  if (!caseType || typeof caseType !== "string") {
    errors.push("Case type is required");
  }
  if (!caseTier || !["tier_1", "tier_2", "tier_3"].includes(caseTier)) {
    errors.push("Valid case tier is required (tier_1, tier_2, or tier_3)");
  }
  if (!caseDescription || typeof caseDescription !== "string") {
    errors.push("Case description is required");
  }
  if (!paymentMethod || typeof paymentMethod !== "string") {
    errors.push("Payment method is required");
  }
  if (
    !paymentAmount ||
    isNaN(parseFloat(paymentAmount)) ||
    parseFloat(paymentAmount) <= 0
  ) {
    errors.push("Valid payment amount is required");
  }
  if (!Array.isArray(plaintiffGroups)) {
    errors.push("Plaintiff groups must be an array");
  }
  if (!Array.isArray(defendantGroups)) {
    errors.push("Defendant groups must be an array");
  }
  if (!scheduledDate) {
    errors.push("Scheduled date is required");
  }
  if (!scheduledTime) {
    errors.push("Scheduled time is required");
  }
  if (!name || typeof name !== "string") {
    errors.push("Name is required");
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    errors.push("Valid email is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors,
    });
  }

  next();
};

/**
 * Validate date format
 */
const validateDateFormat = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/schedule-trial/all-cases
 * Get all scheduled trials (for attorney viewing their cases)
 * FIXED: Added SQL type safety and proper filtering
 */
router.get("/all-cases", generalLimiter, async (req, res) => {
  try {
    const attorneyId = req.user.id;
    const pool = await poolPromise;

    // Only return cases for the authenticated attorney
    const result = await pool.request().input("attorneyId", sql.Int, attorneyId)
      .query(`
        SELECT 
          Id,
          County,
          CaseType,
          CaseTier,
          CaseDescription,
          PaymentMethod,
          PaymentAmount,
          PlaintiffGroups,
          DefendantGroups,
          ScheduledDate,
          ScheduledTime,
          Name,
          Email,
          UserId,
          CreatedAt
        FROM ScheduledTrials
        WHERE UserId = @attorneyId
        ORDER BY ScheduledDate DESC, CreatedAt DESC
      `);

    // Parse JSON fields
    const cases = result.recordset.map((row) => ({
      ...row,
      PlaintiffGroups: JSON.parse(row.PlaintiffGroups || "[]"),
      DefendantGroups: JSON.parse(row.DefendantGroups || "[]"),
    }));

    res.json({
      success: true,
      cases,
      count: cases.length,
    });
  } catch (error) {
    console.error("Fetch cases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cases",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /api/schedule-trial/schedule-trial
 * Schedule a new trial
 * FIXED: SQL type safety, validation, proper error handling
 */
router.post(
  "/schedule-trial",
  scheduleTrialLimiter,
  validateScheduleTrialRequest,
  async (req, res) => {
    try {
      const attorneyId = req.user.id;
      const {
        county,
        caseType,
        caseTier,
        caseDescription,
        paymentMethod,
        paymentAmount,
        plaintiffGroups,
        defendantGroups,
        scheduledDate,
        scheduledTime,
        name,
        email,
      } = req.body;

      // Validate date
      if (!validateDateFormat(scheduledDate)) {
        return res.status(400).json({
          success: false,
          message: "Invalid scheduled date format",
        });
      }

      const pool = await poolPromise;

      // Convert scheduledTime string to Date object for SQL Server TIME type
      // SQL Server's tedious driver requires Date objects for TIME columns
      let timeValue = null;
      if (scheduledTime) {
        const timeParts = scheduledTime.split(':');
        let hours, minutes, seconds;

        if (timeParts.length === 2) {
          hours = parseInt(timeParts[0]);
          minutes = parseInt(timeParts[1]);
          seconds = 0;
        } else if (timeParts.length === 3) {
          hours = parseInt(timeParts[0]);
          minutes = parseInt(timeParts[1]);
          seconds = parseInt(timeParts[2]);
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid time format. Expected HH:MM or HH:MM:SS",
          });
        }

        timeValue = new Date();
        timeValue.setHours(hours, minutes, seconds, 0);
      }

      // Insert with proper SQL types
      const result = await pool
        .request()
        .input("county", sql.NVarChar(100), county)
        .input("caseType", sql.NVarChar(100), caseType)
        .input("caseTier", sql.NVarChar(50), caseTier)
        .input("caseDescription", sql.NVarChar(sql.MAX), caseDescription)
        .input("paymentMethod", sql.NVarChar(50), paymentMethod)
        .input("paymentAmount", sql.Decimal(10, 2), parseFloat(paymentAmount))
        .input(
          "plaintiffGroups",
          sql.NVarChar(sql.MAX),
          JSON.stringify(plaintiffGroups)
        )
        .input(
          "defendantGroups",
          sql.NVarChar(sql.MAX),
          JSON.stringify(defendantGroups)
        )
        .input("scheduledDate", sql.Date, scheduledDate)
        .input("scheduledTime", sql.Time, timeValue)
        .input("name", sql.NVarChar(255), name)
        .input("email", sql.NVarChar(255), email)
        .input("userId", sql.Int, attorneyId).query(`
          INSERT INTO ScheduledTrials (
            County, CaseType, CaseTier, CaseDescription, PaymentMethod, PaymentAmount,
            PlaintiffGroups, DefendantGroups, ScheduledDate, ScheduledTime, Name, Email, UserId,
            CreatedAt
          ) VALUES (
            @county, @caseType, @caseTier, @caseDescription,
            @paymentMethod, @paymentAmount,
            @plaintiffGroups, @defendantGroups,
            @scheduledDate, @scheduledTime, @name, @email, @userId,
            GETUTCDATE()
          );
          
          SELECT SCOPE_IDENTITY() AS TrialId;
        `);

      const trialId = result.recordset[0].TrialId;

      res.json({
        success: true,
        message: "Trial scheduled successfully",
        trialId,
      });
    } catch (error) {
      console.error("Schedule trial error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to schedule trial",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/schedule-trial/:trialId
 * Get specific trial details
 * NEW: Added endpoint to get single trial
 */
router.get("/:trialId", generalLimiter, async (req, res) => {
  try {
    const trialId = parseInt(req.params.trialId, 10);
    const attorneyId = req.user.id;

    if (isNaN(trialId) || trialId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid trial ID is required",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("trialId", sql.Int, trialId)
      .input("attorneyId", sql.Int, attorneyId).query(`
        SELECT 
          Id,
          County,
          CaseType,
          CaseTier,
          CaseDescription,
          PaymentMethod,
          PaymentAmount,
          PlaintiffGroups,
          DefendantGroups,
          ScheduledDate,
          ScheduledTime,
          Name,
          Email,
          UserId,
          CreatedAt
        FROM ScheduledTrials
        WHERE Id = @trialId AND UserId = @attorneyId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Trial not found",
      });
    }

    const trial = {
      ...result.recordset[0],
      PlaintiffGroups: JSON.parse(result.recordset[0].PlaintiffGroups || "[]"),
      DefendantGroups: JSON.parse(result.recordset[0].DefendantGroups || "[]"),
    };

    res.json({
      success: true,
      trial,
    });
  } catch (error) {
    console.error("Get trial error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch trial",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * DELETE /api/schedule-trial/:trialId
 * Delete/cancel scheduled trial
 * NEW: Added delete endpoint
 */
router.delete("/:trialId", generalLimiter, async (req, res) => {
  try {
    const trialId = parseInt(req.params.trialId, 10);
    const attorneyId = req.user.id;

    if (isNaN(trialId) || trialId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid trial ID is required",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("trialId", sql.Int, trialId)
      .input("attorneyId", sql.Int, attorneyId).query(`
        DELETE FROM ScheduledTrials
        WHERE Id = @trialId AND UserId = @attorneyId;
        
        SELECT @@ROWCOUNT as DeletedCount;
      `);

    if (result.recordset[0].DeletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Trial not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Trial cancelled successfully",
    });
  } catch (error) {
    console.error("Delete trial error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel trial",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("Schedule Trial Route Error:", error);

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
