const AdminCalendar = require("../models/AdminCalendar");
const CaseReschedule = require("../models/CaseReschedule");
const Case = require("../models/Case");
const Notification = require("../models/Notification");
const { poolPromise } = require("../config/db");
const sql = require("mssql");

/**
 * Get all blocked slots for admin calendar view
 */
async function getBlockedSlots(req, res) {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const blockedSlots = await AdminCalendar.getBlockedSlots(
      startDate,
      endDate
    );

    res.json({
      success: true,
      blockedSlots,
    });
  } catch (error) {
    console.error("Get blocked slots error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve blocked slots",
    });
  }
}

/**
 * Get available slots for a date range
 */
async function getAvailableSlots(req, res) {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const availableSlots = await AdminCalendar.getAvailableSlots(
      startDate,
      endDate
    );

    res.json({
      success: true,
      availableSlots,
    });
  } catch (error) {
    console.error("Get available slots error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve available slots",
    });
  }
}

/**
 * Manually block a time slot
 */
async function blockSlot(req, res) {
  try {
    const { blockedDate, blockedTime, duration, reason } = req.body;

    if (!blockedDate || !blockedTime) {
      return res.status(400).json({
        success: false,
        message: "blockedDate and blockedTime are required",
      });
    }

    // Check if slot is already blocked
    const isAvailable = await AdminCalendar.isSlotAvailable(
      blockedDate,
      blockedTime
    );
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: "This time slot is already blocked",
      });
    }

    const calendarId = await AdminCalendar.blockSlot({
      blockedDate,
      blockedTime,
      duration: duration || 480,
      reason: reason || "Manually blocked by admin",
    });

    res.json({
      success: true,
      message: "Time slot blocked successfully",
      calendarId,
    });
  } catch (error) {
    console.error("Block slot error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to block time slot",
    });
  }
}

/**
 * Unblock a time slot
 */
async function unblockSlot(req, res) {
  try {
    const { calendarId } = req.params;

    await AdminCalendar.unblockSlot(calendarId);

    res.json({
      success: true,
      message: "Time slot unblocked successfully",
    });
  } catch (error) {
    console.error("Unblock slot error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unblock time slot",
    });
  }
}

/**
 * Check if a specific slot is available
 */
async function checkSlotAvailability(req, res) {
  try {
    const { date, time } = req.query;

    if (!date || !time) {
      return res.status(400).json({
        success: false,
        message: "date and time are required",
      });
    }

    const isAvailable = await AdminCalendar.isSlotAvailable(date, time);

    res.json({
      success: true,
      available: isAvailable,
    });
  } catch (error) {
    console.error("Check slot availability error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check slot availability",
    });
  }
}

/**
 * Get all cases scheduled for a specific date with full details
 * Includes: witnesses, jury questions, meeting info, attorney details
 *
 * FIXED: Uses correct 'Witnesses' table name (not 'CaseWitnesses')
 */
