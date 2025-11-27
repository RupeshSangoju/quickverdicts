// =============================================
// azureBlob.js - Azure Blob Storage Utilities
// FIXED: Added validation, error handling, retry logic, security
// =============================================

const { BlobServiceClient } = require("@azure/storage-blob");
const path = require("path");
const crypto = require("crypto");

// ============================================
// CONFIGURATION & VALIDATION
// ============================================

const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_BLOB_CONTAINER || "warroom-documents";

// Validate connection string
if (!AZURE_STORAGE_CONNECTION_STRING) {
  console.error("CRITICAL: AZURE_STORAGE_CONNECTION_STRING not configured");
  throw new Error(
    "AZURE_STORAGE_CONNECTION_STRING environment variable is required"
  );
}

// Validate connection string format
if (
  !AZURE_STORAGE_CONNECTION_STRING.includes("AccountName=") ||
  !AZURE_STORAGE_CONNECTION_STRING.includes("AccountKey=")
) {
  console.error("CRITICAL: Invalid AZURE_STORAGE_CONNECTION_STRING format");
  throw new Error(
    "AZURE_STORAGE_CONNECTION_STRING must contain AccountName and AccountKey"
  );
}

// Initialize clients
let blobServiceClient;
let containerClient;

try {
  blobServiceClient = BlobServiceClient.fromConnectionString(
    AZURE_STORAGE_CONNECTION_STRING
  );
  containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  console.log(
    `✅ Azure Blob Storage initialized (Container: ${CONTAINER_NAME})`
  );
} catch (error) {
  console.error("CRITICAL: Failed to initialize Azure Blob Storage:", error);
  throw new Error("Failed to initialize Azure Blob Storage");
}

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4GB - Allow large video files and document bundles
const MAX_FILENAME_LENGTH = 255;

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

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 10000,
  BACKOFF_MULTIPLIER: 2,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== "string") {
    throw new Error("Valid filename is required");
  }

  // Get the base name (removes any path components)
  let sanitized = path.basename(filename);

  // Remove or replace dangerous characters
  sanitized = sanitized
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
    .replace(/\.{2,}/g, ".") // Replace multiple dots with single dot
    .replace(/^\.+/, "") // Remove leading dots
    .trim();

  if (sanitized.length === 0) {
    throw new Error("Filename is empty after sanitization");
  }

  if (sanitized.length > MAX_FILENAME_LENGTH) {
    // Keep extension, truncate name
    const ext = path.extname(sanitized);
    const nameWithoutExt = path.basename(sanitized, ext);
    const maxNameLength = MAX_FILENAME_LENGTH - ext.length - 1;
    sanitized = nameWithoutExt.substring(0, maxNameLength) + ext;
  }

  return sanitized;
}

/**
 * Generate unique filename to prevent conflicts
 */
function generateUniqueFilename(originalFilename) {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized);
  const nameWithoutExt = path.basename(sanitized, ext);

  // Add timestamp and random string for uniqueness
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(4).toString("hex");

  return `${nameWithoutExt}_${timestamp}_${randomString}${ext}`;
}

/**
 * Validate MIME type
 */
function validateMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== "string") {
    throw new Error("Valid MIME type is required");
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    throw new Error(`MIME type ${mimeType} is not allowed`);
  }

  return mimeType.toLowerCase();
}

/**
 * Validate file buffer
 */
function validateFileBuffer(fileBuffer) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error("Valid file buffer is required");
  }

  if (fileBuffer.length === 0) {
    throw new Error("File buffer is empty");
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed size of ${formatBytes(MAX_FILE_SIZE)}`
    );
  }

  return fileBuffer;
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Retry operation with exponential backoff
 */
async function retryOperation(
  operation,
  operationName,
  retries = RETRY_CONFIG.MAX_RETRIES
) {
  let lastError;
  let delay = RETRY_CONFIG.INITIAL_DELAY;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (except 429 rate limit)
      if (
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        if (error.statusCode !== 429) {
          console.error(
            `${operationName} failed with client error:`,
            error.message
          );
          throw error;
        }
      }

      if (attempt < retries) {
        console.warn(
          `${operationName} attempt ${attempt}/${retries} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(
          delay * RETRY_CONFIG.BACKOFF_MULTIPLIER,
          RETRY_CONFIG.MAX_DELAY
        );
      }
    }
  }

  console.error(
    `${operationName} failed after ${retries} attempts:`,
    lastError.message
  );
  throw lastError;
}

