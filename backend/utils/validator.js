// =============================================
// validator.js - Input Validation Utilities
// FIXED: Added better validation, security improvements
// NOTE: Renamed from password.js to reflect actual purpose
// =============================================

// ============================================
// PASSWORD VALIDATION
// ============================================

/**
 * Common weak passwords list
 */
const COMMON_PASSWORDS = [
  "password",
  "password123",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "monkey",
  "1234567",
  "letmein",
  "trustno1",
  "dragon",
  "baseball",
  "iloveyou",
  "master",
  "sunshine",
  "ashley",
  "bailey",
  "passw0rd",
  "shadow",
  "superman",
];

/**
 * Validate password according to requirements
 * FIXED: Added common password check, better validation
 *
 * @param {string} password - Password to validate
 * @param {string} firstName - User's first name
 * @param {string} lastName - User's last name
 * @param {string} email - User's email
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validatePassword(password, firstName, lastName, email) {
  if (!password) {
    return { isValid: false, error: "Password is required" };
  }

  if (typeof password !== "string") {
    return { isValid: false, error: "Password must be a string" };
  }

  // Check minimum length (8 characters)
  if (password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters long",
    };
  }

  // Check maximum length (prevent DoS)
  if (password.length > 128) {
    return { isValid: false, error: "Password cannot exceed 128 characters" };
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one number",
    };
  }

  // Check for at least one capital letter
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one capital letter",
    };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()[\]{};:'",.<>/?\\|`~_\-+=]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one special character (!@#$.–+,;)",
    };
  }

  // Check for no more than 2 consecutive identical characters
  if (/(.)\1\1/.test(password)) {
    return {
      isValid: false,
      error:
        "Password must not contain more than 2 consecutive identical characters",
    };
  }

  // Check for common weak passwords
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(lowerPassword)) {
    return {
      isValid: false,
      error: "This password is too common. Please choose a stronger password",
    };
  }

  // Check that password is not the same as account name (first + last name)
  if (firstName && lastName) {
    const accountName = `${firstName}${lastName}`.toLowerCase();
    if (lowerPassword === accountName) {
      return {
        isValid: false,
        error: "Password must not be the same as the account name",
      };
    }

    // Check if password contains first or last name
    if (
      firstName.length >= 3 &&
      lowerPassword.includes(firstName.toLowerCase())
    ) {
      return {
        isValid: false,
        error: "Password must not contain your first name",
      };
    }

    if (
      lastName.length >= 3 &&
      lowerPassword.includes(lastName.toLowerCase())
    ) {
      return {
        isValid: false,
        error: "Password must not contain your last name",
      };
    }
  }

  // Check that password is not the same as email
  if (email) {
    if (lowerPassword === email.toLowerCase()) {
      return {
        isValid: false,
        error: "Password must not be the same as the email address",
      };
    }

    // Check if password contains email username
    const emailUser = email.split("@")[0].toLowerCase();
    if (emailUser.length >= 3 && lowerPassword.includes(emailUser)) {
      return {
        isValid: false,
        error: "Password must not contain your email username",
      };
    }
  }

  // Check for sequential characters
  if (
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(
      password
    )
  ) {
    return {
      isValid: false,
      error: "Password must not contain sequential alphabetic characters",
    };
  }

  // Check for sequential numbers
  if (/(?:012|123|234|345|456|567|678|789|890)/.test(password)) {
    return {
      isValid: false,
      error: "Password must not contain sequential numbers",
    };
  }

  return { isValid: true, error: null };
}

/**
 * Calculate password strength (0-100)
 * NEW: Added password strength calculator
 */
function calculatePasswordStrength(password) {
  if (!password) return 0;

  let strength = 0;

  // Length score (max 25)
  strength += Math.min(password.length * 2, 25);

  // Character variety (max 40)
  if (/[a-z]/.test(password)) strength += 10; // lowercase
  if (/[A-Z]/.test(password)) strength += 10; // uppercase
  if (/\d/.test(password)) strength += 10; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) strength += 10; // special chars

  // Complexity bonus (max 35)
  const uniqueChars = new Set(password).size;
  strength += Math.min(uniqueChars, 20); // unique characters

  // Check for patterns (penalty)
  if (/(.)\1\1/.test(password)) strength -= 10; // repeated chars
  if (/(?:012|123|234|345|456|567|678|789)/.test(password)) strength -= 10; // sequential
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) strength -= 30; // common password

  return Math.max(0, Math.min(100, strength));
}

