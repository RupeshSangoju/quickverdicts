// =============================================
// authController.js - Authentication Controller
// =============================================

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Models
const Attorney = require("../models/Attorney");
const Juror = require("../models/Juror");
const Admin = require("../models/Admin");
const LoginAttempts = require("../models/LoginAttempts");

// Utils
const {
  sendPasswordResetEmail,
  sendOTPEmail,
  sendEmailVerification,
} = require("../utils/email");

/* ===========================================================
   OTP MANAGEMENT (IN-MEMORY STORE)
   =========================================================== */

const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const otpRateLimit = new Map();
const OTP_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const OTP_RATE_LIMIT_MAX = 5;

/* ===========================================================
   LOGIN RATE LIMITING CONSTANTS
   =========================================================== */

const MAX_LOGIN_ATTEMPTS = 5; // Maximum failed login attempts
const LOGIN_LOCKOUT_MINUTES = 15; // Account lockout duration in minutes

/* ===========================================================
   PASSWORD RESET TOKEN MANAGEMENT (IN-MEMORY STORE)
   =========================================================== */

const resetTokenStore = new Map();
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Cleanup expired OTPs and reset tokens every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) otpStore.delete(email);
  }
  for (const [email, data] of otpRateLimit.entries()) {
    if (now > data.resetAt) otpRateLimit.delete(email);
  }
  for (const [token, data] of resetTokenStore.entries()) {
    if (now > data.expiresAt) resetTokenStore.delete(token);
  }
}, 15 * 60 * 1000);

/* ===========================================================
   HELPER FUNCTIONS
   =========================================================== */

