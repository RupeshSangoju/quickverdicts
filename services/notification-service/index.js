if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const required = ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET", "FRONTEND_URL"];
const missing = required.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error("❌ Missing required environment variables:", missing);
  process.exit(1);
}

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { poolPromise } = require("./config/db");
const notificationRoutes = require("./routes/notificationRoutes");
const Notification = require("./models/Notification");
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
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Internal-Token"],
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.id);
  next();
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});
app.use(globalLimiter);

// ─── Health check ───────────────────────────────────────────────
app.get("/health", async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().query("SELECT 1");
    res.json({ success: true, service: "notification-service", status: "OK", timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ success: false, service: "notification-service", status: "ERROR" });
  }
});

// ─── Internal endpoint: other services POST here to create notifications ────
// Protected by a shared internal token (INTERNAL_SERVICE_TOKEN env var).
app.post("/internal/notifications", (req, res, next) => {
  const token = req.headers["x-internal-token"];
  if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ success: false, error: "Unauthorized internal request" });
  }
  next();
}, async (req, res) => {
  try {
    const { userId, userType, caseId, type, title, message } = req.body;
    if (!userId || !userType || !type || !title || !message) {
      return res.status(400).json({ success: false, error: "Missing required fields: userId, userType, type, title, message" });
    }
    const notificationId = await Notification.createNotification({ userId, userType, caseId, type, title, message });
    res.status(201).json({ success: true, notificationId });
  } catch (err) {
    console.error("❌ [internal/notifications] Error:", err);
    res.status(500).json({ success: false, error: "Failed to create notification" });
  }
});

// ─── Public + authenticated notification routes ───────────────────
app.use("/notifications", notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

async function start() {
  try {
    const pool = await poolPromise;
    await pool.request().query("SELECT 1");
    console.log("✅ notification-service: database connected");

    const PORT = process.env.PORT || 5002;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 notification-service running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ notification-service failed to start:", err);
    process.exit(1);
  }
}

start();

module.exports = app;
