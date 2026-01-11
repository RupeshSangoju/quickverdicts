// Quick script to add AdminRescheduledBy column to Cases table
// Run with: node add_admin_reschedule_column.js

const { executeQuery, sql } = require('./config/db');

async function addColumn() {
  try {
    console.log('Checking if AdminRescheduledBy column exists...');

    const checkResult = await executeQuery(async (pool) => {
      const result = await pool.request().query(`
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Cases')
        AND name = 'AdminRescheduledBy'
      `);
      return result.recordset;
    });

    if (checkResult.length > 0) {
      console.log('✅ AdminRescheduledBy column already exists!');
      process.exit(0);
      return;
    }

    console.log('Adding AdminRescheduledBy column...');
    await executeQuery(async (pool) => {
      await pool.request().query(`
        ALTER TABLE dbo.Cases
        ADD AdminRescheduledBy INT NULL;
      `);
    });
    console.log('✅ AdminRescheduledBy column added successfully');

    console.log('Checking if foreign key constraint exists...');
    const fkCheck = await executeQuery(async (pool) => {
      const result = await pool.request().query(`
        SELECT * FROM sys.foreign_keys
        WHERE object_id = OBJECT_ID('dbo.FK_Cases_AdminRescheduledBy')
      `);
      return result.recordset;
    });

    if (fkCheck.length > 0) {
      console.log('✅ Foreign key constraint already exists!');
      process.exit(0);
      return;
    }

    console.log('Adding foreign key constraint...');
    await executeQuery(async (pool) => {
      await pool.request().query(`
        ALTER TABLE dbo.Cases
        ADD CONSTRAINT FK_Cases_AdminRescheduledBy
        FOREIGN KEY (AdminRescheduledBy) REFERENCES dbo.Admins(AdminId)
        ON DELETE NO ACTION;
      `);
    });
    console.log('✅ Foreign key constraint added successfully');

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

addColumn();

