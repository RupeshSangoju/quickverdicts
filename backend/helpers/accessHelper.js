/**
 * Access Helpers
 * Utility functions for checking user access permissions
 */

const { getPool } = require("../config/db");

/**
 * Send standardized error response
 */
function sendError(res, status, message, code, data = null) {
  const response = {
    success: false,
    error: message,
    code: code,
  };
  if (data) response.data = data;
  return res.status(status).json(response);
}

/**
 * Validate case ID
 */
function validateCaseId(caseId) {
  const parsed = parseInt(caseId, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return {
      isValid: false,
      error: "Invalid case ID format",
    };
  }
  return {
    isValid: true,
    value: parsed,
  };
}

/**
 * Get case details from database
 */
async function getCaseDetails(caseId) {
  try {
    const pool = await getPool();
    const { sql } = require("../config/db");
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT
          CaseId,
          AttorneyId,
          CaseTitle,
          CaseType,
          County,
          State,
          CaseJurisdiction,
          ScheduledDate,
          ScheduledTime,
          RequiredJurors,
          AdminApprovalStatus,
          AttorneyStatus,
          CaseDescription,
          PaymentMethod,
          PaymentAmount,
          VoirDire1Questions,
          VoirDire2Questions,
          CaseTier,
          JuryChargeStatus,
          JuryChargeReleasedAt,
          JuryChargeReleasedBy,
          PlaintiffGroups,
          DefendantGroups,
          ApprovedAt,
          ApprovedBy,
          AdminComments,
          CreatedAt,
          UpdatedAt
        FROM dbo.Cases
        WHERE CaseId = @caseId AND IsDeleted = 0
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    return result.recordset[0];
  } catch (error) {
    console.error("Error getting case details:", error);
    throw error;
  }
}

/**
 * Check if juror is approved for a specific case
 */
async function isJurorApprovedForCase(jurorId, caseId) {
  try {
    const pool = await getPool();
    const { sql } = require("../config/db");
    const result = await pool
      .request()
      .input("jurorId", sql.Int, parseInt(jurorId))
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT COUNT(*) as count
        FROM dbo.JurorApplications
        WHERE JurorId = @jurorId
          AND CaseId = @caseId
          AND Status = 'approved'
      `);

    return result.recordset[0].count > 0;
  } catch (error) {
    console.error("Error checking juror approval:", error);
    throw error;
  }
}

/**
 * Check if user is an admin
 */
function isAdmin(user) {
  return user && user.type === "admin";
}

/**
 * Check if user is an attorney
 */
function isAttorney(user) {
  return user && user.type === "attorney";
}

/**
 * Check if user is a juror
 */
function isJuror(user) {
  return user && user.type === "juror";
}

module.exports = {
  sendError,
  validateCaseId,
  getCaseDetails,
  isJurorApprovedForCase,
  isAdmin,
  isAttorney,
  isJuror,
};
