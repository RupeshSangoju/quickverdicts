// =============================================
// acsRoomService.js - Azure Communication Services Room Management
// FIXED: Added validation, error handling, retry logic, cleanup
// =============================================

const { RoomsClient } = require("@azure/communication-rooms");
const {
  CommunicationIdentityClient,
} = require("@azure/communication-identity");
const { ChatClient } = require("@azure/communication-chat");
const {
  AzureCommunicationTokenCredential,
} = require("@azure/communication-common");

// ============================================
// CONFIGURATION & VALIDATION
// ============================================

const connectionString = process.env.ACS_CONNECTION_STRING;

if (!connectionString) {
  console.error("CRITICAL: ACS_CONNECTION_STRING not configured");
  throw new Error("ACS_CONNECTION_STRING environment variable is required");
}

// Validate connection string format
if (
  !connectionString.includes("endpoint=") ||
  !connectionString.includes("accesskey=")
) {
  console.error("CRITICAL: Invalid ACS_CONNECTION_STRING format");
  throw new Error("ACS_CONNECTION_STRING must contain endpoint and accesskey");
}

// Initialize clients with error handling
let roomsClient;
let identityClient;

try {
  roomsClient = new RoomsClient(connectionString);
  identityClient = new CommunicationIdentityClient(connectionString);
  console.log("✅ ACS clients initialized successfully");
} catch (error) {
  console.error("CRITICAL: Failed to initialize ACS clients:", error);
  throw new Error("Failed to initialize Azure Communication Services");
}

// Extract ACS endpoint from connection string
const ACS_ENDPOINT =
  connectionString.match(/endpoint=(https:\/\/[^;]+)/)?.[1] ||
  process.env.ACS_ENDPOINT;

if (!ACS_ENDPOINT) {
  console.error(
    "CRITICAL: Could not extract ACS_ENDPOINT from connection string"
  );
  throw new Error("ACS endpoint could not be determined");
}

console.log("✅ ACS Endpoint configured");

// ============================================
// CONSTANTS
// ============================================

const PARTICIPANT_ROLES = {
  PRESENTER: "Presenter",
  ATTENDEE: "Attendee",
  CONSUMER: "Consumer",
};

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_MULTIPLIER: 2,
};

const DEFAULT_ROOM_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate and parse date
 */
function validateDate(dateValue, fieldName) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${dateValue}`);
  }

  return date;
}

/**
 * Validate participant role
 */
function validateRole(role) {
  const validRoles = Object.values(PARTICIPANT_ROLES);

  if (!validRoles.includes(role)) {
    throw new Error(
      `Invalid role: ${role}. Must be one of: ${validRoles.join(", ")}`
    );
  }

  return role;
}

/**
 * Validate communication user ID format
 */
function validateUserId(userId, fieldName = "User ID") {
  if (!userId || typeof userId !== "string") {
    throw new Error(`${fieldName} is required and must be a string`);
  }

  // ACS user IDs typically follow a specific format
  if (!userId.startsWith("8:acs:") && !userId.startsWith("8:")) {
    console.warn(
      `Warning: ${fieldName} may not be in valid ACS format:`,
      userId
    );
  }

  return userId;
}

/**
 * Retry helper for transient Azure failures
 */
async function retryOperation(
  operation,
  operationName,
  retries = RETRY_CONFIG.MAX_RETRIES
) {
  let lastError;
  let delay = RETRY_CONFIG.INITIAL_DELAY;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (except 429 rate limit)
      if (
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        if (error.statusCode !== 429) {
          console.error(
            `${operationName} failed with client error (${error.statusCode}):`,
            error.message
          );
          throw error;
        }
      }

      if (attempt < retries) {
        console.warn(
          `${operationName} attempt ${attempt} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(
          delay * RETRY_CONFIG.BACKOFF_MULTIPLIER,
          RETRY_CONFIG.MAX_DELAY
        );
      }
    }
  }

  console.error(
    `${operationName} failed after ${retries} attempts:`,
    lastError
  );
  throw lastError;
}

/**
 * Sanitize error for logging (remove sensitive data)
 */
function sanitizeError(error) {
  const sanitized = {
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
  };

  // Don't log full error object which might contain tokens
  return sanitized;
}

// ============================================
// ROOM MANAGEMENT
// ============================================

