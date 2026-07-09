if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const required = ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET", "FRONTEND_URL"];
const missing = required.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error("❌ Missing required environment variables:", missing);
  process.exit(1);
}

const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { poolPromise } = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.GATEWAY_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : []),
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://localhost:4000", "http://localhost:5000"]
    : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("CORS policy violation"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
}));

app.use(cookieParser());

// Stripe webhook needs raw body — all other routes get JSON
app.use((req, res, next) => {
  if (req.originalUrl === "/payments/webhook") {
    express.raw({ type: "*/*" })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});
app.use((req, res, next) => {
  if (req.originalUrl !== "/payments/webhook") {
    express.urlencoded({ extended: true })(req, res, next);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.id);
  next();
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});
app.use(globalLimiter);

app.get("/health", async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().query("SELECT 1");
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
    res.json({
      success: true,
      service: "payment-service",
      status: stripeConfigured ? "OK" : "degraded",
      stripe: stripeConfigured ? "configured" : "not configured",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ success: false, service: "payment-service", status: "ERROR" });
  }
});

const paymentRoutes = require("./routes/paymentRoutes");
const couponRoutes = require("./routes/couponRoutes");

app.use("/payments", paymentRoutes);
app.use("/coupons", couponRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

async function start() {
  try {
    const pool = await poolPromise;
    await pool.request().query("SELECT 1");
    console.log("✅ payment-service: database connected");

    const PORT = process.env.PORT || 5003;
    http.createServer(app).listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 payment-service running on port ${PORT}`);
      if (!process.env.STRIPE_SECRET_KEY) {
        console.warn("⚠️  STRIPE_SECRET_KEY not set — payment endpoints will return 503");
      }
    });
  } catch (err) {
    console.error("❌ payment-service failed to start:", err);
    process.exit(1);
  }
}

start();

module.exports = app;