// ============================================
// EMAIL VALIDATION
// ============================================

/**
 * Disposable email domain list (common ones)
 */
const DISPOSABLE_DOMAINS = [
  "tempmail.com",
  "guerrillamail.com",
  "10minutemail.com",
  "throwaway.email",
  "mailinator.com",
  "maildrop.cc",
  "temp-mail.org",
  "fakeinbox.com",
  "trashmail.com",
];

/**
 * Validate email format
 * FIXED: Added disposable email check, better validation
 *
 * @param {string} email - Email to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateEmail(email, options = {}) {
  const allowDisposable = options.allowDisposable !== false;

  if (!email) {
    return { isValid: false, error: "Email is required" };
  }

  if (typeof email !== "string") {
    return { isValid: false, error: "Email must be a string" };
  }

  // Trim and lowercase
  const trimmedEmail = email.trim().toLowerCase();

  // Basic email regex pattern
  const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

  if (!emailPattern.test(trimmedEmail)) {
    return { isValid: false, error: "Please enter a valid email address" };
  }

  // Check for common invalid patterns
  if (
    trimmedEmail.includes("..") ||
    trimmedEmail.startsWith(".") ||
    trimmedEmail.endsWith(".")
  ) {
    return { isValid: false, error: "Please enter a valid email address" };
  }

  // Check for consecutive dots in domain
  const parts = trimmedEmail.split("@");
  if (parts.length !== 2) {
    return { isValid: false, error: "Please enter a valid email address" };
  }

  const [localPart, domain] = parts;

  // Validate local part length
  if (localPart.length === 0 || localPart.length > 64) {
    return { isValid: false, error: "Email local part (before @) is invalid" };
  }

  // Validate domain length
  if (domain.length === 0 || domain.length > 255) {
    return { isValid: false, error: "Email domain (after @) is invalid" };
  }

  // Check total length limits
  if (trimmedEmail.length > 254) {
    return { isValid: false, error: "Email address is too long" };
  }

  // Check for disposable email domains
  if (!allowDisposable && DISPOSABLE_DOMAINS.includes(domain)) {
    return {
      isValid: false,
      error: "Disposable email addresses are not allowed",
      isDisposable: true,
    };
  }

  // Check for suspicious patterns
  if (/test|fake|temp|dummy|spam/i.test(trimmedEmail)) {
    return {
      isValid: true,
      warning: "This email address looks suspicious",
      suspicious: true,
    };
  }

  return { isValid: true, error: null };
}

// ============================================
// PHONE NUMBER VALIDATION
// ============================================

/**
 * Validate phone number format
 * FIXED: Added international support, better formatting
 *
 * @param {string} phone - Phone number to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validatePhone(phone, options = {}) {
  const international = options.international === true;

  if (!phone) {
    return { isValid: false, error: "Phone number is required" };
  }

  if (typeof phone !== "string") {
    return { isValid: false, error: "Phone number must be a string" };
  }

  // Remove all non-numeric characters for validation
  const cleanPhone = phone.replace(/\D/g, "");

  if (cleanPhone.length === 0) {
    return { isValid: false, error: "Phone number cannot be empty" };
  }

  if (international) {
    // International format (7-15 digits)
    if (cleanPhone.length >= 7 && cleanPhone.length <= 15) {
      return { isValid: true, error: null, formatted: cleanPhone };
    }
    return {
      isValid: false,
      error: "Please enter a valid phone number (7-15 digits)",
    };
  }

  // US phone number validation (10 digits, or 11 digits starting with 1)
  if (cleanPhone.length === 10) {
    // Format: (XXX) XXX-XXXX
    const formatted = `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(
      3,
      6
    )}-${cleanPhone.slice(6)}`;
    return { isValid: true, error: null, formatted };
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) {
    // Format: +1 (XXX) XXX-XXXX
    const formatted = `+1 (${cleanPhone.slice(1, 4)}) ${cleanPhone.slice(
      4,
      7
    )}-${cleanPhone.slice(7)}`;
    return { isValid: true, error: null, formatted };
  } else {
    return {
      isValid: false,
      error: "Please enter a valid US phone number (10 digits)",
    };
  }
}

// ============================================
// GENERAL VALIDATION
// ============================================

/**
 * Validate required fields
 * FIXED: Better error messages, detailed feedback
 *
 * @param {Object} data - Data object to validate
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateRequiredFields(data, requiredFields) {
  if (!data || typeof data !== "object") {
    return {
      isValid: false,
      error: "Invalid data provided",
      missingFields: requiredFields,
    };
  }

  if (!Array.isArray(requiredFields)) {
    return {
      isValid: false,
      error: "Required fields must be an array",
    };
  }

  const missingFields = [];

  for (const field of requiredFields) {
    const value = data[field];

    if (value === undefined || value === null) {
      missingFields.push(field);
    } else if (typeof value === "string" && !value.trim()) {
      missingFields.push(field);
    } else if (Array.isArray(value) && value.length === 0) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    const fieldList = missingFields
      .map((f) => f.replace(/([A-Z])/g, " $1").trim())
      .join(", ");
    return {
      isValid: false,
      error: `Missing required fields: ${fieldList}`,
      missingFields,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate ZIP code format
 * FIXED: Added Canadian postal code support
 *
 * @param {string} zipCode - ZIP code to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateZipCode(zipCode, options = {}) {
  const country = options.country || "US";

  if (!zipCode) {
    return { isValid: false, error: "ZIP code is required" };
  }

  if (typeof zipCode !== "string") {
    return { isValid: false, error: "ZIP code must be a string" };
  }

  const trimmed = zipCode.trim();

  if (country === "US") {
    // US ZIP code pattern (5 digits or 5+4 format)
    const zipPattern = /^\d{5}(-\d{4})?$/;

    if (!zipPattern.test(trimmed)) {
      return {
        isValid: false,
        error: "Please enter a valid ZIP code (e.g., 12345 or 12345-6789)",
      };
    }

    return { isValid: true, error: null, formatted: trimmed };
  } else if (country === "CA") {
    // Canadian postal code pattern (A1A 1A1)
    const postalPattern = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

    if (!postalPattern.test(trimmed)) {
      return {
        isValid: false,
        error: "Please enter a valid postal code (e.g., A1A 1A1)",
      };
    }

    const formatted = trimmed.toUpperCase().replace(/(.{3})(.{3})/, "$1 $2");
    return { isValid: true, error: null, formatted };
  }

  return { isValid: false, error: "Unsupported country code" };
}

/**
 * Validate US state code
 * @param {string} state - State code to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateStateCode(state) {
  if (!state) {
    return { isValid: false, error: "State is required" };
  }

  if (typeof state !== "string") {
    return { isValid: false, error: "State must be a string" };
  }

  const validStates = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
    "DC",
    "AS",
    "GU",
    "MP",
    "PR",
    "VI",
  ];

  const stateCode = state.trim().toUpperCase();

  if (stateCode.length !== 2) {
    return {
      isValid: false,
      error: "State code must be 2 letters (e.g., TX, CA)",
    };
  }

  if (!validStates.includes(stateCode)) {
    return { isValid: false, error: "Please enter a valid US state code" };
  }

  return { isValid: true, error: null, state: stateCode };
}

// ============================================
// SANITIZATION
// ============================================

/**
 * Sanitize input string
 * FIXED: Better HTML/XSS prevention, SQL injection protection
 *
 * @param {string} input - Input string to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeInput(input, options = {}) {
  const maxLength = options.maxLength || 255;
  const allowHTML = options.allowHTML === true;

  if (typeof input !== "string") {
    return "";
  }

  let sanitized = input.trim();

  if (!allowHTML) {
    // Remove HTML tags
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<[^>]*>/g, "");

    // Encode special characters
    sanitized = sanitized
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Limit length
  sanitized = sanitized.substring(0, maxLength);

  return sanitized;
}

/**
 * Sanitize HTML for safe display
 * NEW: Added HTML sanitization
 */
