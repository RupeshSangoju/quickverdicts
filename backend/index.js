// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// ============================================
// ENVIRONMENT VALIDATION
// ============================================
const requiredEnvVars = [
  "DB_SERVER",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
  "FRONTEND_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach((varName) => console.error(`   - ${varName}`));
  process.exit(1);
}

// ============================================
// MODULE IMPORTS
// ============================================
const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

// ============================================
// CUSTOM MIDDLEWARE IMPORTS
// ============================================
let errorHandler;
try {
  errorHandler = require("./middleware/errorHandler");
  if (typeof errorHandler !== "function") {
    console.warn(
      "⚠️  errorHandler is not a function, will use default handler"
    );
    errorHandler = null;
  }
} catch (error) {
  console.warn("⚠️  Could not load errorHandler:", error.message);
  errorHandler = null;
}

// ============================================
// DATABASE CONNECTION
// ============================================
const { poolPromise } = require("./config/db");

// ============================================
// JOB SCHEDULER
// ============================================
const { startScheduler, stopScheduler } = require("./jobs/trialScheduler");
const { startReminderScheduler, stopReminderScheduler } = require("./jobs/trialReminderScheduler");

// ============================================
// WEBSOCKET SERVICE
// ============================================
const websocketService = require("./services/websocketService");

// ============================================
// SAFE ROUTE IMPORT FUNCTION
// ============================================
function safeRequireRoute(routePath, routeName) {
  try {
    const route = require(routePath);
    if (!route || typeof route !== "function") {
      console.error(
        `❌ Invalid export for route "${routeName}" (${routePath})`
      );
      return express.Router();
    }
    console.log(`✅ Route "${routeName}" loaded successfully`);
    return route;
  } catch (error) {
    console.error(
      `❌ Failed to load route "${routeName}" (${routePath}):`,
      error.message
    );
    return express.Router();
  }
}

// ============================================
// LOAD ROUTES
// ============================================
console.log("\n📦 Loading routes...");

const authRoutes = safeRequireRoute("./routes/authRoutes", "Auth");
const attorneyRoutes = safeRequireRoute("./routes/attorneyRoutes", "Attorney");
const jurorRoutes = safeRequireRoute("./routes/jurorRoutes", "Juror");
const scheduleTrialRoutes = safeRequireRoute(
  "./routes/scheduleTrial",
  "Schedule Trial"
);
const warRoomTeamRoutes = safeRequireRoute(
  "./routes/warRoomTeamRoutes",
  "War Room Team"
);
const warRoomDocumentRoutes = safeRequireRoute(
  "./routes/warRoomDocumentRoutes",
  "War Room Documents"
);
const warRoomVoirDireRoutes = safeRequireRoute(
  "./routes/warRoomVoirDireRoutes",
  "War Room Voir Dire"
);
const warRoomInfoRoutes = safeRequireRoute(
  "./routes/warRoomInfoRoutes",
  "War Room Info"
);
const warRoomApplicationRoutes = safeRequireRoute(
  "./routes/warRoomApplicationRoutes",
  "War Room Applications"
);
const fileRoutes = safeRequireRoute("./routes/fileRoutes", "Files");
const notificationRoutes = safeRequireRoute(
  "./routes/notificationRoutes",
  "Notifications"
);
const adminCalendarRoutes = safeRequireRoute(
  "./routes/adminCalendarRoutes",
  "Admin Calendar"
);
const adminRoutes = safeRequireRoute("./routes/admin", "Admin");
const trialRoutes = safeRequireRoute("./routes/trialRoutes", "Trial");
const witnessRoutes = safeRequireRoute("./routes/witnessRoutes", "Witness");
const tierUpgradeRoutes = safeRequireRoute(
  "./routes/tierUpgradeRoutes",
  "Tier Upgrade"
);
const caseRoutes = safeRequireRoute("./routes/caseRoutes", "Cases");
const paymentRoutes = safeRequireRoute("./routes/paymentRoutes", "Payment");
const diagnosticRoutes = safeRequireRoute("./routes/diagnosticRoutes", "Diagnostic");
const juryChargeRoutes = safeRequireRoute("./routes/juryChargeRoutes", "Jury Charge");
const verdictRoutes = safeRequireRoute("./routes/verdictRoutes", "Verdicts");
const recordingRoutes = safeRequireRoute("./routes/recordingRoutes", "Recordings");

console.log("✅ All routes loaded\n");

// ============================================
// EXPRESS APP INITIALIZATION
// ============================================
const app = express();
app.set("trust proxy", 1);

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", "https:"],
              scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
              imgSrc: ["'self'", "data:", "https:", "blob:"],
              connectSrc: [
                "'self'",
                "https:",
                "wss:",
                "https://*.communication.azure.com",
                "https://*.skype.com",
              ],
              mediaSrc: ["'self'", "https:", "blob:"],
              fontSrc: ["'self'", "https:", "data:"],
            },
          }
        : false,
  })
);

