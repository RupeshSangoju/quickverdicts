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
      SELECT TOP 5
        c.CaseId,
        c.CaseTitle,
        c.ScheduledDate,
        c.ScheduledTime,
        c.AttorneyStatus,
        a.State as AttorneyState,
        a.FirstName + ' ' + a.LastName as AttorneyName,
        CASE
          WHEN a.State IN ('Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'New Hampshire', 'New Jersey', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'Vermont', 'Virginia', 'West Virginia') THEN -300
          WHEN a.State IN ('Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska', 'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas', 'Wisconsin') THEN -360
          WHEN a.State IN ('Arizona', 'Colorado', 'Idaho', 'Montana', 'New Mexico', 'Utah', 'Wyoming') THEN -420
          WHEN a.State IN ('California', 'Nevada', 'Oregon', 'Washington') THEN -480
          WHEN a.State = 'Alaska' THEN -540
          WHEN a.State = 'Hawaii' THEN -600
          WHEN a.State = 'India' THEN 330
          ELSE 0
        END as TimezoneOffset,
        CAST(CONCAT(
          CONVERT(VARCHAR(10), c.ScheduledDate, 120),
          ' ',
          CONVERT(VARCHAR(8), c.ScheduledTime, 108)
        ) AS DATETIME) AS ScheduledDateTime,
        DATEDIFF(MINUTE, DATEADD(MINUTE, CASE
          WHEN a.State IN ('Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'New Hampshire', 'New Jersey', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'Vermont', 'Virginia', 'West Virginia') THEN -300
          WHEN a.State IN ('Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska', 'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas', 'Wisconsin') THEN -360
          WHEN a.State IN ('Arizona', 'Colorado', 'Idaho', 'Montana', 'New Mexico', 'Utah', 'Wyoming') THEN -420
          WHEN a.State IN ('California', 'Nevada', 'Oregon', 'Washington') THEN -480
          WHEN a.State = 'Alaska' THEN -540
          WHEN a.State = 'Hawaii' THEN -600
          WHEN a.State = 'India' THEN 330
          ELSE 0
        END, GETDATE()),
          CAST(CONCAT(
            CONVERT(VARCHAR(10), c.ScheduledDate, 120),
            ' ',
            CONVERT(VARCHAR(8), c.ScheduledTime, 108)
          ) AS DATETIME)
        ) AS MinutesUntilTrial,
        DATEADD(MINUTE, CASE
          WHEN a.State IN ('Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'New Hampshire', 'New Jersey', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'Vermont', 'Virginia', 'West Virginia') THEN -300
          WHEN a.State IN ('Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska', 'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas', 'Wisconsin') THEN -360
          WHEN a.State IN ('Arizona', 'Colorado', 'Idaho', 'Montana', 'New Mexico', 'Utah', 'Wyoming') THEN -420
          WHEN a.State IN ('California', 'Nevada', 'Oregon', 'Washington') THEN -480
          WHEN a.State = 'Alaska' THEN -540
          WHEN a.State = 'Hawaii' THEN -600
          WHEN a.State = 'India' THEN 330
          ELSE 0
        END, GETDATE()) AS CurrentLocalTime,
        GETDATE() AS CurrentServerTime_UTC
      FROM Cases c
      LEFT JOIN Attorneys a ON c.AttorneyId = a.AttorneyId
      WHERE c.AttorneyStatus IN ('awaiting_trial', 'join_trial')
        AND c.AdminApprovalStatus = 'approved'
      ORDER BY c.ScheduledDate DESC, c.ScheduledTime DESC
    `);

    console.log('=== CASE INFO (with dynamic timezone per attorney) ===');
    if (caseInfo.recordset.length > 0) {
      caseInfo.recordset.forEach((c, index) => {
        console.log(`\n--- Case ${index + 1} ---`);
        console.log(`Case: ${c.CaseTitle} (ID: ${c.CaseId})`);
        console.log(`Status: ${c.AttorneyStatus}`);
        console.log(`Attorney: ${c.AttorneyName} from ${c.AttorneyState}`);
        console.log(`Timezone Offset: ${c.TimezoneOffset} minutes (${c.TimezoneOffset / 60} hours from UTC)`);
        console.log(`Scheduled DateTime: ${c.ScheduledDateTime}`);
        console.log(`Current UTC Time: ${c.CurrentServerTime_UTC}`);
        console.log(`Current ${c.AttorneyState} Time: ${c.CurrentLocalTime}`);
        console.log(`Minutes until trial: ${c.MinutesUntilTrial}`);
        console.log(`✅ War room: ${c.MinutesUntilTrial <= 60 && c.MinutesUntilTrial >= 0 ? 'SHOULD BE OPEN (within 60 min)' : 'CLOSED (opens 60 min before trial)'}`);
        console.log(`✅ Notifications: ${c.MinutesUntilTrial <= 30 && c.MinutesUntilTrial >= 0 ? 'SHOULD BE SENT (within 30 min)' : 'NOT YET (sends 30 min before trial)'}`);
      });
    } else {
      console.log('No cases found');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testTimezone();
