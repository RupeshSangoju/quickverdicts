// =============================================
// trialRoutes.js - Trial Meeting & Video Chat Routes
// FIXED: Added SQL types, validation, rate limiting, better structure
// =============================================

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const {
  CommunicationIdentityClient,
} = require("@azure/communication-identity");
const { poolPromise, sql } = require("../config/db");
const { authMiddleware } = require("../middleware/authMiddleware");
const {
  requireTrialAccess,
  requireAdminForTrial,
} = require("../middleware/trialMiddleware");

// Import models
const TrialMeeting = require("../models/TrialMeeting");
const Case = require("../models/Case");
const JurorApplication = require("../models/JurorApplication");
const Notification = require("../models/Notification");
const Event = require("../models/Event");

// Import ACS services
const {
  createRoom,
  addParticipantToRoom,
  removeParticipantFromRoom,
  createChatThread,
  addParticipantToChat,
  removeParticipantFromChat,
  ACS_ENDPOINT,
} = require("../services/acsRoomsService");

// ============================================
// AZURE COMMUNICATION SERVICES CONFIGURATION
// ============================================

const connectionString = process.env.ACS_CONNECTION_STRING;

if (!connectionString) {
  console.error("CRITICAL: ACS_CONNECTION_STRING not configured");
}

const identityClient = connectionString
  ? new CommunicationIdentityClient(connectionString)
  : null;

console.log("ACS_ENDPOINT:", ACS_ENDPOINT);
console.log("ACS Identity Client initialized:", !!identityClient);

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Strict rate limiter for joining trials
 */
const joinTrialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 join attempts per 15 minutes
  message: {
    success: false,
    message: "Too many join attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General trial operations limiter
 */
const generalTrialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests
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

// All routes require authentication
router.use(authMiddleware);

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate case ID parameter
 */
const validateCaseId = (req, res, next) => {
  const caseId = parseInt(req.params.caseId, 10);

  if (isNaN(caseId) || caseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid case ID is required",
    });
  }

  req.validatedCaseId = caseId;
  next();
};

/**
 * Check if ACS is configured
 */
const checkACSConfiguration = (req, res, next) => {
  if (!identityClient || !connectionString) {
    return res.status(503).json({
      success: false,
      message: "Video communication service not available",
    });
  }
  next();
};

// ============================================
// TRIAL MEETING CREATION
// ============================================

/**
 * Create meeting room AND chat thread when war room is submitted
 * Called from attorneyRoutes.js submit-war-room endpoint
 *
 * ✅ FIXED: Creates chat thread immediately with service identity AND stores service user ID
 */
async function createTrialMeeting(caseId) {
  try {
    console.log("=== Creating trial meeting for case:", caseId);

    // Check if meeting already exists
    const existingMeeting = await TrialMeeting.getMeetingByCaseId(caseId);
    if (existingMeeting) {
      console.log("Meeting already exists:", existingMeeting.MeetingId);
      return existingMeeting;
    }

    if (!identityClient) {
      throw new Error("ACS not configured");
    }

    console.log("Creating new ACS room and chat...");
    const caseData = await Case.findById(caseId);

    if (!caseData) {
      throw new Error("Case not found");
    }

    // 1. Create ACS Room for video
    const validFrom = new Date();
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const room = await createRoom(validFrom, validUntil);
    console.log("✅ ACS Room created:", room.id);

    // 2. Create Chat Thread immediately
    const chatResult = await createChatThread(
      `Trial: ${caseData.CaseTitle || "Case " + caseId}`
    );
    console.log("✅ Chat thread created:", chatResult.chatThreadId);
    console.log("✅ Service user ID:", chatResult.serviceUserId);

    // 3. Store in database with chat thread ID and service user ID
    const threadId = `trial-case-${caseId}-${Date.now()}`;
    const meetingId = await TrialMeeting.createMeeting(
      caseId,
      threadId,
      room.id,
      chatResult.chatThreadId,
      chatResult.serviceUserId
    );

    // 4. Create event
    await Event.createEvent({
      caseId,
      eventType: Event.EVENT_TYPES.TRIAL_STARTED,
      description: "Trial meeting created with video and chat",
      triggeredBy: caseData.AttorneyId,
      userType: "attorney",
    });

    console.log(`✅ Trial meeting created successfully!`);
    console.log(`   Meeting ID: ${meetingId}`);
    console.log(`   Room ID: ${room.id}`);
    console.log(`   Chat Thread ID: ${chatResult.chatThreadId}`);
    console.log(`   Service User ID: ${chatResult.serviceUserId}`);

    return {
      MeetingId: meetingId,
      CaseId: caseId,
      ThreadId: threadId,
      RoomId: room.id,
      ChatThreadId: chatResult.chatThreadId,
      ChatServiceUserId: chatResult.serviceUserId,
      Status: "created",
    };
  } catch (error) {
    console.error("❌ Error creating trial meeting:", error);
    throw error;
  }
}

