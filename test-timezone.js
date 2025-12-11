// Quick test to check SQL Server timezone and case scheduling
require('dotenv').config({ path: './backend/.env' });
const { poolPromise } = require('./backend/config/db');

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
        DATEDIFF(MINUTE, GETDATE(),
          CAST(CONCAT(
            CONVERT(VARCHAR(10), ScheduledDate, 120),
            ' ',
            CONVERT(VARCHAR(8), ScheduledTime, 108)
          ) AS DATETIME)
        ) AS MinutesUntilTrial,
        GETDATE() AS CurrentServerTime
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
      console.log(`Scheduled: ${c.ScheduledDateTime}`);
      console.log(`Current Server Time: ${c.CurrentServerTime}`);
      console.log(`Minutes until trial: ${c.MinutesUntilTrial}`);
      console.log('');
      console.log(`War room opens at: ${c.MinutesUntilTrial <= 60 ? 'YES - SHOULD BE OPEN!' : 'NO - Not yet (opens 60 min before)'}`);
      console.log(`Notifications sent at: ${c.MinutesUntilTrial <= 30 ? 'YES - SHOULD BE SENT!' : 'NO - Not yet (sent 30 min before)'}`);
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
