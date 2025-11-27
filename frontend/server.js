const express = require("express");
const next = require("next");
const path = require("path");

// ============================================
// CONFIGURATION
// ============================================
const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT, 10) || 8080;

// ============================================
// INITIALIZE NEXT.JS
// ============================================
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ============================================
// START SERVER WITH EXPRESS
// ============================================
app
  .prepare()
  .then(() => {
    const server = express();

    // Trust proxy for Azure
    server.set("trust proxy", 1);

    // ============================================
    // SERVE STATIC FILES WITH CORRECT MIME TYPES
    // ============================================

    // Serve Next.js static files (_next/static/*)
    server.use(
      "/_next/static",
      express.static(path.join(__dirname, ".next/static"), {
        maxAge: "365d",
        immutable: true,
        setHeaders: (res, filePath) => {
          // Set correct MIME types
          if (filePath.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
          } else if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
            res.setHeader(
              "Content-Type",
              "application/javascript; charset=utf-8"
            );
          } else if (filePath.endsWith(".json")) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
          } else if (filePath.endsWith(".woff")) {
            res.setHeader("Content-Type", "font/woff");
          } else if (filePath.endsWith(".woff2")) {
            res.setHeader("Content-Type", "font/woff2");
          } else if (filePath.endsWith(".map")) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
          } else if (filePath.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
        },
      })
    );

    // Serve public folder - BUT SKIP index.html (let Next.js handle root)
    server.use(
      express.static(path.join(__dirname, "public"), {
        maxAge: "7d",
        index: false, // ← CRITICAL FIX: Don't serve index.html from public
      })
    );

    // ============================================
    // HANDLE ALL OTHER REQUESTS WITH NEXT.JS
    // ============================================
    server.all("*", (req, res) => {
      return handle(req, res);
    });

    // ============================================
    // START LISTENING
    // ============================================
    server.listen(port, hostname, (err) => {
      if (err) throw err;
      console.log("═══════════════════════════════════════════════");
      console.log(`🚀 Frontend server running on http://${hostname}:${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔧 Dev mode: ${dev}`);
      console.log(`✅ Express middleware: Enabled`);
      console.log(`📁 Static files: .next/static & public`);
      console.log("═══════════════════════════════════════════════");
    });
  })
  .catch((err) => {
    console.error("❌ Error starting server:", err);
    process.exit(1);
  });
