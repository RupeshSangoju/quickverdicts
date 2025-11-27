// =============================================
// Database Migration Runner
// =============================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { poolPromise, sql } = require('../config/db');

async function runMigrations() {
  try {
    console.log('🚀 Starting database migrations...\n');

    const pool = await poolPromise;
    const migrationsDir = path.join(__dirname, 'migrations');

    // Get all SQL files in migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Run in alphabetical order

    console.log(`📁 Found ${files.length} migration file(s)\n`);

    for (const file of files) {
      console.log(`▶️  Running: ${file}`);

      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      // Split by GO statements and execute each batch
      const batches = sqlContent
        .split(/\n\s*GO\s*\n/gi)
        .map(batch => batch.trim())
        .filter(batch => batch.length > 0);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (batch) {
          try {
            await pool.request().query(batch);
          } catch (err) {
            // Check if error is about object already existing (safe to ignore)
            if (err.message.includes('already an object named') ||
                err.message.includes('already exists') ||
                err.number === 2714 || // Table already exists
                err.number === 2726) { // Column already exists
              console.log(`   ⚠️  Object already exists (skipping): ${err.message}`);
              continue;
            }
            console.error(`   ❌ Error in batch ${i + 1}:`, err.message);
            throw err;
          }
        }
      }

      console.log(`   ✅ Completed: ${file}\n`);
    }

    console.log('🎉 All migrations completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();
