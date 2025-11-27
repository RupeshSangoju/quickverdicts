// =============================================
// trialMiddleware.js - Trial Access Control Middleware
// =============================================

const {
  sendError,
  validateCaseId,
  getCaseDetails,
  isJurorApprovedForCase,
} = require("../helpers/accessHelper");

// ============================================
// TRIAL ACCESS (join_trial stage)
// ============================================
async function requireTrialAccess(req, res, next) {
  try {
    const user = req.user;
    console.log(`🔐 Trial access check - User:`, user ? `${user.type} (ID: ${user.id})` : 'None');

    if (!user?.id || !user?.type) {
      console.error("❌ No user authentication found");
      return sendError(res, 401, "Authentication required", "AUTH_REQUIRED");
    }

    const validation = validateCaseId(req.params.caseId);
    if (!validation.isValid) {
      console.error(`❌ Invalid case ID: ${req.params.caseId}`);
      return sendError(res, 400, validation.error, "INVALID_CASE_ID");
    }

    const caseId = validation.value;
    console.log(`🔍 Checking trial access for case ${caseId}`);

    // Admin has full access
    if (user.type === "admin") {
      console.log(`✅ Admin access granted for case ${caseId}`);
      req.caseId = caseId;
      return next();
    }

    const caseData = await getCaseDetails(caseId);
    if (!caseData) {
      console.error(`❌ Case ${caseId} not found in database`);
      return sendError(res, 404, "Case not found", "CASE_NOT_FOUND");
    }

    console.log(`📋 Case ${caseId} - AttorneyStatus: ${caseData.AttorneyStatus}, AdminApproval: ${caseData.AdminApprovalStatus}`);

    if (caseData.AdminApprovalStatus !== "approved") {
      console.error(`❌ Case ${caseId} not approved by admin (status: ${caseData.AdminApprovalStatus})`);
      return sendError(
        res,
        403,
        "Case not yet approved by admin",
        "CASE_NOT_APPROVED"
      );
    }

    if (caseData.AttorneyStatus !== "join_trial") {
      console.error(`❌ Trial not active for case ${caseId} (status: ${caseData.AttorneyStatus})`);
      return sendError(
        res,
        403,
        `Trial not accessible (status: ${caseData.AttorneyStatus})`,
        "TRIAL_NOT_ACTIVE"
      );
    }

    // Attorney access
    if (user.type === "attorney") {
      if (caseData.AttorneyId !== user.id) {
        console.error(`❌ Attorney ${user.id} does not own case ${caseId} (owner: ${caseData.AttorneyId})`);
        return sendError(
          res,
          403,
          "You do not have access to this trial",
          "ACCESS_DENIED"
        );
      }

      console.log(`✅ Attorney ${user.id} access granted for case ${caseId}`);
      req.caseData = caseData;
      req.caseId = caseId;
      return next();
    }

    // Juror access
    if (user.type === "juror") {
      const approved = await isJurorApprovedForCase(user.id, caseId);
      if (!approved) {
        console.error(`❌ Juror ${user.id} not approved for case ${caseId}`);
        return sendError(
          res,
          403,
          "You are not approved for this trial",
          "JUROR_NOT_APPROVED"
        );
      }

      console.log(`✅ Juror ${user.id} access granted for case ${caseId}`);
      req.caseData = caseData;
      req.caseId = caseId;
      return next();
    }

    console.error(`❌ Invalid user type for trial access: ${user.type}`);
    return sendError(
      res,
      403,
      "Invalid user type for trial access",
      "INVALID_USER_TYPE"
    );
  } catch (err) {
    console.error("❌ Trial access check error:", err);
    sendError(res, 500, "Failed to verify trial access", "ACCESS_CHECK_ERROR");
  }
}

// ============================================
// VERDICT ACCESS (view_details stage)
// ============================================
async function requireVerdictAccess(req, res, next) {
  try {
    const user = req.user;
    if (!user?.id || !user?.type)
      return sendError(res, 401, "Authentication required", "AUTH_REQUIRED");

    const validation = validateCaseId(req.params.caseId);
    if (!validation.isValid)
      return sendError(res, 400, validation.error, "INVALID_CASE_ID");

    const caseId = validation.value;

    if (user.type === "admin") {
      req.caseId = caseId;
      return next();
    }

    const caseData = await getCaseDetails(caseId);
    if (!caseData)
      return sendError(res, 404, "Case not found", "CASE_NOT_FOUND");

    if (caseData.AttorneyStatus !== "view_details")
      return sendError(
        res,
        403,
        "Verdict not available yet",
        "VERDICT_STAGE_NOT_ACTIVE",
        {
          currentStatus: caseData.AttorneyStatus,
        }
      );

    // Attorney
    if (user.type === "attorney") {
      if (caseData.AttorneyId !== user.id)
        return sendError(
          res,
          403,
          "You do not have access to this case",
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
          "You are not approved for this case",
          "JUROR_NOT_APPROVED"
        );

      req.caseData = caseData;
      req.caseId = caseId;
      return next();
    }

    return sendError(
      res,
      403,
      "Invalid user type for verdict access",
      "INVALID_USER_TYPE"
    );
  } catch (err) {
    console.error("Verdict access check error:", err);
    sendError(
      res,
      500,
      "Failed to verify verdict access",
      "ACCESS_CHECK_ERROR"
    );
  }
}

// ============================================
// ADMIN CHECK
// ============================================
function requireAdminForTrial(req, res, next) {
  const user = req.user;
  if (!user?.type)
    return sendError(res, 401, "Authentication required", "AUTH_REQUIRED");
  if (user.type !== "admin")
    return sendError(
      res,
      403,
      "Administrator privileges required",
      "ADMIN_REQUIRED"
    );
  next();
}

// ============================================
// ATTORNEY OWNERSHIP CHECK
// ============================================
async function requireCaseOwnership(req, res, next) {
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

    req.caseData = caseData;
    req.caseId = caseId;
    next();
  } catch (err) {
    console.error("Case ownership check error:", err);
    sendError(
      res,
      500,
      "Failed to verify case ownership",
      "OWNERSHIP_CHECK_ERROR"
    );
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  requireTrialAccess,
  requireVerdictAccess,
  requireAdminForTrial,
  requireCaseOwnership,
};