// ============================================
// TRIAL MEETING ROUTES
// ============================================

/**
 * GET /api/trial/meeting/:caseId
 * Get meeting details for a case
 * FIXED: Added validation and better authorization
 */
router.get(
  "/meeting/:caseId",
  generalTrialLimiter,
  validateCaseId,
  requireTrialAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const userId = req.user.id;
      const userType = req.user.type;

      const caseData = await Case.findById(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }

      // Check authorization
      if (userType === "attorney" && caseData.AttorneyId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      if (userType === "juror") {
        const application = await JurorApplication.findByJurorAndCase(
          userId,
          caseId
        );
        if (!application || application.Status !== "approved") {
          return res.status(403).json({
            success: false,
            message: "Access denied",
          });
        }
      }

      const meeting = await TrialMeeting.getMeetingByCaseId(caseId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: "Meeting not found",
        });
      }

      res.json({
        success: true,
        meeting: {
          meetingId: meeting.MeetingId,
          threadId: meeting.ThreadId,
          chatThreadId: meeting.ChatThreadId,
          roomId: meeting.RoomId,
          status: meeting.Status,
          createdAt: meeting.CreatedAt,
        },
      });
    } catch (error) {
      console.error("Error getting meeting:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get meeting details",
      });
    }
  }
);

/**
 * POST /api/trial/join/:caseId
 * Generate ACS token for user to join trial with chat support
 *
 * ✅ FIXED: Uses stored service user ID to add participants to chat
 */
