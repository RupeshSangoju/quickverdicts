// =============================================
// emailVerification.js - Email Verification Utilities
// FIXED: Added validation, caching, rate limiting, retry logic
// NOTE: Renamed from password.js to reflect actual functionality
// =============================================

const axios = require("axios");

// ============================================
// CONFIGURATION
// ============================================

const EMAIL_VERIFICATION_CONFIG = {
  API_URL: process.env.EMAIL_VERIFICATION_API_URL,
  API_KEY: process.env.EMAIL_VERIFICATION_API_KEY,
  METHOD: (process.env.EMAIL_VERIFICATION_METHOD || "generic").toLowerCase(),
  STRICT:
    String(process.env.EMAIL_VERIFICATION_STRICT || "false").toLowerCase() ===
    "true",
  TIMEOUT: parseInt(process.env.EMAIL_VERIFICATION_TIMEOUT || "5000", 10), // 5 seconds default
  CACHE_TTL: parseInt(
    process.env.EMAIL_VERIFICATION_CACHE_TTL || "3600000",
    10
  ), // 1 hour default
  MAX_RETRIES: 2,
  ENABLED:
    String(process.env.EMAIL_VERIFICATION_ENABLED || "false").toLowerCase() ===
    "true",
};

// Log configuration status on startup
if (EMAIL_VERIFICATION_CONFIG.ENABLED) {
  if (
    !EMAIL_VERIFICATION_CONFIG.API_URL ||
    !EMAIL_VERIFICATION_CONFIG.API_KEY
  ) {
    console.warn(
      "⚠️ Email verification enabled but API_URL or API_KEY not configured"
    );
    EMAIL_VERIFICATION_CONFIG.ENABLED = false;
  } else {
    console.log(
      `✅ Email verification enabled (Method: ${EMAIL_VERIFICATION_CONFIG.METHOD})`
    );
  }
} else {
  console.log("ℹ️ Email verification disabled (fail-open mode)");
}

// ============================================
// CACHING
// ============================================

const verificationCache = new Map();

/**
 * Get cached verification result
 */
function getCachedResult(email) {
  const cached = verificationCache.get(email.toLowerCase());

  if (!cached) {
    return null;
  }

  // Check if expired
  if (Date.now() - cached.timestamp > EMAIL_VERIFICATION_CONFIG.CACHE_TTL) {
    verificationCache.delete(email.toLowerCase());
    return null;
  }

  return cached.result;
}

/**
 * Cache verification result
 */
function setCachedResult(email, result) {
  verificationCache.set(email.toLowerCase(), {
    result,
    timestamp: Date.now(),
  });

  // Limit cache size to prevent memory issues
  if (verificationCache.size > 10000) {
    // Remove oldest 1000 entries
    const entries = Array.from(verificationCache.entries());
    entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 1000)
      .forEach(([key]) => verificationCache.delete(key));
  }
}

/**
 * Clear verification cache
 */