/**
 * Sanitize error for logging
 */
function sanitizeError(error) {
  return {
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
  };
}

// ============================================
// CONTAINER MANAGEMENT
// ============================================

/**
 * Ensure container exists (called on startup)
 */
async function ensureContainerExists() {
  try {
    const exists = await containerClient.exists();

    if (!exists) {
      console.log(`Creating container: ${CONTAINER_NAME}...`);
      await containerClient.create({
        access: "blob", // Public read access to blobs
      });
      console.log(`✅ Container ${CONTAINER_NAME} created`);
    } else {
      console.log(`✅ Container ${CONTAINER_NAME} exists`);
    }
  } catch (error) {
    // Ignore if container already exists (race condition)
    if (error.statusCode === 409) {
      console.log(`ℹ️ Container ${CONTAINER_NAME} already exists`);
      return;
    }

    console.error(
      "❌ Failed to ensure container exists:",
      sanitizeError(error)
    );
    throw new Error(`Failed to create container: ${error.message}`);
  }
}

// Ensure container exists on startup
ensureContainerExists().catch((error) => {
  console.error("CRITICAL: Container initialization failed:", error);
});

// ============================================
// BLOB OPERATIONS
// ============================================

/**
 * Upload file to Azure Blob Storage
 * FIXED: Added validation, retry logic, unique naming, error handling
 *
 * @param {Buffer} fileBuffer - File data as buffer
 * @param {string} fileName - Original filename
 * @param {string} mimeType - MIME type of the file
 * @param {Object} options - Optional settings
 * @param {boolean} options.useUniqueFilename - Generate unique filename (default: true)
 * @returns {Promise<string>} URL of uploaded blob
 */