function sanitizeHTML(html) {
  if (typeof html !== "string") {
    return "";
  }

  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;");
}

// ============================================
// NAME VALIDATION
// ============================================

/**
 * Validate name field
 * FIXED: Better character validation, international support
 *
 * @param {string} name - Name to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateName(name, fieldName = "Name", options = {}) {
  const minLength = options.minLength || 1;
  const maxLength = options.maxLength || 50;
  const allowNumbers = options.allowNumbers === true;

  if (!name || typeof name !== "string") {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const trimmedName = name.trim();

  // Check length
  if (trimmedName.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${minLength} character(s)`,
    };
  }

  if (trimmedName.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} cannot exceed ${maxLength} characters`,
    };
  }

  // Check for valid characters
  const namePattern = allowNumbers
    ? /^[a-zA-Z0-9\s\-'\.]+$/
    : /^[a-zA-Z\s\-'\.]+$/;

  if (!namePattern.test(trimmedName)) {
    const allowed = allowNumbers
      ? "letters, numbers, spaces, hyphens, apostrophes, and periods"
      : "letters, spaces, hyphens, apostrophes, and periods";
    return {
      isValid: false,
      error: `${fieldName} can only contain ${allowed}`,
    };
  }

  // Check for excessive special characters
  const specialCharCount = (trimmedName.match(/[-'.]/g) || []).length;
  if (specialCharCount > trimmedName.length / 2) {
    return {
      isValid: false,
      error: `${fieldName} contains too many special characters`,
    };
  }

  return { isValid: true, error: null, sanitized: trimmedName };
}

// ============================================
// ROLE-SPECIFIC VALIDATION
// ============================================

/**
 * Validate attorney-specific fields
 * FIXED: Better bar number validation
 *
 * @param {Object} data - Attorney data to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateAttorneyData(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return {
      isValid: false,
      error: "Invalid attorney data provided",
      errors: ["Invalid data"],
    };
  }

  // Validate state bar number
  if (!data.stateBarNumber || !data.stateBarNumber.trim()) {
    errors.push("State bar number is required");
  } else {
    const barNumber = data.stateBarNumber.trim();

    if (barNumber.length < 3) {
      errors.push("State bar number appears to be too short");
    }

    if (barNumber.length > 50) {
      errors.push("State bar number is too long");
    }

    // Check for valid characters (alphanumeric, hyphens, spaces)
    if (!/^[a-zA-Z0-9\s\-]+$/.test(barNumber)) {
      errors.push("State bar number contains invalid characters");
    }
  }

  // Validate law firm name
  if (!data.lawFirmName || !data.lawFirmName.trim()) {
    errors.push("Law firm name is required");
  } else {
    const firmName = data.lawFirmName.trim();

    if (firmName.length < 2) {
      errors.push("Law firm name is too short");
    }

    if (firmName.length > 200) {
      errors.push("Law firm name cannot exceed 200 characters");
    }
  }

  // Validate practice areas if provided
  if (data.practiceAreas && Array.isArray(data.practiceAreas)) {
    if (data.practiceAreas.length === 0) {
      errors.push("At least one practice area must be selected");
    }

    if (data.practiceAreas.length > 20) {
      errors.push("Too many practice areas selected (max 20)");
    }
  }

  // Validate years of experience if provided
  if (data.yearsOfExperience !== undefined) {
    const years = parseInt(data.yearsOfExperience, 10);

    if (isNaN(years) || years < 0) {
      errors.push("Years of experience must be a positive number");
    }

    if (years > 70) {
      errors.push("Years of experience seems unrealistic");
    }
  }

  return {
    isValid: errors.length === 0,
    error: errors.length > 0 ? errors.join("; ") : null,
    errors,
  };
}

/**
 * Validate juror-specific fields
 * FIXED: Better payment method validation, criteria validation
 *
 * @param {Object} data - Juror data to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateJurorData(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return {
      isValid: false,
      error: "Invalid juror data provided",
      errors: ["Invalid data"],
    };
  }

  // Validate payment method
  const validPaymentMethods = ["venmo", "paypal", "cashapp", "zelle"];
  if (!data.paymentMethod) {
    errors.push("Payment method is required");
  } else if (!validPaymentMethods.includes(data.paymentMethod.toLowerCase())) {
    errors.push(
      "Invalid payment method selected. Must be: Venmo, PayPal, CashApp, or Zelle"
    );
  }

  // Validate payment username if provided
  if (data.paymentUsername) {
    const username = data.paymentUsername.trim();

    if (username.length < 3) {
      errors.push("Payment username is too short");
    }

    if (username.length > 50) {
      errors.push("Payment username is too long");
    }
  }

  // Validate county
  if (!data.county || !data.county.trim()) {
    errors.push("County is required");
  } else {
    const county = data.county.trim();

    if (county.length < 2) {
      errors.push("County name is too short");
    }

    if (county.length > 100) {
      errors.push("County name cannot exceed 100 characters");
    }
  }

  // Validate criteria responses if provided
  if (data.criteriaResponses) {
    try {
      const criteria =
        typeof data.criteriaResponses === "string"
          ? JSON.parse(data.criteriaResponses)
          : data.criteriaResponses;

      // Check for disqualifying responses
      if (criteria.age === "no" || criteria.age === false) {
        errors.push("You must be at least 18 years old to serve as a juror");
      }

      if (criteria.citizen === "no" || criteria.citizen === false) {
        errors.push("You must be a US citizen to serve as a juror");
      }

      if (criteria.indictment === "yes" || criteria.indictment === true) {
        errors.push(
          "Individuals currently under indictment are not eligible to serve"
        );
      }

      if (criteria.felony === "yes" || criteria.felony === true) {
        errors.push(
          "Individuals with felony convictions may not be eligible to serve"
        );
      }
    } catch (error) {
      errors.push("Invalid criteria responses format");
    }
  }

  return {
    isValid: errors.length === 0,
    error: errors.length > 0 ? errors.join("; ") : null,
    errors,
  };
}

// ============================================
// ADDITIONAL VALIDATORS
// ============================================

/**
 * Validate URL format
 * NEW: Added URL validation
 */
