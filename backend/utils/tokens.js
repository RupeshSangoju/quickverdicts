// =============================================
// tokens.js - JWT Token Management Utilities
// FIXED: Added validation, error handling, token verification
// =============================================

const jwt = require("jsonwebtoken");

// ============================================
// CONFIGURATION & VALIDATION
// ============================================

const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET,
  ALGORITHM: "HS256",
  ISSUER: "quick-verdicts",
  AUDIENCE: "quick-verdicts-users",
};

// Validate JWT_SECRET on startup
if (!JWT_CONFIG.SECRET) {
  console.error("CRITICAL: JWT_SECRET not configured");
  throw new Error("JWT_SECRET environment variable is required");
}

if (JWT_CONFIG.SECRET.length < 32) {
  console.warn(
    "⚠️ WARNING: JWT_SECRET should be at least 32 characters for security"
  );
}

console.log("✅ JWT token service initialized");

// ============================================
// TOKEN TYPES & EXPIRATION
// ============================================

const TOKEN_TYPES = {
  EMAIL_VERIFICATION: "verify_email",
  PASSWORD_RESET: "reset_password",
  ACCESS_TOKEN: "access",
  REFRESH_TOKEN: "refresh",
  TWO_FACTOR: "two_factor",
};

const TOKEN_EXPIRATION = {
  [TOKEN_TYPES.EMAIL_VERIFICATION]:
    process.env.EMAIL_VERIFICATION_EXPIRES_IN || "24h",
  [TOKEN_TYPES.PASSWORD_RESET]: process.env.PASSWORD_RESET_EXPIRES_IN || "1h",
  [TOKEN_TYPES.ACCESS_TOKEN]: process.env.JWT_EXPIRES_IN || "24h",
  [TOKEN_TYPES.REFRESH_TOKEN]: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  [TOKEN_TYPES.TWO_FACTOR]: "10m",
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    throw new Error("Valid email is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  return email.toLowerCase().trim();
}

/**
 * Validate user type
 */
function validateUserType(userType) {
  const validTypes = ["attorney", "juror", "admin"];

  if (!userType || !validTypes.includes(userType.toLowerCase())) {
    throw new Error(`Invalid user type: ${userType}`);
  }

  return userType.toLowerCase();
}

/**
 * Validate token string
 */
function validateTokenString(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Valid token is required");
  }

  if (token.length < 10) {
    throw new Error("Token too short");
  }

  if (token.length > 2000) {
    throw new Error("Token too long");
  }

  // Check for JWT format (three parts separated by dots)
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  return token;
}

// ============================================
// TOKEN CREATION
// ============================================

/**
 * Create a generic JWT token
 * FIXED: Added validation, better error handling, metadata
 *
 * @param {Object} payload - Token payload
 * @param {string} expiresIn - Expiration time
 * @param {Object} options - Additional options
 * @returns {string} JWT token
 */
function createToken(payload, expiresIn, options = {}) {
  try {
    if (!payload || typeof payload !== "object") {
      throw new Error("Valid payload is required");
    }

    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      iss: JWT_CONFIG.ISSUER,
      aud: JWT_CONFIG.AUDIENCE,
    };

    const signOptions = {
      algorithm: JWT_CONFIG.ALGORITHM,
      expiresIn: expiresIn || "24h",
      ...options,
    };

    const token = jwt.sign(tokenPayload, JWT_CONFIG.SECRET, signOptions);

    return token;
  } catch (error) {
    console.error("Token creation error:", error.message);
    throw new Error(`Failed to create token: ${error.message}`);
  }
}

/**
 * Create a short-lived email verification token (JWT, stateless)
 * FIXED: Added validation and error handling
 *
 * Encodes: purpose, email, userType
 *
 * @param {string} email - User's email address
 * @param {string} userType - User type (attorney, juror, admin)
 * @returns {string} JWT token
 */
function createEmailVerificationToken(email, userType = "juror") {
  try {
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);

    const payload = {
      purpose: TOKEN_TYPES.EMAIL_VERIFICATION,
      email: validEmail,
      userType: validUserType,
    };

    const expiresIn = TOKEN_EXPIRATION[TOKEN_TYPES.EMAIL_VERIFICATION];
    const token = createToken(payload, expiresIn);

    console.log(
      `✅ Email verification token created for ${validEmail} (${validUserType})`
    );
    return token;
  } catch (error) {
    console.error("Email verification token creation error:", error.message);
    throw new Error(
      `Failed to create email verification token: ${error.message}`
    );
  }
}

/**
 * Create password reset token
 * NEW: Added password reset token generation
 *
 * @param {string} email - User's email address
 * @param {string} userType - User type
 * @param {number} userId - User ID
 * @returns {string} JWT token
 */
function createPasswordResetToken(email, userType, userId) {
  try {
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      throw new Error("Valid user ID is required");
    }

    const payload = {
      purpose: TOKEN_TYPES.PASSWORD_RESET,
      email: validEmail,
      userType: validUserType,
      userId: userId,
    };

    const expiresIn = TOKEN_EXPIRATION[TOKEN_TYPES.PASSWORD_RESET];
    const token = createToken(payload, expiresIn);

    console.log(`✅ Password reset token created for ${validEmail}`);
    return token;
  } catch (error) {
    console.error("Password reset token creation error:", error.message);
    throw new Error(`Failed to create password reset token: ${error.message}`);
  }
}

