// =============================================
// fileRoutes.js - Secure File Management Routes
// FIXED: Added validation, security, access control
// =============================================

const express = require("express");
const router = express.Router();
const { BlobServiceClient } = require("@azure/storage-blob");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireWarRoomAccess } = require("../middleware/warRoomMiddleware");

// Import models
const Case = require("../models/Case");
const JurorApplication = require("../models/JurorApplication");
const Event = require("../models/Event");

// ============================================
// CONFIGURATION
// ============================================

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_CONTAINER_NAME || "warroom-documents";
const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB) || 4096; // 4GB default
const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

// Validate Azure configuration
if (!connectionString) {
  console.error("CRITICAL: AZURE_STORAGE_CONNECTION_STRING not configured");
}

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Rate limiter for file downloads
 * Prevents abuse of file download endpoint
 */
const fileDownloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 downloads per 15 minutes
  message: {
    success: false,
    message: "Too many file downloads. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for file uploads
 */
const fileUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    success: false,
    message: "Too many file uploads. Please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Sanitize and validate file name
 * Prevents path traversal attacks
 */
function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== "string") {
    throw new Error("Invalid file name");
  }

  // Remove any path separators and dangerous characters
  const sanitized = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  if (sanitized !== fileName) {
    console.warn(`File name sanitized: ${fileName} -> ${sanitized}`);
  }

  if (sanitized.length === 0) {
    throw new Error("Invalid file name after sanitization");
  }

  return sanitized;
}

/**
 * Validate case ID parameter
 */
const validateCaseId = (req, res, next) => {
  const caseId = parseInt(req.params.caseId, 10);

  if (isNaN(caseId) || caseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid case ID is required",
    });
  }

  req.validatedCaseId = caseId;
  next();
};

/**
 * Validate and sanitize file name parameter
 */
const validateFileName = (req, res, next) => {
  try {
    const fileName = sanitizeFileName(req.params.fileName);

    // Additional validation
    const maxFileNameLength = 255;
    if (fileName.length > maxFileNameLength) {
      return res.status(400).json({
        success: false,
        message: "File name too long",
      });
    }

    // Check file extension
    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".xlsx",
      ".xls",
      ".ppt",
      ".pptx",
    ];

    const ext = path.extname(fileName).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: `File type not allowed. Allowed types: ${allowedExtensions.join(
          ", "
        )}`,
      });
    }

    req.sanitizedFileName = fileName;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Invalid file name",
    });
  }
};

// ============================================
// ACCESS CONTROL MIDDLEWARE
// ============================================

/**
 * Verify user has access to case files
 * FIXED: Implemented the TODO from original code
 */
const verifyCaseFileAccess = async (req, res, next) => {
  try {
    const caseId = req.validatedCaseId;
    const user = req.user;

    // Get case data
    const caseData = await Case.findById(caseId);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // Admin always has access
    if (user.type === "admin") {
      req.caseData = caseData;
      return next();
    }

    // Attorney access - must own the case
    if (user.type === "attorney") {
      if (caseData.AttorneyId !== user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You do not own this case",
        });
      }
      req.caseData = caseData;
      return next();
    }

    // Juror access - must be approved for the case
    if (user.type === "juror") {
      const application = await JurorApplication.findByJurorAndCase(
        user.id,
        caseId
      );

      if (!application || application.Status !== "approved") {
        return res.status(403).json({
          success: false,
          message: "Access denied: You are not approved for this case",
        });
      }

      req.caseData = caseData;
      req.jurorApplication = application;
      return next();
    }

    // Unknown user type
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  } catch (error) {
    console.error("Case file access verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify file access",
    });
  }
};

// ============================================
// AZURE BLOB HELPERS
// ============================================

/**
 * Get blob service client
 */
function getBlobServiceClient() {
  if (!connectionString) {
    throw new Error("Azure Storage connection string not configured");
  }
  return BlobServiceClient.fromConnectionString(connectionString);
}

/**
 * Check if blob exists
 */
async function blobExists(blobClient) {
  try {
    return await blobClient.exists();
  } catch (error) {
    console.error("Error checking blob existence:", error);
    return false;
  }
}

/**
 * Get blob properties
 */
async function getBlobProperties(blobClient) {
  try {
    return await blobClient.getProperties();
  } catch (error) {
    console.error("Error getting blob properties:", error);
    return null;
  }
}

