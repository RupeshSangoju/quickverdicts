// =============================================
// validate.js - Input Validation Utilities
// Centralized validation functions for the application
// =============================================

// ============================================
// EMAIL VALIDATION
// ============================================

/**
 * Validate email address format
 * RFC 5322 compliant email validation
 */
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Email is required" };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return { isValid: false, error: "Email cannot be empty" };
  }

  if (trimmedEmail.length > 254) {
    return { isValid: false, error: "Email is too long (max 254 characters)" };
  }

  // RFC 5322 compliant regex
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmedEmail)) {
    return { isValid: false, error: "Invalid email format" };
  }

  return { isValid: true, email: trimmedEmail.toLowerCase() };
}

// ============================================
// PASSWORD VALIDATION
// ============================================

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - Contains uppercase and lowercase letters
 * - Contains at least one number
 * - Contains at least one special character
 * - Not containing user's name or email
 */
function validatePassword(password, firstName = "", lastName = "", email = "") {
  if (!password || typeof password !== "string") {
    return { isValid: false, error: "Password is required" };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters long",
    };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      error: "Password is too long (max 128 characters)",
    };
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one uppercase letter",
    };
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one number",
    };
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one special character",
    };
  }

  // Check if password contains user's name
  const lowerPassword = password.toLowerCase();
  if (firstName && lowerPassword.includes(firstName.toLowerCase())) {
    return { isValid: false, error: "Password cannot contain your first name" };
  }
  if (lastName && lowerPassword.includes(lastName.toLowerCase())) {
    return { isValid: false, error: "Password cannot contain your last name" };
  }

  // Check if password contains email username
  if (email) {
    const emailUsername = email.split("@")[0].toLowerCase();
    if (emailUsername && lowerPassword.includes(emailUsername)) {
      return {
        isValid: false,
        error: "Password cannot contain your email username",
      };
    }
  }

  return { isValid: true };
}

// ============================================
// PHONE NUMBER VALIDATION
// ============================================

/**
 * Validate US phone number
 * Accepts formats: (123) 456-7890, 123-456-7890, 1234567890, +1 123 456 7890
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== "string") {
    return { isValid: false, error: "Phone number is required" };
  }

  const trimmedPhone = phone.trim();

  if (trimmedPhone.length === 0) {
    return { isValid: false, error: "Phone number cannot be empty" };
  }

  // Remove all non-digit characters
  const digitsOnly = trimmedPhone.replace(/\D/g, "");

  // US phone numbers should be 10 digits (or 11 if starting with 1)
  if (digitsOnly.length === 10) {
    return { isValid: true, phone: digitsOnly };
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return { isValid: true, phone: digitsOnly.substring(1) };
  } else {
    return {
      isValid: false,
      error: "Invalid US phone number format (must be 10 digits)",
    };
  }
}

/**
 * Format phone number for display
 * Formats 10-digit phone as (123) 456-7890
 */
function formatPhone(phone) {
  if (!phone) return "";

  const digitsOnly = phone.replace(/\D/g, "");

  if (digitsOnly.length === 10) {
    return `(${digitsOnly.substring(0, 3)}) ${digitsOnly.substring(
      3,
      6
    )}-${digitsOnly.substring(6)}`;
  }

  return phone;
}

// ============================================
// ZIP CODE VALIDATION
// ============================================

/**
 * Validate US ZIP code (5 digits or 5+4 format)
 */
function validateZipCode(zipCode) {
  if (!zipCode || typeof zipCode !== "string") {
    return { isValid: false, error: "ZIP code is required" };
  }

  const trimmedZip = zipCode.trim();

  // 5-digit ZIP
  if (/^\d{5}$/.test(trimmedZip)) {
    return { isValid: true, zipCode: trimmedZip };
  }

  // ZIP+4 format
  if (/^\d{5}-\d{4}$/.test(trimmedZip)) {
    return { isValid: true, zipCode: trimmedZip };
  }

  return {
    isValid: false,
    error: "Invalid ZIP code format (must be 12345 or 12345-6789)",
  };
}

