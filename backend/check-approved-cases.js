// Check approved cases status
const { poolPromise } = require("./config/db");

async function checkApprovedCases() {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        CaseId,
        CaseTitle,
        AttorneyStatus,
        AdminApprovalStatus,
        State,
        County,
        ScheduledDate,
        IsDeleted,
        CreatedAt
      FROM dbo.Cases
      WHERE AdminApprovalStatus = 'approved'
        AND IsDeleted = 0
      ORDER BY CreatedAt DESC
    `);

    console.log("\n=== APPROVED CASES CHECK ===\n");
    console.log(`Total approved cases: ${result.recordset.length}\n`);

    if (result.recordset.length === 0) {
      console.log("❌ No approved cases found!");
      console.log("\nPossible issues:");
      console.log("1. Admin hasn't approved any cases yet");
      console.log("2. All approved cases have been deleted (IsDeleted = 1)");
    } else {
      result.recordset.forEach((c, i) => {
        console.log(`Case ${i + 1}:`);
        console.log(`  ID: ${c.CaseId}`);
        console.log(`  Title: ${c.CaseTitle}`);
        console.log(`  Attorney Status: ${c.AttorneyStatus} ${c.AttorneyStatus === 'war_room' ? '✅' : '❌ WRONG!'}`);
        console.log(`  Admin Approval: ${c.AdminApprovalStatus}`);
        console.log(`  Location: ${c.County}, ${c.State}`);
        console.log(`  Scheduled Date: ${c.ScheduledDate}`);
        console.log(`  Created: ${c.CreatedAt}`);
        console.log("");
      });

      // Check if any have wrong status
      const wrongStatus = result.recordset.filter(c => c.AttorneyStatus !== 'war_room');
      if (wrongStatus.length > 0) {
        console.log(`\n⚠️  WARNING: ${wrongStatus.length} approved case(s) have WRONG AttorneyStatus:`);
        wrongStatus.forEach(c => {
          console.log(`   - Case ${c.CaseId}: "${c.AttorneyStatus}" (should be "war_room")`);
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkApprovedCases();