function checkOTPRateLimit(email) {
  const now = Date.now();
  const info = otpRateLimit.get(email);

  if (!info) {
    otpRateLimit.set(email, { count: 1, resetAt: now + OTP_RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (now > info.resetAt) {
    otpRateLimit.set(email, { count: 1, resetAt: now + OTP_RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (info.count >= OTP_RATE_LIMIT_MAX) {
    const mins = Math.ceil((info.resetAt - now) / 60000);
    return {
      allowed: false,
      message: `Too many OTP requests. Try again in ${mins} minutes.`,
    };
  }

  info.count++;
  return { allowed: true };
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(email, otp) {
  otpStore.set(email, {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });
  console.log(`✅ OTP stored for ${email}: ${otp}`);
}

function verifyOTPCode(email, otp) {
  const record = otpStore.get(email);

  if (!record) {
    return { valid: false, error: "Verification code not found or expired" };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return {
      valid: false,
      error: "Verification code expired. Please request a new one",
    };
  }

  record.attempts++;

  if (record.attempts > OTP_MAX_ATTEMPTS) {
    otpStore.delete(email);
    return {
      valid: false,
      error: "Too many incorrect attempts. Please request a new code",
    };
  }

  if (record.otp !== otp) {
    return { valid: false, error: "Invalid verification code" };
  }

  otpStore.delete(email);
  return { valid: true };
}

function generateJWT(user, type) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      type: type,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/* ===========================================================
   ATTORNEY AUTHENTICATION
   =========================================================== */

/**
 * Attorney signup
 */
async function attorneySignup(req, res) {
  try {
    const {
      firstName,
      middleName,
      lastName,
      lawFirmName,
      email,
      password,
      phoneNumber,
      state,
      stateBarNumber,
      officeAddress1,
      officeAddress2,
      city,
      county,
      zipCode,
    } = req.body;

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !state ||
      !stateBarNumber
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Required fields: firstName, lastName, email, password, state, stateBarNumber",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingAttorney = await Attorney.findByEmail(normalizedEmail);
    if (existingAttorney) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists",
        code: "EMAIL_EXISTS",
      });
    }

    // Check if state bar number already exists
    const barNumberExists = await Attorney.checkStateBarNumberExists(
      stateBarNumber,
      state
    );
    if (barNumberExists) {
      return res.status(409).json({
        success: false,
        error: "This state bar number is already registered",
        code: "BAR_NUMBER_EXISTS",
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create attorney
    const attorneyId = await Attorney.createAttorney({
      firstName,
      middleName,
      lastName,
      lawFirmName,
      email: normalizedEmail,
      passwordHash,
      phoneNumber,
      state,
      stateBarNumber,
      officeAddress1,
      officeAddress2,
      city,
      county,
      zipCode,
    });

    // Generate JWT
    const token = generateJWT(
      { id: attorneyId, email: normalizedEmail },
      "attorney"
    );

    return res.status(201).json({
      success: true,
      message: "Attorney account created successfully",
      token,
      user: {
        id: attorneyId,
        email: normalizedEmail,
        firstName,
        lastName,
        type: "attorney",
      },
    });
  } catch (error) {
    console.error("❌ [Attorney.signup] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create account",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Attorney login with brute force protection
 */
async function attorneyLogin(req, res) {
  try {
    const { email, password, timezoneOffset } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
        code: "MISSING_CREDENTIALS",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Check failed login attempts
    const failedAttempts = await LoginAttempts.getRecentFailedAttempts(
      normalizedEmail,
      "attorney",
      LOGIN_LOCKOUT_MINUTES
    );

    // If account is locked due to too many failed attempts
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      const unlockTime = await LoginAttempts.getAccountLockoutTime(
        normalizedEmail,
        "attorney",
        LOGIN_LOCKOUT_MINUTES
      );

      const now = new Date();
      const minutesRemaining = Math.ceil((new Date(unlockTime) - now) / 60000);

      return res.status(429).json({
        success: false,
        error: `Account temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`,
        code: "ACCOUNT_LOCKED",
        minutesRemaining,
      });
    }

    // Find attorney
    const attorney = await Attorney.findByEmail(normalizedEmail);
    if (!attorney) {
      // Record failed attempt
      await LoginAttempts.recordFailedAttempt(normalizedEmail, "attorney", ipAddress);

      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Check if account is active
    if (!attorney.IsActive) {
      return res.status(403).json({
        success: false,
        error: "Your account has been deactivated. Please contact support.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      password,
      attorney.PasswordHash
    );
    if (!isValidPassword) {
      // Record failed attempt
      await LoginAttempts.recordFailedAttempt(normalizedEmail, "attorney", ipAddress);

      const newFailedAttempts = failedAttempts + 1;
      const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newFailedAttempts;

      // If this was the last allowed attempt, inform user about lockout
      if (attemptsRemaining <= 0) {
        return res.status(401).json({
          success: false,
          error: `Invalid email or password. Account locked for ${LOGIN_LOCKOUT_MINUTES} minutes due to too many failed attempts.`,
          code: "INVALID_CREDENTIALS",
        });
      }

      // Show warning about remaining attempts
      return res.status(401).json({
        success: false,
        error: `Invalid email or password. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining before account lockout.`,
        code: "INVALID_CREDENTIALS",
        attemptsRemaining,
      });
    }

    // Clear failed login attempts on successful login
    await LoginAttempts.clearFailedAttempts(normalizedEmail, "attorney");

    // Update last login
    await Attorney.updateLastLogin(attorney.AttorneyId);

    // Update timezone offset if provided
    if (timezoneOffset !== undefined && timezoneOffset !== null) {
      try {
        await Attorney.updateTimezoneOffset(attorney.AttorneyId, timezoneOffset);
        console.log(`🌍 Attorney ${attorney.AttorneyId} timezone updated: ${timezoneOffset} minutes from UTC`);
      } catch (tzError) {
        // Don't fail login if timezone update fails, just log the error
        console.error('⚠️ Failed to update attorney timezone offset:', tzError);
      }
    }

    // Generate JWT
    const token = generateJWT(
      { id: attorney.AttorneyId, email: attorney.Email },
      "attorney"
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: attorney.AttorneyId,
        email: attorney.Email,
        firstName: attorney.FirstName,
        lastName: attorney.LastName,
        lawFirmName: attorney.LawFirmName,
        phoneNumber: attorney.PhoneNumber,
        type: "attorney",
        verified: attorney.IsVerified,
        verificationStatus: attorney.VerificationStatus,
        tierLevel: attorney.TierLevel,
      },
    });
  } catch (error) {
    console.error("❌ [Attorney.login] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Login failed",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Send OTP to attorney email
 */
async function sendAttorneyOTP(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
        code: "EMAIL_REQUIRED",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit
    const rateCheck = checkOTPRateLimit(normalizedEmail);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: rateCheck.message,
        code: "RATE_LIMIT_EXCEEDED",
      });
    }

    // Check if email is already registered
    const existing = await Attorney.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists",
        code: "EMAIL_EXISTS",
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(normalizedEmail, otp);

    // Send OTP email
    await sendOTPEmail(normalizedEmail, otp, "attorney");

    return res.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    console.error("❌ [Attorney.sendOTP] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to send verification code",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Verify Attorney Email OTP
 */
async function verifyAttorneyOTP(req, res) {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ USE IN-MEMORY OTP STORE (not database)
    const verification = verifyOTPCode(normalizedEmail, otp);

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.error,
      });
    }

    console.log(`✅ Attorney email verified: ${normalizedEmail}`);

    // Success response
    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("❌ OTP Verification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
    });
  }
}

/**
 * Send email verification link to attorney
 */
async function sendAttorneyEmailVerification(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
        code: "EMAIL_REQUIRED",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find attorney
    const attorney = await Attorney.findByEmail(normalizedEmail);
    if (!attorney) {
      return res.status(404).json({
        success: false,
        error: "Attorney not found",
        code: "ATTORNEY_NOT_FOUND",
      });
    }

    if (attorney.IsVerified) {
      return res.status(400).json({
        success: false,
        error: "Email is already verified",
        code: "ALREADY_VERIFIED",
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&type=attorney`;

    // Send verification email
    await sendEmailVerification(normalizedEmail, verificationLink, "attorney");

    return res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("❌ [Attorney.sendEmailVerification] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to send verification email",
      code: "INTERNAL_ERROR",
    });
  }
}

/* ===========================================================
   JUROR AUTHENTICATION
   =========================================================== */

/**
 * Juror signup
 */
async function jurorSignup(req, res) {
  try {
    console.log("📥 Juror Signup Request:", {
      email: req.body.email,
      hasPassword: !!req.body.password,
      paymentMethod: req.body.paymentMethod,
      userAgreementAccepted: req.body.userAgreementAccepted,
    });

    const {
      // Personal Details (from Step 2 - personalDetails2)
      name,
      email,
      password,
      phoneNumber,
      address1,
      address2,
      city,
      county,
      state,
      zipCode,

      // Payment (from Step 2)
      paymentMethod,

      // Agreement (from Step 4) - accept both field names
      agreedToTerms,
      userAgreementAccepted,

      // Criteria (from Step 1 - sent as JSON string)
      criteriaResponses,
    } = req.body;

    // ✅ VALIDATE REQUIRED FIELDS
    if (!name || !email || !password || !phoneNumber || !county || !state) {
      console.error("❌ Missing required fields:", {
        name: !!name,
        email: !!email,
        password: !!password,
        phoneNumber: !!phoneNumber,
        county: !!county,
        state: !!state,
      });

      return res.status(400).json({
        success: false,
        error:
          "Required fields: name, email, password, phoneNumber, county, state",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // ✅ VALIDATE PAYMENT METHOD
    const validPaymentMethods = ["venmo", "paypal", "cashapp", "zelle"];
    if (
      !paymentMethod ||
      !validPaymentMethods.includes(paymentMethod.toLowerCase())
    ) {
      console.error("❌ Invalid payment method:", paymentMethod);

      return res.status(400).json({
        success: false,
        error: `Payment method must be one of: ${validPaymentMethods.join(
          ", "
        )}`,
        code: "INVALID_PAYMENT_METHOD",
      });
    }

    // ✅ VALIDATE USER AGREEMENT (accept both field names for compatibility)
    const agreedToTermsValue = agreedToTerms || userAgreementAccepted;
    if (agreedToTermsValue !== true && agreedToTermsValue !== "true") {
      console.error("❌ User agreement not accepted:", agreedToTermsValue);

      return res.status(400).json({
        success: false,
        error: "You must accept the user agreement to continue",
        code: "AGREEMENT_REQUIRED",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ CHECK IF EMAIL EXISTS
    const existingJuror = await Juror.findByEmail(normalizedEmail);
    if (existingJuror) {
      console.warn("⚠️ Email already exists:", normalizedEmail);

      return res.status(409).json({
        success: false,
        error: "An account with this email already exists",
        code: "EMAIL_EXISTS",
      });
    }

    // ✅ HASH PASSWORD
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    console.log("🔐 Creating juror account:", {
      name,
      email: normalizedEmail,
      phoneNumber,
      county,
      state,
      city,
      zipCode,
      paymentMethod,
      hasCriteriaResponses: !!criteriaResponses,
    });

    // ✅ CREATE JUROR - Send ALL fields
    const jurorId = await Juror.createJuror({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phoneNumber: phoneNumber.trim(),
      address1: address1?.trim() || null,
      address2: address2?.trim() || null,
      city: city?.trim() || null,
      county: county.trim(),
      state: state.trim().toUpperCase(),
      zipCode: zipCode?.trim() || null,
      paymentMethod: paymentMethod.toLowerCase(),
      criteriaResponses: criteriaResponses || null, // Already a JSON string from frontend
      userAgreementAccepted: true,
    });

    console.log(`✅ Juror created successfully with ID: ${jurorId}`);

    // ✅ GENERATE JWT
    const token = generateJWT({ id: jurorId, email: normalizedEmail }, "juror");

    // ✅ SUCCESS RESPONSE
    return res.status(201).json({
      success: true,
      message: "Juror account created successfully",
      token,
      user: {
        id: jurorId,
        email: normalizedEmail,
        name,
        type: "juror",
        county,
        state,
        verified: false,
        verificationStatus: "pending",
        onboardingCompleted: false,
      },
    });
  } catch (error) {
    console.error("❌ [Juror.signup] Error:", error);
    console.error("Stack trace:", error.stack);

    // ✅ DETAILED ERROR RESPONSE
    return res.status(500).json({
      success: false,
      error: "Failed to create account",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Juror login with brute force protection
 */
async function jurorLogin(req, res) {
  try {
    const { email, password, timezoneOffset } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
        code: "MISSING_CREDENTIALS",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Check failed login attempts
    const failedAttempts = await LoginAttempts.getRecentFailedAttempts(
      normalizedEmail,
      "juror",
      LOGIN_LOCKOUT_MINUTES
    );

    // If account is locked due to too many failed attempts
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      const unlockTime = await LoginAttempts.getAccountLockoutTime(
        normalizedEmail,
        "juror",
        LOGIN_LOCKOUT_MINUTES
      );

      const now = new Date();
      const minutesRemaining = Math.ceil((new Date(unlockTime) - now) / 60000);

      return res.status(429).json({
        success: false,
        error: `Account temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`,
        code: "ACCOUNT_LOCKED",
        minutesRemaining,
      });
    }

    // Find juror
    const juror = await Juror.findByEmail(normalizedEmail);
    if (!juror) {
      // Record failed attempt
      await LoginAttempts.recordFailedAttempt(normalizedEmail, "juror", ipAddress);

      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Check if account is active
    if (!juror.IsActive) {
      return res.status(403).json({
        success: false,
        error: "Your account has been deactivated. Please contact support.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, juror.PasswordHash);
    if (!isValidPassword) {
      // Record failed attempt
      await LoginAttempts.recordFailedAttempt(normalizedEmail, "juror", ipAddress);

      const newFailedAttempts = failedAttempts + 1;
      const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newFailedAttempts;

      // If this was the last allowed attempt, inform user about lockout
      if (attemptsRemaining <= 0) {
        return res.status(401).json({
          success: false,
          error: `Invalid email or password. Account locked for ${LOGIN_LOCKOUT_MINUTES} minutes due to too many failed attempts.`,
          code: "INVALID_CREDENTIALS",
        });
      }

      // Show warning about remaining attempts
      return res.status(401).json({
        success: false,
        error: `Invalid email or password. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining before account lockout.`,
        code: "INVALID_CREDENTIALS",
        attemptsRemaining,
      });
    }

    // Clear failed login attempts on successful login
    await LoginAttempts.clearFailedAttempts(normalizedEmail, "juror");

    // Update last login
    await Juror.updateLastLogin(juror.JurorId);

    // Update timezone offset if provided
    if (timezoneOffset !== undefined && timezoneOffset !== null) {
      try {
        await Juror.updateTimezoneOffset(juror.JurorId, timezoneOffset);
        console.log(`🌍 Juror ${juror.JurorId} timezone updated: ${timezoneOffset} minutes from UTC`);
      } catch (tzError) {
        // Don't fail login if timezone update fails, just log the error
        console.error('⚠️ Failed to update juror timezone offset:', tzError);
      }
    }

    // Generate JWT
    const token = generateJWT(
      { id: juror.JurorId, email: juror.Email },
      "juror"
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: juror.JurorId,
        email: juror.Email,
        name: juror.Name,
        county: juror.County,
        state: juror.State,
        type: "juror",
        verified: juror.IsVerified,
        verificationStatus: juror.VerificationStatus,
        onboardingCompleted: juror.OnboardingCompleted,
      },
    });
  } catch (error) {
    console.error("❌ [Juror.login] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Login failed",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Send OTP to juror email
 */
async function sendJurorOTP(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
        code: "EMAIL_REQUIRED",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit
    const rateCheck = checkOTPRateLimit(normalizedEmail);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: rateCheck.message,
        code: "RATE_LIMIT_EXCEEDED",
      });
    }

    // Check if email is already registered
    const existing = await Juror.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists",
        code: "EMAIL_EXISTS",
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(normalizedEmail, otp);

    // Send OTP email
    await sendOTPEmail(normalizedEmail, otp, "juror");

    return res.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    console.error("❌ [Juror.sendOTP] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to send verification code",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Verify Juror Email OTP
 */
async function verifyJurorOTP(req, res) {
  try {
    const { email, otp } = req.body;

    console.log("🔐 Juror OTP Verification Request:", { email, otp });

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // ✅ CRITICAL: Use in-memory OTP store, NOT database
    const verification = verifyOTPCode(email, otp);

    console.log("📝 OTP Verification Result:", verification);

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.error,
      });
    }

    console.log(`✅ Juror email verified: ${email}`);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("❌ OTP Verification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
    });
  }
}

/**
 * Send email verification link to juror
 */
async function sendJurorEmailVerification(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
        code: "EMAIL_REQUIRED",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find juror
    const juror = await Juror.findByEmail(normalizedEmail);
    if (!juror) {
      return res.status(404).json({
        success: false,
        error: "Juror not found",
        code: "JUROR_NOT_FOUND",
      });
    }

    if (juror.IsVerified) {
      return res.status(400).json({
        success: false,
        error: "Email is already verified",
        code: "ALREADY_VERIFIED",
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&type=juror`;

    // Send verification email
    await sendEmailVerification(normalizedEmail, verificationLink, "juror");

    return res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("❌ [Juror.sendEmailVerification] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to send verification email",
      code: "INTERNAL_ERROR",
    });
  }
}

/* ===========================================================
   ADMIN AUTHENTICATION
   =========================================================== */

/**
 * Admin login
 */
async function adminLogin(req, res) {
  try {
    const { email, password, timezoneOffset } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
        code: "MISSING_CREDENTIALS",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Check failed login attempts
    const failedAttempts = await LoginAttempts.getRecentFailedAttempts(
      normalizedEmail,
      "admin",
      LOGIN_LOCKOUT_MINUTES
    );

    // If account is locked due to too many failed attempts
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      const unlockTime = await LoginAttempts.getAccountLockoutTime(
        normalizedEmail,
        "admin",
        LOGIN_LOCKOUT_MINUTES
      );

      const now = new Date();
      const minutesRemaining = Math.ceil((new Date(unlockTime) - now) / 60000);

      return res.status(429).json({
        success: false,
        error: `Account temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`,
        code: "ACCOUNT_LOCKED",
        minutesRemaining,
      });
    }

    // Find admin
    const admin = await Admin.findByEmail(normalizedEmail);
    if (!admin) {
      // Record failed attempt
      await LoginAttempts.recordFailedAttempt(normalizedEmail, "admin", ipAddress);

      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Check if account is active
    if (!admin.IsActive) {
      return res.status(403).json({
        success: false,
        error: "Admin account is inactive. Please contact support.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.PasswordHash);
    if (!isValidPassword) {
      // Record failed attempt
      await LoginAttempts.recordFailedAttempt(normalizedEmail, "admin", ipAddress);

      const newFailedAttempts = failedAttempts + 1;
      const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newFailedAttempts;

      // If this was the last allowed attempt, inform user about lockout
      if (attemptsRemaining <= 0) {
        return res.status(401).json({
          success: false,
          error: `Invalid email or password. Account locked for ${LOGIN_LOCKOUT_MINUTES} minutes due to too many failed attempts.`,
          code: "INVALID_CREDENTIALS",
        });
      }

      // Show warning about remaining attempts
      return res.status(401).json({
        success: false,
        error: `Invalid email or password. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining before account lockout.`,
        code: "INVALID_CREDENTIALS",
        attemptsRemaining,
      });
    }

    // Clear failed login attempts on successful login
    await LoginAttempts.clearFailedAttempts(normalizedEmail, "admin");

    // Update last login
    await Admin.updateLastLogin(admin.AdminId);

    // Update timezone offset if provided
    if (timezoneOffset !== undefined && timezoneOffset !== null) {
      try {
        await Admin.updateTimezoneOffset(admin.AdminId, timezoneOffset);
        console.log(`🌍 Admin ${admin.AdminId} timezone updated: ${timezoneOffset} minutes from UTC`);
      } catch (tzError) {
        // Don't fail login if timezone update fails, just log the error
        console.error('⚠️ Failed to update admin timezone offset:', tzError);
      }
    }

    // Generate JWT
    const token = generateJWT(
      { id: admin.AdminId, email: admin.Email },
      "admin"
    );

    return res.json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: admin.AdminId,
        email: admin.Email,
        username: admin.Username,
        firstName: admin.FirstName,
        lastName: admin.LastName,
        type: "admin",
        role: admin.Role,
      },
    });
  } catch (error) {
    console.error("❌ [Admin.login] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Login failed",
      code: "INTERNAL_ERROR",
    });
  }
}

/* ===========================================================
   PASSWORD RESET - OTP BASED
   =========================================================== */

/**
 * Request password reset - Send OTP to email
 */
async function requestPasswordReset(req, res) {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        error: "Email and user type are required",
        code: "MISSING_FIELDS",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit
    const rateCheck = checkOTPRateLimit(normalizedEmail);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: rateCheck.message,
        code: "RATE_LIMIT_EXCEEDED",
      });
    }

    // Find user
    let user = null;
    if (userType === "attorney") {
      user = await Attorney.findByEmail(normalizedEmail);
    } else if (userType === "juror") {
      user = await Juror.findByEmail(normalizedEmail);
    }

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message:
          "If an account exists with this email, a verification code has been sent",
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    const otpKey = `reset_${normalizedEmail}_${userType}`; // Different key to avoid conflicts with signup OTP

    otpStore.set(otpKey, {
      otp,
      email: normalizedEmail,
      userType,
      userId: user.AttorneyId || user.JurorId,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    });

    console.log(`✅ Password reset OTP generated for ${normalizedEmail}: ${otp}`);

    // Send OTP email (reusing the sendOTPEmail function)
    await sendOTPEmail(normalizedEmail, otp, userType);

    return res.json({
      success: true,
      message:
        "If an account exists with this email, a verification code has been sent",
    });
  } catch (error) {
    console.error("❌ [Auth.requestPasswordReset] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process password reset request",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Verify password reset OTP
 */
async function verifyPasswordResetOTP(req, res) {
  try {
    const { email, otp, userType } = req.body;

    if (!email || !otp || !userType) {
      return res.status(400).json({
        success: false,
        error: "Email, verification code, and user type are required",
        code: "MISSING_FIELDS",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpKey = `reset_${normalizedEmail}_${userType}`;

    // Get OTP record
    const record = otpStore.get(otpKey);

    if (!record) {
      return res.status(400).json({
        success: false,
        error: "Verification code not found or expired",
        code: "OTP_NOT_FOUND",
      });
    }

    // Check if OTP expired
    if (Date.now() > record.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        success: false,
        error: "Verification code expired. Please request a new one",
        code: "OTP_EXPIRED",
      });
    }

    // Increment attempts
    record.attempts++;

    // Check max attempts
    if (record.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        success: false,
        error: "Too many incorrect attempts. Please request a new code",
        code: "TOO_MANY_ATTEMPTS",
      });
    }

    // Verify OTP
    if (record.otp !== otp) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code",
        code: "INVALID_OTP",
      });
    }

    console.log(`✅ Password reset OTP verified for ${normalizedEmail}`);

    // Mark OTP as verified (don't delete yet, needed for password reset)
    record.verified = true;
    otpStore.set(otpKey, record);

    return res.json({
      success: true,
      message: "Verification code verified successfully",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("❌ [Auth.verifyPasswordResetOTP] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to verify code",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Reset password with OTP
 */
async function resetPasswordWithOTP(req, res) {
  try {
    const { email, otp, newPassword, userType } = req.body;

    if (!email || !otp || !newPassword || !userType) {
      return res.status(400).json({
        success: false,
        error: "Email, verification code, password, and user type are required",
        code: "MISSING_FIELDS",
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
        code: "WEAK_PASSWORD",
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: "Password must contain uppercase, lowercase, and number",
        code: "WEAK_PASSWORD",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpKey = `reset_${normalizedEmail}_${userType}`;

    // Verify OTP
    const record = otpStore.get(otpKey);

    if (!record) {
      return res.status(400).json({
        success: false,
        error: "Verification code not found or expired",
        code: "OTP_NOT_FOUND",
      });
    }

    // Check if OTP expired
    if (Date.now() > record.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        success: false,
        error: "Verification code has expired. Please request a new one.",
        code: "OTP_EXPIRED",
      });
    }

    // Check if OTP was verified
    if (!record.verified || record.otp !== otp) {
      return res.status(400).json({
        success: false,
        error: "Invalid or unverified verification code",
        code: "INVALID_OTP",
      });
    }

    // Check if user type matches
    if (record.userType !== userType) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code for this user type",
        code: "INVALID_USER_TYPE",
      });
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password based on user type
    if (userType === "attorney") {
      await Attorney.updatePassword(record.userId, passwordHash);
    } else if (userType === "juror") {
      await Juror.updatePassword(record.userId, passwordHash);
    }

    // Delete OTP after successful password reset
    otpStore.delete(otpKey);

    console.log(`✅ Password reset successful for ${normalizedEmail}`);

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("❌ [Auth.resetPasswordWithOTP] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reset password",
      code: "INTERNAL_ERROR",
    });
  }
}

/* ===========================================================
   TOKEN VERIFICATION
   =========================================================== */

/**
 * Verify JWT token
 */
async function verifyToken(req, res) {
  try {
    const authHeader = req.headers.authorization || req.body.token;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
        code: "TOKEN_REQUIRED",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user = null;

    if (decoded.type === "attorney") {
      const attorney = await Attorney.findById(decoded.id);
      if (attorney) {
        user = {
          id: attorney.AttorneyId,
          email: attorney.Email,
          type: "attorney",
          verified: attorney.IsVerified,
        };
      }
    } else if (decoded.type === "juror") {
      const juror = await Juror.findById(decoded.id);
      if (juror) {
        user = {
          id: juror.JurorId,
          email: juror.Email,
          type: "juror",
          verified: juror.IsVerified,
        };
      }
    } else if (decoded.type === "admin") {
      const admin = await Admin.findById(decoded.id);
      if (admin) {
        user = {
          id: admin.AdminId,
          email: admin.Email,
          type: "admin",
          role: admin.Role,
        };
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        code: "INVALID_TOKEN",
      });
    }

    return res.json({
      success: true,
      valid: true,
      user,
    });
  } catch (error) {
    console.error("❌ [Auth.verifyToken] Error:", error);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
      code: "TOKEN_INVALID",
    });
  }
}

/**
 * Get current authenticated user
 */
async function getCurrentUser(req, res) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
        code: "NOT_AUTHENTICATED",
      });
    }

    let fullUser = null;

    if (user.type === "attorney") {
      const attorney = await Attorney.findById(user.id);
      if (attorney) {
        delete attorney.PasswordHash;
        fullUser = attorney;
      }
    } else if (user.type === "juror") {
      const juror = await Juror.findById(user.id);
      if (juror) {
        delete juror.PasswordHash;
        fullUser = juror;
      }
    } else if (user.type === "admin") {
      const admin = await Admin.findById(user.id);
      if (admin) {
        delete admin.PasswordHash;
        fullUser = admin;
      }
    }

    if (!fullUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    return res.json({
      success: true,
      user: fullUser,
    });
  } catch (error) {
    console.error("❌ [Auth.getCurrentUser] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get user",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Verify email verification token
 */
async function verifyEmailVerificationToken(req, res) {
  try {
    const { token, type } = req.query;

    if (!token || !type) {
      return res.status(400).json({
        success: false,
        error: "Token and type are required",
        code: "MISSING_FIELDS",
      });
    }

    // ✅ FIX: Implement actual email verification logic
    const { verifyEmailVerificationToken: verifyToken } = require("../utils/tokens");
    const { poolPromise, sql } = require("../config/db");

    // Verify the JWT token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (tokenError) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired verification token",
        code: "INVALID_TOKEN",
      });
    }

    if (!decoded.email || decoded.userType !== type) {
      return res.status(400).json({
        success: false,
        error: "Token data mismatch",
        code: "TOKEN_MISMATCH",
      });
    }

    // Update user's email verification status in database
    const pool = await poolPromise;
    const tableName = type === "attorney" ? "Attorneys" : type === "juror" ? "Jurors" : "Admins";

    const result = await pool
      .request()
      .input("email", sql.NVarChar, decoded.email)
      .query(`
        UPDATE dbo.${tableName}
        SET EmailVerified = 1,
            EmailVerifiedAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
        WHERE Email = @email AND (EmailVerified = 0 OR EmailVerified IS NULL)
      `);

    if (result.rowsAffected[0] === 0) {
      // Check if user exists but already verified
      const checkResult = await pool
        .request()
        .input("email", sql.NVarChar, decoded.email)
        .query(`SELECT EmailVerified FROM dbo.${tableName} WHERE Email = @email`);

      if (checkResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      if (checkResult.recordset[0].EmailVerified) {
        return res.json({
          success: true,
          message: "Email already verified",
          alreadyVerified: true,
        });
      }
    }

    console.log(`✅ Email verified for ${type}: ${decoded.email}`);

    return res.json({
      success: true,
      message: "Email verified successfully",
      alreadyVerified: false,
    });
  } catch (error) {
    console.error("❌ [Auth.verifyEmailToken] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to verify email",
      code: "INTERNAL_ERROR",
    });
  }
}

