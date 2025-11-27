// =============================================
// PasswordReset.js - Password Reset Token Model (Refactored)
// =============================================

const { poolPromise, sql } = require("../config/db");
const crypto = require("crypto");

// ============================================
// CONSTANTS
// ============================================

const USER_TYPES = {
  ATTORNEY: "attorney",
  JUROR: "juror",
};

const TOKEN_EXPIRY_MINUTES = 60; // 1 hour
const MAX_ATTEMPTS_PER_WINDOW = 3; // Max 3 reset requests
const RATE_LIMIT_WINDOW_MINUTES = 15; // Within 15 minutes

// ============================================
// VALIDATION HELPERS
// ============================================

function validateEmail(email) {
  if (!email || typeof email !== "string") throw new Error("Email is required");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new Error("Invalid email format");

  return email.toLowerCase().trim();
}

function validateUserType(userType) {
  if (!userType || typeof userType !== "string")
    throw new Error("User type is required");

  const valid = Object.values(USER_TYPES);
  if (!valid.includes(userType))
    throw new Error(`Invalid user type. Must be one of: ${valid.join(", ")}`);

  return userType;
}

function generateSecureToken() {
  return crypto.randomBytes(24).toString("hex"); // 48-char hex string
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ============================================
// USER EXISTENCE CHECK
// ============================================

async function userExists(email, userType) {
  try {
    const pool = await poolPromise;
    const table = userType === USER_TYPES.ATTORNEY ? "Attorneys" : "Jurors";

    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query(`SELECT COUNT(*) AS count FROM dbo.${table} WHERE Email = @email`);

    return result.recordset[0].count > 0;
  } catch (error) {
    console.error("❌ Error checking user existence:", error);
    throw error;
  }
}

// ============================================
// PASSWORD RESET CORE OPERATIONS
// ============================================

async function createPasswordResetToken(email, userType) {
  try {
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);

    // Check if user exists
    const exists = await userExists(validEmail, validUserType);
    if (!exists) {
      // Don't reveal non-existent accounts
      console.log(
        `⚠️ Password reset requested for non-existent ${validUserType}: ${validEmail}`
      );
      return {
        token: null,
        message: "If this email exists, a reset link has been sent",
      };
    }

    // Rate limiting
    const attempts = await getResetAttemptCount(
      validEmail,
      RATE_LIMIT_WINDOW_MINUTES
    );
    if (attempts >= MAX_ATTEMPTS_PER_WINDOW) {
      throw new Error(
        `Too many password reset attempts. Please try again in ${RATE_LIMIT_WINDOW_MINUTES} minutes`
      );
    }

    const pool = await poolPromise;

    // Generate secure token + hash
    const resetToken = generateSecureToken();
    const hashedToken = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Remove previous tokens for this user
    await pool
      .request()
      .input("email", sql.NVarChar, validEmail)
      .input("userType", sql.NVarChar, validUserType)
      .query(
        `DELETE FROM dbo.PasswordResets WHERE Email = @email AND UserType = @userType`
      );

    // Insert new token
    await pool
      .request()
      .input("email", sql.NVarChar, validEmail)
      .input("userType", sql.NVarChar, validUserType)
      .input("tokenHash", sql.NVarChar, hashedToken)
      .input("expiresAt", sql.DateTime2, expiresAt).query(`
        INSERT INTO dbo.PasswordResets (Email, UserType, TokenHash, ExpiresAt, CreatedAt)
        VALUES (@email, @userType, @tokenHash, @expiresAt, GETUTCDATE())
      `);

    return {
      token: resetToken,
      expiresAt,
      expiresInMinutes: TOKEN_EXPIRY_MINUTES,
    };
  } catch (error) {
    console.error("❌ Error creating password reset token:", error);
    throw error;
  }
}