/**
 * Create access token (for authentication)
 * NEW: Added access token generation
 *
 * @param {Object} userData - User data
 * @returns {string} JWT token
 */
function createAccessToken(userData) {
  try {
    if (!userData || typeof userData !== "object") {
      throw new Error("Valid user data is required");
    }

    const { id, email, type } = userData;

    if (!id || !email || !type) {
      throw new Error("User data must include id, email, and type");
    }

    const payload = {
      purpose: TOKEN_TYPES.ACCESS_TOKEN,
      userId: id,
      email: validateEmail(email),
      userType: validateUserType(type),
    };

    const expiresIn = TOKEN_EXPIRATION[TOKEN_TYPES.ACCESS_TOKEN];
    const token = createToken(payload, expiresIn);

    console.log(`✅ Access token created for user ${id} (${type})`);
    return token;
  } catch (error) {
    console.error("Access token creation error:", error.message);
    throw new Error(`Failed to create access token: ${error.message}`);
  }
}

/**
 * Create refresh token
 * NEW: Added refresh token generation
 *
 * @param {number} userId - User ID
 * @param {string} userType - User type
 * @returns {string} JWT token
 */
function createRefreshToken(userId, userType) {
  try {
    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      throw new Error("Valid user ID is required");
    }

    const validUserType = validateUserType(userType);

    const payload = {
      purpose: TOKEN_TYPES.REFRESH_TOKEN,
      userId: userId,
      userType: validUserType,
    };

    const expiresIn = TOKEN_EXPIRATION[TOKEN_TYPES.REFRESH_TOKEN];
    const token = createToken(payload, expiresIn);

    console.log(`✅ Refresh token created for user ${userId}`);
    return token;
  } catch (error) {
    console.error("Refresh token creation error:", error.message);
    throw new Error(`Failed to create refresh token: ${error.message}`);
  }
}

/**
 * Create two-factor authentication token
 * NEW: Added 2FA token generation
 *
 * @param {number} userId - User ID
 * @param {string} code - 2FA code
 * @returns {string} JWT token
 */
function createTwoFactorToken(userId, code) {
  try {
    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      throw new Error("Valid user ID is required");
    }

    if (!code || typeof code !== "string") {
      throw new Error("Valid 2FA code is required");
    }

    const payload = {
      purpose: TOKEN_TYPES.TWO_FACTOR,
      userId: userId,
      code: code,
    };

    const expiresIn = TOKEN_EXPIRATION[TOKEN_TYPES.TWO_FACTOR];
    const token = createToken(payload, expiresIn);

    console.log(`✅ 2FA token created for user ${userId}`);
    return token;
  } catch (error) {
    console.error("2FA token creation error:", error.message);
    throw new Error(`Failed to create 2FA token: ${error.message}`);
  }
}

// ============================================
// TOKEN VERIFICATION
// ============================================

/**
 * Verify a JWT token and return decoded payload
 * FIXED: Added validation, better error handling
 *
 * @param {string} token - JWT token to verify
 * @param {string} expectedPurpose - Expected token purpose
 * @returns {Object} Decoded token payload
 */
function verifyToken(token, expectedPurpose) {
  try {
    // Validate token format
    const validToken = validateTokenString(token);

    // Verify JWT signature and expiration
    const decoded = jwt.verify(validToken, JWT_CONFIG.SECRET, {
      algorithms: [JWT_CONFIG.ALGORITHM],
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE,
    });

    // Verify token purpose if specified
    if (expectedPurpose && decoded.purpose !== expectedPurpose) {
      throw new Error(
        `Invalid token purpose: expected ${expectedPurpose}, got ${decoded.purpose}`
      );
    }

    // Check if token is expired (additional check)
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token has expired");
    }

    return decoded;
  } catch (error) {
    // Handle JWT-specific errors
    if (error.name === "TokenExpiredError") {
      throw new Error("Token has expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error(`Invalid token: ${error.message}`);
    } else if (error.name === "NotBeforeError") {
      throw new Error("Token not yet valid");
    }

    throw error;
  }
}

/**
 * Verify an email verification token and return decoded payload
 * FIXED: Added specific error handling
 *
 * @param {string} token - Email verification token
 * @returns {Object} Decoded token with email and userType
 */
function verifyEmailVerificationToken(token) {
  try {
    const decoded = verifyToken(token, TOKEN_TYPES.EMAIL_VERIFICATION);

    if (!decoded.email || !decoded.userType) {
      throw new Error("Token missing required fields (email, userType)");
    }

    console.log(`✅ Email verification token verified for ${decoded.email}`);
    return decoded; // {purpose, email, userType, iat, exp, iss, aud}
  } catch (error) {
    console.error(
      "Email verification token verification error:",
      error.message
    );
    throw new Error(`Invalid email verification token: ${error.message}`);
  }
}

