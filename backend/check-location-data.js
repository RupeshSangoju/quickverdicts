// Check what timezone/location data we have
require('dotenv').config();
const { poolPromise } = require('./config/db');

async function checkData() {
  try {
    const pool = await poolPromise;

    // Check Cases table structure
    console.log('=== CHECKING LOCATION DATA ===\n');

    const caseData = await pool.request().query(`
      SELECT TOP 3
        c.CaseId,
        c.CaseTitle,
        c.State as CaseState,
        c.County as CaseCounty,
        c.ScheduledDate,
        c.ScheduledTime,
        a.AttorneyId,
        a.FirstName + ' ' + a.LastName as AttorneyName,
        a.State as AttorneyState,
        a.City as AttorneyCity
      FROM Cases c
      LEFT JOIN Attorneys a ON c.AttorneyId = a.AttorneyId
      WHERE c.AdminApprovalStatus = 'approved'
      ORDER BY c.CaseId DESC
    `);

    console.log('Sample Cases with Location Data:');
    console.table(caseData.recordset);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();
