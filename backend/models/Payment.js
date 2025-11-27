// =============================================
// Payment.js - Payment Processing Model
// FIXED: Added SQL type safety, validation, better error handling
// =============================================

const { poolPromise, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

const PAYMENT_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
};

const PAYMENT_METHODS = {
  CREDIT_CARD: "credit_card",
  PAYPAL: "paypal",
  BANK_TRANSFER: "bank_transfer",
  CHECK: "check",
};

const PAYMENT_TYPES = {
  CASE_FILING: "case_filing",
  JUROR_PAYMENT: "juror_payment",
  ATTORNEY_FEE: "attorney_fee",
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate payment data
 * FIXED: Added validation
 */
function validatePaymentData(data) {
  const errors = [];

  if (!data.caseId || isNaN(parseInt(data.caseId))) {
    errors.push("Valid case ID is required");
  }
  if (
    !data.amount ||
    isNaN(parseFloat(data.amount)) ||
    parseFloat(data.amount) <= 0
  ) {
    errors.push("Valid payment amount is required");
  }
  if (!data.paymentMethod || typeof data.paymentMethod !== "string") {
    errors.push("Payment method is required");
  }

  if (errors.length > 0) {
    throw new Error(`Payment validation failed: ${errors.join(", ")}`);
  }
}

// ============================================
// PAYMENT OPERATIONS
// ============================================

/**
 * Create payment record
 * FIXED: Added validation and SQL type safety
 *
 * @param {Object} paymentData - Payment data
 * @returns {Promise<number>} New payment ID
 */
async function createPayment(paymentData) {
  try {
    // Validate payment data
    validatePaymentData(paymentData);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(paymentData.caseId))
      .input(
        "userId",
        sql.Int,
        paymentData.userId ? parseInt(paymentData.userId) : null
      )
      .input("userType", sql.NVarChar, paymentData.userType || null)
      .input("amount", sql.Decimal(10, 2), parseFloat(paymentData.amount))
      .input("paymentMethod", sql.NVarChar, paymentData.paymentMethod.trim())
      .input(
        "paymentType",
        sql.NVarChar,
        paymentData.paymentType || PAYMENT_TYPES.CASE_FILING
      )
      .input("status", sql.NVarChar, PAYMENT_STATUSES.PENDING)
      .input("transactionId", sql.NVarChar, paymentData.transactionId || null)
      .input("description", sql.NVarChar, paymentData.description || null)
      .query(`
        INSERT INTO dbo.Payments (
          CaseId, UserId, UserType, Amount, PaymentMethod, PaymentType,
          Status, TransactionId, Description, CreatedAt, UpdatedAt
        ) VALUES (
          @caseId, @userId, @userType, @amount, @paymentMethod, @paymentType,
          @status, @transactionId, @description, GETUTCDATE(), GETUTCDATE()
        );
        SELECT SCOPE_IDENTITY() as PaymentId;
      `);

    return result.recordset[0].PaymentId;
  } catch (error) {
    console.error("Error creating payment:", error);
    throw error;
  }
}

/**
 * Update payment status
 * FIXED: Added validation and SQL type safety
 *
 * @param {number} paymentId - Payment ID
 * @param {string} status - New status
 * @param {Object} metadata - Optional metadata (transactionId, errorMessage, etc.)
 * @returns {Promise<void>}
 */
async function updatePaymentStatus(paymentId, status, metadata = {}) {
  try {
    const id = parseInt(paymentId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid payment ID is required");
    }

    const validStatuses = Object.values(PAYMENT_STATUSES);
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    const pool = await poolPromise;
    const request = pool
      .request()
      .input("paymentId", sql.Int, id)
      .input("status", sql.NVarChar, status);

    let query = `
      UPDATE dbo.Payments 
      SET Status = @status,
          UpdatedAt = GETUTCDATE()
    `;

    // Add completion timestamp for completed/failed statuses
    if (status === PAYMENT_STATUSES.COMPLETED) {
      query += ", CompletedAt = GETUTCDATE()";
    }

    // Update transaction ID if provided
    if (metadata.transactionId) {
      query += ", TransactionId = @transactionId";
      request.input("transactionId", sql.NVarChar, metadata.transactionId);
    }

    // Update error message if provided
    if (metadata.errorMessage) {
      query += ", ErrorMessage = @errorMessage";
      request.input("errorMessage", sql.NVarChar, metadata.errorMessage);
    }

    query += " WHERE PaymentId = @paymentId";

    await request.query(query);
  } catch (error) {
    console.error("Error updating payment status:", error);
    throw error;
  }
}

/**
 * Get payment by ID
 * FIXED: Added SQL type safety
 *
 * @param {number} paymentId - Payment ID
 * @returns {Promise<Object|null>} Payment record
 */
