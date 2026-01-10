-- =============================================
-- Migration: 005_create_attorney_reschedule_requests.sql
-- Description: Create table for attorney-initiated reschedule requests
-- Date: 2026-01-10
-- =============================================

-- Create AttorneyRescheduleRequests table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AttorneyRescheduleRequests')
BEGIN
    CREATE TABLE dbo.AttorneyRescheduleRequests (
        RequestId INT IDENTITY(1,1) PRIMARY KEY,
        CaseId INT NOT NULL,
        AttorneyId INT NOT NULL,

        -- New schedule details requested by attorney
        NewScheduledDate DATE NOT NULL,
        NewScheduledTime VARCHAR(10) NOT NULL,

        -- Original schedule (for reference)
        OriginalScheduledDate DATE NOT NULL,
        OriginalScheduledTime VARCHAR(10) NOT NULL,

        -- Request details
        Reason NVARCHAR(1000) NULL,
        AttorneyComments NVARCHAR(MAX) NULL,

        -- Admin response
        Status NVARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
        AdminId INT NULL,
        AdminComments NVARCHAR(MAX) NULL,
        RespondedAt DATETIME2 NULL,

        -- Timestamps
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        -- Foreign keys
        CONSTRAINT FK_AttorneyRescheduleRequests_Cases FOREIGN KEY (CaseId) REFERENCES dbo.Cases(CaseId) ON DELETE CASCADE,
        CONSTRAINT FK_AttorneyRescheduleRequests_Attorneys FOREIGN KEY (AttorneyId) REFERENCES dbo.Attorneys(AttorneyId) ON DELETE CASCADE,
        CONSTRAINT FK_AttorneyRescheduleRequests_Admins FOREIGN KEY (AdminId) REFERENCES dbo.Admins(AdminId),

        -- Constraints
        CONSTRAINT CHK_RescheduleStatus CHECK (Status IN ('pending', 'approved', 'rejected'))
    );

    -- Create indexes for faster queries
    CREATE INDEX IDX_AttorneyRescheduleRequests_CaseId ON dbo.AttorneyRescheduleRequests(CaseId);
    CREATE INDEX IDX_AttorneyRescheduleRequests_AttorneyId ON dbo.AttorneyRescheduleRequests(AttorneyId);
    CREATE INDEX IDX_AttorneyRescheduleRequests_Status ON dbo.AttorneyRescheduleRequests(Status);
    CREATE INDEX IDX_AttorneyRescheduleRequests_CreatedAt ON dbo.AttorneyRescheduleRequests(CreatedAt);

    PRINT 'AttorneyRescheduleRequests table created successfully';
END
ELSE
BEGIN
    PRINT 'AttorneyRescheduleRequests table already exists';
END
GO