// ============================================
// FILE ROUTES
// ============================================

/**
 * GET /api/files/:caseId/:fileName
 * Download/serve a case file
 * FIXED: Added complete access control and validation
 */
router.get(
  "/files/:caseId/:fileName",
  fileDownloadLimiter,
  authMiddleware,
  validateCaseId,
  validateFileName,
  verifyCaseFileAccess,
  requireWarRoomAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const fileName = req.sanitizedFileName;
      const user = req.user;

      // Construct blob path (organize by case)
      const blobPath = `case-${caseId}/${fileName}`;

      // Get blob client
      const blobServiceClient = getBlobServiceClient();
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobPath);

      // Check if blob exists
      const exists = await blobExists(blobClient);
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Get blob properties
      const properties = await getBlobProperties(blobClient);

      if (properties && properties.contentLength > maxFileSizeBytes) {
        return res.status(413).json({
          success: false,
          message: `File too large. Maximum size: ${maxFileSizeMB}MB`,
        });
      }

      // Download blob
      const downloadResponse = await blobClient.download();

      // Set appropriate headers
      const contentType =
        properties?.contentType ||
        downloadResponse.contentType ||
        "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.setHeader("Cache-Control", "private, max-age=3600"); // Cache for 1 hour

      if (properties?.contentLength) {
        res.setHeader("Content-Length", properties.contentLength);
      }

      // Log file access for audit
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `File accessed: ${fileName}`,
        triggeredBy: user.id,
        userType: user.type,
      }).catch((err) => console.error("Failed to log file access:", err));

      // Stream file to response
      downloadResponse.readableStreamBody.pipe(res);
    } catch (error) {
      console.error("File serve error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve file",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/files/:caseId
 * List all files for a case
 * NEW: Added file listing endpoint
 */
router.get(
  "/files/:caseId",
  fileDownloadLimiter,
  authMiddleware,
  validateCaseId,
  verifyCaseFileAccess,
  requireWarRoomAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const prefix = `case-${caseId}/`;

      const blobServiceClient = getBlobServiceClient();
      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      // List blobs with prefix
      const files = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        // Remove prefix to get just the filename
        const fileName = blob.name.substring(prefix.length);

        files.push({
          name: fileName,
          size: blob.properties.contentLength,
          contentType: blob.properties.contentType,
          lastModified: blob.properties.lastModified,
          createdOn: blob.properties.createdOn,
        });
      }

      res.json({
        success: true,
        caseId,
        files,
        count: files.length,
      });
    } catch (error) {
      console.error("List files error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list files",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/files/:caseId/:fileName
 * Delete a case file (Attorney only)
 * NEW: Added file deletion endpoint
 */
router.delete(
  "/files/:caseId/:fileName",
  fileDownloadLimiter,
  authMiddleware,
  validateCaseId,
  validateFileName,
  verifyCaseFileAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const fileName = req.sanitizedFileName;
      const user = req.user;

      // Only attorneys can delete files from their cases
      if (user.type !== "attorney" && user.type !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only attorneys can delete files",
        });
      }

      const blobPath = `case-${caseId}/${fileName}`;

      const blobServiceClient = getBlobServiceClient();
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobPath);

      // Check if blob exists
      const exists = await blobExists(blobClient);
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Delete blob
      await blobClient.delete();

      // Log file deletion
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `File deleted: ${fileName}`,
        triggeredBy: user.id,
        userType: user.type,
      }).catch((err) => console.error("Failed to log file deletion:", err));

      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      console.error("File deletion error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete file",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/files/health
 * Check Azure Blob Storage connection
 */
router.get("/health", async (req, res) => {
  try {
    if (!connectionString) {
      return res.status(503).json({
        success: false,
        status: "unhealthy",
        message: "Azure Storage not configured",
      });
    }

    const blobServiceClient = getBlobServiceClient();
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Test connection
    await containerClient.exists();

    res.json({
      success: true,
      status: "healthy",
      service: "file-storage",
      container: containerName,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("File service health check error:", error);
    res.status(503).json({
      success: false,
      status: "unhealthy",
      message: "Azure Storage connection failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("File Route Error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

// ============================================
// EXPORTS
// ============================================

module.exports = router;