router.post(
  "/join/:caseId",
  joinTrialLimiter,
  validateCaseId,
  checkACSConfiguration,
  requireTrialAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const userId = req.user.id;
      const userType = req.user.type;

      console.log(`🎯 Trial join request - User: ${userType} (ID: ${userId}), Case: ${caseId}`);

      const caseData = await Case.findById(caseId);
      if (!caseData) {
        console.error(`❌ Case ${caseId} not found`);
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }

      console.log(`📋 Case ${caseId} status: ${caseData.AttorneyStatus}, AdminApproval: ${caseData.AdminApprovalStatus}`);

      // ✅ FIX: Check if trial can be joined (15 minutes before scheduled time)
      // Scheduled time is stored in attorney's LOCAL timezone
      // Admins can join anytime
      if (userType !== "admin" && caseData.ScheduledDate && caseData.ScheduledTime) {
        // Parse the stored local date/time
        const dateParts = caseData.ScheduledDate.split('T')[0].split('-');
        const timeParts = caseData.ScheduledTime.split(':');

        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // 0-indexed
        const day = parseInt(dateParts[2], 10);
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        const seconds = parseInt(timeParts[2] || 0, 10);

        // Get the timezone offset that was stored when case was created
        const timezoneOffsetMinutes = parseInt(caseData.TimezoneOffset || 0, 10);

        // Create UTC timestamp for the scheduled time using the stored timezone offset
        // Date.UTC creates timestamp, then subtract offset to convert from local to UTC
        const scheduledLocalAsUTC = Date.UTC(year, month, day, hours, minutes, seconds);
        const scheduledActualUTC = scheduledLocalAsUTC - (timezoneOffsetMinutes * 60 * 1000);

        const now = Date.now();
        const fifteenMinutesInMs = 15 * 60 * 1000;
        const canJoinAfter = scheduledActualUTC - fifteenMinutesInMs;

        console.log(`🕐 Trial join time check for case ${caseId}:`);
        console.log(`   Scheduled (in attorney TZ): ${caseData.ScheduledDate} ${caseData.ScheduledTime}`);
        console.log(`   Timezone offset: ${timezoneOffsetMinutes} minutes`);
        console.log(`   Current time (UTC): ${new Date(now).toISOString()}`);
        console.log(`   Can join after (UTC): ${new Date(canJoinAfter).toISOString()}`);

        if (now < canJoinAfter) {
          const minutesUntilJoin = Math.ceil((canJoinAfter - now) / (60 * 1000));
          console.log(`⏰ Too early to join - ${minutesUntilJoin} minutes until join time`);
          return res.status(403).json({
            success: false,
            message: `Trial cannot be joined yet. You can join ${minutesUntilJoin} minute${minutesUntilJoin !== 1 ? 's' : ''} before the scheduled time.`,
            scheduledTime: new Date(scheduledActualUTC).toISOString(),
            canJoinAt: new Date(canJoinAfter).toISOString()
          });
        }
        console.log(`✅ Time check passed - can join now`);
      }

      // Verify authorization and set display name
      let displayName = "";
      let participantRole = "Attendee";

      if (userType === "attorney") {
        if (caseData.AttorneyId !== userId) {
          console.error(`❌ Attorney ${userId} does not own case ${caseId} (owner: ${caseData.AttorneyId})`);
          return res.status(403).json({
            success: false,
            message: "Access denied",
          });
        }
        displayName = `${req.user.firstName} ${req.user.lastName} (Attorney)`;
        participantRole = "Presenter";
      } else if (userType === "juror") {
        const application = await JurorApplication.findByJurorAndCase(
          userId,
          caseId
        );
        if (!application || application.Status !== "approved") {
          console.error(`❌ Juror ${userId} not approved for case ${caseId}`);
          return res.status(403).json({
            success: false,
            message: "Access denied - not approved for this case",
          });
        }
        displayName = `${req.user.name} (Juror)`;
      } else if (userType === "admin") {
        displayName = "Court Administrator";
        participantRole = "Presenter";
      } else {
        console.error(`❌ Invalid user type: ${userType}`);
        return res.status(403).json({
          success: false,
          message: "Invalid user type",
        });
      }

      const meeting = await TrialMeeting.getMeetingByCaseId(caseId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: "Meeting not found. Please contact administrator.",
        });
      }

      if (!meeting.ChatThreadId) {
        return res.status(500).json({
          success: false,
          message: "Chat not available for this meeting.",
        });
      }

      // 🔧 FIX: Check for existing active participant and remove them from ACS room/chat
      // This prevents duplicate participants when refreshing the page
      const existingParticipants = await TrialMeeting.getActiveParticipants(meeting.MeetingId);
      const existingParticipant = existingParticipants.find(
        p => p.UserId === userId && p.UserType === userType
      );

      if (existingParticipant && existingParticipant.AcsUserId) {
        console.log(`🧹 Found existing participant ${existingParticipant.DisplayName} (ACS: ${existingParticipant.AcsUserId})`);
        console.log(`   Removing from ACS room/chat before creating new identity...`);

        try {
          // Remove from ACS room
          await removeParticipantFromRoom(meeting.RoomId, existingParticipant.AcsUserId);

          // Remove from chat thread
          if (meeting.ChatThreadId && meeting.ChatServiceUserId) {
            await removeParticipantFromChat(
              meeting.ChatThreadId,
              meeting.ChatServiceUserId,
              existingParticipant.AcsUserId
            );
          }

          // Mark as left in database
          await TrialMeeting.removeParticipant(existingParticipant.ParticipantId);

          console.log(`✅ Cleaned up old participant identity`);
        } catch (cleanupError) {
          console.error("⚠️ Error cleaning up old participant (continuing anyway):", cleanupError.message);
          // Continue - we'll try to add the new identity anyway
        }
      }

      // Create ACS user identity and token with VoIP and Chat scopes
      const identityResponse = await identityClient.createUser();
      const acsUserId = identityResponse.communicationUserId;

      // Add participant to ACS Room (for video)
      await addParticipantToRoom(meeting.RoomId, acsUserId, participantRole);

      // Generate token with VoIP and Chat scopes
      const tokenResponse = await identityClient.getToken(identityResponse, [
        "voip",
        "chat",
      ]);

      // Add user to chat thread using the stored service user ID
      if (meeting.ChatThreadId && meeting.ChatServiceUserId) {
        try {
          await addParticipantToChat(
            meeting.ChatThreadId,
            meeting.ChatServiceUserId,
            acsUserId,
            displayName
          );
        } catch (chatAddError) {
          console.error("Failed to add participant to chat:", chatAddError);
          // Continue anyway - they can still join video
        }
      }

      // Track participant in database
      await TrialMeeting.addParticipant(
        meeting.MeetingId,
        userId,
        userType,
        displayName,
        acsUserId
      );

      // Update meeting status to active if first join
      if (meeting.Status === "created") {
        await TrialMeeting.updateMeetingStatus(meeting.MeetingId, "active");
      }

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `${displayName} joined trial`,
        triggeredBy: userId,
        userType,
      });

      console.log(`✅ ${displayName} joined successfully`);
      console.log(`   ACS User ID: ${acsUserId}`);
      console.log(`   Chat Thread: ${meeting.ChatThreadId}`);

      res.json({
        success: true,
        token: tokenResponse.token,
        expiresOn: tokenResponse.expiresOn,
        userId: acsUserId,
        displayName: displayName,
        roomId: meeting.RoomId,
        chatThreadId: meeting.ChatThreadId,
        endpointUrl: ACS_ENDPOINT,
      });
    } catch (error) {
      console.error("❌ Error joining trial:", error);
      res.status(500).json({
        success: false,
        message: "Failed to join trial",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/trial/participants/:caseId
 * Get list of participants in a trial
 * FIXED: Added validation
 */
router.get(
  "/participants/:caseId",
  generalTrialLimiter,
  validateCaseId,
  requireTrialAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;

      const meeting = await TrialMeeting.getMeetingByCaseId(caseId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: "Meeting not found",
        });
      }

      const participants = await TrialMeeting.getParticipants(
        meeting.MeetingId
      );

      res.json({
        success: true,
        participants,
        count: participants.length,
      });
    } catch (error) {
      console.error("Error getting participants:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get participants",
      });
    }
  }
);