/**
 * Create a new ACS Room for a trial
 * FIXED: Added validation, error handling, proper date handling
 *
 * @param {Date|string} validFrom - Room start time
 * @param {Date|string} validUntil - Room end time
 * @returns {Promise<Object>} Room object with id and other properties
 */
async function createRoom(validFrom, validUntil) {
  try {
    // Validate and parse dates
    const fromDate = validFrom
      ? validateDate(validFrom, "validFrom")
      : new Date();
    const untilDate = validUntil
      ? validateDate(validUntil, "validUntil")
      : new Date(Date.now() + DEFAULT_ROOM_DURATION);

    // Ensure untilDate is after fromDate
    if (untilDate <= fromDate) {
      throw new Error("validUntil must be after validFrom");
    }

    // Ensure room doesn't exceed reasonable duration (e.g., 30 days)
    const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (untilDate - fromDate > maxDuration) {
      throw new Error("Room duration cannot exceed 30 days");
    }

    console.log(
      `Creating ACS room from ${fromDate.toISOString()} to ${untilDate.toISOString()}`
    );

    const createRoomOptions = {
      validFrom: fromDate,
      validUntil: untilDate,
      pstnDialOutEnabled: false,
    };

    const room = await retryOperation(
      () => roomsClient.createRoom(createRoomOptions),
      "Create ACS Room"
    );

    console.log("✅ ACS Room created successfully:", room.id);
    return room;
  } catch (error) {
    console.error("❌ Error creating ACS room:", sanitizeError(error));
    throw new Error(`Failed to create ACS room: ${error.message}`);
  }
}

/**
 * Add participant to room
 * FIXED: Added validation, conflict handling, retry logic
 *
 * @param {string} roomId - The room ID
 * @param {string} participantId - The participant's ACS user ID
 * @param {string} role - Participant role (Presenter, Attendee, Consumer)
 */
async function addParticipantToRoom(
  roomId,
  participantId,
  role = PARTICIPANT_ROLES.ATTENDEE
) {
  try {
    // Validate inputs
    if (!roomId || typeof roomId !== "string") {
      throw new Error("Valid roomId is required");
    }

    validateUserId(participantId, "Participant ID");
    validateRole(role);

    const participant = {
      id: { communicationUserId: participantId },
      role: role,
    };

    await retryOperation(
      () => roomsClient.addOrUpdateParticipants(roomId, [participant]),
      `Add participant to room ${roomId}`
    );

    console.log(
      `✅ Participant ${participantId} added to room ${roomId} with role ${role}`
    );
  } catch (error) {
    // Conflict = participant already exists, which is OK
    if (error.statusCode === 409) {
      console.log(`ℹ️ Participant ${participantId} already in room ${roomId}`);
      return;
    }

    console.error(`❌ Error adding participant to room:`, sanitizeError(error));
    throw new Error(`Failed to add participant to room: ${error.message}`);
  }
}

/**
 * Remove participant from room
 * NEW: Added participant removal
 *
 * @param {string} roomId - The room ID
 * @param {string} participantId - The participant's ACS user ID
 */
async function removeParticipantFromRoom(roomId, participantId) {
  try {
    if (!roomId || typeof roomId !== "string") {
      throw new Error("Valid roomId is required");
    }

    validateUserId(participantId, "Participant ID");

    await retryOperation(
      () =>
        roomsClient.removeParticipants(roomId, [
          { communicationUserId: participantId },
        ]),
      `Remove participant from room ${roomId}`
    );

    console.log(`✅ Participant ${participantId} removed from room ${roomId}`);
  } catch (error) {
    console.error(
      `❌ Error removing participant from room:`,
      sanitizeError(error)
    );
    throw new Error(`Failed to remove participant from room: ${error.message}`);
  }
}

/**
 * Get room details
 * FIXED: Added validation and error handling
 *
 * @param {string} roomId - The room ID
 * @returns {Promise<Object>} Room details
 */
async function getRoom(roomId) {
  try {
    if (!roomId || typeof roomId !== "string") {
      throw new Error("Valid roomId is required");
    }

    const room = await retryOperation(
      () => roomsClient.getRoom(roomId),
      `Get room ${roomId}`
    );

    return room;
  } catch (error) {
    console.error(`❌ Error getting room:`, sanitizeError(error));
    throw new Error(`Failed to get room: ${error.message}`);
  }
}