async function getCasesByDate(req, res) {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date is required (format: YYYY-MM-DD)",
      });
    }

    const pool = await poolPromise;

    // Get cases for the date
    const casesResult = await pool.request().input("date", sql.Date, date)
      .query(`
        SELECT
          c.CaseId,
          c.CaseTitle,
          c.CaseType,
          c.County,
          c.ScheduledDate,
          c.ScheduledTime,
          c.AttorneyStatus,
          c.PlaintiffGroups,
          c.DefendantGroups,
          CONCAT(a.FirstName, ' ', a.LastName) as AttorneyName,
          a.Email as AttorneyEmail,
          a.LawFirmName,
          a.State as AttorneyState,
          tm.RoomId,
          tm.ThreadId,
          tm.Status as MeetingStatus
        FROM dbo.Cases c
        JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
        LEFT JOIN dbo.TrialMeetings tm ON c.CaseId = tm.CaseId
        WHERE CAST(c.ScheduledDate AS DATE) = @date
          AND c.AdminApprovalStatus = 'approved'
        ORDER BY c.ScheduledTime
      `);

    const cases = casesResult.recordset;

    // For each case, fetch witnesses and jury questions
    const casesWithDetails = await Promise.all(
      cases.map(async (caseItem) => {
        try {
          // Get witnesses from CaseWitnesses table
          let witnessesResult = { recordset: [] };
          try {
            witnessesResult = await pool
              .request()
              .input("caseId", sql.Int, caseItem.CaseId).query(`
                SELECT
                  WitnessId,
                  WitnessName,
                  Side,
                  Description
                FROM dbo.CaseWitnesses
                WHERE CaseId = @caseId
                ORDER BY OrderIndex ASC
              `);
          } catch (err) {
            if (err.number === 208) { // Invalid object name
              console.warn('⚠️ CaseWitnesses table does not exist yet');
            } else {
              throw err;
            }
          }

          // Get jury charge questions (gracefully handle missing table)
          let questionsResult = { recordset: [] };
          try {
            questionsResult = await pool
              .request()
              .input("caseId", sql.Int, caseItem.CaseId).query(`
                SELECT
                  QuestionId,
                  QuestionText,
                  QuestionType,
                  Options,
                  OrderIndex,
                  IsRequired
                FROM dbo.JuryChargeQuestions
                WHERE CaseId = @caseId
                ORDER BY OrderIndex ASC
              `);
          } catch (err) {
            if (err.number === 208 || err.number === 207) { // Invalid object name or invalid column name
              console.warn('⚠️ JuryChargeQuestions table does not exist or has different schema');
            } else {
              throw err;
            }
          }

          // Get approved jurors count
          const jurorsResult = await pool
            .request()
            .input("caseId", sql.Int, caseItem.CaseId).query(`
              SELECT COUNT(*) as ApprovedJurorCount
              FROM dbo.JurorApplications
              WHERE CaseId = @caseId AND Status = 'approved'
            `);

          // Get juror applications with juror details
          let jurorApplicationsResult = { recordset: [] };
          try {
            jurorApplicationsResult = await pool
              .request()
              .input("caseId", sql.Int, caseItem.CaseId).query(`
                SELECT
                  ja.ApplicationId,
                  ja.JurorId,
                  ja.Status,
                  ja.AppliedAt,
                  j.Name as JurorName,
                  j.Email as JurorEmail,
                  j.County,
                  j.State
                FROM dbo.JurorApplications ja
                INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
                WHERE ja.CaseId = @caseId
                ORDER BY ja.AppliedAt DESC
              `);
          } catch (err) {
            if (err.number === 208) {
              console.warn('⚠️ JurorApplications or Jurors table does not exist yet');
            } else {
              throw err;
            }
          }

          return {
            ...caseItem,
            State: caseItem.AttorneyState,
            witnesses: witnessesResult.recordset,
            juryQuestions: questionsResult.recordset.map((q) => ({
              ...q,
              Options: q.Options ? (typeof q.Options === 'string' ? JSON.parse(q.Options) : q.Options) : [],
            })),
            jurors: jurorApplicationsResult.recordset,
            approvedJurorCount:
              jurorsResult.recordset[0]?.ApprovedJurorCount || 0,
            canJoin:
              caseItem.RoomId !== null && caseItem.AttorneyStatus !== "pending",
          };
        } catch (caseError) {
          console.error(
            `Error fetching details for case ${caseItem.CaseId}:`,
            caseError
          );
          // Return case without details if there's an error
          return {
            ...caseItem,
            State: caseItem.AttorneyState,
            witnesses: [],
            juryQuestions: [],
            approvedJurorCount: 0,
            canJoin: false,
            error: "Failed to load some case details",
          };
        }
      })
    );

    res.json({
      success: true,
      date: date,
      casesCount: casesWithDetails.length,
      cases: casesWithDetails,
    });
  } catch (error) {
    console.error("Get cases by date error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve cases for the selected date",
      error: error.message,
    });
  }
}

module.exports = {
  getBlockedSlots,
  getAvailableSlots,
  blockSlot,
  unblockSlot,
  checkSlotAvailability,
  getCasesByDate,
};
