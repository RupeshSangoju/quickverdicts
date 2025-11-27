// =============================================
// jurorController.js - Juror Profile Management
// =============================================

const Juror = require("../models/Juror");
const JurorApplication = require("../models/JurorApplication");
const bcrypt = require("bcryptjs");

/* ===========================================================
   PROFILE MANAGEMENT
   =========================================================== */

/**
 * Get juror profile
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

    const jurorId = req.user.id;
    const juror = await Juror.findById(jurorId);

    if (!juror) {
      return res.status(404).json({
        success: false,
        error: "Juror profile not found",
        code: "PROFILE_NOT_FOUND",
      });
    }

    // Remove sensitive data
    delete juror.PasswordHash;

    res.json({
      success: true,
      data: {
        juror: {
          id: juror.JurorId,
          name: juror.Name,
          email: juror.Email,
          phoneNumber: juror.PhoneNumber,
          address1: juror.Address1,
          address2: juror.Address2,
          city: juror.City,
          state: juror.State,
          zipCode: juror.ZipCode,
          county: juror.County,
          maritalStatus: juror.MaritalStatus,
          spouseEmployer: juror.SpouseEmployer,
          employerName: juror.EmployerName,
          employerAddress: juror.EmployerAddress,
          yearsInCounty: juror.YearsInCounty,
          ageRange: juror.AgeRange,
          gender: juror.Gender,
          education: juror.Education,
          paymentMethod: juror.PaymentMethod,
          isVerified: juror.IsVerified,
          verificationStatus: juror.VerificationStatus,
          verifiedAt: juror.VerifiedAt,
          isActive: juror.IsActive,
          onboardingCompleted: juror.OnboardingCompleted,
          introVideoCompleted: juror.IntroVideoCompleted,
          jurorQuizCompleted: juror.JurorQuizCompleted,
          profileComplete: juror.ProfileComplete,
          createdAt: juror.CreatedAt,
          lastLoginAt: juror.LastLoginAt,
        },
      },
    });
  } catch (error) {
    console.error("❌ [Juror.getProfile] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve profile",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Update juror profile
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

    const jurorId = req.user.id;
    const allowedFields = [
      "name",
      "phoneNumber",
      "address1",
      "address2",
      "city",
      "zipCode",
      "paymentMethod",
      "maritalStatus",
      "spouseEmployer",
      "employerName",
      "employerAddress",
      "yearsInCounty",
      "ageRange",
      "gender",
      "education",
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

    // Validate name if provided
    if (updates.name !== undefined) {
      if (!updates.name || updates.name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Name cannot be empty",
          code: "INVALID_INPUT",
        });
      }
      if (updates.name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: "Name must be at least 2 characters",
          code: "INVALID_INPUT",
        });
      }
    }

    // Validate phone number if provided
    if (updates.phoneNumber !== undefined) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(updates.phoneNumber)) {
        return res.status(400).json({
          success: false,
          error: "Invalid phone number format",
          code: "INVALID_PHONE",
        });
      }
    }

    // Validate years in county if provided
    if (updates.yearsInCounty !== undefined) {
      const years = parseInt(updates.yearsInCounty);
      if (isNaN(years) || years < 0 || years > 100) {
        return res.status(400).json({
          success: false,
          error: "Years in county must be between 0 and 100",
          code: "INVALID_INPUT",
        });
      }
    }

    // Verify juror exists
    const existingJuror = await Juror.findById(jurorId);
    if (!existingJuror) {
      return res.status(404).json({
        success: false,
        error: "Juror not found",
        code: "JUROR_NOT_FOUND",
      });
    }

    // Update profile
    await Juror.updateJurorProfile(jurorId, updates);

    // Check if profile is now complete
    const updatedJuror = await Juror.findById(jurorId);
    const isProfileComplete = !!(
      updatedJuror.Name &&
      updatedJuror.PhoneNumber &&
      updatedJuror.Address1 &&
      updatedJuror.City &&
      updatedJuror.ZipCode &&
      updatedJuror.AgeRange &&
      updatedJuror.Gender &&
      updatedJuror.Education
    );

    if (isProfileComplete && !updatedJuror.ProfileComplete) {
      await Juror.updateTaskCompletion(jurorId, "profile", true);
    }

    // Remove sensitive data
    delete updatedJuror.PasswordHash;

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        juror: {
          id: updatedJuror.JurorId,
          name: updatedJuror.Name,
          email: updatedJuror.Email,
          phoneNumber: updatedJuror.PhoneNumber,
          address1: updatedJuror.Address1,
          address2: updatedJuror.Address2,
          city: updatedJuror.City,
          state: updatedJuror.State,
          zipCode: updatedJuror.ZipCode,
          county: updatedJuror.County,
          paymentMethod: updatedJuror.PaymentMethod,
          isVerified: updatedJuror.IsVerified,
          verificationStatus: updatedJuror.VerificationStatus,
          profileComplete: updatedJuror.ProfileComplete,
        },
      },
    });
  } catch (error) {
    console.error("❌ [Juror.updateProfile] Error:", error);

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
 * Change juror password
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

    const jurorId = req.user.id;
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

    // Get current juror data
    const juror = await Juror.findById(jurorId);
    if (!juror) {
      return res.status(404).json({
        success: false,
        error: "Juror not found",
        code: "JUROR_NOT_FOUND",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      juror.PasswordHash
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
      juror.PasswordHash
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
    await Juror.updatePassword(jurorId, newPasswordHash);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ [Juror.changePassword] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change password",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Delete (deactivate) juror account
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

    const jurorId = req.user.id;
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

    // Verify juror exists
    const juror = await Juror.findById(jurorId);
    if (!juror) {
      return res.status(404).json({
        success: false,
        error: "Juror not found",
        code: "JUROR_NOT_FOUND",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, juror.PasswordHash);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: "Incorrect password",
        code: "INVALID_PASSWORD",
      });
    }

    // Check for approved applications
    const applications = await JurorApplication.getApplicationsByJuror(jurorId);
    const approvedApplications = applications.filter(
      (a) => a.Status === "approved"
    );

    if (approvedApplications.length > 0) {
      // Check if any are for upcoming trials
      const upcomingTrials = approvedApplications.filter((a) => {
        if (!a.ScheduledDate) return false;
        const scheduledDate = new Date(a.ScheduledDate);
        return scheduledDate >= new Date();
      });

      if (upcomingTrials.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete account with ${upcomingTrials.length} upcoming trial(s). Please contact support.`,
          code: "UPCOMING_TRIALS_EXIST",
          data: {
            upcomingTrialsCount: upcomingTrials.length,
            approvedApplicationsCount: approvedApplications.length,
          },
        });
      }
    }

    // Deactivate account (soft delete)
    await Juror.deactivateJuror(jurorId);

    res.json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("❌ [Juror.deleteAccount] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete account",
      code: "INTERNAL_ERROR",
    });
  }
}

/* ===========================================================
   STATISTICS
   =========================================================== */

