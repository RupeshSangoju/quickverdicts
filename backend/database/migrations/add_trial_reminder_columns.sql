-- =============================================
-- Migration: Add Trial Reminder Tracking Columns
-- Purpose: Track which reminder emails have been sent (4, 3, 2, 1 days before trial)
-- =============================================

-- Add columns to track reminder emails
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Cases') AND name = 'Reminders4Days')
BEGIN
    ALTER TABLE dbo.Cases
    ADD Reminders4Days BIT DEFAULT 0;
    PRINT '✅ Added Reminders4Days column';
END
ELSE
BEGIN
    PRINT '⏭️  Reminders4Days column already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Cases') AND name = 'Reminders3Days')
BEGIN
    ALTER TABLE dbo.Cases
    ADD Reminders3Days BIT DEFAULT 0;
    PRINT '✅ Added Reminders3Days column';
END
ELSE
BEGIN
    PRINT '⏭️  Reminders3Days column already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Cases') AND name = 'Reminders2Days')
BEGIN
    ALTER TABLE dbo.Cases
    ADD Reminders2Days BIT DEFAULT 0;
    PRINT '✅ Added Reminders2Days column';
END
ELSE
BEGIN
    PRINT '⏭️  Reminders2Days column already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Cases') AND name = 'Reminders1Day')
BEGIN
    ALTER TABLE dbo.Cases
    ADD Reminders1Day BIT DEFAULT 0;
    PRINT '✅ Added Reminders1Day column';
END
ELSE
BEGIN
    PRINT '⏭️  Reminders1Day column already exists';
END

-- Set default values for existing cases
UPDATE dbo.Cases
SET
    Reminders4Days = 0,
    Reminders3Days = 0,
    Reminders2Days = 0,
    Reminders1Day = 0
WHERE
    Reminders4Days IS NULL
    OR Reminders3Days IS NULL
    OR Reminders2Days IS NULL
    OR Reminders1Day IS NULL;

PRINT '✅ Migration completed: Trial reminder tracking columns added';
