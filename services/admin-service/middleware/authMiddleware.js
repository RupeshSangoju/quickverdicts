// =============================================
// authMiddleware.js - JWT Authentication & Authorization
// =============================================

const jwt = require("jsonwebtoken");
const { findByEmail: findAttorneyByEmail } = require("../models/Attorney");
const { findByEmail: findJurorByEmail } = require("../models/Juror");
const { findById: findAdminById } = require("../models/Admin");

// ============================================
// JWT SECRET VALIDATION
// ============================================
function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("🚨 CRITICAL: JWT_SECRET not set in environment variables!");
    throw new Error("JWT_SECRET must be configured");
  }
  if (secret.length < 32) {
    console.warn(
      "⚠️  JWT_SECRET is too short; use at least 32 characters for security!"
    );
  }
  return secret;
}

const JWT_SECRET = getJWTSecret();

// Token expiration times
const TOKEN_EXPIRY = {
  ACCESS: process.env.JWT_ACCESS_EXPIRY || "15m",
  REFRESH: process.env.JWT_REFRESH_EXPIRY || "7d",
  REMEMBER_ME: process.env.JWT_REMEMBER_EXPIRY || "30d",
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function handleAuthError(res, message, code = "AUTH_ERROR", status = 401) {
  return res.status(status).json({
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  });
}

// Extract token from multiple sources
function extractToken(req) {
  // 1. Authorization header (preferred)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme === "Bearer" && token) {
      return token;
    }
  }

  // 2. Cookie (for web apps)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  // 3. Query parameter (for WebSocket/streaming - use cautiously)
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
}

// Verify token hasn't been revoked (implement with Redis/database in future)
async function isTokenRevoked(tokenId, userId) {
  // TODO: Check against revoked tokens list (Redis recommended)
  // Example:
  // const isRevoked = await redis.get(`revoked:${tokenId}`);
  // return isRevoked === '1';
  return false;
}

