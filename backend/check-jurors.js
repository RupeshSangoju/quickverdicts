// =============================================
// Quick script to check juror applications in database
// =============================================

const { poolPromise, sql } = require("./config/db");

async function checkJurors() {
  try {
    const pool = await poolPromise;

    // Get all cases with their juror counts
    const casesResult = await pool.request().query(`
      SELECT
        c.CaseId,
        c.CaseTitle,
        c.AttorneyStatus,
        (SELECT COUNT(*) FROM dbo.JurorApplications WHERE CaseId = c.CaseId) AS TotalApplications,
        (SELECT COUNT(*) FROM dbo.JurorApplications WHERE CaseId = c.CaseId AND Status = 'approved') AS ApprovedApplications,
        (SELECT COUNT(*) FROM dbo.JurorApplications WHERE CaseId = c.CaseId AND Status = 'pending') AS PendingApplications
      FROM dbo.Cases c
      WHERE c.AdminApprovalStatus = 'approved'
      ORDER BY c.ScheduledDate DESC
    `);

    console.log("\n=== CASES AND JUROR APPLICATIONS ===\n");

    if (casesResult.recordset.length === 0) {
      console.log("❌ No approved cases found in database");
      return;
    }

    casesResult.recordset.forEach((caseItem) => {
      console.log(`📋 Case ID: ${caseItem.CaseId}`);
      console.log(`   Title: ${caseItem.CaseTitle}`);
      console.log(`   Status: ${caseItem.AttorneyStatus}`);
      console.log(`   Total Applications: ${caseItem.TotalApplications}`);
      console.log(`   Approved: ${caseItem.ApprovedApplications}`);
      console.log(`   Pending: ${caseItem.PendingApplications}`);
      console.log("");
    });

    // Get detailed juror applications for cases with applications
    const jurorsResult = await pool.request().query(`
      SELECT
        ja.ApplicationId,
        ja.CaseId,
        ja.Status,
        ja.AppliedAt,
        j.Name as JurorName,
        j.Email as JurorEmail,
        j.County,
        j.State,
        c.CaseTitle
      FROM dbo.JurorApplications ja
      INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
      INNER JOIN dbo.Cases c ON ja.CaseId = c.CaseId
      ORDER BY ja.AppliedAt DESC
    `);

    console.log("\n=== DETAILED JUROR APPLICATIONS ===\n");

    if (jurorsResult.recordset.length === 0) {
      console.log("❌ No juror applications found in database");
      console.log("💡 Tip: Have jurors apply to cases from the juror portal first");
      return;
    }

    jurorsResult.recordset.forEach((juror) => {
      console.log(`👤 ${juror.JurorName} (${juror.JurorEmail})`);
      console.log(`   Case: ${juror.CaseTitle} (ID: ${juror.CaseId})`);
      console.log(`   Location: ${juror.County}, ${juror.State}`);
      console.log(`   Status: ${juror.Status}`);
      console.log(`   Applied: ${juror.AppliedAt}`);
      console.log("");
    });

    console.log(`✅ Total juror applications found: ${jurorsResult.recordset.length}\n`);

  } catch (error) {
    console.error("❌ Error checking jurors:", error);
  } finally {
    process.exit(0);
  }
}

checkJurors();