// ============================================
// STATE VALIDATION
// ============================================

/**
 * Validate US state abbreviation
 */
const US_STATES = [
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
];

function validateState(state) {
  if (!state || typeof state !== "string") {
    return { isValid: false, error: "State is required" };
  }

  const upperState = state.trim().toUpperCase();

  if (!US_STATES.includes(upperState)) {
    return { isValid: false, error: "Invalid US state abbreviation" };
  }

  return { isValid: true, state: upperState };
}

// ============================================
// NAME VALIDATION
// ============================================

/**
 * Validate name (first name, last name, etc.)
 */
function validateName(name, fieldName = "Name") {
  if (!name || typeof name !== "string") {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return { isValid: false, error: `${fieldName} cannot be empty` };
  }

  if (trimmedName.length < 2) {
    return {
      isValid: false,
      error: `${fieldName} must be at least 2 characters`,
    };
  }

  if (trimmedName.length > 50) {
    return {
      isValid: false,
      error: `${fieldName} is too long (max 50 characters)`,
    };
  }

  // Allow letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
    return {
      isValid: false,
      error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`,
    };
  }

  return { isValid: true, name: trimmedName };
}

// ============================================
// URL VALIDATION
// ============================================

/**
 * Validate URL format
 */
function validateURL(url, fieldName = "URL") {
  if (!url || typeof url !== "string") {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const trimmedURL = url.trim();

  try {
    const urlObj = new URL(trimmedURL);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: `${fieldName} must use http or https protocol`,
      };
    }

    return { isValid: true, url: trimmedURL };
  } catch (error) {
    return { isValid: false, error: `Invalid ${fieldName} format` };
  }
}

// ============================================
// DATE VALIDATION
// ============================================

/**
 * Validate date string
 */
function validateDate(dateString, fieldName = "Date") {
  if (!dateString) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return { isValid: false, error: `Invalid ${fieldName} format` };
  }

  return { isValid: true, date };
}

/**
 * Validate date is in the future
 */
function validateFutureDate(dateString, fieldName = "Date") {
  const validation = validateDate(dateString, fieldName);
  if (!validation.isValid) {
    return validation;
  }

  const now = new Date();
  if (validation.date <= now) {
    return { isValid: false, error: `${fieldName} must be in the future` };
  }

  return { isValid: true, date: validation.date };
}

/**
 * Validate date is in the past
 */
function validatePastDate(dateString, fieldName = "Date") {
  const validation = validateDate(dateString, fieldName);
  if (!validation.isValid) {
    return validation;
  }

  const now = new Date();
  if (validation.date >= now) {
    return { isValid: false, error: `${fieldName} must be in the past` };
  }

  return { isValid: true, date: validation.date };
}

// ============================================
// INTEGER VALIDATION
// ============================================

/**
 * Validate integer
 */
function validateInteger(value, fieldName = "Value", min = null, max = null) {
  if (value === null || value === undefined) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const num = parseInt(value, 10);

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid integer` };
  }

  if (min !== null && num < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (max !== null && num > max) {
    return { isValid: false, error: `${fieldName} must be at most ${max}` };
  }

  return { isValid: true, value: num };
}

// ============================================
// STRING LENGTH VALIDATION
// ============================================

/**
 * Validate string length
 */
function validateStringLength(str, fieldName = "Field", min = 0, max = 255) {
  if (!str || typeof str !== "string") {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const trimmed = str.trim();

  if (trimmed.length < min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${min} characters`,
    };
  }

  if (trimmed.length > max) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${max} characters`,
    };
  }

  return { isValid: true, value: trimmed };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Email
  validateEmail,

  // Password
  validatePassword,

  // Phone
  validatePhone,
  formatPhone,

  // Address
  validateZipCode,
  validateState,
  US_STATES,

  // Name
  validateName,

  // URL
  validateURL,

  // Date
  validateDate,
  validateFutureDate,
  validatePastDate,

  // Number
  validateInteger,

  // String
  validateStringLength,
};