// ============================================
// CORE AUTHENTICATION MIDDLEWARE
// ============================================
async function authMiddleware(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return handleAuthError(
        res,
        "No authentication token provided",
        "NO_TOKEN"
      );
    }

    // Verify and decode token
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256", "HS384", "HS512"], // Explicitly allow only HMAC algorithms
      complete: false, // We only need the payload
    });

    // Extract user information from token
    const userType = decoded.type || decoded.role || "unknown";
    const userEmail = decoded.email || decoded.username;
    const userId = decoded.id || decoded.sub || decoded.userId;
    const tokenId = decoded.jti; // JWT ID for revocation tracking

    // Validate required fields
    if (!userEmail || !userId) {
      return handleAuthError(
        res,
        "Invalid token: missing required user information",
        "INVALID_TOKEN_PAYLOAD"
      );
    }

    // Check if token has been revoked
    if (tokenId && (await isTokenRevoked(tokenId, userId))) {
      return handleAuthError(
        res,
        "Token has been revoked. Please log in again.",
        "TOKEN_REVOKED"
      );
    }

    let user = null;

    // Admin authentication
    if (
      userType === "admin" ||
      userType === "administrator" ||
      decoded.isAdmin
    ) {
      // Verify admin exists in database (important for security)
      try {
        const admin = await findAdminById(userId);
        if (!admin || !admin.IsActive) {
          return handleAuthError(
            res,
            "Admin account not found or inactive",
            "ADMIN_NOT_FOUND",
            403
          );
        }
        user = {
          id: admin.AdminId,
          email: admin.Email,
          type: "admin",
          firstName: admin.FirstName,
          lastName: admin.LastName,
          verified: true,
          role: "admin",
          permissions: admin.Permissions || [],
        };
      } catch (error) {
        console.error("❌ Error fetching admin:", error);
        return handleAuthError(
          res,
          "Error validating admin credentials",
          "AUTH_ERROR",
          500
        );
      }
    }

    // Attorney authentication
    else if (userType === "attorney") {
      try {
        const attorney = await findAttorneyByEmail(userEmail);

        if (!attorney) {
          return handleAuthError(
            res,
            "Attorney account not found",
            "ATTORNEY_NOT_FOUND",
            404
          );
        }

        // Check if attorney account is active
        if (attorney.IsDeleted || !attorney.IsActive) {
          return handleAuthError(
            res,
            "Attorney account is inactive or has been deleted",
            "ACCOUNT_DEACTIVATED",
            403
          );
        }

        user = {
          id: attorney.AttorneyId,
          email: attorney.Email,
          type: "attorney",
          firstName: attorney.FirstName,
          lastName: attorney.LastName,
          lawFirmName: attorney.LawFirmName,
          verified: attorney.IsVerified,
          verificationStatus: attorney.VerificationStatus,
          tierLevel: attorney.TierLevel || "free",
          phoneNumber: attorney.PhoneNumber,
        };
      } catch (error) {
        console.error("❌ Error fetching attorney:", error);
        return handleAuthError(
          res,
          "Error validating attorney credentials",
          "AUTH_ERROR",
          500
        );
      }
    }

    // Juror authentication
    else if (userType === "juror") {
      try {
        const juror = await findJurorByEmail(userEmail);

        if (!juror) {
          return handleAuthError(
            res,
            "Juror account not found",
            "JUROR_NOT_FOUND",
            404
          );
        }

        // Check if juror is active
        if (!juror.IsActive) {
          return handleAuthError(
            res,
            "Your account has been deactivated. Please contact support.",
            "ACCOUNT_DEACTIVATED",
            403
          );
        }

        user = {
          id: juror.JurorId,
          email: juror.Email,
          type: "juror",
          name: juror.Name,
          firstName: juror.FirstName,
          lastName: juror.LastName,
          county: juror.County,
          state: juror.State,
          verified: juror.IsVerified,
          verificationStatus: juror.VerificationStatus,
          onboardingCompleted: juror.OnboardingCompleted || false,
          introVideoCompleted: juror.IntroVideoCompleted || false,
          jurorQuizCompleted: juror.JurorQuizCompleted || false,
          profileComplete: juror.ProfileComplete || false,
        };
      } catch (error) {
        console.error("❌ Error fetching juror:", error);
        return handleAuthError(
          res,
          "Error validating juror credentials",
          "AUTH_ERROR",
          500
        );
      }
    } else {
      return handleAuthError(
        res,
        `Unsupported user type: ${userType}`,
        "INVALID_USER_TYPE"
      );
    }

    if (!user) {
      return handleAuthError(
        res,
        "User authentication failed",
        "USER_NOT_FOUND",
        404
      );
    }

    // Attach user and token info to request
    req.user = user;
    req.token = decoded;
    req.tokenId = tokenId;

    // Log authentication in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `✅ Authenticated ${user.type}: ${user.email} (ID: ${user.id})`
      );
    }

    next();
  } catch (error) {
    // Handle JWT-specific errors
    if (error.name === "JsonWebTokenError") {
      return handleAuthError(
        res,
        "Invalid authentication token",
        "INVALID_TOKEN"
      );
    }

    if (error.name === "TokenExpiredError") {
      return handleAuthError(
        res,
        "Your session has expired. Please log in again.",
        "TOKEN_EXPIRED"
      );
    }

    if (error.name === "NotBeforeError") {
      return handleAuthError(res, "Token is not yet valid", "TOKEN_NOT_ACTIVE");
    }

    // Log unexpected errors
    console.error("❌ [authMiddleware] Unexpected error:", error);
    return handleAuthError(
      res,
      "Authentication error occurred",
      "AUTH_ERROR",
      500
    );
  }
}

