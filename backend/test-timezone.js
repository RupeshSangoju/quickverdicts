// Quick test to check SQL Server timezone and case scheduling
require('dotenv').config();
const { poolPromise } = require('./config/db');

async function testTimezone() {
  try {
    const pool = await poolPromise;

    // Check SQL Server current time
    const serverTime = await pool.request().query(`
      SELECT
        GETDATE() AS ServerLocalTime,
        GETUTCDATE() AS ServerUTCTime,
        DATEDIFF(HOUR, GETUTCDATE(), GETDATE()) AS TimezoneOffsetHours,
        SYSDATETIMEOFFSET() AS ServerTimeWithOffset
    `);

    console.log('=== SQL SERVER TIMEZONE INFO ===');
    console.log(serverTime.recordset[0]);
    console.log('');

    // Check your scheduled case
    const caseInfo = await pool.request().query(`
      SELECT TOP 1
        CaseId,
        CaseTitle,
        ScheduledDate,
        ScheduledTime,
        AttorneyStatus,
        CAST(CONCAT(
          CONVERT(VARCHAR(10), ScheduledDate, 120),
          ' ',
          CONVERT(VARCHAR(8), ScheduledTime, 108)
        ) AS DATETIME) AS ScheduledDateTime,
        DATEDIFF(MINUTE, DATEADD(MINUTE, 330, GETDATE()),
          CAST(CONCAT(
            CONVERT(VARCHAR(10), ScheduledDate, 120),
            ' ',
            CONVERT(VARCHAR(8), ScheduledTime, 108)
          ) AS DATETIME)
        ) AS MinutesUntilTrial,
        DATEADD(MINUTE, 330, GETDATE()) AS CurrentServerTime_IndiaTime,
        GETDATE() AS CurrentServerTime_UTC
      FROM Cases
      WHERE AttorneyStatus = 'awaiting_trial'
        AND AdminApprovalStatus = 'approved'
      ORDER BY ScheduledDate DESC, ScheduledTime DESC
    `);

    console.log('=== YOUR CASE INFO ===');
    if (caseInfo.recordset.length > 0) {
      const c = caseInfo.recordset[0];
      console.log(`Case: ${c.CaseTitle} (ID: ${c.CaseId})`);
      console.log(`Status: ${c.AttorneyStatus}`);
      console.log(`Scheduled DateTime: ${c.ScheduledDateTime} (stored in DB as India time)`);
      console.log(`Current UTC Time: ${c.CurrentServerTime_UTC}`);
      console.log(`Current India Time: ${c.CurrentServerTime_IndiaTime} (UTC + 5:30)`);
      console.log(`Minutes until trial: ${c.MinutesUntilTrial}`);
      console.log('');
      console.log(`✅ War room access: ${c.MinutesUntilTrial <= 60 && c.MinutesUntilTrial >= 0 ? 'OPEN (within 60 min of trial)' : 'CLOSED (opens 60 min before trial)'}`);
      console.log(`✅ Notifications: ${c.MinutesUntilTrial <= 30 && c.MinutesUntilTrial >= 0 ? 'SHOULD BE SENT (within 30 min)' : 'NOT YET (sends 30 min before trial)'}`);
    } else {
      console.log('No cases found with status awaiting_trial');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testTimezone();
