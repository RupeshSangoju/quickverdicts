-- =============================================
-- Migration: 002_create_jury_charge_tables.sql
-- Description: Creates JuryChargeQuestions and JuryChargeResponses tables
-- Required for: Jury Charge Builder functionality in War Room
-- =============================================

-- Drop tables if they exist (reverse dependency order)
IF OBJECT_ID('dbo.JuryChargeResponses', 'U') IS NOT NULL
  DROP TABLE dbo.JuryChargeResponses;
GO

IF OBJECT_ID('dbo.JuryChargeQuestions', 'U') IS NOT NULL
  DROP TABLE dbo.JuryChargeQuestions;
GO

-- =============================================
-- TABLE: JuryChargeQuestions
-- Purpose: Stores custom jury verdict questions created by attorneys
-- =============================================
CREATE TABLE dbo.JuryChargeQuestions (
  -- Primary Key
  QuestionId INT IDENTITY(1,1) PRIMARY KEY,

  -- Foreign Keys
  CaseId INT NOT NULL,

  -- Question Content
  QuestionText NVARCHAR(1000) NOT NULL,
  QuestionType NVARCHAR(50) NOT NULL CHECK (QuestionType IN ('Multiple Choice', 'Yes/No', 'Text Response', 'Numeric Response')),
  Options NVARCHAR(MAX) NULL, -- JSON array for Multiple Choice options

  -- Question Settings
  OrderIndex INT NOT NULL DEFAULT 0,
  IsRequired BIT NOT NULL DEFAULT 1,
  MinValue INT NULL, -- For Numeric Response type
  MaxValue INT NULL, -- For Numeric Response type

  -- Timestamps
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  UpdatedAt DATETIME2 NULL,

  -- Foreign Key Constraint
  CONSTRAINT FK_JuryChargeQuestions_Cases FOREIGN KEY (CaseId)
    REFERENCES dbo.Cases(CaseId) ON DELETE CASCADE
);
GO

-- Indexes for performance
CREATE INDEX IX_JuryChargeQuestions_CaseId ON dbo.JuryChargeQuestions(CaseId);
CREATE INDEX IX_JuryChargeQuestions_OrderIndex ON dbo.JuryChargeQuestions(CaseId, OrderIndex);
GO

PRINT '✅ JuryChargeQuestions table created successfully';
GO

-- =============================================
-- TABLE: JuryChargeResponses
-- Purpose: Stores juror responses to jury charge questions (verdicts)
-- =============================================
CREATE TABLE dbo.JuryChargeResponses (
  -- Primary Key
  ResponseId INT IDENTITY(1,1) PRIMARY KEY,

  -- Foreign Keys
  QuestionId INT NOT NULL,
  JurorId INT NOT NULL,

  -- Response Data
  Response NVARCHAR(MAX) NOT NULL, -- Stores the juror's answer

  -- Timestamps
  SubmittedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  UpdatedAt DATETIME2 NULL,

  -- Foreign Key Constraints
  CONSTRAINT FK_JuryChargeResponses_Questions FOREIGN KEY (QuestionId)
    REFERENCES dbo.JuryChargeQuestions(QuestionId) ON DELETE CASCADE,

  CONSTRAINT FK_JuryChargeResponses_Jurors FOREIGN KEY (JurorId)
    REFERENCES dbo.Jurors(JurorId) ON DELETE NO ACTION,

  -- Ensure one response per juror per question
  CONSTRAINT UQ_JuryChargeResponses_QuestionJuror UNIQUE (QuestionId, JurorId)
);
GO

-- Indexes for performance
CREATE INDEX IX_JuryChargeResponses_QuestionId ON dbo.JuryChargeResponses(QuestionId);
CREATE INDEX IX_JuryChargeResponses_JurorId ON dbo.JuryChargeResponses(JurorId);
GO

PRINT '✅ JuryChargeResponses table created successfully';
GO

PRINT '';
PRINT '========================================';
PRINT '✅ Jury Charge Tables Migration Complete';
PRINT '========================================';
PRINT '';
PRINT 'Tables created:';
PRINT '  - dbo.JuryChargeQuestions (stores attorney-created verdict questions)';
PRINT '  - dbo.JuryChargeResponses (stores juror responses/verdicts)';
PRINT '';
PRINT 'Next steps:';
PRINT '  1. Verify tables exist: SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE ''JuryCharge%''';
PRINT '  2. Test jury charge builder in attorney war room';
PRINT '  3. Test verdict submission in juror portal';
PRINT '';
GO
