// =============================================
// WebSocket Service
// Handles real-time updates for jury charge and verdicts
// =============================================

const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.io instance
 */
function initializeWebSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        console.warn("⚠️  [WebSocket] Connection attempt without token");
        return next(new Error("Authentication required"));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      socket.userId = decoded.id;
      socket.userType = decoded.type;

      console.log(
        `✅ [WebSocket] Authenticated: ${socket.userType} #${socket.userId}`
      );
      next();
    } catch (error) {
      console.error("❌ [WebSocket] Authentication failed:", error.message);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    console.log(
      `🔌 [WebSocket] Client connected: ${socket.id} (${socket.userType} #${socket.userId})`
    );

    // Join case-specific room
    socket.on("join_case", (caseId) => {
      const roomName = `case_${caseId}`;
      socket.join(roomName);
      console.log(
        `📍 [WebSocket] ${socket.userType} #${socket.userId} joined ${roomName}`
      );

      socket.emit("joined_case", {
        success: true,
        caseId,
        message: `Joined case ${caseId}`,
      });
    });

    // Leave case-specific room
    socket.on("leave_case", (caseId) => {
      const roomName = `case_${caseId}`;
      socket.leave(roomName);
      console.log(
        `📍 [WebSocket] ${socket.userType} #${socket.userId} left ${roomName}`
      );
    });

    // Join jury charge builder room (attorney/admin during editing)
    socket.on("join_jury_charge_builder", (caseId) => {
      const roomName = `jury_charge_builder_${caseId}`;
      socket.join(roomName);
      console.log(
        `📝 [WebSocket] ${socket.userType} #${socket.userId} joined ${roomName}`
      );
    });

    // Join verdict monitoring room (admin)
    socket.on("join_verdict_monitoring", (caseId) => {
      const roomName = `verdict_monitoring_${caseId}`;
      socket.join(roomName);
      console.log(
        `📊 [WebSocket] ${socket.userType} #${socket.userId} joined ${roomName}`
      );
    });

    // Heartbeat/ping
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    // Disconnection
    socket.on("disconnect", (reason) => {
      console.log(
        `🔌 [WebSocket] Client disconnected: ${socket.id} (${reason})`
      );
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`❌ [WebSocket] Socket error:`, error);
    });
  });

  console.log("✅ [WebSocket] Server initialized");
  return io;
}

/**
 * Get Socket.io instance
 * @returns {Object} Socket.io instance
 */
function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initializeWebSocket first.");
  }
  return io;
}

// ============================================
// JURY CHARGE EVENTS
// ============================================

/**
 * Notify when jury charge question is added
 * @param {number} caseId
 * @param {Object} question - The added question
 */
