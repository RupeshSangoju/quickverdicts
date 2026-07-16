const TrialMeeting = require("../models/TrialMeeting");
const Case = require("../models/Case");
const Event = require("../models/Event");

// Lazily resolve ACS service so the module loads even without ACS configured
function getAcsService() {
  try { return require("../services/acsRoomsService"); } catch { return null; }
}

async function createTrialMeeting(caseId) {
  try {
    const existingMeeting = await TrialMeeting.getMeetingByCaseId(caseId);
    if (existingMeeting) return existingMeeting;

    const acs = getAcsService();
    if (!acs || !acs.createRoom) throw new Error("ACS not configured");

    const caseData = await Case.findById(caseId);
    if (!caseData) throw new Error("Case not found");

    const validFrom = new Date();
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const room = await acs.createRoom(validFrom, validUntil);

    const chatResult = await acs.createChatThread(
      `Trial: ${caseData.CaseTitle || "Case " + caseId}`
    );

    const threadId = `trial-case-${caseId}-${Date.now()}`;
    const meetingId = await TrialMeeting.createMeeting(
      caseId,
      threadId,
      room.id,
      chatResult.chatThreadId,
      chatResult.serviceUserId
    );

    await Event.createEvent({
      caseId,
      eventType: Event.EVENT_TYPES.TRIAL_STARTED,
      description: "Trial meeting created with video and chat",
      triggeredBy: caseData.AttorneyId,
      userType: "attorney",
    });

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

module.exports = { createTrialMeeting };
