// =============================================
// paymentRoutes.js - Payment Processing Routes
// Stripe integration with Credit Card and Google Pay
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const Stripe = require("stripe");
const { poolPromise, sql } = require("../config/db");
const {
  authMiddleware,
  requireAttorney,
  requireJuror,
} = require("../middleware/authMiddleware");

// Import models
const Case = require("../models/Case");
const Payment = require("../models/Payment");
const Event = require("../models/Event");
const Notification = require("../models/Notification");

// Import controllers
const paymentController = require("../controllers/paymentController");

// ============================================
// STRIPE CONFIGURATION
// ============================================

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.error("WARNING: STRIPE_SECRET_KEY not configured");
}

const stripe = stripeSecretKey ? Stripe(stripeSecretKey) : null;

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Strict rate limiter for payment operations
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: {
    success: false,
    message: "Too many payment attempts. Please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General payment operations limiter
 */
const generalPaymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// MIDDLEWARE
// ============================================

router.use(authMiddleware);

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate amount
 */
const validateAmount = (amount) => {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error("Invalid amount");
  }
  
  if (numAmount < 1) {
    throw new Error("Amount must be at least $1.00");
  }
  
  if (numAmount > 10000) {
    throw new Error("Amount cannot exceed $10,000.00");
  }
  
  return Math.round(numAmount * 100); // Convert to cents
};

/**
 * Validate case ID
 */
const validateCaseId = (req, res, next) => {
  const caseId = parseInt(req.body.caseId || req.params.caseId, 10);
  
  if (isNaN(caseId) || caseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid case ID is required",
    });
  }
  
  req.validatedCaseId = caseId;
  next();
};

// ============================================
// STRIPE HELPER FUNCTIONS
// ============================================

/**
 * Create Stripe customer
 */
async function createStripeCustomer(user, email) {
  if (!stripe) throw new Error("Stripe not configured");
  
  return await stripe.customers.create({
    email: email || user.email,
    name: `${user.firstName} ${user.lastName}`,
    metadata: {
      userId: user.id.toString(),
      userType: user.type,
    },
  });
}

/**
 * Get or create Stripe customer
 */
async function getOrCreateCustomer(user) {
  if (!stripe) throw new Error("Stripe not configured");
  
  // Check if user already has a Stripe customer ID
  if (user.stripeCustomerId) {
    try {
      return await stripe.customers.retrieve(user.stripeCustomerId);
    } catch (error) {
      console.error("Error retrieving Stripe customer:", error);
    }
  }
  
  // Create new customer
  const customer = await createStripeCustomer(user, user.email);
  
  // Save customer ID to database
  const pool = await poolPromise;
  await pool
    .request()
    .input("userId", sql.Int, user.id)
    .input("customerId", sql.NVarChar(255), customer.id)
    .query(`
      UPDATE dbo.Attorneys
      SET StripeCustomerId = @customerId
      WHERE AttorneyId = @userId
    `);
  
  return customer;
}

// ============================================
// PAYMENT INTENT ROUTES
// ============================================

/**
 * POST /api/payments/create-payment-intent
 * Create a payment intent for case payment
 */
router.post(
  "/create-payment-intent",
  paymentLimiter,
  requireAttorney,
  validateCaseId,
  async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({
          success: false,
          message: "Payment service not available",
        });
      }

      const caseId = req.validatedCaseId;
      const { paymentMethod } = req.body; // 'card' or 'google_pay'
      const user = req.user;

      // Validate payment method
      const validMethods = ['card', 'google_pay'];
      if (!paymentMethod || !validMethods.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: "Valid payment method is required (card or google_pay)",
        });
      }

      // Get case details
      const caseData = await Case.findById(caseId);
      
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }

      // Verify attorney owns the case
      if (caseData.AttorneyId !== user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Check if case already paid
      if (caseData.PaymentStatus === 'completed') {
        return res.status(400).json({
          success: false,
          message: "This case has already been paid",
        });
      }

      // Validate and convert amount
      let amountInCents;
      try {
        amountInCents = validateAmount(caseData.PaymentAmount);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      // Get or create Stripe customer
      const customer = await getOrCreateCustomer(user);

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        customer: customer.id,
        payment_method_types: paymentMethod === 'google_pay' 
          ? ['card'] // Google Pay uses card under the hood
          : ['card'],
        metadata: {
          caseId: caseId.toString(),
          attorneyId: user.id.toString(),
          caseTitle: caseData.CaseTitle,
          paymentMethod: paymentMethod,
        },
        description: `Payment for case: ${caseData.CaseTitle}`,
      });

      // Record payment intent in database
      await Payment.createPaymentIntent({
        caseId,
        attorneyId: user.id,
        stripePaymentIntentId: paymentIntent.id,
        amount: caseData.PaymentAmount,
        currency: 'USD',
        paymentMethod: paymentMethod,
        status: 'pending',
      });

      res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: caseData.PaymentAmount,
        currency: 'usd',
      });
    } catch (error) {
      console.error("Create payment intent error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create payment intent",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/payments/confirm-payment
 * Confirm payment and update case status
 */
router.post(
  "/confirm-payment",
  generalPaymentLimiter,
  requireAttorney,
  async (req, res) => {
    try {
      const { paymentIntentId } = req.body;
      const user = req.user;

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          message: "Payment intent ID is required",
        });
      }

      if (!stripe) {
        return res.status(503).json({
          success: false,
          message: "Payment service not available",
        });
      }

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: "Payment not successful",
          status: paymentIntent.status,
        });
      }

      // Get payment record
      const payment = await Payment.findByStripeIntentId(paymentIntentId);
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment record not found",
        });
      }

      // Verify attorney owns this payment
      if (payment.AttorneyId !== user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Update payment status
      await Payment.updatePaymentStatus(payment.PaymentId, 'completed');

      // Update case payment status
      await Case.updateCasePaymentStatus(payment.CaseId, 'completed');

      // Create event
      await Event.createEvent({
        caseId: payment.CaseId,
        eventType: Event.EVENT_TYPES.PAYMENT_PROCESSED,
        description: `Payment completed: $${payment.Amount}`,
        triggeredBy: user.id,
        userType: 'attorney',
      });

      // Get first active admin to send notification
      const Admin = require("../models/Admin");
      const adminsResult = await Admin.getAllAdmins({ isActive: true, limit: 1 });
      const firstAdmin = adminsResult.admins[0];

      if (firstAdmin) {
        // Notify admin
        await Notification.createNotification({
          userId: firstAdmin.AdminId,
          userType: Notification.USER_TYPES.ADMIN,
          caseId: payment.CaseId,
          type: Notification.NOTIFICATION_TYPES.PAYMENT_RECEIVED,
          title: "Payment Received",
          message: `Payment of $${payment.Amount} received for case`,
        });
      }

      res.json({
        success: true,
        message: "Payment confirmed successfully",
        payment: {
          id: payment.PaymentId,
          amount: payment.Amount,
          status: 'completed',
        },
      });
    } catch (error) {
      console.error("Confirm payment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to confirm payment",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

// ============================================
// PAYMENT HISTORY ROUTES
// ============================================

/**
 * GET /api/payments/history
 * Get payment history for attorney
 */
router.get(
  "/history",
  generalPaymentLimiter,
  requireAttorney,
  async (req, res) => {
    try {
      const attorneyId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const payments = await Payment.getPaymentsByAttorney(
        attorneyId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        payments: payments.data,
        pagination: payments.pagination,
      });
    } catch (error) {
      console.error("Get payment history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment history",
      });
    }
  }
);

