// =============================================
// CouponCode.js - Coupon Code Model
// Manage discount codes with redemption caps
// =============================================

const { poolPromise, sql } = require("../config/db");

// ============================================
// VALIDATION HELPERS
// ============================================

function validateCouponData(data) {
  const errors = [];

  if (!data.code || typeof data.code !== "string" || !data.code.trim()) {
    errors.push("Code is required");
  }
  if (!data.applicableTier || typeof data.applicableTier !== "string") {
    errors.push("Applicable tier is required");
  }
  if (data.discountAmount === undefined || isNaN(parseFloat(data.discountAmount)) || parseFloat(data.discountAmount) <= 0) {
    errors.push("Discount amount must be a positive number");
  }
  if (data.maxRedemptions === undefined || isNaN(parseInt(data.maxRedemptions)) || parseInt(data.maxRedemptions) <= 0) {
    errors.push("Max redemptions must be a positive integer");
  }

  if (errors.length > 0) {
    throw new Error(`Coupon validation failed: ${errors.join(", ")}`);
  }
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Create a new coupon code
 * @param {Object} data - Coupon data (code, applicableTier, discountAmount, maxRedemptions, expiresAt, isActive)
 * @returns {Promise<number>} New coupon ID
 */
async function createCoupon(data) {
  try {
    validateCouponData(data);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("code", sql.NVarChar(255), data.code.trim().toUpperCase())
      .input("applicableTier", sql.NVarChar(50), data.applicableTier.trim())
      .input("discountAmount", sql.Decimal(10, 2), parseFloat(data.discountAmount))
      .input("maxRedemptions", sql.Int, parseInt(data.maxRedemptions))
      .input("redemptionsUsed", sql.Int, 0)
      .input("isActive", sql.Bit, data.isActive !== false ? 1 : 0)
      .input("expiresAt", sql.DateTime, data.expiresAt || null)
      .query(`
        INSERT INTO dbo.CouponCodes (
          Code, ApplicableTier, DiscountAmount, MaxRedemptions, RedemptionsUsed,
          IsActive, ExpiresAt, CreatedAt, UpdatedAt
        ) VALUES (
          @code, @applicableTier, @discountAmount, @maxRedemptions, @redemptionsUsed,
          @isActive, @expiresAt, GETUTCDATE(), GETUTCDATE()
        );
        SELECT SCOPE_IDENTITY() AS CouponId;
      `);

    return result.recordset[0].CouponId;
  } catch (error) {
    console.error("Error creating coupon:", error);
    throw error;
  }
}

/**
 * Find coupon by code
 * @param {string} code - Coupon code
 * @returns {Promise<Object|null>} Coupon record
 */
async function findByCode(code) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("code", sql.NVarChar(255), code.trim().toUpperCase())
      .query(`
        SELECT * FROM dbo.CouponCodes
        WHERE Code = @code
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error finding coupon by code:", error);
    throw error;
  }
}

/**
 * Validate coupon for a specific tier (does NOT increment counter)
 * Used for display/validation before payment
 * @param {string} code - Coupon code
 * @param {string} caseTier - Case tier (e.g., "Tier 1")
 * @returns {Promise<Object>} { isValid: boolean, discountAmount?: number, message?: string }
 */
async function validateCoupon(code, caseTier) {
  try {
    const coupon = await findByCode(code);

    if (!coupon) {
      return { isValid: false, message: "Coupon code not found" };
    }

    if (!coupon.IsActive) {
      return { isValid: false, message: "Coupon code is no longer active (redemption limit reached)" };
    }

    if (coupon.ExpiresAt && new Date(coupon.ExpiresAt) < new Date()) {
      return { isValid: false, message: "Coupon code has expired" };
    }

    if (coupon.ApplicableTier !== caseTier) {
      return { isValid: false, message: `Coupon is only valid for ${coupon.ApplicableTier} cases` };
    }

    if (coupon.RedemptionsUsed >= coupon.MaxRedemptions) {
      return { isValid: false, message: "Coupon code has reached its redemption limit" };
    }

    return { isValid: true, discountAmount: coupon.DiscountAmount };
  } catch (error) {
    console.error("Error validating coupon:", error);
    throw error;
  }
}

/**
 * Atomically increment redemption counter if under cap
 * Called ONLY on confirmed successful payment
 * Automatically deactivates the coupon when max redemptions is reached
 * @param {string} code - Coupon code
 * @returns {Promise<Object>} { success: boolean, reachedCap: boolean, redemptionsUsed?: number, maxRedemptions?: number }
 */
async function incrementRedemptionCounter(code) {
  try {
    const pool = await poolPromise;

    // First, increment if under cap and get current state
    const updateResult = await pool
      .request()
      .input("code", sql.NVarChar(255), code.trim().toUpperCase())
      .query(`
        UPDATE dbo.CouponCodes
        SET RedemptionsUsed = RedemptionsUsed + 1, UpdatedAt = GETUTCDATE()
        WHERE Code = @code AND RedemptionsUsed < MaxRedemptions;

        SELECT Code, RedemptionsUsed, MaxRedemptions, IsActive FROM dbo.CouponCodes WHERE Code = @code
      `);

    // If no rows affected by the update, cap was already reached
    if (updateResult.rowsAffected[0] === 0) {
      return { success: false, reachedCap: true };
    }

    const coupon = updateResult.recordset[0];
    const reachedCap = coupon.RedemptionsUsed >= coupon.MaxRedemptions;

    // If we just reached the cap, auto-deactivate so coupon stops showing on frontend
    if (reachedCap && coupon.IsActive) {
      await pool
        .request()
        .input("code", sql.NVarChar(255), code.trim().toUpperCase())
        .query(`
          UPDATE dbo.CouponCodes
          SET IsActive = 0, UpdatedAt = GETUTCDATE()
          WHERE Code = @code
        `);
      console.log(`✅ Coupon "${code}" reached cap (${coupon.RedemptionsUsed}/${coupon.MaxRedemptions}) and auto-deactivated`);
    }

    return {
      success: true,
      reachedCap,
      redemptionsUsed: coupon.RedemptionsUsed,
      maxRedemptions: coupon.MaxRedemptions,
    };
  } catch (error) {
    console.error("Error incrementing redemption counter:", error);
    throw error;
  }
}

/**
 * Get coupon details by code (for admin viewing)
 * @param {string} code - Coupon code
 * @returns {Promise<Object|null>} Full coupon record
 */
async function getCouponDetails(code) {
  return findByCode(code);
}

/**
 * Update coupon (e.g., toggle active status, adjust max redemptions)
 * @param {string} code - Coupon code
 * @param {Object} updates - Fields to update (isActive, maxRedemptions, expiresAt)
 * @returns {Promise<void>}
 */
async function updateCoupon(code, updates) {
  try {
    const pool = await poolPromise;
    const request = pool
      .request()
      .input("code", sql.NVarChar(255), code.trim().toUpperCase());

    let query = "UPDATE dbo.CouponCodes SET ";
    const setClauses = [];

    if (updates.isActive !== undefined) {
      setClauses.push("IsActive = @isActive");
      request.input("isActive", sql.Bit, updates.isActive ? 1 : 0);
    }
    if (updates.maxRedemptions !== undefined) {
      setClauses.push("MaxRedemptions = @maxRedemptions");
      request.input("maxRedemptions", sql.Int, parseInt(updates.maxRedemptions));
    }
    if (updates.expiresAt !== undefined) {
      setClauses.push("ExpiresAt = @expiresAt");
      request.input("expiresAt", sql.DateTime, updates.expiresAt || null);
    }

    if (setClauses.length === 0) {
      throw new Error("No fields to update");
    }

    setClauses.push("UpdatedAt = GETUTCDATE()");
    query += setClauses.join(", ") + " WHERE Code = @code";

    await request.query(query);
  } catch (error) {
    console.error("Error updating coupon:", error);
    throw error;
  }
}

/**
 * List all coupons (for admin)
 * @returns {Promise<Array>} Array of coupon records
 */
async function listAllCoupons() {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(`
        SELECT * FROM dbo.CouponCodes
        ORDER BY CreatedAt DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error listing coupons:", error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  createCoupon,
  findByCode,
  validateCoupon,
  incrementRedemptionCounter,
  getCouponDetails,
  updateCoupon,
  listAllCoupons,
};