// ============================================
// CORS CONFIGURATION
// ============================================

// Build allowed origins list based on environment
const allowedOrigins = [];

// Always add configured URLs
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.PRODUCTION_URL) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

// Only add localhost origins in development
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:4000",
    "https://localhost:3000",
    "https://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:4000",
  );
}

// Remove duplicates and falsy values
const uniqueOrigins = [...new Set(allowedOrigins.filter(Boolean))];

console.log("🔒 CORS configured with allowed origins:", uniqueOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        // In production, you might want to be more restrictive
        if (process.env.NODE_ENV === "production" && process.env.STRICT_CORS === "true") {
          return callback(new Error("Origin header required"), false);
        }
        return callback(null, true);
      }

      // Check if origin is allowed
      if (uniqueOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Log blocked origins for debugging
      console.warn(`🚫 Blocked CORS request from origin: ${origin}`);
      const msg = "The CORS policy does not allow access from this origin.";
      return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-Requested-With",
      "Accept",
    ],
    exposedHeaders: [
      "X-Request-ID",
      "X-Response-Time",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "RateLimit-Policy",
    ],
    maxAge: 86400, // 24 hours - cache preflight requests
  })
);

// ============================================
// COOKIE PARSER
// ============================================
app.use(cookieParser());

// ============================================
// BODY PARSERS
// ============================================
// Increased limits to 4GB to support large file uploads (videos, document bundles)
app.use(express.json({ limit: "4gb" }));
app.use(express.urlencoded({ extended: true, limit: "4gb" }));

// ============================================
// REQUEST ID MIDDLEWARE
// ============================================
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.id);
  next();
});

