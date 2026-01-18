// =============================================
// authRoutes.js - Authentication Routes
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { authMiddleware } = require("../middleware/authMiddleware");
const { asyncHandler } = require("../middleware/errorHandler");

// Import controllers
const {
  // Attorney Auth
  attorneySignup,
  attorneyLogin,
  sendAttorneyOTP,
  verifyAttorneyOTP,
  sendAttorneyEmailVerification,

  // Juror Auth
  jurorSignup,
  jurorLogin,
  sendJurorOTP,
  verifyJurorOTP,
  sendJurorEmailVerification,

  // Admin Auth
  adminLogin,

  // Password Reset (OTP-based)
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPasswordWithOTP,

  // Token Verification
  verifyToken,
  getCurrentUser,
  verifyEmailVerificationToken,

  // Authenticated OTP (for profile password changes)
  sendAuthenticatedOTP,
  verifyAuthenticatedOTP,
} = require("../controllers/authController");

/* ===========================================================
   RATE LIMITERS
   =========================================================== */

const createRateLimiter = (max, windowMinutes, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    message: {
      success: false,
      error: message,
      code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

// Authentication rate limiters
// Production values are strict, can be overridden via environment variables for development
const isDev = process.env.NODE_ENV !== 'production';

const signupLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_SIGNUP) || (isDev ? 100 : 5),
  15,
  "Too many signup attempts. Try again in 15 minutes."
);
const loginLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_LOGIN) || (isDev ? 100 : 10),
  15,
  "Too many login attempts. Try again in 15 minutes."
);
const adminLoginLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_ADMIN_LOGIN) || (isDev ? 50 : 3),
  15,
  "Too many admin login attempts. Try again in 15 minutes."
);
const otpLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_OTP) || (isDev ? 50 : 5),
  60,
  "Too many OTP requests. Try again in 1 hour."
);
const otpVerificationLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_OTP_VERIFY) || (isDev ? 100 : 10),
  15,
  "Too many OTP verification attempts. Try again in 15 minutes."
);
const passwordResetLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_PASSWORD_RESET) || (isDev ? 50 : 3),
  60,
  "Too many password reset requests. Try again in 1 hour."
);
const emailVerificationLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_EMAIL_VERIFY) || (isDev ? 50 : 3),
  60,
  "Too many verification emails sent. Try again in 1 hour."
);
const generalAuthLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_GENERAL_AUTH) || (isDev ? 100 : 50),
  15,
  "Too many requests. Please try again later."
);

/* ===========================================================
   VALIDATION MIDDLEWARE
   =========================================================== */

const validateEmail = (req, res, next) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({
      success: false,
      error: "Email is required",
      code: "EMAIL_REQUIRED",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Invalid email format",
      code: "INVALID_EMAIL",
    });
  }

  req.body.email = email.toLowerCase().trim();
  next();
};

const validatePassword = (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      error: "Password is required",
      code: "PASSWORD_REQUIRED",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 8 characters long",
      code: "WEAK_PASSWORD",
    });
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return res.status(400).json({
      success: false,
      error: "Password must contain uppercase, lowercase, and number",
      code: "WEAK_PASSWORD",
    });
  }

  next();
};

const validateUserType = (req, res, next) => {
  const { userType } = req.body;

  if (!userType) {
    return res.status(400).json({
      success: false,
      error: "User type is required",
      code: "USER_TYPE_REQUIRED",
    });
  }

  const validTypes = ["attorney", "juror"];
  const normalizedType = userType.toLowerCase();

  if (!validTypes.includes(normalizedType)) {
    return res.status(400).json({
      success: false,
      error: "Invalid user type. Must be 'attorney' or 'juror'",
      code: "INVALID_USER_TYPE",
    });
  }

  req.body.userType = normalizedType;
  next();
};

const validateOTP = (req, res, next) => {
  const { otp } = req.body;

  if (!otp) {
    return res.status(400).json({
      success: false,
      error: "OTP is required",
      code: "OTP_REQUIRED",
    });
  }

  const otpStr = otp.toString().trim();

  if (!/^\d{6}$/.test(otpStr)) {
    return res.status(400).json({
      success: false,
      error: "Invalid OTP format. Must be 6 digits",
      code: "INVALID_OTP_FORMAT",
    });
  }

  req.body.otp = otpStr;
  next();
};

/* ===========================================================
   PUBLIC ROUTES
   =========================================================== */

/**
 * GET /api/auth/health
 * Health check endpoint
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "auth",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
  });
});

/* ===========================================================
   ADMIN AUTHENTICATION
   =========================================================== */

/**
 * POST /api/auth/admin/login
 * Admin login
 */
router.post(
  "/admin/login",
  adminLoginLimiter,
  validateEmail,
  asyncHandler(adminLogin)
);

/* ===========================================================
   ATTORNEY AUTHENTICATION
   =========================================================== */

/**
 * POST /api/auth/attorney/signup
 * Attorney registration
 */
router.post(
  "/attorney/signup",
  signupLimiter,
  validateEmail,
  validatePassword,
  asyncHandler(attorneySignup)
);

/**
 * POST /api/auth/attorney/login
 * Attorney login
 */
