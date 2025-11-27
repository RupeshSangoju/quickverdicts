# Database Migrations

## Overview

This directory contains SQL migrations for the QuickVerdicts database. Migrations must be run manually on your Azure SQL Database.

## Available Migrations

### 001_create_payments_table.sql
Creates the Payments table for handling juror payments.

### 002_add_reschedule_fields_to_cases.sql
Adds fields to the Cases table for handling time slot conflicts and reschedule requests.

### 003_add_jury_charge_fields_to_cases.sql ⚠️ **REQUIRED FOR JURY CHARGE FEATURE**
Creates the complete jury charge system including:
- **JuryChargeQuestions** table - Stores jury charge questions
- **JuryChargeResponses** table - Stores juror verdicts/responses
- Adds **JuryChargeStatus**, **JuryChargeReleasedAt**, **JuryChargeReleasedBy** columns to Cases table

## How to Run Migrations

### Option 1: Azure Portal (Recommended)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your SQL Database
3. Click on "Query editor" in the left sidebar
4. Login with your database credentials
5. Open the migration file (e.g., `003_add_jury_charge_fields_to_cases.sql`)
6. Copy and paste the entire SQL script
7. Click "Run" to execute
8. Check the messages panel for success confirmations

### Option 2: Azure Data Studio

1. Open Azure Data Studio
2. Connect to your Azure SQL Database
3. Open the migration file
4. Execute the script (F5 or click Run)
5. Check the messages for success confirmations

### Option 3: SQL Server Management Studio (SSMS)

1. Open SSMS
2. Connect to your Azure SQL Database
   - Server: `your-server.database.windows.net`
   - Authentication: SQL Server Authentication
   - Username: Your admin username
   - Password: Your admin password
3. Open the migration file
4. Execute the script (F5 or click Execute)
5. Check the messages for success confirmations

## Migration 003 - Jury Charge System (CRITICAL)

⚠️ **This migration MUST be run before using the jury charge features!**

### What it creates:

**JuryChargeQuestions Table:**
- Stores questions that attorneys create for jurors to answer
- Supports multiple question types: Multiple Choice, Yes/No, Text Response, Numeric Response
- Maintains question order and validation rules

**JuryChargeResponses Table:**
- Stores juror responses/verdicts to each question
- Ensures one response per juror per question
- Timestamps all submissions

**Cases Table Updates:**
- `JuryChargeStatus` - Tracks if jury charge is pending or completed
- `JuryChargeReleasedAt` - When admin released the jury charge to jurors
- `JuryChargeReleasedBy` - Which admin released it

### Expected Output:

When you run the migration, you should see:
```
✅ Created JuryChargeQuestions table with indexes
✅ Created JuryChargeResponses table with indexes and constraints
✅ Added JuryChargeStatus column to Cases table
✅ Added JuryChargeReleasedAt column to Cases table
✅ Added JuryChargeReleasedBy column to Cases table
✅ Added foreign key constraint FK_Cases_JuryChargeReleasedBy_Admins
✅ Added index IX_Cases_JuryChargeStatus
========================================
✅ Migration 003 completed successfully
========================================
```

### If tables/columns already exist:

The migration is idempotent - it will check if tables/columns exist before creating them:
```
ℹ️  JuryChargeQuestions table already exists
ℹ️  JuryChargeResponses table already exists
ℹ️  JuryChargeStatus column already exists
...
```

## Verification

After running a migration, verify it was successful:

```sql
-- Check if JuryChargeQuestions table exists
SELECT * FROM sys.tables WHERE name = 'JuryChargeQuestions';

-- Check if JuryChargeResponses table exists
SELECT * FROM sys.tables WHERE name = 'JuryChargeResponses';

-- Check if Cases table has jury charge columns
SELECT * FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Cases')
AND name IN ('JuryChargeStatus', 'JuryChargeReleasedAt', 'JuryChargeReleasedBy');

-- Check table structures
EXEC sp_help 'dbo.JuryChargeQuestions';
EXEC sp_help 'dbo.JuryChargeResponses';
```

## Troubleshooting

### Error: "There is already an object named..."
The migration is safe to re-run. If you see this error, the tables/columns already exist and the migration will skip them.

### Error: "Cannot add foreign key..."
This usually means the referenced table (Cases, Admins, or Jurors) doesn't exist yet. Ensure your main database schema is properly set up.

### Error: "Column names in each table must be unique..."
This means the column already exists. The migration should handle this, but if you see this error, check if a previous migration partially completed.

## Need Help?

If you encounter issues running migrations:

1. Check the Azure SQL Database firewall rules (ensure your IP is allowed)
2. Verify your connection string is correct
3. Ensure you have sufficient permissions (db_owner or higher)
4. Check the Messages panel for detailed error information

## Important Notes

- ⚠️ Always backup your database before running migrations
- ⚠️ Migrations cannot be automatically rolled back - test in a development environment first
- ⚠️ Each migration is idempotent (safe to run multiple times)
- ⚠️ Run migrations in order (001, 002, 003, etc.)