function validateURL(url, options = {}) {
  const allowedProtocols = options.protocols || ["http", "https"];

  if (!url || typeof url !== "string") {
    return { isValid: false, error: "URL is required" };
  }

  try {
    const urlObj = new URL(url);

    if (!allowedProtocols.includes(urlObj.protocol.replace(":", ""))) {
      return {
        isValid: false,
        error: `URL protocol must be: ${allowedProtocols.join(", ")}`,
      };
    }

    return { isValid: true, error: null, parsed: urlObj };
  } catch (error) {
    return { isValid: false, error: "Invalid URL format" };
  }
}

/**
 * Validate date format
 * NEW: Added date validation
 */
function validateDate(dateString, options = {}) {
  const allowPast = options.allowPast !== false;
  const allowFuture = options.allowFuture !== false;

  if (!dateString) {
    return { isValid: false, error: "Date is required" };
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return { isValid: false, error: "Invalid date format" };
  }

  const now = new Date();

  if (!allowPast && date < now) {
    return { isValid: false, error: "Date cannot be in the past" };
  }

  if (!allowFuture && date > now) {
    return { isValid: false, error: "Date cannot be in the future" };
  }

  return { isValid: true, error: null, date };
}

/**
 * Validate number range
 * NEW: Added number validation
 */
function validateNumber(value, options = {}) {
  const min = options.min !== undefined ? options.min : -Infinity;
  const max = options.max !== undefined ? options.max : Infinity;
  const integer = options.integer === true;
  const fieldName = options.fieldName || "Value";

  if (value === undefined || value === null || value === "") {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const num = Number(value);

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a number` };
  }

  if (integer && !Number.isInteger(num)) {
    return { isValid: false, error: `${fieldName} must be a whole number` };
  }

  if (num < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (num > max) {
    return { isValid: false, error: `${fieldName} cannot exceed ${max}` };
  }

  return { isValid: true, error: null, value: num };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Password
  validatePassword,
  calculatePasswordStrength,

  // Email & Phone
  validateEmail,
  validatePhone,

  // General
  validateRequiredFields,
  validateZipCode,
  validateStateCode,
  validateName,
  validateURL,
  validateDate,
  validateNumber,

  // Sanitization
  sanitizeInput,
  sanitizeHTML,

  // Role-specific
  validateAttorneyData,
  validateJurorData,

  // Constants
  COMMON_PASSWORDS,
  DISPOSABLE_DOMAINS,
};
