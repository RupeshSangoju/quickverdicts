// =============================================
// email.js - Email Service Utilities
// FIXED: Added validation, caching, retry logic, security
// =============================================

const nodemailer = require("nodemailer");
const { createEmailVerificationToken } = require("./tokens");

// ============================================
// CONFIGURATION & VALIDATION
// ============================================

const EMAIL_CONFIG = {
  FROM_NAME: "Quick Verdicts",
  FROM_EMAIL: process.env.EMAIL_USER,
  FRONTEND_URL: process.env.FRONTEND_URL,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  TIMEOUT: 30000, // 30 seconds
};

// Validate required environment variables
if (!process.env.FRONTEND_URL) {
  console.error("CRITICAL: FRONTEND_URL not configured");
  throw new Error("FRONTEND_URL environment variable is required");
}

if (process.env.NODE_ENV === "production") {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.error("CRITICAL: Email credentials not configured for production");
    throw new Error("EMAIL_USER and EMAIL_APP_PASSWORD required in production");
  }
}

// ============================================
// TRANSPORTER CACHING
// ============================================

let cachedTransporter = null;
let transporterPromise = null;

/**
 * Create or get cached email transporter
 * FIXED: Added caching to avoid creating new connections
 */
async function getTransporter() {
  // Return cached transporter if available
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // Wait for existing transporter creation if in progress
  if (transporterPromise) {
    return transporterPromise;
  }

  // Create new transporter
  transporterPromise = createTransporter();

  try {
    cachedTransporter = await transporterPromise;
    transporterPromise = null;
    return cachedTransporter;
  } catch (error) {
    transporterPromise = null;
    throw error;
  }
}

/**
 * Create transporter for sending emails
 * FIXED: Better error handling and configuration
 */
async function createTransporter() {
  try {
    if (process.env.NODE_ENV === "production") {
      // Production: Use Gmail with consistent environment variables
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD,
        },
        pool: true, // Use pooled connections
        maxConnections: 5,
        maxMessages: 100,
      });

      // Verify configuration
      await transporter.verify();
      console.log("✅ Production email transporter created and verified");
      return transporter;
    } else {
      // Development: prefer Gmail if provided, otherwise use Ethereal test account
      if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
          },
          pool: true,
        });

        await transporter.verify();
        console.log("✅ Development email transporter created (Gmail)");
        return transporter;
      }

      // Fallback to Ethereal for testing
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      console.log(
        "⚠️ Development email transporter created (Ethereal test account)"
      );
      console.log(`Preview URL: https://ethereal.email`);
      return transporter;
    }
  } catch (error) {
    console.error("❌ Failed to create email transporter:", error.message);
    throw new Error(`Email configuration failed: ${error.message}`);
  }
}

/**
 * Clear cached transporter (useful for testing or config changes)
 */
