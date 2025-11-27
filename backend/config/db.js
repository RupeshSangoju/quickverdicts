const sql = require("mssql");

// ============================================
// DATABASE CONFIGURATION
// ============================================

// Environment-based pool sizing
// Development: smaller pool
// Production: larger pool to handle more concurrent requests
const isProduction = process.env.NODE_ENV === "production";

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10) || 1433,

  options: {
    // Azure SQL requires encryption
    encrypt: true,

    // Trust server certificate only in development
    // In production, use proper SSL certificates
    trustServerCertificate: !isProduction,

    // Enable arithmetic abort for better error handling
    enableArithAbort: true,

    // Connection timeout: time to establish connection
    connectTimeout: 30000, // 30 seconds

    // Request timeout: time to execute query
    // Increase for complex queries or large data operations
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT, 10) || 60000, // 60 seconds

    // Transaction settings
    abortTransactionOnError: true,
    connectionIsolationLevel: sql.ISOLATION_LEVEL.READ_COMMITTED,

    // Application name for monitoring in Azure SQL
    appName: "QuickVerdicts-Backend",
  },

  pool: {
    // Minimum pool size - always keep this many connections alive
    min: parseInt(process.env.DB_POOL_MIN, 10) || (isProduction ? 5 : 2),

    // Maximum pool size - scale based on environment
    max: parseInt(process.env.DB_POOL_MAX, 10) || (isProduction ? 30 : 10),

    // Time to wait for available connection before timing out
    acquireTimeoutMillis: 30000, // 30 seconds

    // Idle timeout - close connections idle for this long
    // Increased from 30s to 10 minutes to reduce connection churn
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 600000, // 10 minutes

    // How often to check for idle connections to reap
    reapIntervalMillis: 1000,

    // Delay between connection creation retries
    createRetryIntervalMillis: 200,

    // Timeout for creating new connection
    createTimeoutMillis: 30000,

    // Timeout for destroying connection
    destroyTimeoutMillis: 5000,

    // Don't propagate errors during connection creation
    propagateCreateError: false,
  },
};

// Validate required configuration
if (!config.server || !config.database || !config.user || !config.password) {
  console.error("❌ Missing required database configuration!");
  console.error("Required: DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD");
  throw new Error("Database configuration incomplete");
}

// Log configuration (without sensitive data)
console.log("📊 Database configuration:", {
  server: config.server,
  database: config.database,
  port: config.port,
  poolMin: config.pool.min,
  poolMax: config.pool.max,
  environment: process.env.NODE_ENV || "development",
});

// ============================================
// CONNECTION STATE TRACKING
// ============================================
let poolInstance = null;
let isConnecting = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

// ============================================
// DATABASE CONNECTION POOL WITH RETRY LOGIC
// ============================================
const poolPromise = (async () => {
  // Return existing pool if already connected
  if (poolInstance && poolInstance.connected) {
    return poolInstance;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait for ongoing connection attempt
    while (isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (poolInstance && poolInstance.connected) {
      return poolInstance;
    }
  }

  isConnecting = true;

  try {
    console.log("🔌 Connecting to Azure SQL Database...");

    poolInstance = new sql.ConnectionPool(config);

    // Set up event listeners BEFORE connecting
    poolInstance.on("error", (err) => {
      console.error("❌ Database pool error:", err.message);

      // Attempt to reconnect on critical errors
      if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT") {
        console.log("🔄 Attempting to reconnect...");
        connectionAttempts++;

        if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
          setTimeout(() => {
            poolInstance = null;
            isConnecting = false;
          }, 5000);
        }
      }
    });

    poolInstance.on("close", () => {
      console.warn("⚠️  Database pool closed");
      poolInstance = null;
    });

    // Connect to the pool
    await poolInstance.connect();

    console.log("✅ Connected to Azure SQL Database");
    console.log(`📊 Database: ${config.database}`);
    console.log(`🖥️  Server: ${config.server}`);
    console.log(`🔗 Pool: min=${config.pool.min}, max=${config.pool.max}`);

    connectionAttempts = 0; // Reset on successful connection
    isConnecting = false;

    return poolInstance;
  } catch (err) {
    isConnecting = false;
    console.error("❌ Database connection failed:", err.message);
    console.error("   ⚙️  Check your .env file and Azure SQL credentials");
    console.error("   📋 Details:", {
      server: config.server,
      database: config.database,
      user: config.user,
      port: config.port,
    });

    // Don't throw immediately, allow retry logic
    if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
      console.log(
        `🔄 Retry attempt ${
          connectionAttempts + 1
        }/${MAX_RETRY_ATTEMPTS} in 5 seconds...`
      );
      connectionAttempts++;

      await new Promise((resolve) => setTimeout(resolve, 5000));
      return poolPromise; // Recursive retry
    }

    throw err; // Give up after max attempts
  }
})();

// ============================================
// HELPER: GET POOL (with connection check)
// ============================================
const getPool = async () => {
  try {
    const pool = await poolPromise;

    // Verify connection is still alive
    if (!pool.connected) {
      console.warn("⚠️  Pool exists but not connected, reconnecting...");
      poolInstance = null;
      return await poolPromise;
    }

    return pool;
  } catch (error) {
    console.error("❌ Failed to get database pool:", error.message);
    throw error;
  }
};

// ============================================
// HELPER: EXECUTE QUERY WITH RETRY
// ============================================
const executeQuery = async (queryFn, maxRetries = 2) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const pool = await getPool();
      return await queryFn(pool);
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable =
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ESOCKET" ||
        error.message.includes("Connection is closed");

      if (isRetryable && attempt < maxRetries) {
        console.warn(
          `⚠️  Query failed (attempt ${attempt + 1}/${
            maxRetries + 1
          }), retrying...`
        );
        poolInstance = null; // Force reconnection
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1))
        );
        continue;
      }

      break; // Not retryable or max retries reached
    }
  }

  throw lastError;
};

// ============================================
// HELPER: HEALTH CHECK
// ============================================
const healthCheck = async () => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT 1 as healthy");
    return {
      healthy: true,
      database: config.database,
      server: config.server,
      connected: pool.connected,
      poolSize: pool.size,
      poolAvailable: pool.available,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      database: config.database,
      server: config.server,
    };
  }
};

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const closePool = async () => {
  try {
    if (poolInstance) {
      console.log("🔌 Closing database connection pool...");
      await poolInstance.close();
      poolInstance = null;
      console.log("✅ Database connection pool closed");
    }
  } catch (err) {
    console.error("❌ Error closing database pool:", err.message);
  }
};

// Handle process termination
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection in database module:", reason);
});

// ============================================
// EXPORTS
// ============================================
module.exports = {
  sql,
  poolPromise,
  getPool,
  executeQuery,
  healthCheck,
  closePool,
};