async function uploadToBlob(fileBuffer, fileName, mimeType, options = {}) {
  try {
    // Validate inputs
    const validatedBuffer = validateFileBuffer(fileBuffer);
    const validatedMimeType = validateMimeType(mimeType);

    // Generate filename (unique by default to prevent conflicts)
    const useUniqueFilename = options.useUniqueFilename !== false;
    const finalFilename = useUniqueFilename
      ? generateUniqueFilename(fileName)
      : sanitizeFilename(fileName);

    console.log(
      `Uploading file: ${finalFilename} (${formatBytes(
        validatedBuffer.length
      )})`
    );

    const blockBlobClient = containerClient.getBlockBlobClient(finalFilename);

    // Upload with retry logic
    await retryOperation(
      () =>
        blockBlobClient.uploadData(validatedBuffer, {
          blobHTTPHeaders: {
            blobContentType: validatedMimeType,
          },
          metadata: {
            originalName: fileName,
            uploadedAt: new Date().toISOString(),
          },
        }),
      `Upload blob ${finalFilename}`
    );

    console.log(`✅ File uploaded successfully: ${blockBlobClient.url}`);
    return blockBlobClient.url;
  } catch (error) {
    console.error("❌ Upload to blob failed:", sanitizeError(error));
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Get blob client from file URL
 * FIXED: Added validation and error handling
 *
 * @param {string} fileUrl - Full URL to the blob
 * @returns {BlobClient} Blob client instance
 */
function getBlobClient(fileUrl) {
  try {
    if (!fileUrl || typeof fileUrl !== "string") {
      throw new Error("Valid file URL is required");
    }

    // Extract blob name from URL
    const urlParts = fileUrl.split("/");
    const blobName = urlParts[urlParts.length - 1];

    if (!blobName) {
      throw new Error("Could not extract blob name from URL");
    }

    // Decode URL-encoded characters
    const decodedBlobName = decodeURIComponent(blobName);

    return containerClient.getBlobClient(decodedBlobName);
  } catch (error) {
    console.error("❌ Failed to get blob client:", sanitizeError(error));
    throw new Error(`Failed to get blob client: ${error.message}`);
  }
}

/**
 * Delete blob from storage
 * NEW: Added delete functionality
 *
 * @param {string} fileUrl - Full URL to the blob
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteBlob(fileUrl) {
  try {
    const blobClient = getBlobClient(fileUrl);

    const deleted = await retryOperation(
      () => blobClient.deleteIfExists(),
      `Delete blob ${blobClient.name}`
    );

    if (deleted) {
      console.log(`✅ Blob deleted: ${blobClient.name}`);
    } else {
      console.log(`ℹ️ Blob not found: ${blobClient.name}`);
    }

    return deleted;
  } catch (error) {
    console.error("❌ Failed to delete blob:", sanitizeError(error));
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Check if blob exists
 * NEW: Added existence check
 *
 * @param {string} fileUrl - Full URL to the blob
 * @returns {Promise<boolean>} True if exists
 */
async function blobExists(fileUrl) {
  try {
    const blobClient = getBlobClient(fileUrl);

    return await retryOperation(
      () => blobClient.exists(),
      `Check blob existence ${blobClient.name}`
    );
  } catch (error) {
    console.error("❌ Failed to check blob existence:", sanitizeError(error));
    return false;
  }
}

/**
 * Get blob metadata
 * NEW: Added metadata retrieval
 *
 * @param {string} fileUrl - Full URL to the blob
 * @returns {Promise<Object>} Blob properties and metadata
 */
async function getBlobMetadata(fileUrl) {
  try {
    const blobClient = getBlobClient(fileUrl);

    const properties = await retryOperation(
      () => blobClient.getProperties(),
      `Get blob metadata ${blobClient.name}`
    );

    return {
      size: properties.contentLength,
      contentType: properties.contentType,
      lastModified: properties.lastModified,
      metadata: properties.metadata,
    };
  } catch (error) {
    console.error("❌ Failed to get blob metadata:", sanitizeError(error));
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * Download blob as buffer
 * NEW: Added download functionality
 *
 * @param {string} fileUrl - Full URL to the blob
 * @returns {Promise<Buffer>} File data as buffer
 */
async function downloadBlob(fileUrl) {
  try {
    const blobClient = getBlobClient(fileUrl);

    const downloadResponse = await retryOperation(
      () => blobClient.download(),
      `Download blob ${blobClient.name}`
    );

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    console.log(
      `✅ Downloaded blob: ${blobClient.name} (${formatBytes(buffer.length)})`
    );

    return buffer;
  } catch (error) {
    console.error("❌ Failed to download blob:", sanitizeError(error));
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

/**
 * List all blobs in container
 * NEW: Added list functionality
 *
 * @param {Object} options - List options
 * @param {string} options.prefix - Filter by prefix
 * @param {number} options.maxResults - Max results to return
 * @returns {Promise<Array>} Array of blob items
 */
async function listBlobs(options = {}) {
  try {
    const blobs = [];

    const listOptions = {
      prefix: options.prefix || undefined,
    };

    const maxResults = options.maxResults || 1000;

    for await (const blob of containerClient.listBlobsFlat(listOptions)) {
      blobs.push({
        name: blob.name,
        url: `${containerClient.url}/${blob.name}`,
        size: blob.properties.contentLength,
        contentType: blob.properties.contentType,
        lastModified: blob.properties.lastModified,
      });

      if (blobs.length >= maxResults) {
        break;
      }
    }

    console.log(`✅ Listed ${blobs.length} blobs`);
    return blobs;
  } catch (error) {
    console.error("❌ Failed to list blobs:", sanitizeError(error));
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

/**
 * Get storage statistics
 * NEW: Added statistics
 *
 * @returns {Promise<Object>} Storage statistics
 */
async function getStorageStats() {
  try {
    let totalSize = 0;
    let totalCount = 0;
    const byType = {};

    for await (const blob of containerClient.listBlobsFlat()) {
      totalSize += blob.properties.contentLength || 0;
      totalCount++;

      const contentType = blob.properties.contentType || "unknown";
      byType[contentType] = (byType[contentType] || 0) + 1;
    }

    return {
      totalFiles: totalCount,
      totalSize: totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      byContentType: byType,
    };
  } catch (error) {
    console.error("❌ Failed to get storage stats:", sanitizeError(error));
    throw new Error(`Failed to get storage statistics: ${error.message}`);
  }
}

/**
 * Health check for Azure Blob Storage
 * NEW: Added health check
 */
async function checkHealth() {
  try {
    const exists = await containerClient.exists();

    return {
      healthy: exists,
      container: CONTAINER_NAME,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Blob storage health check failed:", sanitizeError(error));
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core operations
  uploadToBlob,
  getBlobClient,
  deleteBlob,
  downloadBlob,

  // Metadata & utilities
  blobExists,
  getBlobMetadata,
  listBlobs,
  getStorageStats,

  // Health
  checkHealth,

  // Utilities
  sanitizeFilename,
  generateUniqueFilename,
  formatBytes,

  // Constants
  CONTAINER_NAME,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
};