function clearVerificationCache() {
  verificationCache.clear();
  console.log("✅ Email verification cache cleared");
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate email format
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
 * Basic email format validation (fast, no API)
 */
function isValidEmailFormat(email) {
  try {
    validateEmail(email);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// API VERIFICATION METHODS
// ============================================

/**
 * Parse Abstract API response
 */
function parseAbstractResponse(data, strict) {
  // If explicit invalid format
  if (
    typeof data?.is_valid_format?.value !== "undefined" &&
    !data.is_valid_format.value
  ) {
    return { exists: false, reason: "invalid_format", confidence: "high" };
  }

  // Strongest: SMTP validity
  if (typeof data?.is_smtp_valid?.value !== "undefined") {
    const exists = Boolean(data.is_smtp_valid.value);
    return {
      exists,
      reason: exists ? "smtp_valid" : "smtp_invalid",
      confidence: "high",
    };
  }

  // Explicit deliverability
  if (typeof data?.deliverability !== "undefined") {
    const exists = data.deliverability === "DELIVERABLE";
    return {
      exists,
      reason: data.deliverability.toLowerCase(),
      confidence: "high",
    };
  }

  // MX record present
  if (typeof data?.is_mx_found?.value !== "undefined") {
    const exists = Boolean(data.is_mx_found.value);
    return {
      exists: exists || !strict,
      reason: exists ? "mx_found" : "no_mx_record",
      confidence: "medium",
    };
  }

  // Reputation score (0..1)
  if (typeof data?.score !== "undefined") {
    const threshold = strict ? 0.7 : 0.3;
    const score = Number(data.score);
    const exists = score >= threshold;
    return {
      exists,
      reason: `score_${exists ? "pass" : "fail"}`,
      confidence: "medium",
      score,
    };
  }

  // Unknown shape
  return {
    exists: !strict,
    reason: "unknown_response",
    confidence: "low",
  };
}

/**
 * Parse MailboxLayer API response
 */
function parseMailboxLayerResponse(data) {
  const smtpCheck = Boolean(data?.smtp_check);
  return {
    exists: smtpCheck,
    reason: smtpCheck ? "smtp_valid" : "smtp_invalid",
    confidence: "high",
  };
}

/**
 * Parse Hunter API response
 */
function parseHunterResponse(data) {
  const status = data?.data?.status;
  const exists = status === "valid";
  return {
    exists,
    reason: status || "unknown",
    confidence: status ? "high" : "low",
  };
}

/**
 * Parse ZeroBounce API response
 */
function parseZeroBounceResponse(data) {
  const status = data?.status;
  const exists = status === "valid";
  return {
    exists,
    reason: status || "unknown",
    confidence: status ? "high" : "low",
  };
}

/**
 * Parse generic API response
 */
function parseGenericResponse(data) {
  // Try common flags
  if (typeof data?.smtp_check !== "undefined") {
    const exists = Boolean(data.smtp_check);
    return { exists, reason: "smtp_check", confidence: "high" };
  }

  if (typeof data?.deliverable !== "undefined") {
    const exists = Boolean(data.deliverable);
    return { exists, reason: "deliverable", confidence: "high" };
  }

  if (typeof data?.is_valid !== "undefined") {
    const exists = Boolean(data.is_valid);
    return { exists, reason: "is_valid", confidence: "medium" };
  }

  // Unknown shape - fail open
  return { exists: true, reason: "unknown_response", confidence: "low" };
}

// ============================================
// EMAIL VERIFICATION
// ============================================

/**
 * Check if an email address exists using third-party API
 * FIXED: Added validation, caching, retry logic, better error handling
 *
 * @param {string} email - Email address to verify
 * @param {Object} options - Verification options
 * @param {boolean} options.useCache - Use cached results (default: true)
 * @param {boolean} options.throwOnError - Throw error on API failure (default: false)
 * @returns {Promise<Object>} Verification result with exists, reason, confidence
 */
async function checkEmailExists(email, options = {}) {
  const useCache = options.useCache !== false;
  const throwOnError = options.throwOnError === true;

  try {
    // Validate email format
    const validEmail = validateEmail(email);

    // Check if verification is enabled
    if (!EMAIL_VERIFICATION_CONFIG.ENABLED) {
      return {
        exists: true,
        reason: "verification_disabled",
        confidence: "none",
        cached: false,
      };
    }

    // Check cache
    if (useCache) {
      const cached = getCachedResult(validEmail);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // Make API request with retry
    let lastError;
    for (
      let attempt = 1;
      attempt <= EMAIL_VERIFICATION_CONFIG.MAX_RETRIES;
      attempt++
    ) {
      try {
        const response = await axios.get(EMAIL_VERIFICATION_CONFIG.API_URL, {
          params: {
            api_key: EMAIL_VERIFICATION_CONFIG.API_KEY,
            email: validEmail,
          },
          timeout: EMAIL_VERIFICATION_CONFIG.TIMEOUT,
          headers: {
            "User-Agent": "QuickVerdicts/1.0",
          },
        });

        // Parse response based on method
        let result;
        const method = EMAIL_VERIFICATION_CONFIG.METHOD;

        switch (method) {
          case "abstract":
            result = parseAbstractResponse(
              response.data,
              EMAIL_VERIFICATION_CONFIG.STRICT
            );
            break;
          case "mailboxlayer":
            result = parseMailboxLayerResponse(response.data);
            break;
          case "hunter":
            result = parseHunterResponse(response.data);
            break;
          case "zerobounce":
            result = parseZeroBounceResponse(response.data);
            break;
          case "generic":
          default:
            result = parseGenericResponse(response.data);
            break;
        }

        // Add metadata
        result.cached = false;
        result.verifiedAt = new Date().toISOString();

        // Cache result
        if (useCache) {
          setCachedResult(validEmail, result);
        }

        console.log(
          `✅ Email verification: ${validEmail} - ${
            result.exists ? "EXISTS" : "NOT FOUND"
          } (${result.reason})`
        );
        return result;
      } catch (error) {
        lastError = error;

        // Don't retry on 4xx errors (except 429)
        if (
          error.response?.status >= 400 &&
          error.response?.status < 500 &&
          error.response?.status !== 429
        ) {
          break;
        }

        if (attempt < EMAIL_VERIFICATION_CONFIG.MAX_RETRIES) {
          console.warn(
            `⚠️ Email verification attempt ${attempt} failed, retrying...`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All attempts failed
    throw lastError;
  } catch (error) {
    console.error("❌ Email verification error:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });

    if (throwOnError) {
      throw error;
    }

    // Fail-open to avoid blocking signups
    // Frontend still requires email link verification
    return {
      exists: true,
      reason: "verification_failed",
      confidence: "none",
      error: error.message,
      cached: false,
    };
  }
}

/**
 * Batch verify multiple emails
 * NEW: Added batch verification with rate limiting
 *
 * @param {string[]} emails - Array of email addresses
 * @param {number} batchSize - Number of concurrent requests (default: 3)
 * @returns {Promise<Map>} Map of email to verification result
 */
async function checkEmailsBatch(emails, batchSize = 3) {
  const results = new Map();

  // Validate all emails first
  const validEmails = [];
  for (const email of emails) {
    try {
      validEmails.push(validateEmail(email));
    } catch (error) {
      results.set(email, {
        exists: false,
        reason: "invalid_format",
        confidence: "high",
        error: error.message,
      });
    }
  }

  // Process in batches
  for (let i = 0; i < validEmails.length; i += batchSize) {
    const batch = validEmails.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((email) => checkEmailExists(email))
    );

    batch.forEach((email, index) => {
      results.set(email, batchResults[index]);
    });

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < validEmails.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Quick validation without API call
 * NEW: Fast validation for real-time UI feedback
 *
 * @param {string} email - Email address
 * @returns {Object} Basic validation result
 */
function quickValidate(email) {
  try {
    const validEmail = validateEmail(email);

    // Check for disposable email domains
    const disposableDomains = [
      "tempmail.com",
      "guerrillamail.com",
      "10minutemail.com",
      "throwaway.email",
      "mailinator.com",
      "maildrop.cc",
    ];

    const domain = validEmail.split("@")[1];
    const isDisposable = disposableDomains.includes(domain);

    return {
      valid: true,
      email: validEmail,
      isDisposable,
      warning: isDisposable ? "Disposable email address" : null,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Get verification statistics
 * NEW: Added metrics tracking
 */
function getVerificationStats() {
  return {
    cacheSize: verificationCache.size,
    cacheTTL: EMAIL_VERIFICATION_CONFIG.CACHE_TTL,
    enabled: EMAIL_VERIFICATION_CONFIG.ENABLED,
    method: EMAIL_VERIFICATION_CONFIG.METHOD,
    strict: EMAIL_VERIFICATION_CONFIG.STRICT,
  };
}

/**
 * Test verification API configuration
 * NEW: Added configuration test
 */
async function testVerificationConfig() {
  if (!EMAIL_VERIFICATION_CONFIG.ENABLED) {
    return {
      success: false,
      message: "Email verification is disabled",
    };
  }

  if (
    !EMAIL_VERIFICATION_CONFIG.API_URL ||
    !EMAIL_VERIFICATION_CONFIG.API_KEY
  ) {
    return {
      success: false,
      message: "API URL or API KEY not configured",
    };
  }

  try {
    // Test with a known good email
    const result = await checkEmailExists("test@example.com", {
      useCache: false,
      throwOnError: true,
    });

    return {
      success: true,
      message: "Email verification API is working",
      testResult: result,
    };
  } catch (error) {
    return {
      success: false,
      message: `API test failed: ${error.message}`,
      error: error.message,
    };
  }
}

// ============================================
// CLEANUP
// ============================================

/**
 * Periodic cache cleanup
 */
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [email, cached] of verificationCache.entries()) {
    if (now - cached.timestamp > EMAIL_VERIFICATION_CONFIG.CACHE_TTL) {
      verificationCache.delete(email);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(
      `🧹 Cleaned ${cleaned} expired email verification cache entries`
    );
  }
}, 60 * 60 * 1000); // Run every hour

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Main functions
  checkEmailExists,
  checkEmailsBatch,
  quickValidate,

  // Utilities
  isValidEmailFormat,
  validateEmail,

  // Cache management
  getCachedResult,
  setCachedResult,
  clearVerificationCache,

  // Stats & testing
  getVerificationStats,
  testVerificationConfig,

  // Configuration (read-only)
  config: { ...EMAIL_VERIFICATION_CONFIG },
};