function clearTransporterCache() {
  if (cachedTransporter) {
    cachedTransporter.close();
    cachedTransporter = null;
  }
  transporterPromise = null;
  console.log("✅ Email transporter cache cleared");
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validate email address format
 */
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    throw new Error("Valid email address is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  if (email.length > 255) {
    throw new Error("Email address too long (max 255 characters)");
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
 * Sanitize HTML content to prevent XSS
 */
function sanitizeHTML(text) {
  if (!text) return "";

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validate token format
 */
function validateToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Valid token is required");
  }

  if (token.length < 10 || token.length > 500) {
    throw new Error("Invalid token format");
  }

  return token;
}

/**
 * Validate OTP
 */
function validateOTP(otp) {
  if (!otp || typeof otp !== "string") {
    throw new Error("Valid OTP is required");
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new Error("OTP must be 6 digits");
  }

  return otp;
}

// ============================================
// EMAIL SENDING WITH RETRY
// ============================================

/**
 * Send email with retry logic
 * FIXED: Added retry mechanism for transient failures
 */
async function sendEmailWithRetry(
  mailOptions,
  retries = EMAIL_CONFIG.MAX_RETRIES
) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const transporter = await getTransporter();
      const info = await transporter.sendMail(mailOptions);

      // Log success
      console.log(`✅ Email sent successfully (attempt ${attempt}):`, {
        messageId: info.messageId,
        to: mailOptions.to,
        subject: mailOptions.subject,
      });

      // Preview URL for Ethereal (development)
      if (process.env.NODE_ENV !== "production" && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(`📧 Preview URL: ${previewUrl}`);
        }
      }

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      lastError = error;

      // Don't retry on authentication or configuration errors
      if (error.code === "EAUTH" || error.code === "ESOCKET") {
        console.error(`❌ Email configuration error:`, error.message);
        throw error;
      }

      if (attempt < retries) {
        console.warn(
          `⚠️ Email send attempt ${attempt} failed, retrying in ${EMAIL_CONFIG.RETRY_DELAY}ms...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, EMAIL_CONFIG.RETRY_DELAY)
        );
      }
    }
  }

  console.error(
    `❌ Email failed after ${retries} attempts:`,
    lastError.message
  );
  return {
    success: false,
    error: lastError.message,
  };
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Base email template wrapper
 */
function wrapEmailTemplate(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quick Verdicts</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        ${content}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email header template
 */
function getEmailHeader() {
  return `
    <div style="background: #16305B; padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Quick Verdicts</h1>
    </div>
  `;
}

/**
 * Email footer template
 */
function getEmailFooter() {
  return `
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
      <p style="color: #666; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} Quick Verdicts. All rights reserved.
      </p>
      <p style="color: #999; font-size: 11px; margin: 10px 0 0 0;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `;
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

/**
 * Send password reset email
 * FIXED: Added validation and sanitization
 */
async function sendPasswordResetEmail(email, resetToken, userType) {
  try {
    // Validate inputs
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);
    const validToken = validateToken(resetToken);

    const resetLink = `${EMAIL_CONFIG.FRONTEND_URL}/reset-password?token=${validToken}&type=${validUserType}`;

    const content = `
      ${getEmailHeader()}
      <div style="padding: 40px;">
        <h2 style="color: #16305B; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #666; line-height: 1.6;">Hello,</p>
        <p style="color: #666; line-height: 1.6;">
          We received a request to reset your ${sanitizeHTML(
            validUserType
          )} account password.
        </p>
        <p style="color: #666; line-height: 1.6;">
          Click the button below to reset your password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="display: inline-block; background: #16305B; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #856404; margin: 0; font-size: 14px;">
            <strong>⏱️ Important:</strong> This link expires in 1 hour for security reasons.
          </p>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 5px; font-size: 12px; color: #666;">
          ${resetLink}
        </p>
        <p style="color: #999; font-size: 13px; margin-top: 30px;">
          If you didn't request this password reset, please ignore this email or contact support if you have concerns.
        </p>
      </div>
      ${getEmailFooter()}
    `;

    const mailOptions = {
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: validEmail,
      subject: "Quick Verdicts - Password Reset Request",
      html: wrapEmailTemplate(content),
    };

    const result = await sendEmailWithRetry(mailOptions);
    return result.success;
  } catch (error) {
    console.error("❌ Error sending password reset email:", error.message);
    return false;
  }
}

/**
 * Send email verification email
 * FIXED: Added validation and better template
 */
async function sendEmailVerification(email, verificationToken, userType) {
  try {
    // Validate inputs
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);
    const validToken = validateToken(verificationToken);

    const signupPath = validUserType === "attorney" ? "attorney" : "juror";
    const verificationLink = `${EMAIL_CONFIG.FRONTEND_URL}/signup/${signupPath}?verifyToken=${validToken}`;

    const content = `
      ${getEmailHeader()}
      <div style="padding: 40px;">
        <h2 style="color: #16305B; margin-top: 0;">Verify Your Email Address</h2>
        <p style="color: #666; line-height: 1.6;">
          Thank you for signing up as ${
            validUserType === "attorney" ? "an attorney" : "a juror"
          }!
        </p>
        <p style="color: #666; line-height: 1.6;">
          To complete your registration, please verify your email address by clicking the button below:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="display: inline-block; background: #16305B; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Email Address
          </a>
        </div>
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #856404; margin: 0; font-size: 14px;">
            <strong>⏱️ Important:</strong> This link expires in 24 hours.
          </p>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 5px; font-size: 12px; color: #666;">
          ${verificationLink}
        </p>
      </div>
      ${getEmailFooter()}
    `;

    const mailOptions = {
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: validEmail,
      subject: "Quick Verdicts - Please Verify Your Email Address",
      html: wrapEmailTemplate(content),
    };

    const result = await sendEmailWithRetry(mailOptions);
    return result.success;
  } catch (error) {
    console.error("❌ Error sending verification email:", error.message);
    return false;
  }
}

