// =============================================
// warRoomMiddleware.js - War Room Access Control Middleware
// =============================================

const {
  sendError,
  validateCaseId,
  getCaseDetails,
  isJurorApprovedForCase,
} = require("../helpers/accessHelper");

// ============================================
// WAR ROOM ACCESS
// ============================================
async function requireWarRoomAccess(req, res, next) {
  try {
    const user = req.user;
    if (!user?.id || !user?.type)
      return sendError(res, 401, "Authentication required", "AUTH_REQUIRED");

    const validation = validateCaseId(req.params.caseId);
    if (!validation.isValid)
      return sendError(res, 400, validation.error, "INVALID_CASE_ID");
    const caseId = validation.value;

    const caseData = await getCaseDetails(caseId);
    if (!caseData)
      return sendError(res, 404, "Case not found", "CASE_NOT_FOUND");

    if (caseData.AdminApprovalStatus !== "approved")
      return sendError(
        res,
        403,
        "Case not approved by admin",
        "CASE_NOT_APPROVED"
      );

    const allowedStatuses = ["war_room", "join_trial"];
    if (!allowedStatuses.includes(caseData.AttorneyStatus))
      return sendError(
        res,
        403,
        "War room not accessible",
        "WAR_ROOM_NOT_ACCESSIBLE",
        {
          currentStatus: caseData.AttorneyStatus,
          allowedStatuses,
        }
      );

    // Admin
    if (user.type === "admin") {
      req.caseData = caseData;
      req.caseId = caseId;
      return next();
    }

    // Attorney
    if (user.type === "attorney") {
      if (caseData.AttorneyId !== user.id)
        return sendError(
          res,
          403,
          "You do not own this case's war room",
          "ACCESS_DENIED"
        );
      req.caseData = caseData;
      req.caseId = caseId;
      return next();
    }

    // Juror
    if (user.type === "juror") {
      const approved = await isJurorApprovedForCase(user.id, caseId);
      if (!approved)
        return sendError(
          res,
          403,
          "You are not approved for this case's war room",
          "JUROR_NOT_APPROVED"
        );
      req.caseData = caseData;
      req.caseId = caseId;
      return next();
    }

    return sendError(
      res,
      403,
      "Invalid user type for war room access",
      "INVALID_USER_TYPE"
    );
  } catch (err) {
    console.error("War room access error:", err);
    sendError(
      res,
      500,
      "Failed to verify war room access",
      "ACCESS_CHECK_ERROR"
    );
  }
}

// ============================================
// WAR ROOM OWNERSHIP (Attorney)
// ============================================
async function requireWarRoomOwnership(req, res, next) {
  try {
    const user = req.user;
    if (!user || user.type !== "attorney")
      return sendError(
        res,
        403,
        "Attorney privileges required",
        "ATTORNEY_REQUIRED"
      );

    const validation = validateCaseId(req.params.caseId);
    if (!validation.isValid)
      return sendError(res, 400, validation.error, "INVALID_CASE_ID");

    const caseId = validation.value;
    const caseData = await getCaseDetails(caseId);

    if (!caseData)
      return sendError(res, 404, "Case not found", "CASE_NOT_FOUND");

    if (caseData.AttorneyId !== user.id)
      return sendError(res, 403, "You do not own this case", "NOT_CASE_OWNER");

    const allowedStatuses = ["war_room", "join_trial"];
    if (!allowedStatuses.includes(caseData.AttorneyStatus))
      return sendError(
        res,
        403,
        "War room not available in current case status",
        "WAR_ROOM_NOT_ACCESSIBLE",
        {
          currentStatus: caseData.AttorneyStatus,
        }
      );

    req.caseData = caseData;
    req.caseId = caseId;
    next();
  } catch (err) {
    console.error("War room ownership error:", err);
    sendError(
      res,
      500,
      "Failed to verify war room ownership",
      "OWNERSHIP_CHECK_ERROR"
    );
  }
}

// ============================================
// ACTIVE WAR ROOM (Strictly 'war_room')
// ============================================
async function requireActiveWarRoom(req, res, next) {
  try {
    const user = req.user;
    if (!user?.id || !user?.type)
      return sendError(res, 401, "Authentication required", "AUTH_REQUIRED");

    const validation = validateCaseId(req.params.caseId);
    if (!validation.isValid)
      return sendError(res, 400, validation.error, "INVALID_CASE_ID");
    const caseId = validation.value;

    const caseData = await getCaseDetails(caseId);
    if (!caseData)
      return sendError(res, 404, "Case not found", "CASE_NOT_FOUND");

    if (caseData.AttorneyStatus !== "war_room")
      return sendError(
        res,
        403,
        "Only accessible during active war room phase",
        "NOT_IN_WAR_ROOM_PHASE",
        {
          currentStatus: caseData.AttorneyStatus,
        }
      );

    req.caseData = caseData;
    req.caseId = caseId;
    next();
  } catch (err) {
    console.error("Active war room check error:", err);
    sendError(res, 500, "Failed to verify war room phase", "PHASE_CHECK_ERROR");
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  requireWarRoomAccess,
  requireWarRoomOwnership,
  requireActiveWarRoom,
};
