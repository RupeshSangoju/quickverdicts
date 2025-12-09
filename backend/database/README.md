# Database Migrations

This directory contains SQL migration scripts for the Quick Verdicts database.

## 🚀 Quick Start

### Run All Migrations

```bash
cd backend
node database/runMigrations.js
```

### Run Single Migration (Manual)

If you prefer to run migrations manually via Azure SQL Studio or SQL Server Management Studio:

1. Open `/backend/database/migrations/001_create_payments_table.sql`
2. Execute the script in your Azure SQL database

## 📁 Migration Files

### 001_create_payments_table.sql
Creates the `dbo.Payments` table with all necessary columns and indexes.

**Required for:** Payment processing, attorney dashboard, juror dashboard

**Tables created:**
- `dbo.Payments` - Stores all payment transactions

### 002_create_jury_charge_tables.sql
Creates the jury charge question and response tables for the verdict system.

**Required for:** Jury Charge Builder in war room, juror verdict submission

**Tables created:**
- `dbo.JuryChargeQuestions` - Stores custom verdict questions created by attorneys
- `dbo.JuryChargeResponses` - Stores juror responses/verdicts

## ⚠️ IMPORTANT

Before running migrations, ensure your `.env` file in the backend directory contains:

```env
DB_SERVER=your-azure-sql-server.database.windows.net
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433
```

## 🔍 Verify Migration Success

After running migrations, verify all tables exist:

```sql
-- Check all migrated tables
SELECT * FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN ('Payments', 'JuryChargeQuestions', 'JuryChargeResponses');
```

### Payments Table Columns:
- PaymentId (INT, PRIMARY KEY)
- CaseId (INT)
- UserId (INT)
- UserType (NVARCHAR)
- Amount (DECIMAL)
- PaymentMethod (NVARCHAR)
- PaymentType (NVARCHAR)
- Status (NVARCHAR)
- TransactionId (NVARCHAR)
- Description (NVARCHAR)
- CreatedAt (DATETIME2)
- UpdatedAt (DATETIME2)

### JuryChargeQuestions Table Columns:
- QuestionId (INT, PRIMARY KEY)
- CaseId (INT, FOREIGN KEY)
- QuestionText (NVARCHAR(1000))
- QuestionType (NVARCHAR(50))
- Options (NVARCHAR(MAX))
- OrderIndex (INT)
- IsRequired (BIT)
- MinValue (INT, NULL)
- MaxValue (INT, NULL)
- CreatedAt (DATETIME2)
- UpdatedAt (DATETIME2)

### JuryChargeResponses Table Columns:
- ResponseId (INT, PRIMARY KEY)
- QuestionId (INT, FOREIGN KEY)
- JurorId (INT, FOREIGN KEY)
- Response (NVARCHAR(MAX))
- SubmittedAt (DATETIME2)
- UpdatedAt (DATETIME2)

## 🐛 Troubleshooting

### Error: "Database configuration incomplete"
- Check that all DB_* environment variables are set in `.env`
- Verify you're running from the `/backend` directory

### Error: "Object already exists"
- The migration includes DROP TABLE IF EXISTS
- Safe to re-run migrations

### Error: "Foreign key constraint failed"
- Ensure the `dbo.Cases` table exists
- Check if CaseId column exists in Cases table

## 📝 Creating New Migrations

1. Create a new file in `/backend/database/migrations/`
2. Use naming convention: `00X_description.sql`
3. Include DROP IF EXISTS for safety
4. Add GO statements between batches
5. Test migration on development database first

Example template:

```sql
-- Drop table if exists
IF OBJECT_ID('dbo.YourTable', 'U') IS NOT NULL
  DROP TABLE dbo.YourTable;
GO

-- Create table
CREATE TABLE dbo.YourTable (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  -- Add your columns here
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

PRINT '✅ YourTable created successfully';
```

## 🔄 Migration Status Tracking (Future)

Future enhancement: Create a `_migrations` table to track which migrations have been run.

```sql
CREATE TABLE dbo._migrations (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  MigrationFile NVARCHAR(255) NOT NULL,
  ExecutedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
```