async function findById(paymentId) {
  try {
    const id = parseInt(paymentId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid payment ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("paymentId", sql.Int, id).query(`
        SELECT 
          p.*,
          c.CaseTitle,
          c.County
        FROM dbo.Payments p
        LEFT JOIN dbo.Cases c ON p.CaseId = c.CaseId
        WHERE p.PaymentId = @paymentId
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error finding payment by ID:", error);
    throw error;
  }
}

/**
 * Get payments by case
 * FIXED: Added SQL type safety
 *
 * @param {number} caseId - Case ID
 * @returns {Promise<Array>} Array of payments
 */
async function getPaymentsByCase(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid case ID is required");
    }

    const pool = await poolPromise;
    const result = await pool.request().input("caseId", sql.Int, id).query(`
        SELECT *
        FROM dbo.Payments
        WHERE CaseId = @caseId
        ORDER BY CreatedAt DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting payments by case:", error);
    throw error;
  }
}

/**
 * Get payments by user
 * FIXED: Added SQL type safety
 *
 * @param {number} userId - User ID
 * @param {string} userType - User type
 * @returns {Promise<Array>} Array of payments
 */
async function getPaymentsByUser(userId, userType) {
  try {
    const id = parseInt(userId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid user ID is required");
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("userId", sql.Int, id)
      .input("userType", sql.NVarChar, userType).query(`
        SELECT 
          p.*,
          c.CaseTitle
        FROM dbo.Payments p
        LEFT JOIN dbo.Cases c ON p.CaseId = c.CaseId
        WHERE p.UserId = @userId AND p.UserType = @userType
        ORDER BY p.CreatedAt DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting payments by user:", error);
    throw error;
  }
}

/**
 * Get payment statistics
 * NEW: Added statistics function
 *
 * @param {number} days - Days to look back
 * @returns {Promise<Object>} Payment statistics
 */
async function getPaymentStatistics(days = 30) {
  try {
    const validDays = Math.min(365, Math.max(1, parseInt(days) || 30));

    const pool = await poolPromise;
    const result = await pool.request().input("days", sql.Int, validDays)
      .query(`
        SELECT 
          Status,
          PaymentType,
          COUNT(*) as Count,
          SUM(Amount) as TotalAmount,
          AVG(Amount) as AvgAmount,
          MIN(Amount) as MinAmount,
          MAX(Amount) as MaxAmount
        FROM dbo.Payments
        WHERE CreatedAt >= DATEADD(day, -@days, GETUTCDATE())
        GROUP BY Status, PaymentType
        ORDER BY Status, PaymentType
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting payment statistics:", error);
    throw error;
  }
}

/**
 * Process refund
 * NEW: Added refund function
 *
 * @param {number} paymentId - Payment ID to refund
 * @param {number} refundAmount - Amount to refund
 * @param {string} reason - Refund reason
 * @returns {Promise<number>} Refund payment ID
 */
async function processRefund(paymentId, refundAmount, reason) {
  try {
    const id = parseInt(paymentId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid payment ID is required");
    }

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Valid refund amount is required");
    }

    // Get original payment
    const originalPayment = await findById(id);
    if (!originalPayment) {
      throw new Error("Payment not found");
    }

    if (originalPayment.Status !== PAYMENT_STATUSES.COMPLETED) {
      throw new Error("Can only refund completed payments");
    }

    if (amount > originalPayment.Amount) {
      throw new Error("Refund amount cannot exceed original payment amount");
    }

    const pool = await poolPromise;

    // Create refund payment record
    const result = await pool
      .request()
      .input("caseId", sql.Int, originalPayment.CaseId)
      .input("userId", sql.Int, originalPayment.UserId)
      .input("userType", sql.NVarChar, originalPayment.UserType)
      .input("amount", sql.Decimal(10, 2), -amount) // Negative amount for refund
      .input("paymentMethod", sql.NVarChar, originalPayment.PaymentMethod)
      .input("paymentType", sql.NVarChar, originalPayment.PaymentType)
      .input("status", sql.NVarChar, PAYMENT_STATUSES.REFUNDED)
      .input("originalPaymentId", sql.Int, id)
      .input("description", sql.NVarChar, `Refund: ${reason}`).query(`
        INSERT INTO dbo.Payments (
          CaseId, UserId, UserType, Amount, PaymentMethod, PaymentType,
          Status, OriginalPaymentId, Description, CreatedAt, UpdatedAt, CompletedAt
        ) VALUES (
          @caseId, @userId, @userType, @amount, @paymentMethod, @paymentType,
          @status, @originalPaymentId, @description, GETUTCDATE(), GETUTCDATE(), GETUTCDATE()
        );
        SELECT SCOPE_IDENTITY() as PaymentId;
      `);

    // Update original payment status
    await pool
      .request()
      .input("paymentId", sql.Int, id)
      .input("status", sql.NVarChar, PAYMENT_STATUSES.REFUNDED).query(`
        UPDATE dbo.Payments
        SET Status = @status, UpdatedAt = GETUTCDATE()
        WHERE PaymentId = @paymentId
      `);

    return result.recordset[0].PaymentId;
  } catch (error) {
    console.error("Error processing refund:", error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_TYPES,

  // Core operations
  createPayment,
  updatePaymentStatus,
  findById,

  // Query operations
  getPaymentsByCase,
  getPaymentsByUser,

  // Refunds
  processRefund, // NEW

  // Statistics
  getPaymentStatistics, // NEW
};
