// =============================================
// initializeDatabase.js - Database Initialization
// Creates necessary tables if they don't exist
// =============================================

const { poolPromise, sql } = require("../config/db");

/**
 * Initialize CouponCodes table and seed initial coupons
 */
async function initializeCouponCodesTable() {
  try {
    const pool = await poolPromise;

    // Create CouponCodes table if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CouponCodes' AND xtype='U')
      BEGIN
        CREATE TABLE dbo.CouponCodes (
          CouponId INT PRIMARY KEY IDENTITY(1,1),
          Code NVARCHAR(255) NOT NULL UNIQUE,
          ApplicableTier NVARCHAR(50) NOT NULL,
          DiscountAmount DECIMAL(10, 2) NOT NULL,
          MaxRedemptions INT NOT NULL,
          RedemptionsUsed INT NOT NULL DEFAULT 0,
          IsActive BIT NOT NULL DEFAULT 1,
          ExpiresAt DATETIME NULL,
          CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
          UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE()
        );

        CREATE INDEX idx_coupon_code ON dbo.CouponCodes(Code);
        CREATE INDEX idx_coupon_tier ON dbo.CouponCodes(ApplicableTier);
        CREATE INDEX idx_coupon_active ON dbo.CouponCodes(IsActive);

        PRINT 'CouponCodes table created successfully';
      END;
    `);

    // Add CouponCode column to Payments table if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Payments' AND COLUMN_NAME='CouponCode')
      BEGIN
        ALTER TABLE dbo.Payments ADD CouponCode NVARCHAR(255) NULL;
        PRINT 'CouponCode column added to Payments table';
      END;
    `);

    // Seed the Tier 1 launch coupon if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.CouponCodes WHERE Code = 'TIER1LAUNCH')
      BEGIN
        INSERT INTO dbo.CouponCodes (Code, ApplicableTier, DiscountAmount, MaxRedemptions, RedemptionsUsed, IsActive, ExpiresAt)
        VALUES ('TIER1LAUNCH', 'Tier 1', 1000.00, 50, 0, 1, NULL);
        PRINT 'Tier 1 launch coupon created: TIER1LAUNCH - $1,000 off (first 50 cases)';
      END;
    `);

    console.log("✅ Database initialization completed");
  } catch (error) {
    console.error("❌ Database initialization error:", error.message);
    throw error;
  }
}

module.exports = {
  initializeCouponCodesTable,
};