/**
 * Delete room
 * FIXED: Added validation and error handling
 *
 * @param {string} roomId - The room ID
 */
async function deleteRoom(roomId) {
  try {
    if (!roomId || typeof roomId !== "string") {
      throw new Error("Valid roomId is required");
    }

    await retryOperation(
      () => roomsClient.deleteRoom(roomId),
      `Delete room ${roomId}`
    );

    console.log(`✅ Room ${roomId} deleted successfully`);
  } catch (error) {
    // If room doesn't exist, that's OK
    if (error.statusCode === 404) {
      console.log(`ℹ️ Room ${roomId} already deleted or doesn't exist`);
      return;
    }

    console.error(`❌ Error deleting room:`, sanitizeError(error));
    throw new Error(`Failed to delete room: ${error.message}`);
  }
}

// ============================================
// CHAT MANAGEMENT
// ============================================

/**
 * Create a chat thread for the trial
 * FIXED: Added validation, cleanup on failure, proper identity management
 *
 * Uses a service identity so it's not tied to any specific user
 * RETURNS BOTH chatThreadId AND serviceUserId
 *
 * @param {string} topic - The chat topic/title
 * @returns {Promise<Object>} Object with chatThreadId and serviceUserId
 */
async function createChatThread(topic) {
  let serviceIdentity = null;
  let chatClient = null;

  try {
    // Validate topic
    if (!topic || typeof topic !== "string") {
      throw new Error("Valid topic is required");
    }

    if (topic.length > 250) {
      throw new Error("Topic too long (max 250 characters)");
    }

    console.log("Creating service identity for chat thread...");

    // Create a service identity to own the chat thread
    serviceIdentity = await retryOperation(
      () => identityClient.createUser(),
      "Create service identity"
    );

    const serviceToken = await retryOperation(
      () => identityClient.getToken(serviceIdentity, ["chat"]),
      "Get service token"
    );

    console.log(
      "✅ Service identity created:",
      serviceIdentity.communicationUserId
    );

    // Create chat client with service identity
    const credential = new AzureCommunicationTokenCredential(
      serviceToken.token
    );
    chatClient = new ChatClient(ACS_ENDPOINT, credential);

    // Create the chat thread
    const createChatThreadResult = await retryOperation(
      () => chatClient.createChatThread({ topic: topic }),
      "Create chat thread"
    );

    const chatThreadId = createChatThreadResult.chatThread.id;
    console.log("✅ Chat thread created successfully:", chatThreadId);

    return {
      chatThreadId: chatThreadId,
      serviceUserId: serviceIdentity.communicationUserId,
    };
  } catch (error) {
    console.error("❌ Error creating chat thread:", sanitizeError(error));

    // Cleanup: Delete service identity if chat thread creation failed
    if (serviceIdentity) {
      try {
        await identityClient.deleteUser(serviceIdentity);
        console.log("🧹 Cleaned up service identity after failure");
      } catch (cleanupError) {
        console.error(
          "Warning: Failed to cleanup service identity:",
          sanitizeError(cleanupError)
        );
      }
    }

    throw new Error(`Failed to create chat thread: ${error.message}`);
  }
}

/**
 * Add participant to chat thread
 * FIXED: Added validation, better error handling, cleanup
 *
 * Uses the ORIGINAL service identity that created the thread (not a new one!)
 *
 * @param {string} chatThreadId - The chat thread ID
 * @param {string} chatServiceUserId - The service user ID that created the thread
 * @param {string} participantUserId - The user ID to add
 * @param {string} displayName - Display name for the participant
 */
