// =============================================
// TrialRecording.js - Trial Recording Model
// =============================================

const { poolPromise, sql } = require("../config/db");

const RECORDING_STATUS = {
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
};

async function startRecording(meetingId, caseId, startedBy) {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId))
      .input("caseId", sql.Int, parseInt(caseId))
      .input("startedBy", sql.Int, parseInt(startedBy)).query(`
        INSERT INTO dbo.TrialRecordings 
        (MeetingId, CaseId, Status, StartedBy, StartedAt, CreatedAt)
        VALUES 
        (@meetingId, @caseId, 'processing', @startedBy, GETUTCDATE(), GETUTCDATE());
        SELECT SCOPE_IDENTITY() as RecordingId;
      `);

    const recordingId = result.recordset[0].RecordingId;

    await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId))
      .input("startedBy", sql.Int, parseInt(startedBy)).query(`
        UPDATE dbo.TrialMeetings
        SET IsRecording = 1, 
            RecordingStartedAt = GETUTCDATE(),
            RecordingStartedBy = @startedBy
        WHERE MeetingId = @meetingId
      `);

    return recordingId;
  } catch (error) {
    console.error("Error starting recording:", error);
    throw error;
  }
}

async function stopRecording(
  recordingId,
  recordingUrl = null,
  fileSize = null
) {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("recordingId", sql.Int, parseInt(recordingId))
      .input("recordingUrl", sql.NVarChar, recordingUrl)
      .input("fileSize", sql.BigInt, fileSize).query(`
        UPDATE dbo.TrialRecordings
        SET Status = 'ready',
            CompletedAt = GETUTCDATE(),
            RecordingUrl = @recordingUrl,
            FileSize = @fileSize,
            Duration = DATEDIFF(SECOND, StartedAt, GETUTCDATE())
        WHERE RecordingId = @recordingId;
        
        SELECT MeetingId FROM dbo.TrialRecordings WHERE RecordingId = @recordingId;
      `);

    const meetingId = result.recordset[0]?.MeetingId;

    if (meetingId) {
      await pool.request().input("meetingId", sql.Int, meetingId).query(`
          UPDATE dbo.TrialMeetings
          SET IsRecording = 0
          WHERE MeetingId = @meetingId
        `);
    }

    return true;
  } catch (error) {
    console.error("Error stopping recording:", error);
    throw error;
  }
}

async function findById(recordingId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("recordingId", sql.Int, parseInt(recordingId)).query(`
        SELECT 
          tr.*,
          c.CaseTitle,
          c.County,
          a.FirstName + ' ' + a.LastName as StartedByName
        FROM dbo.TrialRecordings tr
        LEFT JOIN dbo.Cases c ON tr.CaseId = c.CaseId
        LEFT JOIN dbo.Admins a ON tr.StartedBy = a.AdminId
        WHERE tr.RecordingId = @recordingId
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error finding recording:", error);
    throw error;
  }
}

async function getRecordingsByCase(caseId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId)).query(`
        SELECT 
          tr.*,
          a.FirstName + ' ' + a.LastName as StartedByName,
          a.Email as StartedByEmail
        FROM dbo.TrialRecordings tr
        LEFT JOIN dbo.Admins a ON tr.StartedBy = a.AdminId
        WHERE tr.CaseId = @caseId
        ORDER BY tr.StartedAt DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting recordings by case:", error);
    throw error;
  }
}

async function getRecordingByMeeting(meetingId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId)).query(`
        SELECT 
          tr.*,
          a.FirstName + ' ' + a.LastName as StartedByName
        FROM dbo.TrialRecordings tr
        LEFT JOIN dbo.Admins a ON tr.StartedBy = a.AdminId
        WHERE tr.MeetingId = @meetingId
        ORDER BY tr.StartedAt DESC
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error getting recording by meeting:", error);
    throw error;
  }
}

async function isRecording(meetingId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId)).query(`
        SELECT IsRecording FROM dbo.TrialMeetings WHERE MeetingId = @meetingId
      `);

    return result.recordset[0]?.IsRecording === true;
  } catch (error) {
    console.error("Error checking recording status:", error);
    return false;
  }
}

async function getActiveRecording(meetingId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("meetingId", sql.Int, parseInt(meetingId)).query(`
        SELECT TOP 1 *
        FROM dbo.TrialRecordings
        WHERE MeetingId = @meetingId 
          AND Status = 'processing'
        ORDER BY StartedAt DESC
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error getting active recording:", error);
    throw error;
  }
}

async function updateRecordingUrl(recordingId, recordingUrl, fileSize = null) {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("recordingId", sql.Int, parseInt(recordingId))
      .input("recordingUrl", sql.NVarChar, recordingUrl)
      .input("fileSize", sql.BigInt, fileSize).query(`
        UPDATE dbo.TrialRecordings
        SET RecordingUrl = @recordingUrl,
            FileSize = @fileSize,
            Status = 'ready'
        WHERE RecordingId = @recordingId
      `);
  } catch (error) {
    console.error("Error updating recording URL:", error);
    throw error;
  }
}

async function markRecordingFailed(recordingId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("recordingId", sql.Int, parseInt(recordingId)).query(`
        UPDATE dbo.TrialRecordings
        SET Status = 'failed'
        WHERE RecordingId = @recordingId;
        
        SELECT MeetingId FROM dbo.TrialRecordings WHERE RecordingId = @recordingId;
      `);

    const meetingId = result.recordset[0]?.MeetingId;

    if (meetingId) {
      await pool.request().input("meetingId", sql.Int, meetingId).query(`
          UPDATE dbo.TrialMeetings
          SET IsRecording = 0
          WHERE MeetingId = @meetingId
        `);
    }
  } catch (error) {
    console.error("Error marking recording as failed:", error);
    throw error;
  }
}

module.exports = {
  RECORDING_STATUS,
  startRecording,
  stopRecording,
  findById,
  getRecordingsByCase,
  getRecordingByMeeting,
  isRecording,
  getActiveRecording,
  updateRecordingUrl,
  markRecordingFailed,
};