/**
 * GET /api/trial/case/:caseId/jurors
 * Get approved jurors for a trial
 * FIXED: Added SQL type safety
 */
router.get(
  "/case/:caseId/jurors",
  generalTrialLimiter,
  validateCaseId,
  requireTrialAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT 
            j.JurorId as id,
            j.Name,
            j.Email,
            ja.Status
          FROM dbo.JurorApplications ja
          JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
          WHERE ja.CaseId = @caseId AND ja.Status = 'approved'
        `);

      res.json({
        success: true,
        jurors: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Error fetching jurors:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch jurors",
      });
    }
  }
);

/**
 * POST /api/trial/juror-join/:caseId
 * Juror join endpoint
 *
 * ✅ FIXED: Uses stored service user ID to add juror to chat
 */
router.post(
  "/juror-join/:caseId",
  joinTrialLimiter,
  validateCaseId,
  checkACSConfiguration,
  requireTrialAccess,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const jurorId = req.user.id;
      const pool = await poolPromise;

      const verification = await pool
        .request()
        .input("caseId", sql.Int, caseId)
        .input("jurorId", sql.Int, jurorId).query(`
          SELECT 
            ja.Status, 
            tm.RoomId, 
            tm.ChatThreadId, 
            tm.ChatServiceUserId, 
            tm.MeetingId, 
            j.Name
          FROM dbo.JurorApplications ja
          JOIN dbo.TrialMeetings tm ON ja.CaseId = tm.CaseId
          JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
          WHERE ja.CaseId = @caseId 
            AND ja.JurorId = @jurorId 
            AND ja.Status = 'approved'
        `);

      if (verification.recordset.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to join this trial",
        });
      }

      const data = verification.recordset[0];
      const roomId = data.RoomId;
      const chatThreadId = data.ChatThreadId;
      const chatServiceUserId = data.ChatServiceUserId;
      const meetingId = data.MeetingId;
      const jurorName = data.Name;

      // Create identity and token
      const identity = await identityClient.createUser();
      const token = await identityClient.getToken(identity, ["voip", "chat"]);

      // Add to room (for video)
      try {
        await addParticipantToRoom(
          roomId,
          identity.communicationUserId,
          "Attendee"
        );
      } catch (err) {
        if (err.statusCode !== 409) throw err; // Ignore if already added
      }

      // Add juror to chat thread using the stored service user ID
      if (chatThreadId && chatServiceUserId) {
        try {
          await addParticipantToChat(
            chatThreadId,
            chatServiceUserId,
            identity.communicationUserId,
            `${jurorName} (Juror)`
          );
        } catch (chatAddError) {
          console.error("Failed to add juror to chat:", chatAddError);
          // Continue anyway - they can still join video
        }
      }

      // Track in database
      await TrialMeeting.addParticipant(
        meetingId,
        jurorId,
        "juror",
        `${jurorName} (Juror)`,
        identity.communicationUserId
      );

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: `Juror ${jurorName} joined trial`,
        triggeredBy: jurorId,
        userType: "juror",
      });

      console.log(`✅ Juror ${jurorName} joined successfully with chat access`);

      res.json({
        success: true,
        token: token.token,
        expiresOn: token.expiresOn,
        roomId: roomId,
        displayName: `${jurorName} (Juror)`,
        userId: identity.communicationUserId,
        chatThreadId: chatThreadId,
        endpointUrl: ACS_ENDPOINT,
      });
    } catch (error) {
      console.error("❌ Error in juror join:", error);

      if (error.statusCode === 409) {
        return res.status(200).json({
          success: true,
          message: "Already in room",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to join trial",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ============================================
// ADMIN TRIAL ROUTES
// ============================================

/**
 * GET /api/trial/admin/trials/today
 * Get today's scheduled trials for admin
 * FIXED: Added SQL type safety
 */
router.get(
  "/admin/trials/today",
  generalTrialLimiter,
  requireAdminForTrial,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await pool.request().input("today", sql.Date, today)
        .query(`
          SELECT 
            c.CaseId,
            c.CaseTitle,
            c.CaseType,
            c.County,
            c.ScheduledDate,
            c.ScheduledTime,
            c.AttorneyStatus,
            tm.RoomId,
            tm.ChatThreadId,
            CONCAT(a.FirstName, ' ', a.LastName) as AttorneyName,
            a.LawFirmName
          FROM dbo.Cases c
          LEFT JOIN dbo.TrialMeetings tm ON c.CaseId = tm.CaseId
          JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
          WHERE CAST(c.ScheduledDate AS DATE) = @today
            AND c.AttorneyStatus IN ('approved', 'war_room', 'join_trial')
            AND tm.RoomId IS NOT NULL
          ORDER BY c.ScheduledTime
        `);

      console.log("Today's trials found:", result.recordset.length);

      res.json({
        success: true,
        trials: result.recordset,
        count: result.recordset.length,
        date: today.toISOString().split("T")[0],
      });
    } catch (error) {
      console.error("Error fetching today's trials:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch trials",
      });
    }
  }
);

/**
 * POST /api/trial/admin-join/:caseId
 * Admin join trial
 *
 * ✅ FIXED: Uses stored service user ID to add admin to chat
 */
router.post(
  "/admin-join/:caseId",
  joinTrialLimiter,
  validateCaseId,
  checkACSConfiguration,
  requireAdminForTrial,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;
      const pool = await poolPromise;

      const result = await pool.request().input("caseId", sql.Int, caseId)
        .query(`
          SELECT 
            c.CaseId,
            c.CaseTitle,
            c.ScheduledDate,
            c.ScheduledTime,
            tm.RoomId,
            tm.MeetingId,
            tm.ChatThreadId,
            tm.ChatServiceUserId
          FROM dbo.Cases c
          JOIN dbo.TrialMeetings tm ON c.CaseId = tm.CaseId
          WHERE c.CaseId = @caseId 
            AND c.AttorneyStatus IN ('approved', 'war_room', 'join_trial')
        `);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Trial not found or not approved",
        });
      }

      const trial = result.recordset[0];

      console.log("Admin join - trial record:", {
        CaseId: trial.CaseId,
        RoomId: trial.RoomId,
        MeetingId: trial.MeetingId,
        ChatThreadId: trial.ChatThreadId,
        ChatServiceUserId: trial.ChatServiceUserId,
      });

      console.log("ACS identity client configured:", !!identityClient);

      // 🔧 FIX: Check for existing active admin and remove them from ACS room/chat
      const existingParticipants = await TrialMeeting.getActiveParticipants(trial.MeetingId);
      const existingAdmin = existingParticipants.find(
        p => p.UserId === (req.user.id || 0) && p.UserType === "admin"
      );

      if (existingAdmin && existingAdmin.AcsUserId) {
        console.log(`🧹 Found existing admin (ACS: ${existingAdmin.AcsUserId})`);
        console.log(`   Removing from ACS room/chat before creating new identity...`);

        try {
          await removeParticipantFromRoom(trial.RoomId, existingAdmin.AcsUserId);

          if (trial.ChatThreadId && trial.ChatServiceUserId) {
            await removeParticipantFromChat(
              trial.ChatThreadId,
              trial.ChatServiceUserId,
              existingAdmin.AcsUserId
            );
          }

          await TrialMeeting.removeParticipant(existingAdmin.ParticipantId);

          console.log(`✅ Cleaned up old admin identity`);
        } catch (cleanupError) {
          console.error("⚠️ Error cleaning up old admin (continuing anyway):", cleanupError.message);
        }
      }

      let identityResponse;
      let acsUserId;
      let tokenResponse;

      try {
        identityResponse = await identityClient.createUser();
        acsUserId = identityResponse.communicationUserId;
        console.log("Created ACS identity for admin:", acsUserId);
      } catch (idErr) {
        console.error("Error creating ACS identity for admin:", idErr && idErr.message ? idErr.message : idErr);
        throw idErr;
      }

      try {
        await addParticipantToRoom(trial.RoomId, acsUserId, "Presenter");
      } catch (roomErr) {
        console.error("Error adding admin to room:", roomErr && roomErr.message ? roomErr.message : roomErr);
        throw roomErr;
      }

      try {
        tokenResponse = await identityClient.getToken(identityResponse, ["voip", "chat"]);
      } catch (tokenErr) {
        console.error("Error getting token for admin identity:", tokenErr && tokenErr.message ? tokenErr.message : tokenErr);
        throw tokenErr;
      }

      // Add admin to chat thread using the stored service user ID
      if (trial.ChatThreadId && trial.ChatServiceUserId) {
        try {
          await addParticipantToChat(
            trial.ChatThreadId,
            trial.ChatServiceUserId,
            acsUserId,
            "Court Administrator"
          );
        } catch (chatAddError) {
          console.error("Failed to add admin to chat:", chatAddError && chatAddError.message ? chatAddError.message : chatAddError);
          // Continue - allow video-only join
        }
      }

      await TrialMeeting.addParticipant(
        trial.MeetingId,
        req.user.id || 0,
        "admin",
        "Court Administrator",
        acsUserId
      );

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.CASE_UPDATED,
        description: "Court Administrator joined trial",
        triggeredBy: req.user.id || 0,
        userType: "admin",
      });

      console.log(`✅ Admin joined trial ${caseId} with chat access`);

      res.json({
        success: true,
        token: tokenResponse.token,
        expiresOn: tokenResponse.expiresOn,
        userId: acsUserId,
        displayName: "Court Administrator",
        roomId: trial.RoomId,
        chatThreadId: trial.ChatThreadId,
        endpointUrl: ACS_ENDPOINT,
      });
    } catch (error) {
      console.error("❌ Error joining trial as admin:", error);
      res.status(500).json({
        success: false,
        message: "Failed to join trial",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/trial/end/:caseId
 * End a trial meeting
 * NEW: Added endpoint to end meetings
 */
router.post(
  "/end/:caseId",
  generalTrialLimiter,
  validateCaseId,
  requireAdminForTrial,
  async (req, res) => {
    try {
      const caseId = req.validatedCaseId;

      const meeting = await TrialMeeting.getMeetingByCaseId(caseId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: "Meeting not found",
        });
      }

      // Update meeting status to completed
      await TrialMeeting.updateMeetingStatus(meeting.MeetingId, "completed");

      // Update case status
      await Case.updateCaseStatus(caseId, {
        attorneyStatus: "view_details",
      });

      // Create event
      await Event.createEvent({
        caseId,
        eventType: Event.EVENT_TYPES.TRIAL_COMPLETED,
        description: "Trial meeting ended",
        triggeredBy: req.user.id || 0,
        userType: "admin",
      });

      res.json({
        success: true,
        message: "Trial ended successfully",
      });
    } catch (error) {
      console.error("Error ending trial:", error);
      res.status(500).json({
        success: false,
        message: "Failed to end trial",
      });
    }
  }
);

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/trial/health
 * Health check for trial service
 */
router.get("/health", (req, res) => {
  const isConfigured = !!(identityClient && connectionString && ACS_ENDPOINT);

  res.json({
    success: true,
    status: isConfigured ? "healthy" : "degraded",
    service: "trial-meetings",
    provider: "azure-communication-services",
    configured: isConfigured,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// ERROR HANDLER
// ============================================

router.use((error, req, res, next) => {
  console.error("Trial Route Error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

// ============================================
// EXPORTS
// ============================================

module.exports = router;
module.exports.createTrialMeeting = createTrialMeeting;
