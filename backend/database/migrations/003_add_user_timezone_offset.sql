-- Add TimezoneOffset to user tables
-- This will store the user's timezone offset for accurate time display

-- Add to Attorneys table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Attorneys') AND name = 'TimezoneOffset')
BEGIN
    ALTER TABLE Attorneys ADD TimezoneOffset INT NULL DEFAULT 0;
    PRINT 'Added TimezoneOffset to Attorneys table';
END
ELSE
BEGIN
    PRINT 'TimezoneOffset already exists in Attorneys table';
END

-- Add to Jurors table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Jurors') AND name = 'TimezoneOffset')
BEGIN
    ALTER TABLE Jurors ADD TimezoneOffset INT NULL DEFAULT 0;
    PRINT 'Added TimezoneOffset to Jurors table';
END
ELSE
BEGIN
    PRINT 'TimezoneOffset already exists in Jurors table';
END

-- Add to Admins table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Admins') AND name = 'TimezoneOffset')
BEGIN
    ALTER TABLE Admins ADD TimezoneOffset INT NULL DEFAULT 0;
    PRINT 'Added TimezoneOffset to Admins table';
END
ELSE
BEGIN
    PRINT 'TimezoneOffset already exists in Admins table';
END

PRINT 'All timezone offset columns added successfully!';