/**
 * GET /api/payments/:paymentId
 * Get specific payment details
 */
router.get(
  "/:paymentId",
  generalPaymentLimiter,
  requireAttorney,
  async (req, res) => {
    try {
      const paymentId = parseInt(req.params.paymentId, 10);
      const attorneyId = req.user.id;

      if (isNaN(paymentId) || paymentId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid payment ID is required",
        });
      }

      const payment = await Payment.findById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      // Verify attorney owns this payment
      if (payment.AttorneyId !== attorneyId) {
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
      console.error("Get payment details error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment details",
      });
    }
  }
);

// ============================================
// WEBHOOK ROUTE
// ============================================

/**
 * POST /api/payments/webhook
 * Stripe webhook handler
 * NOTE: This route should NOT use authMiddleware
 */
router.post(
  "/webhook",
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      if (!stripe || !stripeWebhookSecret) {
        return res.status(503).send("Webhook not configured");
      }

      const sig = req.headers['stripe-signature'];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          stripeWebhookSecret
        );
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          await handlePaymentSuccess(paymentIntent);
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          await handlePaymentFailure(failedPayment);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook handler error:", error);
      res.status(500).send("Webhook handler error");
    }
  }
);

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(paymentIntent) {
  try {
    const caseId = parseInt(paymentIntent.metadata.caseId);
    
    // Update payment status
    await Payment.updatePaymentStatusByStripeId(
      paymentIntent.id,
      'completed'
    );

    // Update case payment status
    await Case.updateCasePaymentStatus(caseId, 'completed');

    console.log(`Payment succeeded for case ${caseId}`);
  } catch (error) {
    console.error("Handle payment success error:", error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(paymentIntent) {
  try {
    const caseId = parseInt(paymentIntent.metadata.caseId);
    
    // Update payment status
    await Payment.updatePaymentStatusByStripeId(
      paymentIntent.id,
      'failed'
    );

    console.log(`Payment failed for case ${caseId}`);
  } catch (error) {
    console.error("Handle payment failure error:", error);
  }
}

// ============================================
// PAYMENT STATS AND HISTORY ROUTES
// ============================================

/**
 * GET /api/payments/attorney/payments
 * Get attorney's payment history
 */
router.get(
  "/attorney/payments",
  generalPaymentLimiter,
  requireAttorney,
  paymentController.getAttorneyPayments
);

/**
 * GET /api/payments/attorney/stats
 * Get attorney's payment statistics
 */
router.get(
  "/attorney/stats",
  generalPaymentLimiter,
  requireAttorney,
  paymentController.getAttorneyPaymentStats
);

/**
 * GET /api/payments/juror/payments
 * Get juror's payment history
 */
router.get(
  "/juror/payments",
  generalPaymentLimiter,
  requireJuror,
  paymentController.getJurorPayments
);

/**
 * GET /api/payments/juror/stats
 * Get juror's earnings statistics
 */
router.get(
  "/juror/stats",
  generalPaymentLimiter,
  requireJuror,
  paymentController.getJurorPaymentStats
);

/**
 * GET /api/payments/details/:paymentId
 * Get payment details by ID
 */
router.get(
  "/details/:paymentId",
  generalPaymentLimiter,
  paymentController.getPaymentById
);

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/payments/health
 * Health check for payment service
 */
router.get("/health", (req, res) => {
  const isConfigured = !!(stripe && stripeSecretKey);
  
  res.json({
    success: true,
    status: isConfigured ? "healthy" : "degraded",
    service: "payments",
    provider: "stripe",
    configured: isConfigured,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("Payment Route Error:", error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Payment processing error",
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
});

// ============================================
// EXPORTS
// ============================================

module.exports = router;