router.post(
  "/attorney/login",
  loginLimiter,
  validateEmail,
  asyncHandler(attorneyLogin)
);

/**
 * POST /api/auth/attorney/send-otp
 * Send OTP to attorney email
 */
router.post(
  "/attorney/send-otp",
  otpLimiter,
  validateEmail,
  asyncHandler(sendAttorneyOTP)
);

/**
 * POST /api/auth/attorney/verify-otp
 * Verify attorney OTP
 */
router.post(
  "/attorney/verify-otp",
  otpVerificationLimiter,
  validateEmail,
  validateOTP,
  asyncHandler(verifyAttorneyOTP)
);

/**
 * POST /api/auth/attorney/send-email-verification
 * Send email verification link
 */
router.post(
  "/attorney/send-email-verification",
  emailVerificationLimiter,
  validateEmail,
  asyncHandler(sendAttorneyEmailVerification)
);

/* ===========================================================
   JUROR AUTHENTICATION
   =========================================================== */

/**
 * POST /api/auth/juror/signup
 * Juror registration
 */
router.post(
  "/juror/signup",
  signupLimiter,
  validateEmail,
  validatePassword,
  asyncHandler(jurorSignup)
);

/**
 * POST /api/auth/juror/login
 * Juror login
 */
router.post(
  "/juror/login",
  loginLimiter,
  validateEmail,
  asyncHandler(jurorLogin)
);

/**
 * POST /api/auth/juror/send-otp
 * Send OTP to juror email
 */
router.post(
  "/juror/send-otp",
  otpLimiter,
  validateEmail,
  asyncHandler(sendJurorOTP)
);

/**
 * POST /api/auth/juror/verify-otp
 * Verify juror OTP
 */
router.post(
  "/juror/verify-otp",
  otpVerificationLimiter,
  validateEmail,
  validateOTP,
  asyncHandler(verifyJurorOTP)
);

/**
 * POST /api/auth/juror/send-email-verification
 * Send email verification link
 */
router.post(
  "/juror/send-email-verification",
  emailVerificationLimiter,
  validateEmail,
  asyncHandler(sendJurorEmailVerification)
);

/* ===========================================================
   PASSWORD RESET - OTP BASED
   =========================================================== */

/**
 * POST /api/auth/request-password-reset
 * Request password reset - sends OTP to email
 */
router.post(
  "/request-password-reset",
  passwordResetLimiter,
  validateEmail,
  validateUserType,
  asyncHandler(requestPasswordReset)
);

/**
 * POST /api/auth/verify-password-reset-otp
 * Verify password reset OTP
 */
router.post(
  "/verify-password-reset-otp",
  otpVerificationLimiter,
  validateEmail,
  validateUserType,
  asyncHandler(verifyPasswordResetOTP)
);

/**
 * POST /api/auth/reset-password
 * Reset password with verified OTP
 */
router.post(
  "/reset-password",
  generalAuthLimiter,
  validateEmail,
  validateUserType,
  asyncHandler(resetPasswordWithOTP)
);

/* ===========================================================
   TOKEN & EMAIL VERIFICATION
   =========================================================== */

/**
 * POST /api/auth/verify-token
 * Verify JWT token validity
 */
router.post("/verify-token", generalAuthLimiter, asyncHandler(verifyToken));

/**
 * GET /api/auth/verify-email
 * Verify email with verification token
 */
router.get(
  "/verify-email",
  generalAuthLimiter,
  asyncHandler(verifyEmailVerificationToken)
);

/* ===========================================================
   AUTHENTICATED ROUTES
   All routes below require valid JWT token
   =========================================================== */

router.use(authMiddleware);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get("/me", asyncHandler(getCurrentUser));

/**
 * GET /api/auth/check
 * Check authentication status
 */
router.get("/check", (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      type: req.user.type,
      verified: req.user.verified,
    },
  });
});

/**
 * POST /api/auth/send-otp
 * Send OTP to authenticated user's email (for password change)
 */
router.post(
  "/send-otp",
  otpLimiter,
  asyncHandler(sendAuthenticatedOTP)
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP for authenticated user (for password change)
 */
router.post(
  "/verify-otp",
  otpVerificationLimiter,
  asyncHandler(verifyAuthenticatedOTP)
);

/* ===========================================================
   LEGACY ROUTES (for backward compatibility)
   =========================================================== */

/**
 * POST /api/auth/login
 * Unified login (detects user type)
 */
router.post(
  "/login",
  loginLimiter,
  validateEmail,
  validateUserType,
  asyncHandler(async (req, res, next) => {
    const { userType } = req.body;

    if (userType === "attorney") {
      return attorneyLogin(req, res, next);
    } else if (userType === "juror") {
      return jurorLogin(req, res, next);
    } else {
      return res.status(400).json({
        success: false,
        error: "Invalid user type",
        code: "INVALID_USER_TYPE",
      });
    }
  })
);

/* ===========================================================
   ERROR HANDLER
   =========================================================== */

router.use((error, req, res, next) => {
  console.error("❌ [Auth Route Error]:", error);

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Authentication error occurred",
    code: error.code || "AUTH_ERROR",
  });
});

module.exports = router;
