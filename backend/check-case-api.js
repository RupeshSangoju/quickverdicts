// Quick script to check what the API is returning for cases
// This will help debug the timezone issue

// Load environment variables first
require('dotenv').config();

const { poolPromise, sql } = require("./config/db");

async function checkCaseInDB() {
  try {
    const pool = await poolPromise;

    console.log('\n=== CHECKING DATABASE DIRECTLY ===\n');

    // Get latest case
    const result = await pool.request().query(`
      SELECT TOP 1
        CaseId,
        CaseTitle,
        ScheduledDate,
        ScheduledTime,
        AttorneyId,
        AttorneyStatus,
        AdminApprovalStatus,
        CreatedAt,
        UpdatedAt
      FROM Cases
      WHERE IsDeleted = 0
      ORDER BY CreatedAt DESC
    `);

    if (result.recordset.length === 0) {
      console.log('No cases found in database.');
      return;
    }

    const caseData = result.recordset[0];

    console.log('Latest Case in Database:');
    console.log('========================');
    console.log(`Case ID: ${caseData.CaseId}`);
    console.log(`Title: ${caseData.CaseTitle}`);
    console.log(`Scheduled Date: ${caseData.ScheduledDate}`);
    console.log(`Scheduled Time: ${caseData.ScheduledTime}`);
    console.log(`Attorney ID: ${caseData.AttorneyId}`);
    console.log(`Status: ${caseData.AttorneyStatus}`);
    console.log(`Admin Approval: ${caseData.AdminApprovalStatus}`);
    console.log(`Created: ${caseData.CreatedAt}`);

    console.log('\n=== TIMEZONE INTERPRETATION ===\n');

    // Show what this looks like in different timezones
    const scheduledDateTime = new Date(`${caseData.ScheduledDate}T${caseData.ScheduledTime}Z`); // Z = UTC

    console.log('If stored time is UTC:');
    console.log(`  UTC: ${scheduledDateTime.toISOString()}`);
    console.log(`  IST (UTC+5:30): ${scheduledDateTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`  UK (UTC+0): ${scheduledDateTime.toLocaleString('en-GB', { timeZone: 'Europe/London' })}`);
    console.log(`  US EST (UTC-5): ${scheduledDateTime.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);

    console.log('\n=== CURRENT SERVER TIME ===\n');
    const timeCheck = await pool.request().query(`
      SELECT
        GETUTCDATE() AS 'CurrentUTC',
        GETDATE() AS 'ServerLocal'
    `);

    console.log(`Current UTC: ${timeCheck.recordset[0].CurrentUTC}`);
    console.log(`Server Local: ${timeCheck.recordset[0].ServerLocal}`);

    console.log('\n');
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCaseInDB();