async function verifyPasswordResetToken(token, userType) {
  try {
    if (!token || typeof token !== "string") return null;
    const validUserType = validateUserType(userType);
    const hashedToken = hashToken(token);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("hashedToken", sql.NVarChar, hashedToken)
      .input("userType", sql.NVarChar, validUserType).query(`
        SELECT 
          Email,
          ExpiresAt,
          CreatedAt,
          CASE WHEN ExpiresAt <= GETUTCDATE() THEN 1 ELSE 0 END AS IsExpired
        FROM dbo.PasswordResets
        WHERE TokenHash = @hashedToken
          AND UserType = @userType
          AND ExpiresAt > GETUTCDATE()
          AND UsedAt IS NULL
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("❌ Error verifying reset token:", error);
    throw error;
  }
}

async function markTokenAsUsed(token, userType) {
  try {
    if (!token || typeof token !== "string")
      throw new Error("Valid token required");
    const validUserType = validateUserType(userType);
    const hashedToken = hashToken(token);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("hashedToken", sql.NVarChar, hashedToken)
      .input("userType", sql.NVarChar, validUserType).query(`
        UPDATE dbo.PasswordResets
        SET UsedAt = GETUTCDATE()
        WHERE TokenHash = @hashedToken
          AND UserType = @userType
          AND UsedAt IS NULL
          AND ExpiresAt > GETUTCDATE();
        SELECT @@ROWCOUNT AS affected;
      `);

    return result.recordset[0].affected > 0;
  } catch (error) {
    console.error("❌ Error marking token as used:", error);
    throw error;
  }
}

async function invalidateAllTokensForUser(email, userType) {
  try {
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.NVarChar, validEmail)
      .input("userType", sql.NVarChar, validUserType).query(`
        UPDATE dbo.PasswordResets
        SET UsedAt = GETUTCDATE()
        WHERE Email = @email AND UserType = @userType AND UsedAt IS NULL;
        SELECT @@ROWCOUNT AS affected;
      `);

    return result.recordset[0].affected;
  } catch (error) {
    console.error("❌ Error invalidating user tokens:", error);
    throw error;
  }
}

// ============================================
// MAINTENANCE / RATE LIMITING
// ============================================

async function cleanupExpiredTokens() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      DELETE FROM dbo.PasswordResets
      WHERE ExpiresAt < GETUTCDATE() OR UsedAt IS NOT NULL;
      SELECT @@ROWCOUNT AS DeletedCount;
    `);

    const deleted = result.recordset[0].DeletedCount;
    console.log(`🧹 Cleaned up ${deleted} expired/used password reset tokens`);
    return deleted;
  } catch (error) {
    console.error("❌ Error cleaning up tokens:", error);
    throw error;
  }
}

async function getResetAttemptCount(
  email,
  timeWindowMinutes = RATE_LIMIT_WINDOW_MINUTES
) {
  try {
    const validEmail = validateEmail(email);
    const validWindow = Math.max(
      1,
      Math.min(60, parseInt(timeWindowMinutes) || 15)
    );
    const pool = await poolPromise;
    const windowStart = new Date(Date.now() - validWindow * 60 * 1000);

    const result = await pool
      .request()
      .input("email", sql.NVarChar, validEmail)
      .input("windowStart", sql.DateTime2, windowStart).query(`
        SELECT COUNT(*) AS count
        FROM dbo.PasswordResets
        WHERE Email = @email AND CreatedAt > @windowStart
      `);

    return result.recordset[0].count;
  } catch (error) {
    console.error("❌ Error getting reset attempt count:", error);
    throw error;
  }
}

// ============================================
// ADMIN / DEBUGGING UTILITIES
// ============================================

async function getActiveTokenInfo(email, userType) {
  try {
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.NVarChar, validEmail)
      .input("userType", sql.NVarChar, validUserType).query(`
        SELECT TOP 1
          Email,
          UserType,
          ExpiresAt,
          CreatedAt,
          DATEDIFF(MINUTE, GETUTCDATE(), ExpiresAt) AS MinutesUntilExpiry
        FROM dbo.PasswordResets
        WHERE Email = @email
          AND UserType = @userType
          AND ExpiresAt > GETUTCDATE()
          AND UsedAt IS NULL
        ORDER BY CreatedAt DESC
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("❌ Error fetching active token info:", error);
    throw error;
  }
}

async function getResetStatistics(days = 7) {
  try {
    const validDays = Math.min(365, Math.max(1, parseInt(days) || 7));
    const pool = await poolPromise;

    const result = await pool.request().input("days", sql.Int, validDays)
      .query(`
      SELECT 
        UserType,
        COUNT(*) AS TotalRequests,
        SUM(CASE WHEN UsedAt IS NOT NULL THEN 1 ELSE 0 END) AS SuccessfulResets,
        SUM(CASE WHEN ExpiresAt < GETUTCDATE() AND UsedAt IS NULL THEN 1 ELSE 0 END) AS ExpiredTokens,
        SUM(CASE WHEN ExpiresAt > GETUTCDATE() AND UsedAt IS NULL THEN 1 ELSE 0 END) AS ActiveTokens,
        AVG(CASE WHEN UsedAt IS NOT NULL THEN DATEDIFF(MINUTE, CreatedAt, UsedAt) END) AS AvgTimeToUseMinutes
      FROM dbo.PasswordResets
      WHERE CreatedAt >= DATEADD(DAY, -@days, GETUTCDATE())
      GROUP BY UserType
    `);

    return result.recordset;
  } catch (error) {
    console.error("❌ Error fetching reset statistics:", error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  USER_TYPES,
  TOKEN_EXPIRY_MINUTES,
  MAX_ATTEMPTS_PER_WINDOW,
  RATE_LIMIT_WINDOW_MINUTES,

  // Core
  createPasswordResetToken,
  verifyPasswordResetToken,
  markTokenAsUsed,
  invalidateAllTokensForUser,

  // Maintenance
  cleanupExpiredTokens,
  getResetAttemptCount,

  // Admin
  getActiveTokenInfo,
  getResetStatistics,
};