// ============================================
// ROLE-BASED AUTHORIZATION
// ============================================
function requireAttorney(req, res, next) {
  if (!req.user) {
    return handleAuthError(
      res,
      "Authentication required. Please log in.",
      "AUTH_REQUIRED"
    );
  }

  if (req.user.type !== "attorney") {
    return handleAuthError(
      res,
      "This resource requires attorney privileges",
      "ATTORNEY_REQUIRED",
      403
    );
  }

  next();
}

function requireJuror(req, res, next) {
  if (!req.user) {
    return handleAuthError(
      res,
      "Authentication required. Please log in.",
      "AUTH_REQUIRED"
    );
  }

  if (req.user.type !== "juror") {
    return handleAuthError(
      res,
      "This resource requires juror privileges",
      "JUROR_REQUIRED",
      403
    );
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return handleAuthError(
      res,
      "Authentication required. Please log in.",
      "AUTH_REQUIRED"
    );
  }

  const isAdmin =
    req.user.type === "admin" ||
    req.user.type === "administrator" ||
    req.user.role === "admin";

  if (!isAdmin) {
    return handleAuthError(
      res,
      "This resource requires administrator privileges",
      "ADMIN_REQUIRED",
      403
    );
  }

  next();
}

// Allow multiple roles
function requireAnyRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return handleAuthError(
        res,
        "Authentication required. Please log in.",
        "AUTH_REQUIRED"
      );
    }

    if (!allowedRoles.includes(req.user.type)) {
      return handleAuthError(
        res,
        `This resource requires one of: ${allowedRoles.join(", ")}`,
        "ROLE_REQUIRED",
        403
      );
    }

    next();
  };
}

// ============================================
// STATUS-BASED AUTHORIZATION
// ============================================
function requireVerified(req, res, next) {
  if (!req.user) {
    return handleAuthError(
      res,
      "Authentication required. Please log in.",
      "AUTH_REQUIRED"
    );
  }

  if (!req.user.verified) {
    return handleAuthError(
      res,
      "Please verify your email address to access this resource",
      "VERIFICATION_REQUIRED",
      403
    );
  }

  next();
}

function requireJurorOnboarding(req, res, next) {
  if (!req.user) {
    return handleAuthError(
      res,
      "Authentication required. Please log in.",
      "AUTH_REQUIRED"
    );
  }

  if (req.user.type !== "juror") {
    return handleAuthError(
      res,
      "This resource requires juror privileges",
      "JUROR_REQUIRED",
      403
    );
  }

  if (!req.user.onboardingCompleted) {
    return handleAuthError(
      res,
      "Please complete the onboarding process first",
      "ONBOARDING_REQUIRED",
      403
    );
  }

  next();
}

function requireIntroVideo(req, res, next) {
  if (!req.user) {
    return handleAuthError(
      res,
      "Authentication required. Please log in.",
      "AUTH_REQUIRED"
    );
  }

  if (req.user.type !== "juror") {
    return handleAuthError(
      res,
      "This resource requires juror privileges",
      "JUROR_REQUIRED",
      403
    );
  }

  if (!req.user.introVideoCompleted) {
    return handleAuthError(
      res,
      "Please watch the introductory video first",
      "INTRO_VIDEO_REQUIRED",
      403
    );
  }

  next();
}

function requireJurorQuiz(req, res, next) {
  if (!req.user) {
    return handleAuthError(
      res,
      "Authentication required. Please log in.",
      "AUTH_REQUIRED"
    );
  }

  if (req.user.type !== "juror") {
    return handleAuthError(
      res,
      "This resource requires juror privileges",
      "JUROR_REQUIRED",
      403
    );
  }

  if (!req.user.jurorQuizCompleted) {
    return handleAuthError(
      res,
      "Please complete the juror qualification quiz first",
      "JUROR_QUIZ_REQUIRED",
      403
    );
  }

  next();
}

