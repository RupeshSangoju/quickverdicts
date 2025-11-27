// =============================================
// attorneyController.js - Attorney Controller
// =============================================

const Attorney = require("../models/Attorney");
const Case = require("../models/Case");
const bcrypt = require("bcryptjs");

/**
 * Get attorney profile
 */
async function getProfileHandler(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const attorneyId = req.user.id;
    const attorney = await Attorney.findById(attorneyId);

    if (!attorney) {
      return res.status(404).json({
        success: false,
        error: "Attorney profile not found",
        code: "PROFILE_NOT_FOUND",
      });
    }

    // Remove sensitive data
    delete attorney.PasswordHash;

    res.json({
      success: true,
      data: {
        attorney: {
          id: attorney.AttorneyId,
          firstName: attorney.FirstName,
          middleName: attorney.MiddleName,
          lastName: attorney.LastName,
          lawFirmName: attorney.LawFirmName,
          email: attorney.Email,
          phoneNumber: attorney.PhoneNumber,
          state: attorney.State,
          stateBarNumber: attorney.StateBarNumber,
          officeAddress1: attorney.OfficeAddress1,
          officeAddress2: attorney.OfficeAddress2,
          city: attorney.City,
          county: attorney.County,
          zipCode: attorney.ZipCode,
          tierLevel: attorney.TierLevel,
          isVerified: attorney.IsVerified,
          verificationStatus: attorney.VerificationStatus,
          verifiedAt: attorney.VerifiedAt,
          isActive: attorney.IsActive,
          createdAt: attorney.CreatedAt,
          lastLoginAt: attorney.LastLoginAt,
        },
      },
    });
  } catch (error) {
    console.error("❌ [Attorney.getProfile] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve profile",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Update attorney profile
 */
async function updateProfileHandler(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const attorneyId = req.user.id;
    const allowedFields = [
      "firstName",
      "middleName",
      "lastName",
      "lawFirmName",
      "phoneNumber",
      "officeAddress1",
      "officeAddress2",
      "city",
      "county",
      "zipCode",
      "stateBarNumber",
    ];

    // Filter only allowed fields
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Validate at least one field is being updated
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one field must be provided for update",
        code: "INVALID_INPUT",
      });
    }

    // Verify attorney exists
    const existingAttorney = await Attorney.findById(attorneyId);
    if (!existingAttorney) {
      return res.status(404).json({
        success: false,
        error: "Attorney not found",
        code: "ATTORNEY_NOT_FOUND",
      });
    }

    // Check if state bar number is being changed and if it's unique
    if (
      updates.stateBarNumber &&
      updates.stateBarNumber !== existingAttorney.StateBarNumber
    ) {
      const barNumberExists = await Attorney.checkStateBarNumberExists(
        updates.stateBarNumber,
        existingAttorney.State,
        attorneyId
      );

      if (barNumberExists) {
        return res.status(409).json({
          success: false,
          error: "State bar number already registered in this state",
          code: "DUPLICATE_BAR_NUMBER",
        });
      }
    }

    // Update profile
    await Attorney.updateProfile(attorneyId, updates);

    // Fetch updated attorney data
    const updatedAttorney = await Attorney.findById(attorneyId);
    delete updatedAttorney.PasswordHash;

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        attorney: {
          id: updatedAttorney.AttorneyId,
          firstName: updatedAttorney.FirstName,
          middleName: updatedAttorney.MiddleName,
          lastName: updatedAttorney.LastName,
          lawFirmName: updatedAttorney.LawFirmName,
          email: updatedAttorney.Email,
          phoneNumber: updatedAttorney.PhoneNumber,
          state: updatedAttorney.State,
          stateBarNumber: updatedAttorney.StateBarNumber,
          officeAddress1: updatedAttorney.OfficeAddress1,
          officeAddress2: updatedAttorney.OfficeAddress2,
          city: updatedAttorney.City,
          county: updatedAttorney.County,
          zipCode: updatedAttorney.ZipCode,
          tierLevel: updatedAttorney.TierLevel,
          isVerified: updatedAttorney.IsVerified,
          verificationStatus: updatedAttorney.VerificationStatus,
        },
      },
    });
  } catch (error) {
    console.error("❌ [Attorney.updateProfile] Error:", error);

    if (error.code === "VALIDATION_ERROR") {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update profile",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Change attorney password
 */
async function changePasswordHandler(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const attorneyId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password, new password, and confirmation are required",
        code: "INVALID_INPUT",
      });
    }

    // Validate new password matches confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "New password and confirmation do not match",
        code: "PASSWORD_MISMATCH",
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 8 characters long",
        code: "WEAK_PASSWORD",
      });
    }

    // Password strength regex: at least one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        code: "WEAK_PASSWORD",
      });
    }

    // Get current attorney data
    const attorney = await Attorney.findById(attorneyId);
    if (!attorney) {
      return res.status(404).json({
        success: false,
        error: "Attorney not found",
        code: "ATTORNEY_NOT_FOUND",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      attorney.PasswordHash
    );
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password is incorrect",
        code: "INVALID_PASSWORD",
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(
      newPassword,
      attorney.PasswordHash
    );
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: "New password must be different from current password",
        code: "SAME_PASSWORD",
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await Attorney.updatePassword(attorneyId, newPasswordHash);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ [Attorney.changePassword] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change password",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Delete (deactivate) attorney account
 */
async function deleteAccountHandler(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const attorneyId = req.user.id;
    const { password, confirmDelete } = req.body;

    // Require password confirmation
    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Password is required to delete account",
        code: "PASSWORD_REQUIRED",
      });
    }

    // Require explicit confirmation
    if (confirmDelete !== true) {
      return res.status(400).json({
        success: false,
        error: "Account deletion must be explicitly confirmed",
        code: "CONFIRMATION_REQUIRED",
      });
    }

    // Verify attorney exists
    const attorney = await Attorney.findById(attorneyId);
    if (!attorney) {
      return res.status(404).json({
        success: false,
        error: "Attorney not found",
        code: "ATTORNEY_NOT_FOUND",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      password,
      attorney.PasswordHash
    );
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: "Incorrect password",
        code: "INVALID_PASSWORD",
      });
    }

    // Check for active cases
    const activeCases = await Case.getCasesByAttorney(attorneyId, {
      status: "join_trial",
    });

    if (activeCases.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete account with ${activeCases.length} active case(s). Please complete or cancel them first.`,
        code: "ACTIVE_CASES_EXIST",
        data: {
          activeCasesCount: activeCases.length,
        },
      });
    }

    // Check for pending cases
    const pendingCases = await Case.getCasesByAttorney(attorneyId, {
      adminApprovalStatus: "pending",
    });

    if (pendingCases.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete account with ${pendingCases.length} pending case(s). Please wait for admin approval or cancel them.`,
        code: "PENDING_CASES_EXIST",
        data: {
          pendingCasesCount: pendingCases.length,
        },
      });
    }

    // Deactivate account (soft delete)
    await Attorney.deactivateAccount(attorneyId);

    res.json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("❌ [Attorney.deleteAccount] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete account",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Get attorney statistics
 */
async function getStatsHandler(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const attorneyId = req.user.id;

    // Get all cases
    const cases = await Case.getCasesByAttorney(attorneyId);

    // Calculate statistics
    const stats = {
      totalCases: cases.length,
      casesByStatus: {
        pending: cases.filter((c) => c.AdminApprovalStatus === "pending")
          .length,
        approved: cases.filter((c) => c.AdminApprovalStatus === "approved")
          .length,
        rejected: cases.filter((c) => c.AdminApprovalStatus === "rejected")
          .length,
      },
      casesByState: {
        warRoom: cases.filter((c) => c.AttorneyStatus === "war_room").length,
        joinTrial: cases.filter((c) => c.AttorneyStatus === "join_trial")
          .length,
        completed: cases.filter((c) => c.AttorneyStatus === "completed").length,
        cancelled: cases.filter((c) => c.AttorneyStatus === "cancelled").length,
      },
      casesByType: {
        civil: cases.filter((c) => c.CaseType === "Civil").length,
        criminal: cases.filter((c) => c.CaseType === "Criminal").length,
      },
      upcomingTrials: cases.filter((c) => {
        if (!c.ScheduledDate) return false;
        const scheduledDate = new Date(c.ScheduledDate);
        const today = new Date();
        return scheduledDate >= today;
      }).length,
    };

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error("❌ [Attorney.getStats] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve statistics",
      code: "INTERNAL_ERROR",
    });
  }
}

module.exports = {
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  deleteAccountHandler,
  getStatsHandler,
};
