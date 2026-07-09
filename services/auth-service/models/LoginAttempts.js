// =============================================
// LoginAttempts.js - Login Attempts Tracking Model
// =============================================

const { executeQuery, sql } = require("../config/db");

// ============================================
// CORE QUERIES
// ============================================

/**
 * Record a failed login attempt
 */
async function recordFailedAttempt(email, userType, ipAddress = null) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    return await executeQuery(async (pool) => {
      await pool
        .request()
        .input("email", sql.NVarChar, normalizedEmail)
        .input("userType", sql.NVarChar, userType)
        .input("ipAddress", sql.NVarChar, ipAddress)
        .query(`
          INSERT INTO dbo.LoginAttempts (Email, UserType, IpAddress, AttemptedAt)
          VALUES (@email, @userType, @ipAddress, GETDATE())
        `);

      console.log(`🔒 Failed login attempt recorded for ${normalizedEmail} (${userType})`);
      return true;
    });
  } catch (error) {
    console.error("❌ [LoginAttempts.recordFailedAttempt] Error:", error.message);
    throw error;
  }
}

/**
 * Get failed attempt count for a user in the last N minutes
 */
async function getRecentFailedAttempts(email, userType, minutes = 15) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("email", sql.NVarChar, normalizedEmail)
        .input("userType", sql.NVarChar, userType)
        .input("minutes", sql.Int, minutes)
        .query(`
          SELECT COUNT(*) as FailedAttempts
          FROM dbo.LoginAttempts
          WHERE LOWER(Email) = @email
            AND UserType = @userType
            AND AttemptedAt >= DATEADD(MINUTE, -@minutes, GETDATE())
        `);

      return result.recordset[0]?.FailedAttempts || 0;
    });
  } catch (error) {
    console.error("❌ [LoginAttempts.getRecentFailedAttempts] Error:", error.message);
    throw error;
  }
}

/**
 * Clear failed attempts for a user (after successful login)
 */
async function clearFailedAttempts(email, userType) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    return await executeQuery(async (pool) => {
      await pool
        .request()
        .input("email", sql.NVarChar, normalizedEmail)
        .input("userType", sql.NVarChar, userType)
        .query(`
          DELETE FROM dbo.LoginAttempts
          WHERE LOWER(Email) = @email
            AND UserType = @userType
        `);

      console.log(`✅ Failed login attempts cleared for ${normalizedEmail} (${userType})`);
      return true;
    });
  } catch (error) {
    console.error("❌ [LoginAttempts.clearFailedAttempts] Error:", error.message);
    throw error;
  }
}

/**
 * Get time when account will be unlocked
 */
async function getAccountLockoutTime(email, userType, lockoutMinutes = 15) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("email", sql.NVarChar, normalizedEmail)
        .input("userType", sql.NVarChar, userType)
        .input("lockoutMinutes", sql.Int, lockoutMinutes)
        .query(`
          SELECT TOP 1
            DATEADD(MINUTE, @lockoutMinutes, AttemptedAt) as UnlockTime
          FROM dbo.LoginAttempts
          WHERE LOWER(Email) = @email
            AND UserType = @userType
          ORDER BY AttemptedAt DESC
        `);

      return result.recordset[0]?.UnlockTime || null;
    });
  } catch (error) {
    console.error("❌ [LoginAttempts.getAccountLockoutTime] Error:", error.message);
    throw error;
  }
}

/**
 * Cleanup old login attempts (older than 24 hours)
 */
async function cleanupOldAttempts() {
  try {
    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .query(`
          DELETE FROM dbo.LoginAttempts
          WHERE AttemptedAt < DATEADD(HOUR, -24, GETDATE())
        `);

      console.log(`🧹 Cleaned up ${result.rowsAffected[0]} old login attempts`);
      return result.rowsAffected[0];
    });
  } catch (error) {
    console.error("❌ [LoginAttempts.cleanupOldAttempts] Error:", error.message);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  recordFailedAttempt,
  getRecentFailedAttempts,
  clearFailedAttempts,
  getAccountLockoutTime,
  cleanupOldAttempts,
};
