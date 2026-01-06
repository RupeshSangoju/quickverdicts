-- =============================================
-- Migration: Add Email and IsAccepted columns to CaseWitnesses table
-- Purpose: Allow tracking witness email and attorney acceptance status
-- =============================================

BEGIN TRANSACTION;

BEGIN TRY
    -- Check if Email column exists, if not add it
    IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.CaseWitnesses')
        AND name = 'Email'
    )
    BEGIN
        ALTER TABLE dbo.CaseWitnesses
        ADD Email NVARCHAR(255) NULL;

        PRINT '✓ Added Email column to CaseWitnesses table';
    END
    ELSE
    BEGIN
        PRINT '- Email column already exists in CaseWitnesses table';
    END

    -- Check if IsAccepted column exists, if not add it
    IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.CaseWitnesses')
        AND name = 'IsAccepted'
    )
    BEGIN
        ALTER TABLE dbo.CaseWitnesses
        ADD IsAccepted BIT NOT NULL DEFAULT 0;

        PRINT '✓ Added IsAccepted column to CaseWitnesses table';
    END
    ELSE
    BEGIN
        PRINT '- IsAccepted column already exists in CaseWitnesses table';
    END

    COMMIT TRANSACTION;
    PRINT '✓ Migration 004 completed successfully';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT '✗ Migration 004 failed: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