// ============================================
// RESPONSE TIME MIDDLEWARE (FIXED)
// ============================================
app.use((req, res, next) => {
  const start = Date.now();

  // Intercept res.send to calculate duration
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;

    // Only set header if not already sent
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${duration}ms`);
    }

    // Log slow requests (over 3 seconds)
    if (duration > 3000) {
      console.warn(
        `⚠️  Slow request [${req.id}]: ${req.method} ${req.path} took ${duration}ms`
      );
    }

    // Call original send
    originalSend.call(this, data);
  };

  next();
});

// ============================================
// DEV REQUEST LOGGER
// ============================================
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[${req.id}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// RATE LIMITER
// ============================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  skip: (req) => req.path === "/api/health" || req.path === "/api/test-db",
});
app.use("/api", globalLimiter);

// ============================================
// HEALTH & DIAGNOSTIC ENDPOINTS
// ============================================
app.get("/api/health", async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().query("SELECT 1 as test");

    return res.json({
      success: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      database: "connected",
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "1.0.0",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return res.status(500).json({
      success: false,
      status: "ERROR",
      database: "disconnected",
      error: "Database connection failed",
    });
  }
});

app.get("/api/test-db", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT @@VERSION as version, GETDATE() as currentTime");
    return res.json({
      success: true,
      database: result.recordset[0],
    });
  } catch (err) {
    console.error("Database test error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ============================================
// URL NORMALIZATION
// ============================================
// If NEXT_PUBLIC_API_URL is configured without /api suffix, requests arrive
// at /auth/... instead of /api/auth/... — rewrite transparently so both work.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api") && req.path !== "/") {
    req.url = "/api" + req.url;
  }
  next();
});
// ============================================
// REGISTER API ROUTES
// ============================================
console.log("📍 Registering API routes...\n");

app.use("/api/auth", authRoutes);
app.use("/api/admin-calendar", adminCalendarRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/attorney", attorneyRoutes);
app.use("/api/juror", jurorRoutes);
app.use("/api/case", caseRoutes); // FIXED: Changed from /api/cases to /api/case
app.use("/api/case", witnessRoutes); // FIXED: Changed from /api/cases to /api/case
app.use("/api/case", tierUpgradeRoutes); // FIXED: Changed from /api/cases to /api/case
app.use("/api/trial", trialRoutes); // FIXED: Changed from /api/trials to /api/trial to match frontend
app.use("/api/trials", scheduleTrialRoutes);
app.use("/api/war-room", warRoomTeamRoutes);
app.use("/api/war-room", warRoomDocumentRoutes);
app.use("/api/war-room", warRoomVoirDireRoutes);
app.use("/api/war-room", warRoomInfoRoutes);
app.use("/api/war-room", warRoomApplicationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/diagnostic", diagnosticRoutes);
app.use("/api/jury-charge", juryChargeRoutes);
app.use("/api/verdicts", verdictRoutes);
app.use("/api/recordings", recordingRoutes);

console.log("\n✅ All routes registered\n");

// ============================================
// ROOT ENDPOINT
// ============================================
app.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "QuickVerdicts API Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/api/health",
      testDb: "/api/test-db",
      docs: "/api/docs",
    },
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    message: "The requested endpoint does not exist. Make sure NEXT_PUBLIC_API_URL ends with /api",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
if (errorHandler && typeof errorHandler === "function") {
  app.use(errorHandler);
} else {
  app.use((err, req, res, next) => {
    console.error(`[${req.id}] Error:`, err);

    const statusCode = err.status || err.statusCode || 500;
    const response = {
      success: false,
      error: err.message || "Internal Server Error",
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV === "development") {
      response.stack = err.stack;
      response.details = err.details;
    }

    // Don't try to send if already sent
    if (!res.headersSent) {
      return res.status(statusCode).json(response);
    }
  });
}

// ============================================
// SERVER STARTUP
// ============================================
async function startServer() {
  try {
    console.log("\n🔌 Connecting to database...");
    const pool = await poolPromise;
    await pool.request().query("SELECT 1 as test");
    console.log("✅ Database connection established\n");

    // ── Auto-migration: ensure QuestionType CHECK constraint includes 'Multiple Select' ──
    try {
      // Check current constraint definition
      const constraintCheck = await pool.request().query(`
        SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
        FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE AS ccu
        INNER JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS AS cc
          ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
        WHERE ccu.TABLE_NAME = 'JuryChargeQuestions'
          AND ccu.COLUMN_NAME = 'QuestionType'
      `);

      const existing = constraintCheck.recordset[0];
      const alreadyPatched =
        existing && existing.CHECK_CLAUSE.includes("Multiple Select");

      if (!alreadyPatched) {
        console.log("⚙️  Applying migration: add 'Multiple Select' to QuestionType constraint...");
        if (existing) {
          await pool.request().query(
            `ALTER TABLE dbo.JuryChargeQuestions DROP CONSTRAINT [${existing.CONSTRAINT_NAME}]`
          );
        }
        await pool.request().query(`
          ALTER TABLE dbo.JuryChargeQuestions
          ADD CONSTRAINT CK_JuryChargeQuestions_QuestionType
          CHECK (QuestionType IN ('Multiple Choice', 'Multiple Select', 'Yes/No', 'Text Response', 'Numeric Response'))
        `);
        console.log("✅ Migration applied: QuestionType constraint updated\n");
      } else {
        console.log("✅ QuestionType constraint already up-to-date\n");
      }
    } catch (migrationErr) {
      // Non-fatal — log and continue booting
      console.warn("⚠️  QuestionType constraint migration skipped:", migrationErr.message);
    }
    // ── End auto-migration ──

    const PORT = process.env.PORT || 4000;
    const HOST = process.env.HOST || "0.0.0.0";

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket service
    console.log("🔌 Initializing WebSocket service...");
    websocketService.initializeWebSocket(server);
    console.log("✅ WebSocket service initialized\n");

    server.listen(PORT, HOST, () => {
      console.log("═══════════════════════════════════════════════");
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(
        `🌐 Frontend URL: ${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }`
      );
      console.log(`🔒 CORS Origins: ${allowedOrigins.length} configured`);
      console.log(`🔌 WebSocket: Enabled on /socket.io`);
      console.log("═══════════════════════════════════════════════\n");

      // ✅ Start trial scheduler
      console.log("🕐 Initializing trial scheduler...");
      startScheduler();

      // ✅ Start trial reminder scheduler
      console.log("📧 Initializing trial reminder scheduler...");
      startReminderScheduler();
    });

    const shutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      // ✅ Stop trial scheduler
      stopScheduler();

      // ✅ Stop reminder scheduler
      stopReminderScheduler();

      server.close(async () => {
        console.log("✅ HTTP server closed");
        try {
          const pool = await poolPromise;
          await pool.close();
          console.log("✅ Database connections closed");
        } catch (error) {
          console.error("❌ Error closing database:", error);
        }
        console.log("👋 Process terminated");
        process.exit(0);
      });

      setTimeout(() => {
        console.error("⚠️  Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("\n❌ Failed to start server:");
    console.error(error);
    process.exit(1);
  }
}

// ============================================
// PROCESS ERROR HANDLERS
// ============================================
process.on("unhandledRejection", (reason, promise) => {
  console.error("\n❌ Unhandled Rejection at:", promise, "Reason:", reason);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

process.on("uncaughtException", (error) => {
  console.error("\n❌ Uncaught Exception:", error);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

// ============================================
// LAUNCH SERVER
// ============================================
startServer();

// ============================================
// EXPORT APP
// ============================================
module.exports = app;