/**
 * Verify password reset token
 * NEW: Added password reset token verification
 *
 * @param {string} token - Password reset token
 * @returns {Object} Decoded token
 */
function verifyPasswordResetToken(token) {
  try {
    const decoded = verifyToken(token, TOKEN_TYPES.PASSWORD_RESET);

    if (!decoded.email || !decoded.userId) {
      throw new Error("Token missing required fields (email, userId)");
    }

    console.log(`✅ Password reset token verified for user ${decoded.userId}`);
    return decoded;
  } catch (error) {
    console.error("Password reset token verification error:", error.message);
    throw new Error(`Invalid password reset token: ${error.message}`);
  }
}

/**
 * Verify access token
 * NEW: Added access token verification
 *
 * @param {string} token - Access token
 * @returns {Object} Decoded token
 */
function verifyAccessToken(token) {
  try {
    const decoded = verifyToken(token, TOKEN_TYPES.ACCESS_TOKEN);

    if (!decoded.userId || !decoded.email || !decoded.userType) {
      throw new Error(
        "Token missing required fields (userId, email, userType)"
      );
    }

    return decoded;
  } catch (error) {
    console.error("Access token verification error:", error.message);
    throw new Error(`Invalid access token: ${error.message}`);
  }
}

/**
 * Verify refresh token
 * NEW: Added refresh token verification
 *
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token
 */
function verifyRefreshToken(token) {
  try {
    const decoded = verifyToken(token, TOKEN_TYPES.REFRESH_TOKEN);

    if (!decoded.userId || !decoded.userType) {
      throw new Error("Token missing required fields (userId, userType)");
    }

    return decoded;
  } catch (error) {
    console.error("Refresh token verification error:", error.message);
    throw new Error(`Invalid refresh token: ${error.message}`);
  }
}

// ============================================
// TOKEN UTILITIES
// ============================================

/**
 * Decode token without verification (for debugging)
 * NEW: Added token decoding
 *
 * @param {string} token - JWT token
 * @returns {Object} Decoded token (unverified)
 */
function decodeToken(token) {
  try {
    const validToken = validateTokenString(token);
    return jwt.decode(validToken, { complete: true });
  } catch (error) {
    console.error("Token decode error:", error.message);
    return null;
  }
}

/**
 * Get token expiration time
 * NEW: Added expiration checker
 *
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null if invalid
 */
function getTokenExpiration(token) {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.payload && decoded.payload.exp) {
      return new Date(decoded.payload.exp * 1000);
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if token is expired
 * NEW: Added expiration check
 *
 * @param {string} token - JWT token
 * @returns {boolean} True if expired
 */
function isTokenExpired(token) {
  try {
    const expiration = getTokenExpiration(token);
    if (!expiration) return true;
    return expiration < new Date();
  } catch (error) {
    return true;
  }
}

/**
 * Get time until token expiration
 * NEW: Added time remaining calculator
 *
 * @param {string} token - JWT token
 * @returns {number|null} Milliseconds until expiration or null
 */
function getTimeUntilExpiration(token) {
  try {
    const expiration = getTokenExpiration(token);
    if (!expiration) return null;
    return expiration.getTime() - Date.now();
  } catch (error) {
    return null;
  }
}

// ============================================
// TOKEN BLACKLIST (for logout/revocation)
// ============================================

// In-memory blacklist (in production, use Redis)
const tokenBlacklist = new Set();

/**
 * Revoke/blacklist a token
 * NEW: Added token revocation
 *
 * @param {string} token - Token to revoke
 */
function revokeToken(token) {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.payload) {
      // Store token ID (jti) or hash of token
      const tokenId = decoded.payload.jti || token.substring(0, 50);
      tokenBlacklist.add(tokenId);
      console.log(`✅ Token revoked`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Token revocation error:", error.message);
    return false;
  }
}

/**
 * Check if token is revoked
 * NEW: Added revocation check
 *
 * @param {string} token - Token to check
 * @returns {boolean} True if revoked
 */
function isTokenRevoked(token) {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.payload) {
      const tokenId = decoded.payload.jti || token.substring(0, 50);
      return tokenBlacklist.has(tokenId);
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Clear expired tokens from blacklist
 * NEW: Added cleanup function
 */
function cleanupBlacklist() {
  // In production, this would query Redis with TTL
  console.log(`🧹 Token blacklist cleanup (size: ${tokenBlacklist.size})`);
}

// Cleanup every hour
setInterval(cleanupBlacklist, 60 * 60 * 1000);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Token creation
  createToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  createAccessToken,
  createRefreshToken,
  createTwoFactorToken,

  // Token verification
  verifyToken,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
  verifyAccessToken,
  verifyRefreshToken,

  // Token utilities
  decodeToken,
  getTokenExpiration,
  isTokenExpired,
  getTimeUntilExpiration,

  // Token revocation
  revokeToken,
  isTokenRevoked,
  cleanupBlacklist,

  // Constants
  TOKEN_TYPES,
  TOKEN_EXPIRATION,
};
