// Fix approved cases that don't have AttorneyStatus = 'war_room'
const { poolPromise, sql } = require("./config/db");

async function fixApprovedCases() {
  try {
    const pool = await poolPromise;

    console.log("\n=== FIXING APPROVED CASES STATUS ===\n");

    // Find approved cases that don't have war_room status
    const wrongStatusCases = await pool.request().query(`
      SELECT
        CaseId,
        CaseTitle,
        AttorneyStatus,
        AdminApprovalStatus,
        State,
        County
      FROM dbo.Cases
      WHERE AdminApprovalStatus = 'approved'
        AND AttorneyStatus != 'war_room'
        AND IsDeleted = 0
    `);

    if (wrongStatusCases.recordset.length === 0) {
      console.log("✅ All approved cases already have correct status (war_room)");

      // Show all approved cases
      const allApproved = await pool.request().query(`
        SELECT
          CaseId,
          CaseTitle,
          AttorneyStatus,
          AdminApprovalStatus,
          State,
          County,
          ScheduledDate
        FROM dbo.Cases
        WHERE AdminApprovalStatus = 'approved'
          AND IsDeleted = 0
        ORDER BY CreatedAt DESC
      `);

      console.log(`\nTotal approved cases: ${allApproved.recordset.length}\n`);
      allApproved.recordset.forEach((c, i) => {
        console.log(`${i + 1}. ${c.CaseTitle} (ID: ${c.CaseId})`);
        console.log(`   Status: ${c.AttorneyStatus}`);
        console.log(`   Location: ${c.County}, ${c.State}`);
        console.log(`   Scheduled: ${c.ScheduledDate}`);
        console.log("");
      });
    } else {
      console.log(`⚠️  Found ${wrongStatusCases.recordset.length} approved case(s) with WRONG status:\n`);

      wrongStatusCases.recordset.forEach((c, i) => {
        console.log(`${i + 1}. ${c.CaseTitle} (ID: ${c.CaseId})`);
        console.log(`   Current Status: "${c.AttorneyStatus}" ❌`);
        console.log(`   Location: ${c.County}, ${c.State}`);
        console.log("");
      });

      console.log("🔧 Fixing these cases...\n");

      // Update all approved cases to have war_room status
      const updateResult = await pool.request().query(`
        UPDATE dbo.Cases
        SET AttorneyStatus = 'war_room',
            UpdatedAt = GETUTCDATE()
        WHERE AdminApprovalStatus = 'approved'
          AND AttorneyStatus != 'war_room'
          AND IsDeleted = 0
      `);

      console.log(`✅ Fixed ${updateResult.rowsAffected[0]} case(s)\n`);

      // Verify fix
      const verifyResult = await pool.request().query(`
        SELECT
          CaseId,
          CaseTitle,
          AttorneyStatus,
          State,
          County
        FROM dbo.Cases
        WHERE AdminApprovalStatus = 'approved'
          AND IsDeleted = 0
        ORDER BY CreatedAt DESC
      `);

      console.log("📋 All approved cases now:\n");
      verifyResult.recordset.forEach((c, i) => {
        console.log(`${i + 1}. ${c.CaseTitle} (ID: ${c.CaseId})`);
        console.log(`   Status: ${c.AttorneyStatus} ${c.AttorneyStatus === 'war_room' ? '✅' : '❌'}`);
        console.log(`   Location: ${c.County}, ${c.State}`);
        console.log("");
      });
    }

    console.log("\n=== FIX COMPLETE ===\n");
    console.log("These cases should now be visible on the juror job board!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixApprovedCases();