/* ===========================================================
   PROFILE PASSWORD CHANGE - OTP VERIFICATION
   =========================================================== */

/**
 * Send OTP for authenticated user (for password change)
 * This is different from signup OTP - it's for already authenticated users
 */
async function sendAuthenticatedOTP(req, res) {
  try {
    const user = req.user; // From auth middleware

    if (!user || !user.email) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
        code: "NOT_AUTHENTICATED",
      });
    }

    const normalizedEmail = user.email.toLowerCase().trim();

    // Check rate limit
    const rateCheck = checkOTPRateLimit(normalizedEmail);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: rateCheck.message,
        code: "RATE_LIMIT_EXCEEDED",
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    const otpKey = `profile_change_${normalizedEmail}_${user.type}`; // Different key for profile changes

    otpStore.set(otpKey, {
      otp,
      email: normalizedEmail,
      userType: user.type,
      userId: user.id,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    });

    console.log(`✅ Profile change OTP generated for ${normalizedEmail}: ${otp}`);

    // Send OTP email
    await sendOTPEmail(normalizedEmail, otp, user.type);

    return res.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    console.error("❌ [Auth.sendAuthenticatedOTP] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to send verification code",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Verify OTP for authenticated user (for password change)
 */
async function verifyAuthenticatedOTP(req, res) {
  try {
    const user = req.user; // From auth middleware
    const { otp } = req.body;

    if (!user || !user.email) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
        code: "NOT_AUTHENTICATED",
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        error: "OTP is required",
        code: "OTP_REQUIRED",
      });
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    const otpKey = `profile_change_${normalizedEmail}_${user.type}`;

    // Get OTP record
    const record = otpStore.get(otpKey);

    if (!record) {
      return res.status(400).json({
        success: false,
        error: "Verification code not found or expired",
        code: "OTP_NOT_FOUND",
      });
    }

    // Check if OTP expired
    if (Date.now() > record.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        success: false,
        error: "Verification code expired. Please request a new one",
        code: "OTP_EXPIRED",
      });
    }

    // Increment attempts
    record.attempts++;

    // Check max attempts
    if (record.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        success: false,
        error: "Too many incorrect attempts. Please request a new code",
        code: "TOO_MANY_ATTEMPTS",
      });
    }

    // Verify OTP
    if (record.otp !== otp.toString().trim()) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code",
        code: "INVALID_OTP",
      });
    }

    // Delete OTP after successful verification
    otpStore.delete(otpKey);

    console.log(`✅ Profile change OTP verified for ${normalizedEmail}`);

    return res.json({
      success: true,
      message: "Verification code verified successfully",
    });
  } catch (error) {
    console.error("❌ [Auth.verifyAuthenticatedOTP] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to verify code",
      code: "INTERNAL_ERROR",
    });
  }
}

/* ===========================================================
   EXPORTS
   =========================================================== */

module.exports = {
  // Attorney
  attorneySignup,
  attorneyLogin,
  sendAttorneyOTP,
  verifyAttorneyOTP,
  sendAttorneyEmailVerification,

  // Juror
  jurorSignup,
  jurorLogin,
  sendJurorOTP,
  verifyJurorOTP,
  sendJurorEmailVerification,

  // Admin
  adminLogin,

  // Password Reset (OTP-based)
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPasswordWithOTP,

  // Verification
  verifyToken,
  getCurrentUser,
  verifyEmailVerificationToken,

  // Authenticated OTP (for profile password changes)
  sendAuthenticatedOTP,
  verifyAuthenticatedOTP,
};
