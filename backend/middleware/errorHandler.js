// =============================================
// errorHandler.js - Global Error Handling Middleware
// =============================================

// ============================================
// SQL SERVER ERROR CODES
// ============================================
const SQL_ERROR_CODES = {
  CONNECTION_FAILED: 2,
  REQUIRED_FIELD_MISSING: 515,
  DUPLICATE_KEY: 2627,
  FOREIGN_KEY_VIOLATION: 547,
  TIMEOUT: -2,
  DEADLOCK: 1205,
  PERMISSION_DENIED: 229,
  INVALID_OBJECT: 208,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Generate or extract request ID for tracking */
function getRequestId(req) {
  return (
    req.id ||
    req.headers["x-request-id"] ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
}

/** Determine whether error should be sent to external monitoring service */
function shouldAlertExternally(statusCode, error) {
  // Alert on 5xx errors and critical 4xx errors
  if (statusCode >= 500) return true;
  if (statusCode === 401 || statusCode === 403) return false; // Too noisy
  if (statusCode === 429) return true; // Rate limit abuse
  return false;
}

/** Placeholder for Sentry / Datadog integration */
function sendToErrorTracking(error, context) {
  // TODO: Integrate with Sentry, DataDog, or Azure Application Insights
  if (process.env.SENTRY_DSN) {
    // Example: Sentry.captureException(error, { extra: context });
    console.log("📊 [Error Tracking] Sending to monitoring service...");
  }

  if (process.env.NODE_ENV === "development") {
    console.log("📊 [Error Tracking] Would send to external service:", {
      error: error.message,
      context: {
        requestId: context.requestId,
        path: context.path,
        statusCode: context.statusCode,
        category: context.category,
      },
    });
  }
}

/** Recursively remove sensitive fields from logs */
function sanitizeForLogging(obj) {
  if (!obj || typeof obj !== "object") return obj;

  const sensitiveKeys = [
    "password",
    "token",
    "authorization",
    "cookie",
    "session",
    "ssn",
    "credit_card",
    "cvv",
    "pin",
    "secret",
    "api_key",
    "apiKey",
    "accessToken",
    "refreshToken",
  ];

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }
  return sanitized;
}

// ============================================
// ERROR CATEGORIZATION
// ============================================
function categorizeError(error) {
  let statusCode = 500;
  let message = "Internal Server Error";
  let code = "INTERNAL_ERROR";
  let category = "server_error";
  let userMessage = "An unexpected error occurred. Please try again.";

  // Validation Errors
  if (error.name === "ValidationError") {
    statusCode = 400;
    message = error.message || "Validation failed";
    code = "VALIDATION_ERROR";
    category = "validation";
    userMessage = error.message || "Please check your input and try again.";
  }

  // JWT Errors
  else if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token";
    code = "INVALID_TOKEN";
    category = "authentication";
    userMessage = "Your session is invalid. Please log in again.";
  } else if (error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token has expired";
    code = "TOKEN_EXPIRED";
    category = "authentication";
    userMessage = "Your session has expired. Please log in again.";
  }

  // File Upload Errors
  else if (
    ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(
      error.code
    )
  ) {
    statusCode = 400;
    category = "file_upload";

    if (error.code === "LIMIT_FILE_SIZE") {
      message = "File size exceeds maximum allowed size";
      code = "FILE_TOO_LARGE";
      userMessage = "The file is too large. Maximum size is 10MB.";
    } else if (error.code === "LIMIT_FILE_COUNT") {
      message = "Too many files uploaded";
      code = "TOO_MANY_FILES";
      userMessage = "You can only upload a maximum of 10 files at once.";
    } else {
      message = "Unexpected file upload error";
      code = "FILE_UPLOAD_ERROR";
      userMessage =
        "There was a problem uploading your file. Please try again.";
    }
  }

  // Request Body Errors
  else if (error.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body too large";
    code = "REQUEST_TOO_LARGE";
    category = "request";
    userMessage = "The request is too large. Please reduce the data size.";
  } else if (error.name === "SyntaxError" && error.message.includes("JSON")) {
    statusCode = 400;
    message = "Invalid JSON format";
    code = "INVALID_JSON";
    category = "request";
    userMessage = "Invalid data format received. Please try again.";
  }

  // CORS Errors
  else if (error.message && error.message.includes("CORS")) {
    statusCode = 403;
    message = "CORS policy violation";
    code = "CORS_ERROR";
    category = "security";
    userMessage = "Access denied. Please contact support if this persists.";
  }

  // Rate Limit Errors
  else if (error.statusCode === 429 || error.code === "RATE_LIMIT_EXCEEDED") {
    statusCode = 429;
    message = "Too many requests";
    code = "RATE_LIMIT_EXCEEDED";
    category = "rate_limit";
    userMessage = "Too many requests. Please wait a moment and try again.";
  }

  // Database Errors
  else if (error.number) {
    category = "database";
    switch (error.number) {
      case SQL_ERROR_CODES.CONNECTION_FAILED:
        statusCode = 503;
        message = "Database connection failed";
        code = "DB_CONNECTION_ERROR";
        userMessage =
          "Service temporarily unavailable. Please try again in a moment.";
        break;
      case SQL_ERROR_CODES.REQUIRED_FIELD_MISSING:
        statusCode = 400;
        message = "Missing required database field";
        code = "DB_VALIDATION_ERROR";
        userMessage =
          "Required information is missing. Please check your input.";
        break;
      case SQL_ERROR_CODES.DUPLICATE_KEY:
        statusCode = 409;
        message = "Duplicate record found";
        code = "DUPLICATE_ENTRY";
        userMessage =
          "This record already exists. Please use a different value.";
        break;
      case SQL_ERROR_CODES.FOREIGN_KEY_VIOLATION:
        statusCode = 400;
        message = "Foreign key constraint violation";
        code = "FOREIGN_KEY_ERROR";
        userMessage =
          "Cannot complete operation due to related records. Please check dependencies.";
        break;
      case SQL_ERROR_CODES.TIMEOUT:
        statusCode = 504;
        message = "Database query timeout";
        code = "DB_TIMEOUT";
        userMessage = "The operation is taking too long. Please try again.";
        break;
      case SQL_ERROR_CODES.DEADLOCK:
        statusCode = 409;
        message = "Database deadlock detected";
        code = "DB_DEADLOCK";
        userMessage = "A conflict occurred. Please try again.";
        break;
      case SQL_ERROR_CODES.PERMISSION_DENIED:
        statusCode = 403;
        message = "Database permission denied";
        code = "DB_PERMISSION_ERROR";
        userMessage = "You don't have permission to perform this action.";
        break;
      case SQL_ERROR_CODES.INVALID_OBJECT:
        statusCode = 500;
        message = "Database object not found";
        code = "DB_OBJECT_ERROR";
        userMessage = "A system error occurred. Please contact support.";
        break;
      default:
        statusCode = 500;
        message = "Database error occurred";
        code = "DB_ERROR";
        userMessage = "A database error occurred. Please try again.";
    }
  }

  // Custom Status Code Errors
  else if (error.statusCode || error.status) {
    statusCode = error.statusCode || error.status;
    message = error.message || message;
    code = error.code || code;
    userMessage = error.userMessage || error.message || userMessage;
    category = statusCode >= 500 ? "server_error" : "client_error";
  }

  return { statusCode, message, code, category, userMessage };
}

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
function errorHandler(error, req, res, next) {
  // Prevent headers already sent errors
  if (res.headersSent) {
    console.error("⚠️  Headers already sent, delegating to default handler");
    return next(error);
  }

  const requestId = getRequestId(req);
  const { statusCode, message, code, category, userMessage } =
    categorizeError(error);

  const isDevelopment = process.env.NODE_ENV === "development";

  // Comprehensive log data
  const logData = {
    requestId,
    timestamp: new Date().toISOString(),
    category,
    statusCode,
    code,
    message: error.message,
    path: req.path,
    method: req.method,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers["user-agent"],
    query: sanitizeForLogging(req.query),
    body: sanitizeForLogging(req.body),
    user: req.user
      ? { id: req.user.id, email: req.user.email, type: req.user.type }
      : null,
  };

  if (isDevelopment) {
    logData.stack = error.stack;
  }

  if (error.number) {
    logData.sqlError = {
      number: error.number,
      state: error.state,
      class: error.class,
      lineNumber: error.lineNumber,
      serverName: error.serverName,
      procName: error.procName,
    };
  }

  // Logging by severity
  if (statusCode >= 500) {
    console.error("🔴 [Server Error]", JSON.stringify(logData, null, 2));
  } else if (statusCode >= 400) {
    console.warn("🟡 [Client Error]", JSON.stringify(logData, null, 2));
  } else {
    console.log("🔵 [Info]", JSON.stringify(logData, null, 2));
  }

  // Send to external error tracker if needed
  if (shouldAlertExternally(statusCode, error)) {
    sendToErrorTracking(error, logData);
  }

  // Build safe response for frontend
  const response = {
    success: false,
    error: userMessage, // User-friendly message
    code,
    requestId,
    timestamp: new Date().toISOString(),
  };

  // Add development details
  if (isDevelopment) {
    response.debug = {
      message: error.message, // Technical message
      stack: error.stack?.split("\n").slice(0, 5), // Limit stack trace
      category,
      sqlError: logData.sqlError || null,
    };

    // Helpful hints for common errors
    if (code === "DB_CONNECTION_ERROR") {
      response.hint = "Check DB credentials in .env file";
    } else if (code === "INVALID_TOKEN") {
      response.hint = "Ensure a valid JWT is passed in Authorization header";
    } else if (code === "DUPLICATE_ENTRY") {
      response.hint = "Record already exists in database";
    } else if (code === "CORS_ERROR") {
      response.hint = "Check allowed origins in CORS configuration";
    }
  }

  // Set appropriate headers
  res.setHeader("Content-Type", "application/json");

  // Add retry-after header for rate limiting
  if (statusCode === 429) {
    res.setHeader("Retry-After", "900"); // 15 minutes in seconds
    response.retryAfter = 900;
  }

  res.status(statusCode).json(response);
}

// ============================================
// 404 NOT FOUND HANDLER
// ============================================
function notFoundHandler(req, res) {
  const requestId = getRequestId(req);

  console.warn("🟡 [404 Not Found]", {
    requestId,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection?.remoteAddress,
  });

  res.status(404).json({
    success: false,
    error: "The requested resource was not found",
    code: "NOT_FOUND",
    requestId,
    timestamp: new Date().toISOString(),
    path: req.path,
  });
}

// ============================================
// ASYNC WRAPPER FOR ROUTES
// ============================================
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================
class AppError extends Error {
  constructor(message, statusCode, code, userMessage) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.userMessage = userMessage || message;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, "VALIDATION_ERROR", message);
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR", "Please log in to continue");
  }
}

class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(
      message,
      403,
      "AUTHORIZATION_ERROR",
      "You don't have permission to access this resource"
    );
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(
      `${resource} not found`,
      404,
      "NOT_FOUND",
      `The requested ${resource.toLowerCase()} was not found`
    );
  }
}

class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT", message);
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  SQL_ERROR_CODES,
  // Custom error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
};