// Tier-based authorization (for attorney premium features)
function requireTier(minTier) {
  const tierHierarchy = {
    free: 0,
    basic: 1,
    professional: 2,
    enterprise: 3,
  };

  return (req, res, next) => {
    if (!req.user) {
      return handleAuthError(
        res,
        "Authentication required. Please log in.",
        "AUTH_REQUIRED"
      );
    }

    if (req.user.type !== "attorney") {
      return handleAuthError(
        res,
        "This resource requires attorney privileges",
        "ATTORNEY_REQUIRED",
        403
      );
    }

    const userTierLevel = tierHierarchy[req.user.tierLevel] || 0;
    const requiredTierLevel = tierHierarchy[minTier] || 0;

    if (userTierLevel < requiredTierLevel) {
      return handleAuthError(
        res,
        `This feature requires ${minTier} tier or higher. Please upgrade your account.`,
        "TIER_UPGRADE_REQUIRED",
        403
      );
    }

    next();
  };
}

// ============================================
// OPTIONAL AUTHENTICATION
// ============================================
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return next(); // No token, continue without auth
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256", "HS384", "HS512"],
    });

    const userType = decoded.type || decoded.role;
    const userEmail = decoded.email || decoded.username;
    const userId = decoded.id || decoded.sub;

    let user = null;

    if (
      userType === "admin" ||
      userType === "administrator" ||
      decoded.isAdmin
    ) {
      const admin = await findAdminById(userId);
      if (admin && admin.IsActive) {
        user = {
          id: admin.AdminId,
          email: admin.Email,
          type: "admin",
          verified: true,
        };
      }
    } else if (userType === "attorney") {
      const attorney = await findAttorneyByEmail(userEmail);
      if (attorney && !attorney.IsDeleted && attorney.IsActive) {
        user = {
          id: attorney.AttorneyId,
          email: attorney.Email,
          type: "attorney",
          verified: attorney.IsVerified,
          tierLevel: attorney.TierLevel,
        };
      }
    } else if (userType === "juror") {
      const juror = await findJurorByEmail(userEmail);
      if (juror && juror.IsActive) {
        user = {
          id: juror.JurorId,
          email: juror.Email,
          type: "juror",
          verified: juror.IsVerified,
        };
      }
    }

    if (user) {
      req.user = user;
      req.token = decoded;
    }

    next(); // Continue regardless of success/failure
  } catch (error) {
    // Silent fail for optional auth - just continue without user
    next();
  }
}

// ============================================
// RESOURCE OWNERSHIP VALIDATION
// ============================================
function requireOwnership(resourceIdParam = "id", userIdField = "id") {
  return async (req, res, next) => {
    if (!req.user) {
      return handleAuthError(res, "Authentication required", "AUTH_REQUIRED");
    }

    const resourceId = parseInt(req.params[resourceIdParam]);
    const userId = req.user[userIdField];

    if (resourceId !== userId && req.user.type !== "admin") {
      return handleAuthError(
        res,
        "You can only access your own resources",
        "ACCESS_DENIED",
        403
      );
    }

    next();
  };
}

// ============================================
// RATE LIMITING BY USER
// ============================================
const userRateLimits = new Map();

function rateLimitByUser(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const userId = req.user.id;
    const now = Date.now();
    const userLimit = userRateLimits.get(userId) || {
      count: 0,
      resetTime: now + windowMs,
    };

    if (now > userLimit.resetTime) {
      // Reset window
      userRateLimits.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return handleAuthError(
        res,
        `Rate limit exceeded. Try again in ${Math.ceil(
          (userLimit.resetTime - now) / 1000
        )} seconds.`,
        "RATE_LIMIT_EXCEEDED",
        429
      );
    }

    userLimit.count++;
    userRateLimits.set(userId, userLimit);
    next();
  };
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  authMiddleware,
  authenticateToken: authMiddleware, // alias
  requireAttorney,
  requireJuror,
  requireAdmin,
  requireAnyRole,
  requireVerified,
  requireJurorOnboarding,
  requireIntroVideo,
  requireJurorQuiz,
  requireTier,
  optionalAuth,
  requireOwnership,
  rateLimitByUser,
  TOKEN_EXPIRY,
};
