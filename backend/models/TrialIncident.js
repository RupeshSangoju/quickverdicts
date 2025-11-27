// =============================================
// TrialIncident.js - Trial Incident Model
// =============================================

const { poolPromise, sql } = require("../config/db");

const INCIDENT_TYPES = {
  DISRUPTIVE: "disruptive",
  TECHNICAL: "technical",
  INAPPROPRIATE: "inappropriate",
  CONNECTION: "connection",
  OTHER: "other",
};

const SEVERITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

async function reportIncident(incidentData) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(incidentData.meetingId))
      .input(
        "participantId",
        sql.Int,
        incidentData.participantId ? parseInt(incidentData.participantId) : null
      )
      .input("reportedBy", sql.Int, parseInt(incidentData.reportedBy))
      .input("incidentType", sql.NVarChar, incidentData.incidentType)
      .input("description", sql.NVarChar, incidentData.description)
      .input("actionTaken", sql.NVarChar, incidentData.actionTaken || null)
      .input("severity", sql.NVarChar, incidentData.severity || "medium")
      .query(`
        INSERT INTO dbo.TrialIncidents 
        (MeetingId, ParticipantId, ReportedBy, IncidentType, Description, ActionTaken, Severity, ReportedAt)
        VALUES 
        (@meetingId, @participantId, @reportedBy, @incidentType, @description, @actionTaken, @severity, GETUTCDATE());
        SELECT SCOPE_IDENTITY() as IncidentId;
      `);

    return result.recordset[0].IncidentId;
  } catch (error) {
    console.error("Error reporting incident:", error);
    throw error;
  }
}

async function getIncidentsByMeeting(meetingId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId)).query(`
        SELECT 
          ti.*,
          tp.DisplayName as ParticipantName,
          tp.UserType as ParticipantType,
          a.FirstName + ' ' + a.LastName as ReportedByName,
          a.Email as ReportedByEmail
        FROM dbo.TrialIncidents ti
        LEFT JOIN dbo.TrialParticipants tp ON ti.ParticipantId = tp.ParticipantId
        LEFT JOIN dbo.Admins a ON ti.ReportedBy = a.AdminId
        WHERE ti.MeetingId = @meetingId
        ORDER BY ti.ReportedAt DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting incidents by meeting:", error);
    throw error;
  }
}

async function findById(incidentId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("incidentId", sql.Int, parseInt(incidentId)).query(`
        SELECT 
          ti.*,
          tp.DisplayName as ParticipantName,
          tp.UserType as ParticipantType,
          a.FirstName + ' ' + a.LastName as ReportedByName,
          c.CaseTitle,
          c.CaseId
        FROM dbo.TrialIncidents ti
        LEFT JOIN dbo.TrialParticipants tp ON ti.ParticipantId = tp.ParticipantId
        LEFT JOIN dbo.Admins a ON ti.ReportedBy = a.AdminId
        LEFT JOIN dbo.TrialMeetings tm ON ti.MeetingId = tm.MeetingId
        LEFT JOIN dbo.Cases c ON tm.CaseId = c.CaseId
        WHERE ti.IncidentId = @incidentId
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error finding incident:", error);
    throw error;
  }
}

async function updateActionTaken(incidentId, actionTaken) {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("incidentId", sql.Int, parseInt(incidentId))
      .input("actionTaken", sql.NVarChar, actionTaken).query(`
        UPDATE dbo.TrialIncidents
        SET ActionTaken = @actionTaken
        WHERE IncidentId = @incidentId
      `);
  } catch (error) {
    console.error("Error updating action taken:", error);
    throw error;
  }
}

async function getIncidentStats(meetingId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId)).query(`
        SELECT 
          COUNT(*) as TotalIncidents,
          SUM(CASE WHEN Severity = 'critical' THEN 1 ELSE 0 END) as CriticalIncidents,
          SUM(CASE WHEN Severity = 'high' THEN 1 ELSE 0 END) as HighIncidents,
          SUM(CASE WHEN IncidentType = 'disruptive' THEN 1 ELSE 0 END) as DisruptiveIncidents,
          SUM(CASE WHEN ActionTaken IS NOT NULL THEN 1 ELSE 0 END) as ResolvedIncidents
        FROM dbo.TrialIncidents
        WHERE MeetingId = @meetingId
      `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error getting incident stats:", error);
    throw error;
  }
}

async function getAllIncidents(options = {}) {
  try {
    const pool = await poolPromise;
    let query = `
      SELECT 
        ti.*,
        tp.DisplayName as ParticipantName,
        a.FirstName + ' ' + a.LastName as ReportedByName,
        c.CaseTitle
      FROM dbo.TrialIncidents ti
      LEFT JOIN dbo.TrialParticipants tp ON ti.ParticipantId = tp.ParticipantId
      LEFT JOIN dbo.Admins a ON ti.ReportedBy = a.AdminId
      LEFT JOIN dbo.TrialMeetings tm ON ti.MeetingId = tm.MeetingId
      LEFT JOIN dbo.Cases c ON tm.CaseId = c.CaseId
      WHERE 1=1
    `;

    const request = pool.request();

    if (options.severity) {
      query += " AND ti.Severity = @severity";
      request.input("severity", sql.NVarChar, options.severity);
    }

    if (options.incidentType) {
      query += " AND ti.IncidentType = @incidentType";
      request.input("incidentType", sql.NVarChar, options.incidentType);
    }

    if (options.startDate) {
      query += " AND ti.ReportedAt >= @startDate";
      request.input("startDate", sql.DateTime, options.startDate);
    }

    if (options.endDate) {
      query += " AND ti.ReportedAt <= @endDate";
      request.input("endDate", sql.DateTime, options.endDate);
    }

    query += " ORDER BY ti.ReportedAt DESC";

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error getting all incidents:", error);
    throw error;
  }
}

module.exports = {
  INCIDENT_TYPES,
  SEVERITY_LEVELS,
  reportIncident,
  getIncidentsByMeeting,
  findById,
  updateActionTaken,
  getIncidentStats,
  getAllIncidents,
};
