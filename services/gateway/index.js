if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const required = ["FRONTEND_URL"];
const missing = required.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error("❌ Missing required environment variables:", missing);
  process.exit(1);
}

const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : []),
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://localhost:4000"]
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

// Request ID
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.id);
  next();
});

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});
app.use(globalLimiter);

// ── Service URLs ──────────────────────────────────────────────
const SERVICES = {
  auth:         process.env.AUTH_SERVICE_URL         || "http://localhost:5001",
  notification: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:5002",
  payment:      process.env.PAYMENT_SERVICE_URL      || "http://localhost:5003",
  case:         process.env.CASE_SERVICE_URL         || "http://localhost:5004",
  trial:        process.env.TRIAL_SERVICE_URL        || "http://localhost:5005",
  warRoom:      process.env.WAR_ROOM_SERVICE_URL     || "http://localhost:5006",
  verdict:      process.env.VERDICT_SERVICE_URL      || "http://localhost:5007",
  attorney:     process.env.ATTORNEY_SERVICE_URL     || "http://localhost:5008",
  juror:        process.env.JUROR_SERVICE_URL        || "http://localhost:5009",
  admin:        process.env.ADMIN_SERVICE_URL        || "http://localhost:5010",
  monolith:     process.env.MONOLITH_URL             || "http://localhost:4000",
};

// ── Proxy helper ──────────────────────────────────────────────
function proxy(target, pathRewrite) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    // Stripe webhook needs raw body — pass buffers through untouched
    selfHandleResponse: false,
    on: {
      error: (err, req, res) => {
        console.error(`[gateway] proxy error → ${target}: ${err.message}`);
        res.status(502).json({ success: false, error: "Service temporarily unavailable" });
      },
    },
  });
}

// ── Gateway health ────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "gateway",
    status: "OK",
    services: SERVICES,
    timestamp: new Date().toISOString(),
  });
});

// ── Route table ───────────────────────────────────────────────
//
//  /api/auth/*              → auth-service        :5001  /auth/*
//  /api/notifications/*     → notification-service:5002  /notifications/*
//  /api/payments/*          → payment-service     :5003  /payments/*
//  /api/coupons/*           → payment-service     :5003  /coupons/*
//  /api/case/*              → case-service        :5004  /cases/*  (witnesses, tier-upgrades included)
//  /api/trial/*             → trial-service       :5005  /trials/*
//  /api/trials/*            → trial-service       :5005  /schedule/*
//  /api/war-room/*          → war-room-service    :5006  /war-room/*
//  /api/jury-charge/*       → verdict-service     :5007  /jury-charge/*
//  /api/verdicts/*          → verdict-service     :5007  /verdicts/*
//  /api/attorney/*          → attorney-service    :5008  /attorneys/*
//  /api/juror/*             → juror-service       :5009  /jurors/*
//  /api/admin-calendar/*    → admin-service       :5010  /admin/calendar/*
//  /api/admin/*             → admin-service       :5010  /admin/*
//  /api/files/*             → monolith            :4000  (not yet migrated)
//  /api/recordings/*        → monolith            :4000  (not yet migrated)
//  /api/diagnostic/*        → monolith            :4000  (not yet migrated)

app.use("/api/auth",
  proxy(SERVICES.auth, { "^/api/auth": "/auth" }));

app.use("/api/notifications",
  proxy(SERVICES.notification, { "^/api/notifications": "/notifications" }));

app.use("/api/payments",
  proxy(SERVICES.payment, { "^/api/payments": "/payments" }));

app.use("/api/coupons",
  proxy(SERVICES.payment, { "^/api/coupons": "/coupons" }));

app.use("/api/case",
  proxy(SERVICES.case, { "^/api/case": "/cases" }));

// /api/trial/* → trial-service /trials/*
app.use("/api/trial",
  proxy(SERVICES.trial, { "^/api/trial": "/trials" }));

// /api/trials/* → trial-service /schedule/* (scheduleTrial routes)
app.use("/api/trials",
  proxy(SERVICES.trial, { "^/api/trials": "/schedule" }));

app.use("/api/war-room",
  proxy(SERVICES.warRoom, { "^/api/war-room": "/war-room" }));

app.use("/api/jury-charge",
  proxy(SERVICES.verdict, { "^/api/jury-charge": "/jury-charge" }));

app.use("/api/verdicts",
  proxy(SERVICES.verdict, { "^/api/verdicts": "/verdicts" }));

app.use("/api/attorney",
  proxy(SERVICES.attorney, { "^/api/attorney": "/attorneys" }));

app.use("/api/juror",
  proxy(SERVICES.juror, { "^/api/juror": "/jurors" }));

// admin-calendar must come before /api/admin to avoid prefix collision
app.use("/api/admin-calendar",
  proxy(SERVICES.admin, { "^/api/admin-calendar": "/admin/calendar" }));

app.use("/api/admin",
  proxy(SERVICES.admin, { "^/api/admin": "/admin" }));

// ── Monolith fallback (not yet migrated) ─────────────────────
app.use("/api/files",      proxy(SERVICES.monolith));
app.use("/api/recordings", proxy(SERVICES.monolith));
app.use("/api/diagnostic", proxy(SERVICES.monolith));

// ── 404 catch-all ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.originalUrl}` });
});

const PORT = process.env.PORT || 5000;
http.createServer(app).listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 gateway running on port ${PORT}`);
  console.log("📡 Service routing:");
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`   ${name.padEnd(12)} → ${url}`);
  });
});

module.exports = app;