/**
 * Send OTP verification email
 * FIXED: Added validation and improved security notice
 */
async function sendOTPEmail(email, otp, userType) {
  try {
    // Validate inputs
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);
    const validOTP = validateOTP(otp);

    const content = `
      ${getEmailHeader()}
      <div style="padding: 40px;">
        <h2 style="color: #16305B; margin-top: 0;">Email Verification Code</h2>
        <p style="color: #666; line-height: 1.6;">
          Thank you for signing up as ${
            validUserType === "attorney" ? "an attorney" : "a juror"
          } on Quick Verdicts.
        </p>
        <p style="color: #666; line-height: 1.6;">
          Your verification code is:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background: #16305B; color: white; padding: 20px 40px; border-radius: 8px; font-size: 36px; font-weight: bold; letter-spacing: 10px;">
            ${validOTP}
          </div>
        </div>
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #856404; margin: 0; font-size: 14px;">
            <strong>⏱️ Important:</strong> This code expires in 10 minutes.
          </p>
        </div>
        <div style="background: #fee; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #991b1b; margin: 0; font-size: 14px;">
            <strong>🔒 Security Notice:</strong> Never share this code with anyone. Quick Verdicts staff will never ask for your verification code.
          </p>
        </div>
        <p style="color: #999; font-size: 13px; margin-top: 30px;">
          If you didn't request this code, please ignore this email.
        </p>
      </div>
      ${getEmailFooter()}
    `;

    const mailOptions = {
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: validEmail,
      subject: "Quick Verdicts - Email Verification Code",
      html: wrapEmailTemplate(content),
    };

    const result = await sendEmailWithRetry(mailOptions);
    return result.success;
  } catch (error) {
    console.error("❌ Error sending OTP email:", error.message);
    return false;
  }
}

/**
 * Send account declined notification email
 * FIXED: Added XSS protection for reason field
 */
async function sendAccountDeclinedEmail(email, userType, reason) {
  try {
    // Validate inputs
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);
    const sanitizedReason = reason ? sanitizeHTML(reason) : null;

    const content = `
      ${getEmailHeader()}
      <div style="padding: 40px;">
        <h2 style="color: #16305B; margin-top: 0;">Account Application Status</h2>
        <p style="color: #666; line-height: 1.6;">Hello,</p>
        <p style="color: #666; line-height: 1.6;">
          Thank you for your interest in joining Quick Verdicts as ${
            validUserType === "attorney" ? "an attorney" : "a juror"
          }.
        </p>
        <p style="color: #666; line-height: 1.6;">
          After reviewing your application, we regret to inform you that we are unable to approve your account at this time.
        </p>
        ${
          sanitizedReason
            ? `<div style="background: #fee; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #991b1b; margin: 0;"><strong>Reason:</strong></p>
                <p style="color: #991b1b; margin: 10px 0 0 0;">${sanitizedReason}</p>
              </div>`
            : ""
        }
        <p style="color: #666; line-height: 1.6;">
          If you believe this was an error or have questions, please contact our support team.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${
            EMAIL_CONFIG.FRONTEND_URL
          }/contact" style="display: inline-block; background: #16305B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Contact Support
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          Best regards,<br/>
          Quick Verdicts Team
        </p>
      </div>
      ${getEmailFooter()}
    `;

    const mailOptions = {
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: validEmail,
      subject: `Quick Verdicts - ${
        validUserType.charAt(0).toUpperCase() + validUserType.slice(1)
      } Account Status`,
      html: wrapEmailTemplate(content),
    };

    const result = await sendEmailWithRetry(mailOptions);
    return result.success;
  } catch (error) {
    console.error("❌ Error sending declined email:", error.message);
    return false;
  }
}

/**
 * Send account verified notification email
 * FIXED: Added validation and improved design
 */