async function addParticipantToChat(
  chatThreadId,
  chatServiceUserId,
  participantUserId,
  displayName
) {
  let chatClient = null;

  try {
    // Validate inputs
    if (!chatThreadId || typeof chatThreadId !== "string") {
      throw new Error("Valid chatThreadId is required");
    }

    validateUserId(chatServiceUserId, "Chat service user ID");
    validateUserId(participantUserId, "Participant user ID");

    if (!displayName || typeof displayName !== "string") {
      throw new Error("Valid displayName is required");
    }

    if (displayName.length > 256) {
      throw new Error("Display name too long (max 256 characters)");
    }

    console.log(`Adding ${displayName} to chat thread ${chatThreadId}`);

    // Get a fresh token for the ORIGINAL service identity
    const serviceToken = await retryOperation(
      () =>
        identityClient.getToken({ communicationUserId: chatServiceUserId }, [
          "chat",
        ]),
      "Get service token for chat"
    );

    const credential = new AzureCommunicationTokenCredential(
      serviceToken.token
    );
    chatClient = new ChatClient(ACS_ENDPOINT, credential);
    const chatThreadClient = chatClient.getChatThreadClient(chatThreadId);

    // Add the participant
    await retryOperation(
      () =>
        chatThreadClient.addParticipants({
          participants: [
            {
              id: { communicationUserId: participantUserId },
              displayName: displayName,
            },
          ],
        }),
      `Add ${displayName} to chat`
    );

    console.log(`✅ Added ${displayName} to chat thread ${chatThreadId}`);
  } catch (error) {
    // Participant already exists = OK
    if (error.statusCode === 409 || error.message?.includes("already exists")) {
      console.log(`ℹ️ Participant ${displayName} already in chat`);
      return;
    }

    console.error(`❌ Error adding participant to chat:`, sanitizeError(error));
    throw new Error(`Failed to add participant to chat: ${error.message}`);
  }
}

/**
 * Remove participant from chat thread
 * NEW: Added participant removal from chat
 *
 * @param {string} chatThreadId - The chat thread ID
 * @param {string} chatServiceUserId - The service user ID that created the thread
 * @param {string} participantUserId - The user ID to remove
 */
async function removeParticipantFromChat(
  chatThreadId,
  chatServiceUserId,
  participantUserId
) {
  try {
    if (!chatThreadId || typeof chatThreadId !== "string") {
      throw new Error("Valid chatThreadId is required");
    }

    validateUserId(chatServiceUserId, "Chat service user ID");
    validateUserId(participantUserId, "Participant user ID");

    const serviceToken = await retryOperation(
      () =>
        identityClient.getToken({ communicationUserId: chatServiceUserId }, [
          "chat",
        ]),
      "Get service token for chat"
    );

    const credential = new AzureCommunicationTokenCredential(
      serviceToken.token
    );
    const chatClient = new ChatClient(ACS_ENDPOINT, credential);
    const chatThreadClient = chatClient.getChatThreadClient(chatThreadId);

    await retryOperation(
      () =>
        chatThreadClient.removeParticipant({
          communicationUserId: participantUserId,
        }),
      "Remove participant from chat"
    );

    console.log(`✅ Removed participant from chat thread ${chatThreadId}`);
  } catch (error) {
    console.error(
      `❌ Error removing participant from chat:`,
      sanitizeError(error)
    );
    throw new Error(`Failed to remove participant from chat: ${error.message}`);
  }
}

/**
 * Delete chat thread and service identity
 * NEW: Added cleanup function
 *
 * @param {string} serviceUserId - The service user ID that owns the chat
 */
async function deleteChatThread(serviceUserId) {
  try {
    validateUserId(serviceUserId, "Service user ID");

    await retryOperation(
      () => identityClient.deleteUser({ communicationUserId: serviceUserId }),
      "Delete service identity"
    );

    console.log(
      `✅ Service identity ${serviceUserId} deleted (chat thread cleanup)`
    );
  } catch (error) {
    if (error.statusCode === 404) {
      console.log(`ℹ️ Service identity ${serviceUserId} already deleted`);
      return;
    }

    console.error(`❌ Error deleting service identity:`, sanitizeError(error));
    throw new Error(`Failed to delete service identity: ${error.message}`);
  }
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check ACS service health
 * NEW: Added health check
 */
async function checkHealth() {
  try {
    // Try to create and immediately delete a test identity
    const testIdentity = await identityClient.createUser();
    await identityClient.deleteUser(testIdentity);

    return {
      healthy: true,
      endpoint: ACS_ENDPOINT,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("ACS health check failed:", sanitizeError(error));
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Room management
  createRoom,
  addParticipantToRoom,
  removeParticipantFromRoom,
  getRoom,
  deleteRoom,

  // Chat management
  createChatThread,
  addParticipantToChat,
  removeParticipantFromChat,
  deleteChatThread,

  // Health & utilities
  checkHealth,

  // Constants
  ACS_ENDPOINT,
  PARTICIPANT_ROLES,
};
