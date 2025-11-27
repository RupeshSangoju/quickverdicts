// =============================================
// warRoomDocumentRoutes.js - War Room Document Routes
// FIXED: Added SQL types, validation, authorization, rate limiting, security
// =============================================

const express = require("express");
const router = express.Router();
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { poolPromise, sql } = require("../config/db");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireWarRoomAccess } = require("../middleware/warRoomMiddleware");
const { uploadToBlob, getBlobClient } = require("../utils/azureBlob");
const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} = require("@azure/storage-blob");

// Import models
const Case = require("../models/Case");
const Event = require("../models/Event");

// ============================================
// CONFIGURATION
// ============================================

const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4GB - Allow large video files and document bundles
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  // Videos
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-ms-wmv",
  "video/webm",
  "video/x-flv",
  "video/3gpp",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Strict rate limiter for file uploads
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    success: false,
    message: "Too many file uploads. Please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General document operations limiter
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Download limiter
 */
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Allow more downloads
  message: {
    success: false,
    message: "Too many download requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// MULTER CONFIGURATION
// ============================================

/**
 * Configure multer with file size limit and file filter
 */
const upload = multer({
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      // Additional extension validation
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
        ".bmp",
        ".mp4",
        ".mpeg",
        ".mov",
        ".avi",
        ".wmv",
        ".webm",
        ".flv",
        ".3gp",
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".csv",
      ];

      if (allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File extension ${ext} is not allowed`));
      }
    } else {
      cb(new Error(`File type ${file.mimetype} is not supported`));
    }
  },
});

// ============================================
// MIDDLEWARE
// ============================================

// Protect all routes with authentication
router.use(authMiddleware);

// ============================================
// VALIDATION HELPERS
// ============================================

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
 * Validate document ID parameter
 */
const validateDocumentId = (req, res, next) => {
  const docId = parseInt(req.params.docId, 10);

  if (isNaN(docId) || docId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid document ID is required",
    });
  }

  req.validatedDocId = docId;
  next();
};

/**
 * Verify attorney owns the case or is admin
 */
const verifyDocumentAccess = async (req, res, next) => {
  try {
    const caseId = req.validatedCaseId;
    const user = req.user;

    // Admin has full access
    if (user.type === "admin") {
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }
      req.caseData = caseData;
      return next();
    }

    // Attorney must own the case
    if (user.type !== "attorney") {
      return res.status(403).json({
        success: false,
        message: "Only attorneys can manage case documents",
      });
    }

    const caseData = await Case.findById(caseId);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    if (caseData.AttorneyId !== user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You do not own this case",
      });
    }

    req.caseData = caseData;
    next();
  } catch (error) {
    console.error("Document access verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify document access",
    });
  }
};

/**
 * Verify user can delete documents (attorney/admin only)
 */
const verifyDeletePermission = (req, res, next) => {
  if (req.user.type !== "attorney" && req.user.type !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only attorneys and administrators can delete documents",
    });
  }
  next();
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate SAS URL for blob access
 */
async function generateSasUrl(fileUrl) {
  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = "warroom-documents";

    if (!connectionString) {
      console.warn("Azure Storage connection string not configured");
      return fileUrl;
    }

    // Extract blob name from URL
    const urlParts = fileUrl.split("/");
    const blobName = urlParts[urlParts.length - 1];

    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(
      decodeURIComponent(blobName)
    );

    const sasOptions = {
      containerName,
      blobName: decodeURIComponent(blobName),
      permissions: BlobSASPermissions.parse("r"), // read only
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour
    };

    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      blobServiceClient.credential
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  } catch (error) {
    console.error("SAS generation error:", error);
    return fileUrl; // Return original URL as fallback
  }
}

/**
 * Detect file type from filename and MIME type
 */
function detectFileType(filename, mimetype) {
  const fileExt = path.extname(filename).toLowerCase();

  // Image types
  if (
    [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"].includes(fileExt)
  ) {
    return "image";
  }

  // Video types
  if (
    [".mp4", ".mpeg", ".mov", ".avi", ".wmv", ".webm", ".flv", ".3gp"].includes(
      fileExt
    ) ||
    mimetype.startsWith("video/")
  ) {
    return "video";
  }

  // PDF
  if (fileExt === ".pdf") {
    return "pdf";
  }

  // Word documents
  if (
    [".doc", ".docx"].includes(fileExt) ||
    mimetype === "application/msword" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "word";
  }

  // Excel documents
  if (
    [".xls", ".xlsx"].includes(fileExt) ||
    mimetype === "application/vnd.ms-excel" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "excel";
  }

  // PowerPoint documents
  if (
    [".ppt", ".pptx"].includes(fileExt) ||
    mimetype === "application/vnd.ms-powerpoint" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "powerpoint";
  }

  // Text/CSV
  if ([".txt", ".csv"].includes(fileExt)) {
    return "text";
  }

  // Default to document
  return "document";
}

/**
 * Validate filename for security
 */
function sanitizeFilename(filename) {
  // Remove path traversal attempts
  return path
    .basename(filename)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 255);
}

// ============================================
// WAR ROOM DOCUMENT ROUTES
// ============================================

/**
 * GET /api/war-room-documents/cases/:caseId/war-room/documents
 * Fetch all documents for a case (PRIMARY ENDPOINT)
 * FIXED: Added SQL types, validation, authorization
 */
router.get(
  "/cases/:caseId/war-room/documents",
  downloadLimiter,
  validateCaseId,
  verifyDocumentAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT
            Id,
            CaseId,
            Type,
            FileName,
            FileUrl,
            Description,
            Size,
            MimeType,
            UploadedAt
          FROM WarRoomDocuments
          WHERE CaseId = @caseId
          ORDER BY UploadedAt DESC
        `);

      // Generate SAS URLs for each document
      const documentsWithSas = await Promise.all(
        result.recordset.map(async (doc) => ({
          ...doc,
          FileUrl: await generateSasUrl(doc.FileUrl),
          SizeFormatted: formatFileSize(doc.Size),
        }))
      );

      res.json({
        success: true,
        documents: documentsWithSas,
        count: documentsWithSas.length,
        summary: {
          total: documentsWithSas.length,
          totalSize: documentsWithSas.reduce(
            (sum, doc) => sum + (doc.Size || 0),
            0
          ),
          byType: documentsWithSas.reduce((acc, doc) => {
            acc[doc.Type] = (acc[doc.Type] || 0) + 1;
            return acc;
          }, {}),
        },
      });
    } catch (error) {
      console.error("Fetch documents error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch documents",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/war-room-documents/cases/:caseId/war-room/documents
 * Upload document (PRIMARY ENDPOINT)
 * FIXED: Added validation, security checks, event logging
 */
router.post(
  "/cases/:caseId/war-room/documents",
  uploadLimiter,
  validateCaseId,
  verifyDocumentAccess,
  upload.single("file"),
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { description } = req.body;
      const file = req.file;
      const userId = req.user.id;

      console.log("=== DOCUMENT UPLOAD ===");
      console.log("Case ID:", caseId);
      console.log("File:", file ? file.originalname : "No file");
      console.log("Size:", file ? formatFileSize(file.size) : "N/A");
      console.log("MIME:", file ? file.mimetype : "N/A");

      if (!file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Additional file validation
      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum size is ${formatFileSize(
            MAX_FILE_SIZE
          )}`,
        });
      }

      // Sanitize filename
      const sanitizedFilename = sanitizeFilename(file.originalname);

      // Upload to Azure Blob
      const fileUrl = await uploadToBlob(
        file.buffer,
        sanitizedFilename,
        file.mimetype
      );

      console.log("✅ Upload successful:", fileUrl);

      // Detect file type
      const type = detectFileType(sanitizedFilename, file.mimetype);

      // Save to database
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("type", sql.NVarChar(50), type)
        .input("fileName", sql.NVarChar(255), sanitizedFilename)
        .input("fileUrl", sql.NVarChar(sql.MAX), fileUrl)
        .input("description", sql.NVarChar(500), description || "")
        .input("size", sql.BigInt, file.size)
        .input("mimeType", sql.NVarChar(100), file.mimetype).query(`
          INSERT INTO WarRoomDocuments (
            CaseId, Type, FileName, FileUrl, Description, Size, MimeType, UploadedAt
          )
          VALUES (
            @caseId, @type, @fileName, @fileUrl, @description, @size, @mimeType, GETUTCDATE()
          );

          SELECT SCOPE_IDENTITY() as DocumentId;
        `);

      const documentId = result.recordset[0].DocumentId;

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Document uploaded: ${sanitizedFilename}`,
        triggeredBy: userId,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "File uploaded successfully",
        document: {
          id: documentId,
          fileName: sanitizedFilename,
          fileUrl,
          type,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
        },
      });
    } catch (error) {
      console.error("=== DOCUMENT UPLOAD ERROR ===");
      console.error("Error:", error.message);
      console.error("Stack:", error.stack);

      res.status(500).json({
        success: false,
        message: "Failed to upload document",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/war-room-documents/cases/:caseId/war-room/documents/:docId
 * Delete document (PRIMARY ENDPOINT)
 * FIXED: Added validation, authorization, event logging
 */
router.delete(
  "/cases/:caseId/war-room/documents/:docId",
  generalLimiter,
  validateCaseId,
  validateDocumentId,
  verifyDocumentAccess,
  verifyDeletePermission,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const docId = req.validatedDocId;
      const userId = req.user.id;
      const pool = await poolPromise;

      // Get document info
      const result = await pool
        .request()
        .input("docId", sql.Int, docId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT Id, FileUrl, FileName
          FROM WarRoomDocuments
          WHERE Id = @docId AND CaseId = @caseId
        `);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      const doc = result.recordset[0];

      // Delete from Azure Blob Storage
      try {
        const blobClient = getBlobClient(doc.FileUrl);
        await blobClient.deleteIfExists();
      } catch (blobErr) {
        console.error("Blob deletion error:", blobErr);
        // Continue with DB deletion even if blob deletion fails
      }

      // Delete from database
      await pool
        .request()
        .input("docId", sql.Int, docId)
        .query(`DELETE FROM WarRoomDocuments WHERE Id = @docId`);

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Document deleted: ${doc.FileName}`,
        triggeredBy: userId,
        userType: req.user.type,
      });

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete document",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// LEGACY ENDPOINTS (For Backwards Compatibility)
// ============================================

/**
 * GET /api/war-room-documents/cases/:caseId/documents
 * Legacy endpoint
 */
router.get(
  "/cases/:caseId/documents",
  downloadLimiter,
  validateCaseId,
  requireWarRoomAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT Id, CaseId, Type, FileName, FileUrl, Description, Size, MimeType, UploadedAt
          FROM WarRoomDocuments
          WHERE CaseId = @caseId
          ORDER BY UploadedAt DESC
        `);

      const documentsWithSas = await Promise.all(
        result.recordset.map(async (doc) => ({
          ...doc,
          FileUrl: await generateSasUrl(doc.FileUrl),
        }))
      );

      res.json(documentsWithSas);
    } catch (error) {
      console.error("Fetch documents error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/war-room-documents/cases/:caseId/documents
 * Legacy upload endpoint
 */
router.post(
  "/cases/:caseId/documents",
  uploadLimiter,
  validateCaseId,
  requireWarRoomAccess,
  upload.single("file"),
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const { description } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const sanitizedFilename = sanitizeFilename(file.originalname);
      const fileUrl = await uploadToBlob(
        file.buffer,
        sanitizedFilename,
        file.mimetype
      );
      const type = detectFileType(sanitizedFilename, file.mimetype);

      const pool = await poolPromise;
      await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("type", sql.NVarChar(50), type)
        .input("fileName", sql.NVarChar(255), sanitizedFilename)
        .input("fileUrl", sql.NVarChar(sql.MAX), fileUrl)
        .input("description", sql.NVarChar(500), description || "")
        .input("size", sql.BigInt, file.size)
        .input("mimeType", sql.NVarChar(100), file.mimetype).query(`
          INSERT INTO WarRoomDocuments (CaseId, Type, FileName, FileUrl, Description, Size, MimeType, UploadedAt)
          VALUES (@caseId, @type, @fileName, @fileUrl, @description, @size, @mimeType, GETUTCDATE())
        `);

      res.json({
        success: true,
        message: "File uploaded successfully",
        fileUrl,
        caseId,
        type,
      });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/war-room-documents/cases/:caseId/documents/:docId
 * Legacy delete endpoint
 */
router.delete(
  "/cases/:caseId/documents/:docId",
  generalLimiter,
  validateCaseId,
  validateDocumentId,
  requireWarRoomAccess,
  verifyDeletePermission,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const docId = req.validatedDocId;
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("docId", sql.Int, docId)
        .input("caseId", sql.Int, caseId).query(`
          SELECT Id, FileUrl, FileName
          FROM WarRoomDocuments
          WHERE Id = @docId AND CaseId = @caseId
        `);

      if (result.recordset.length === 0) {
        return res.status(404).json({ error: "Document not found" });
      }

      const doc = result.recordset[0];

      try {
        const blobClient = getBlobClient(doc.FileUrl);
        await blobClient.deleteIfExists();
      } catch (blobErr) {
        console.error("Blob deletion error:", blobErr);
      }

      await pool
        .request()
        .input("docId", sql.Int, docId)
        .query(`DELETE FROM WarRoomDocuments WHERE Id = @docId`);

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format file size to human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("War Room Document Route Error:", error);

  // Handle multer errors
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${formatFileSize(
          MAX_FILE_SIZE
        )}`,
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

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