async function sendAccountVerifiedEmail(email, userType) {
  try {
    // Validate inputs
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);

    const content = `
      ${getEmailHeader()}
      <div style="padding: 40px;">
        <h2 style="color: #16305B; margin-top: 0;">🎉 Account Verified!</h2>
        <p style="color: #666; line-height: 1.6;">Congratulations!</p>
        <p style="color: #666; line-height: 1.6;">
          Your ${validUserType} account has been successfully verified by our admin team.
        </p>
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="color: #16a34a; margin: 0; font-size: 18px;">
            <strong>✓ Account Status: Verified</strong>
          </p>
        </div>
        <p style="color: #666; line-height: 1.6;">
          You now have full access to all platform features. You can log in and start using Quick Verdicts.
        </p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${
            EMAIL_CONFIG.FRONTEND_URL
          }/login" style="display: inline-block; background: #16305B; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
            Login to Your Account
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          Thank you for joining Quick Verdicts!
        </p>
        <p style="color: #666; line-height: 1.6;">
          Best regards,<br/>
          Quick Verdicts Team
        </p>
      </div>
      ${getEmailFooter()}
    `;

    const mailOptions = {
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: validEmail,
      subject: `Quick Verdicts - ${
        validUserType.charAt(0).toUpperCase() + validUserType.slice(1)
      } Account Verified`,
      html: wrapEmailTemplate(content),
    };

    const result = await sendEmailWithRetry(mailOptions);
    return result.success;
  } catch (error) {
    console.error("❌ Error sending verified email:", error.message);
    return false;
  }
}

/**
 * High-level helper: create token and send verification email
 * FIXED: Added validation
 */
async function createAndSendEmailVerification(email, userType) {
  try {
    const validEmail = validateEmail(email);
    const validUserType = validateUserType(userType);

    const token = createEmailVerificationToken(validEmail, validUserType);
    const sent = await sendEmailVerification(validEmail, token, validUserType);

    return { token, sent };
  } catch (error) {
    console.error("❌ Error in createAndSendEmailVerification:", error.message);
    return { token: null, sent: false };
  }
}

/**
 * Test email configuration
 * FIXED: Better error reporting
 */
async function testEmailConfig() {
  try {
    console.log("🔧 Testing email configuration...");

    const transporter = await getTransporter();
    await transporter.verify();

    console.log("✅ Email configuration is valid");
    console.log(
      `   Provider: ${
        process.env.NODE_ENV === "production"
          ? "Gmail (Production)"
          : "Gmail/Ethereal (Development)"
      }`
    );
    console.log(`   From: ${EMAIL_CONFIG.FROM_EMAIL}`);

    return {
      success: true,
      provider:
        process.env.NODE_ENV === "production" ? "Gmail" : "Gmail/Ethereal",
      from: EMAIL_CONFIG.FROM_EMAIL,
    };
  } catch (error) {
    console.error("❌ Email configuration test failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send generic notification email
 * NEW: Added generic notification function
 */
async function sendNotificationEmail(email, subject, content) {
  try {
    const validEmail = validateEmail(email);

    if (!subject || subject.length > 200) {
      throw new Error("Valid subject required (max 200 characters)");
    }

    if (!content) {
      throw new Error("Email content is required");
    }

    const emailContent = `
      ${getEmailHeader()}
      <div style="padding: 40px;">
        ${content}
      </div>
      ${getEmailFooter()}
    `;

    const mailOptions = {
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: validEmail,
      subject: `Quick Verdicts - ${subject}`,
      html: wrapEmailTemplate(emailContent),
    };

    const result = await sendEmailWithRetry(mailOptions);
    return result.success;
  } catch (error) {
    console.error("❌ Error sending notification email:", error.message);
    return false;
  }
}

// ============================================
// CLEANUP
// ============================================

/**
 * Cleanup resources on shutdown
 */
function cleanup() {
  clearTransporterCache();
  console.log("✅ Email service cleanup complete");
}

// Cleanup on process exit
process.on("exit", cleanup);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core email functions
  sendPasswordResetEmail,
  sendEmailVerification,
  sendOTPEmail,
  sendAccountDeclinedEmail,
  sendAccountVerifiedEmail,
  sendNotificationEmail,

  // Helpers
  createAndSendEmailVerification,
  testEmailConfig,

  // Utilities
  validateEmail,
  sanitizeHTML,
  clearTransporterCache,

  // For testing
  getTransporter,
};
