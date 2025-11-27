// =============================================
// Clear Database Script
// WARNING: This deletes all data except Admin!
// =============================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { poolPromise } = require('../config/db');

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function clearDatabase() {
  console.log('\n' + '='.repeat(60));
  console.log('🚨 DATABASE CLEANUP TOOL');
  console.log('='.repeat(60));
  console.log('\n⚠️  WARNING: This will DELETE ALL data except Admin records!');
  console.log('⚠️  This action CANNOT be undone!\n');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_DATABASE || 'N/A'}\n`);

  // Safety check for production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: Cannot run this script in PRODUCTION environment!');
    console.error('   This script is for development/testing only.');
    process.exit(1);
  }

  // Ask for confirmation
  const confirmed = await askConfirmation('Type "yes" to proceed with database cleanup: ');

  if (!confirmed) {
    console.log('\n❌ Operation cancelled by user.');
    rl.close();
    process.exit(0);
  }

  // Double confirmation
  const doubleConfirmed = await askConfirmation('\n⚠️  Are you ABSOLUTELY sure? This will delete ALL records! (yes/no): ');

  if (!doubleConfirmed) {
    console.log('\n❌ Operation cancelled by user.');
    rl.close();
    process.exit(0);
  }

  rl.close();

  try {
    console.log('\n🔄 Connecting to database...');
    const pool = await poolPromise;
    console.log('✅ Connected\n');

    // Read and execute the SQL script
    const sqlPath = path.join(__dirname, 'clear_database.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split by GO statements
    const batches = sqlContent
      .split(/\n\s*GO\s*\n/gi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);

    console.log('🗑️  Executing cleanup script...\n');

    for (const batch of batches) {
      if (batch) {
        await pool.request().query(batch);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE CLEANUP COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📊 All records deleted except Admin table');
    console.log('🔄 You can now start fresh with new data\n');

    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ DATABASE CLEANUP FAILED');
    console.error('='.repeat(60));
    console.error('\nError:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the cleanup
clearDatabase();
