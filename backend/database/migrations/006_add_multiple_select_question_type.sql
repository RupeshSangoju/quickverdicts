-- =============================================
-- Migration: 006_add_multiple_select_question_type.sql
-- Description: Adds 'Multiple Select' as a valid QuestionType value
--              by dropping and recreating the CHECK constraint on
--              dbo.JuryChargeQuestions.QuestionType
-- =============================================

-- Drop the existing CHECK constraint (auto-named by SQL Server)
-- The constraint name may vary between environments, so we drop by finding it dynamically.
DECLARE @constraintName NVARCHAR(256);

SELECT @constraintName = cc.CONSTRAINT_NAME
FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE AS ccu
INNER JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS AS cc
  ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE ccu.TABLE_NAME = 'JuryChargeQuestions'
  AND ccu.COLUMN_NAME = 'QuestionType';

IF @constraintName IS NOT NULL
BEGIN
  EXEC('ALTER TABLE dbo.JuryChargeQuestions DROP CONSTRAINT [' + @constraintName + ']');
  PRINT '✅ Dropped old QuestionType CHECK constraint: ' + @constraintName;
END
ELSE
BEGIN
  PRINT '⚠️  No QuestionType CHECK constraint found — skipping drop';
END
GO

-- Add the updated CHECK constraint that includes 'Multiple Select'
ALTER TABLE dbo.JuryChargeQuestions
  ADD CONSTRAINT CK_JuryChargeQuestions_QuestionType
  CHECK (QuestionType IN ('Multiple Choice', 'Multiple Select', 'Yes/No', 'Text Response', 'Numeric Response'));
GO

PRINT '✅ New QuestionType CHECK constraint added (includes Multiple Select)';
GO