function notifyQuestionAdded(caseId, question) {
  try {
    const roomName = `jury_charge_builder_${caseId}`;
    getIO().to(roomName).emit("jury_charge:question_added", {
      caseId,
      question,
      timestamp: new Date().toISOString(),
    });
    console.log(`📝 [WebSocket] Question added notification sent to ${roomName}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending question added event:", error);
  }
}

/**
 * Notify when jury charge question is updated
 * @param {number} caseId
 * @param {Object} question - The updated question
 */
function notifyQuestionUpdated(caseId, question) {
  try {
    const roomName = `jury_charge_builder_${caseId}`;
    getIO().to(roomName).emit("jury_charge:question_updated", {
      caseId,
      question,
      timestamp: new Date().toISOString(),
    });
    console.log(`📝 [WebSocket] Question updated notification sent to ${roomName}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending question updated event:", error);
  }
}

/**
 * Notify when jury charge question is deleted
 * @param {number} caseId
 * @param {number} questionId - The deleted question ID
 */
function notifyQuestionDeleted(caseId, questionId) {
  try {
    const roomName = `jury_charge_builder_${caseId}`;
    getIO().to(roomName).emit("jury_charge:question_deleted", {
      caseId,
      questionId,
      timestamp: new Date().toISOString(),
    });
    console.log(`📝 [WebSocket] Question deleted notification sent to ${roomName}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending question deleted event:", error);
  }
}

/**
 * Notify when jury charge questions are reordered
 * @param {number} caseId
 * @param {Array} questions - All questions in new order
 */
function notifyQuestionsReordered(caseId, questions) {
  try {
    const roomName = `jury_charge_builder_${caseId}`;
    getIO().to(roomName).emit("jury_charge:questions_reordered", {
      caseId,
      questions,
      timestamp: new Date().toISOString(),
    });
    console.log(`📝 [WebSocket] Questions reordered notification sent to ${roomName}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending questions reordered event:", error);
  }
}

/**
 * Notify when jury charge is released to jurors (LOCKS EDITING)
 * @param {number} caseId
 * @param {Object} releaseData - { releasedAt, releasedBy, questionCount }
 */
function notifyJuryChargeReleased(caseId, releaseData) {
  try {
    // Notify everyone in the case
    const caseRoom = `case_${caseId}`;
    getIO().to(caseRoom).emit("jury_charge:released", {
      caseId,
      ...releaseData,
      isLocked: true,
      timestamp: new Date().toISOString(),
    });

    // Notify jury charge builder room (attorneys)
    const builderRoom = `jury_charge_builder_${caseId}`;
    getIO().to(builderRoom).emit("jury_charge:locked", {
      caseId,
      message: "Jury charge has been released to jurors and is now locked",
      ...releaseData,
      timestamp: new Date().toISOString(),
    });

    console.log(`🔒 [WebSocket] Jury charge released & locked notifications sent for case ${caseId}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending jury charge released event:", error);
  }
}

/**
 * Notify when attorney signals jury charge is ready for admin review
 * @param {number} caseId
 * @param {Object} data - { questionCount, attorneyName }
 */
function notifyJuryChargeReadyForReview(caseId, data) {
  try {
    // Notify all admins (they should be in a global admin room or we send to all connections)
    getIO().emit("jury_charge:ready_for_review", {
      caseId,
      ...data,
      timestamp: new Date().toISOString(),
    });

    console.log(`📢 [WebSocket] Jury charge ready for review notification sent for case ${caseId}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending jury charge ready event:", error);
  }
}

// ============================================
// VERDICT EVENTS
// ============================================

/**
 * Notify when a juror submits verdict
 * @param {number} caseId
 * @param {Object} verdictData - { verdictId, jurorId, jurorName }
 */
function notifyVerdictSubmitted(caseId, verdictData) {
  try {
    const monitoringRoom = `verdict_monitoring_${caseId}`;
    getIO().to(monitoringRoom).emit("verdict:submitted", {
      caseId,
      ...verdictData,
      timestamp: new Date().toISOString(),
    });

    console.log(`📊 [WebSocket] Verdict submitted notification sent for case ${caseId}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending verdict submitted event:", error);
  }
}

/**
 * Notify when verdict submission status changes
 * @param {number} caseId
 * @param {Object} statusData - { totalJurors, submitted, pending }
 */
function notifyVerdictStatusUpdate(caseId, statusData) {
  try {
    const monitoringRoom = `verdict_monitoring_${caseId}`;
    getIO().to(monitoringRoom).emit("verdict:status_update", {
      caseId,
      ...statusData,
      timestamp: new Date().toISOString(),
    });

    console.log(`📊 [WebSocket] Verdict status update sent for case ${caseId}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending verdict status update:", error);
  }
}

/**
 * Notify when all verdicts are in and results are published
 * @param {number} caseId
 * @param {Object} resultsData - Aggregated results
 */
function notifyVerdictResultsPublished(caseId, resultsData) {
  try {
    const caseRoom = `case_${caseId}`;
    getIO().to(caseRoom).emit("verdict:results_published", {
      caseId,
      resultsData,
      timestamp: new Date().toISOString(),
    });

    console.log(`📊 [WebSocket] Verdict results published notification sent for case ${caseId}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error sending verdict results published event:", error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Send notification to specific user
 * @param {number} userId
 * @param {string} userType - 'attorney', 'admin', or 'juror'
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function notifyUser(userId, userType, event, data) {
  try {
    // Find all sockets for this user
    const sockets = Array.from(getIO().sockets.sockets.values());
    const userSockets = sockets.filter(
      (socket) => socket.userId === userId && socket.userType === userType
    );

    userSockets.forEach((socket) => {
      socket.emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });
    });

    console.log(
      `📨 [WebSocket] Notification sent to ${userType} #${userId}: ${event}`
    );
  } catch (error) {
    console.error("❌ [WebSocket] Error sending user notification:", error);
  }
}

/**
 * Broadcast to all connected clients
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastToAll(event, data) {
  try {
    getIO().emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    console.log(`📡 [WebSocket] Broadcast sent: ${event}`);
  } catch (error) {
    console.error("❌ [WebSocket] Error broadcasting:", error);
  }
}

/**
 * Get connected clients count
 * @returns {number} Number of connected clients
 */
function getConnectedClientsCount() {
  try {
    return getIO().sockets.sockets.size;
  } catch (error) {
    console.error("❌ [WebSocket] Error getting connected clients:", error);
    return 0;
  }
}

/**
 * Get clients in a specific room
 * @param {string} roomName - Room name
 * @returns {Array} Array of socket IDs in the room
 */
function getClientsInRoom(roomName) {
  try {
    const room = getIO().sockets.adapter.rooms.get(roomName);
    return room ? Array.from(room) : [];
  } catch (error) {
    console.error("❌ [WebSocket] Error getting clients in room:", error);
    return [];
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Initialization
  initializeWebSocket,
  getIO,

  // Jury Charge Events
  notifyQuestionAdded,
  notifyQuestionUpdated,
  notifyQuestionDeleted,
  notifyQuestionsReordered,
  notifyJuryChargeReleased,
  notifyJuryChargeReadyForReview,

  // Verdict Events
  notifyVerdictSubmitted,
  notifyVerdictStatusUpdate,
  notifyVerdictResultsPublished,

  // Utility Functions
  notifyUser,
  broadcastToAll,
  getConnectedClientsCount,
  getClientsInRoom,
};
