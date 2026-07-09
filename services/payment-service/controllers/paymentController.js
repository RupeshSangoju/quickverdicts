// =============================================
// paymentController.js - Payment Management Controller
// =============================================

const Payment = require("../models/Payment");

// ============================================
// ATTORNEY PAYMENT ENDPOINTS
// ============================================

/**
 * Get attorney's payment history
 * GET /api/attorney/payments
 */
async function getAttorneyPayments(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const attorneyId = req.user.id;
    const payments = await Payment.getPaymentsByUser(attorneyId, "attorney");

    res.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Get attorney payments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get attorney's payment statistics
 * GET /api/attorney/payments/stats
 */
async function getAttorneyPaymentStats(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const attorneyId = req.user.id;
    const payments = await Payment.getPaymentsByUser(attorneyId, "attorney");

    // Calculate statistics
    const totalPaid = payments
      .filter(p => p.Status === Payment.PAYMENT_STATUSES.COMPLETED)
      .reduce((sum, p) => sum + parseFloat(p.Amount), 0);

    const pendingPayments = payments.filter(
      p => p.Status === Payment.PAYMENT_STATUSES.PENDING ||
           p.Status === Payment.PAYMENT_STATUSES.PROCESSING
    ).length;

    const completedPayments = payments.filter(
      p => p.Status === Payment.PAYMENT_STATUSES.COMPLETED
    ).length;

    const failedPayments = payments.filter(
      p => p.Status === Payment.PAYMENT_STATUSES.FAILED
    ).length;

    res.json({
      success: true,
      stats: {
        totalPaid: totalPaid.toFixed(2),
        pendingPayments,
        completedPayments,
        failedPayments,
        totalTransactions: payments.length,
      },
    });
  } catch (error) {
    console.error("Get attorney payment stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ============================================
// JUROR PAYMENT ENDPOINTS
// ============================================

/**
 * Get juror's payment history
 * GET /api/juror/payments
 */
async function getJurorPayments(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const jurorId = req.user.id;
    const payments = await Payment.getPaymentsByUser(jurorId, "juror");

    res.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Get juror payments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get juror's earnings statistics
 * GET /api/juror/payments/stats
 */
async function getJurorPaymentStats(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const jurorId = req.user.id;
    const payments = await Payment.getPaymentsByUser(jurorId, "juror");

    // Calculate statistics
    const totalEarned = payments
      .filter(p => p.Status === Payment.PAYMENT_STATUSES.COMPLETED)
      .reduce((sum, p) => sum + parseFloat(p.Amount), 0);

    const pendingPayments = payments.filter(
      p => p.Status === Payment.PAYMENT_STATUSES.PENDING ||
           p.Status === Payment.PAYMENT_STATUSES.PROCESSING
    ).length;

    const completedPayments = payments.filter(
      p => p.Status === Payment.PAYMENT_STATUSES.COMPLETED
    ).length;

    const failedPayments = payments.filter(
      p => p.Status === Payment.PAYMENT_STATUSES.FAILED
    ).length;

    res.json({
      success: true,
      stats: {
        totalEarned: totalEarned.toFixed(2),
        pendingPayments,
        completedPayments,
        failedPayments,
        totalTransactions: payments.length,
      },
    });
  } catch (error) {
    console.error("Get juror payment stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ============================================
// PAYMENT DETAILS
// ============================================

/**
 * Get payment details by ID
 * GET /api/payments/:paymentId
 */
async function getPaymentById(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Verify user has access to this payment
    if (payment.UserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error("Get payment by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Attorney endpoints
  getAttorneyPayments,
  getAttorneyPaymentStats,

  // Juror endpoints
  getJurorPayments,
  getJurorPaymentStats,

  // Shared endpoints
  getPaymentById,
};