/**
 * Get juror statistics
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

    const jurorId = req.user.id;

    // Get all applications
    const applications = await JurorApplication.getApplicationsByJuror(jurorId);

    // Calculate statistics
    const stats = {
      totalApplications: applications.length,
      applicationsByStatus: {
        pending: applications.filter((a) => a.Status === "pending").length,
        approved: applications.filter((a) => a.Status === "approved").length,
        rejected: applications.filter((a) => a.Status === "rejected").length,
        withdrawn: applications.filter((a) => a.Status === "withdrawn").length,
      },
      upcomingTrials: applications.filter((a) => {
        if (a.Status !== "approved" || !a.ScheduledDate) return false;
        const scheduledDate = new Date(a.ScheduledDate);
        const today = new Date();
        return scheduledDate >= today;
      }).length,
      completedTrials: applications.filter((a) => {
        if (a.Status !== "approved" || !a.ScheduledDate) return false;
        const scheduledDate = new Date(a.ScheduledDate);
        const today = new Date();
        return scheduledDate < today;
      }).length,
      totalEarnings: applications
        .filter((a) => a.Status === "approved" && a.PaymentAmount)
        .reduce((sum, a) => sum + parseFloat(a.PaymentAmount || 0), 0),
    };

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error("❌ [Juror.getStats] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve statistics",
      code: "INTERNAL_ERROR",
    });
  }
}

/* ===========================================================
   EXPORTS
   =========================================================== */

module.exports = {
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  deleteAccountHandler,
  getStatsHandler,
};
