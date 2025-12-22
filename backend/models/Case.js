// =============================================
// Case.js - Case Management Model
// =============================================

const { getPool, executeQuery, sql } = require("../config/db");

// ============================================
// CONSTANTS
// ============================================

const ATTORNEY_CASE_STATES = {
  PENDING_ADMIN_APPROVAL: "pending",
  WAR_ROOM: "war_room",
  AWAITING_TRIAL: "awaiting_trial",  // War room submitted, waiting for trial time
  JOIN_TRIAL: "join_trial",
  VIEW_DETAILS: "view_details",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

const ADMIN_APPROVAL_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const CASE_TYPES = {
  CIVIL: "Civil",
  CRIMINAL: "Criminal",
};

const CASE_JURISDICTIONS = {
  STATE: "State",
  FEDERAL: "Federal",
};

const CASE_TIERS = {
  TIER_1: "Tier 1",
  TIER_2: "Tier 2",
  TIER_3: "Tier 3",
};

// ============================================
// VALIDATION HELPERS
// ============================================

function validateCaseData(data) {
  const errors = [];

  // Required fields
  if (!data.attorneyId || isNaN(parseInt(data.attorneyId))) {
    errors.push("Attorney ID is required");
  }
  if (!data.caseType?.trim()) {
    errors.push("Case type is required");
  } else if (!Object.values(CASE_TYPES).includes(data.caseType.trim())) {
    errors.push("Invalid case type. Must be 'Civil' or 'Criminal'");
  }
  if (!data.caseJurisdiction?.trim()) {
    errors.push("Case jurisdiction is required");
  } else if (!Object.values(CASE_JURISDICTIONS).includes(data.caseJurisdiction.trim())) {
    errors.push("Invalid case jurisdiction. Must be 'State' or 'Federal'");
  }
  if (!data.caseTier?.trim()) {
    errors.push("Case tier is required");
  } else if (!Object.values(CASE_TIERS).includes(data.caseTier.trim())) {
    errors.push("Invalid case tier. Must be Tier 1, 2, or 3");
  }
  if (!data.state?.trim()) {
    errors.push("State is required");
  }
  if (!data.county?.trim()) {
    errors.push("County is required");
  }
  if (!data.caseTitle?.trim()) {
    errors.push("Case title is required");
  } else if (data.caseTitle.trim().length < 5) {
    errors.push("Case title must be at least 5 characters");
  }
  if (!data.scheduledDate) {
    errors.push("Scheduled date is required");
  }

  // Trim scheduledTime before validation
  if (data.scheduledTime) {
    data.scheduledTime = data.scheduledTime.trim();
  }

  if (!data.scheduledTime || data.scheduledTime.trim() === "") {
    errors.push("Scheduled time is required");
  }

  // Validate scheduledTime format (HH:MM or HH:MM:SS) - more robust regex
  if (data.scheduledTime && data.scheduledTime.trim()) {
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$/;
    if (!timeRegex.test(data.scheduledTime.trim())) {
      errors.push("Invalid time format. Expected HH:MM or HH:MM:SS (e.g., 09:00 or 14:30)");
    }
  }

  // Validate future date (only if both date and time are valid)
  if (data.scheduledDate && data.scheduledTime && errors.length === 0) {
    try {
      // Ensure time is in HH:MM:SS format for validation
      let timeForValidation = data.scheduledTime.trim();
      if (!timeForValidation.includes(':')) {
        errors.push("Invalid time format - missing colon separator");
      } else {
        const timeParts = timeForValidation.split(':');
        if (timeParts.length === 2) {
          timeForValidation = `${timeForValidation}:00`;
        }

        const scheduledDateTime = new Date(
          `${data.scheduledDate}T${timeForValidation}`
        );

        if (isNaN(scheduledDateTime.getTime())) {
          errors.push("Invalid date/time format");
        } else {
          // Check if scheduled time is in the future (with 5 minute buffer)
          const now = new Date();
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
          if (scheduledDateTime <= fiveMinutesAgo) {
            errors.push("Scheduled date/time must be in the future");
          }
        }
      }
    } catch (err) {
      errors.push("Invalid date/time format");
    }
  }

  // Validate payment amount
  if (data.paymentAmount !== undefined && data.paymentAmount !== null) {
    const amount = parseFloat(data.paymentAmount);
    if (isNaN(amount) || amount < 0) {
      errors.push("Payment amount must be a positive number");
    }
  }

  // Validate required jurors
  if (data.requiredJurors !== undefined) {
    const jurors = parseInt(data.requiredJurors);
    if (isNaN(jurors) || jurors < 6 || jurors > 12) {
      errors.push("Required jurors must be between 6 and 12");
    }
  }

  if (errors.length) {
    const err = new Error(`Case validation failed: ${errors.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }
}

function safeJSONParse(value, fallback = []) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value || fallback;
  } catch (error) {
    console.warn("⚠️  JSON parse error:", error.message);
    return fallback;
  }
}

function safeJSONStringify(value) {
  try {
    return typeof value === "string" ? value : JSON.stringify(value || []);
  } catch (error) {
    console.warn("⚠️  JSON stringify error:", error.message);
    return "[]";
  }
}

// ============================================
// CREATE
// ============================================

async function createCase(data) {
  try {
    validateCaseData(data);

    // Convert scheduledTime from attorney's local timezone to UTC
    let timeValue = null;
    let utcDateTimeForScheduler = null;

    if (data.scheduledTime && data.scheduledDate) {
      const trimmedTime = data.scheduledTime.trim();
      const timeParts = trimmedTime.split(':');

      // Parse time components
      let hours, minutes, seconds;
      if (timeParts.length === 2) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
        seconds = 0;
      } else if (timeParts.length === 3) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
        seconds = parseInt(timeParts[2], 10);
      } else {
        throw new Error("Invalid time format after validation");
      }

      console.log(`⏰ Attorney Local Time: ${data.scheduledDate} ${trimmedTime}`);
      console.log(`🌍 Timezone Offset: ${data.timezoneOffset} minutes (${data.timezoneName || 'Unknown'})`);

      // Parse the scheduled date components
      const dateParts = data.scheduledDate.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed in Date
      const day = parseInt(dateParts[2], 10);

      // Get timezone offset (positive = ahead of UTC, negative = behind UTC)
      const timezoneOffsetMinutes = parseInt(data.timezoneOffset || 0, 10);

      // Create UTC timestamp representing attorney's local time
      // Date.UTC() creates timestamp in UTC, avoiding server timezone interpretation issues
      const localAsUTC = Date.UTC(year, month, day, hours, minutes, seconds);

      // Convert to actual UTC by subtracting timezone offset
      // If attorney is in IST (UTC+5:30 = +330 min), subtract 330 min to get UTC
      const actualUTC = localAsUTC - (timezoneOffsetMinutes * 60 * 1000);

      // Create Date object from UTC timestamp
      const utcDateTime = new Date(actualUTC);

      // Extract UTC date and time components
      const utcYear = utcDateTime.getUTCFullYear();
      const utcMonth = String(utcDateTime.getUTCMonth() + 1).padStart(2, '0');
      const utcDay = String(utcDateTime.getUTCDate()).padStart(2, '0');
      const utcHours = utcDateTime.getUTCHours();
      const utcMinutes = utcDateTime.getUTCMinutes();
      const utcSeconds = utcDateTime.getUTCSeconds();
      const utcDate = `${utcYear}-${utcMonth}-${utcDay}`;

      // Store as string in HH:MM:SS format
      timeValue = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`;

      console.log(`🌐 Converted to UTC: ${utcDate} ${timeValue}`);
      console.log(`   → Attorney Local: ${data.scheduledDate} ${trimmedTime} (${data.timezoneName})`);
      console.log(`   → Stored in DB (UTC): ${utcDate} ${timeValue}`);

      // Update scheduledDate to UTC date (in case it changed due to timezone conversion)
      data.scheduledDate = utcDate;
    }

    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("attorneyId", sql.Int, parseInt(data.attorneyId))
        .input("caseType", sql.NVarChar, data.caseType.trim())
        .input("caseJurisdiction", sql.NVarChar, data.caseJurisdiction.trim())
        .input("caseTier", sql.NVarChar, data.caseTier.trim())
        .input("state", sql.NVarChar, data.state.trim().toUpperCase())
        .input("county", sql.NVarChar, data.county.trim())
        .input("caseTitle", sql.NVarChar, data.caseTitle.trim())
        .input(
          "caseDescription",
          sql.NVarChar,
          data.caseDescription?.trim() || ""
        )
        .input("paymentMethod", sql.NVarChar, data.paymentMethod?.trim() || "")
        .input(
          "paymentAmount",
          sql.Decimal(10, 2),
          parseFloat(data.paymentAmount) || 0
        )
        .input("scheduledDate", sql.Date, data.scheduledDate)
        .input("scheduledTime", sql.VarChar, timeValue) // Use VarChar to prevent timezone conversion
        .input(
          "plaintiffGroups",
          sql.NVarChar,
          safeJSONStringify(safeJSONParse(data.plaintiffGroups))
        )
        .input(
          "defendantGroups",
          sql.NVarChar,
          safeJSONStringify(safeJSONParse(data.defendantGroups))
        )
        .input(
          "voirDire1Questions",
          sql.NVarChar,
          safeJSONStringify(safeJSONParse(data.voirDire1Questions))
        )
        .input(
          "voirDire2Questions",
          sql.NVarChar,
          safeJSONStringify(safeJSONParse(data.voirDire2Questions))
        )
        .input("requiredJurors", sql.Int, parseInt(data.requiredJurors) || 7)
        .input(
          "attorneyStatus",
          sql.NVarChar,
          ATTORNEY_CASE_STATES.PENDING_ADMIN_APPROVAL
        )
        .input(
          "adminApprovalStatus",
          sql.NVarChar,
          ADMIN_APPROVAL_STATUSES.PENDING
        ).query(`
          INSERT INTO dbo.Cases (
            AttorneyId, CaseType, CaseJurisdiction, CaseTier, State, County, CaseTitle, CaseDescription,
            PaymentMethod, PaymentAmount, ScheduledDate, ScheduledTime,
            PlaintiffGroups, DefendantGroups, VoirDire1Questions, VoirDire2Questions,
            RequiredJurors, AttorneyStatus, AdminApprovalStatus,
            IsDeleted, CreatedAt, UpdatedAt
          )
          VALUES (
            @attorneyId, @caseType, @caseJurisdiction, @caseTier, @state, @county, @caseTitle, @caseDescription,
            @paymentMethod, @paymentAmount, @scheduledDate, @scheduledTime,
            @plaintiffGroups, @defendantGroups, @voirDire1Questions, @voirDire2Questions,
            @requiredJurors, @attorneyStatus, @adminApprovalStatus,
            0, GETUTCDATE(), GETUTCDATE()
          );
          SELECT SCOPE_IDENTITY() AS CaseId;
        `);

      return result.recordset[0].CaseId;
    });
  } catch (error) {
    console.error("❌ [Case.createCase] Error:", error.message);
    throw error;
  }
}

// ============================================
// READ
// ============================================

async function findById(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) {
      const err = new Error("Valid case ID is required");
      err.statusCode = 400;
      throw err;
    }

    return await executeQuery(async (pool) => {
      const result = await pool.request().input("id", sql.Int, id).query(`
          SELECT 
            c.*, 
            a.FirstName + ' ' + a.LastName AS AttorneyName,
            a.Email AS AttorneyEmail,
            a.LawFirmName,
            a.PhoneNumber AS AttorneyPhone,
            a.StateBarNumber,
            ISNULL(c.RequiredJurors, 7) AS RequiredJurors
          FROM dbo.Cases c
          LEFT JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
          WHERE c.CaseId = @id
        `);

      const caseData = result.recordset[0];
      if (caseData) {
        // Parse JSON fields
        caseData.PlaintiffGroups = safeJSONParse(caseData.PlaintiffGroups);
        caseData.DefendantGroups = safeJSONParse(caseData.DefendantGroups);
        caseData.VoirDire1Questions = safeJSONParse(
          caseData.VoirDire1Questions
        );
        caseData.VoirDire2Questions = safeJSONParse(
          caseData.VoirDire2Questions
        );
      }

      return caseData || null;
    });
  } catch (error) {
    console.error("❌ [Case.findById] Error:", error.message);
    throw error;
  }
}

async function getCasesByAttorney(attorneyId, options = {}) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID is required");

    return await executeQuery(async (pool) => {
      const request = pool.request().input("id", sql.Int, id);

      let query = `
        SELECT
          c.*,
          (SELECT COUNT(*) FROM dbo.JurorApplications ja
           WHERE ja.CaseId = c.CaseId AND ja.Status = 'approved') AS ApprovedJurors,
          (SELECT COUNT(*) FROM dbo.JurorApplications ja
           WHERE ja.CaseId = c.CaseId AND ja.Status = 'pending') AS PendingApplications
        FROM dbo.Cases c
        WHERE c.AttorneyId = @id AND c.IsDeleted = 0
      `;

      if (options.status) {
        query += " AND c.AttorneyStatus = @status";
        request.input("status", sql.NVarChar, options.status);
      }

      if (options.adminApprovalStatus) {
        query += " AND c.AdminApprovalStatus = @adminApprovalStatus";
        request.input(
          "adminApprovalStatus",
          sql.NVarChar,
          options.adminApprovalStatus
        );
      }

      query += " ORDER BY c.ScheduledDate DESC, c.CreatedAt DESC";

      const result = await request.query(query);
      return result.recordset;
    });
  } catch (error) {
    console.error("❌ [Case.getCasesByAttorney] Error:", error.message);
    throw error;
  }
}

async function getCasesPendingAdminApproval(limit = 50) {
  try {
    return await executeQuery(async (pool) => {
      const result = await pool
        .request()
        .input("limit", sql.Int, Math.min(100, Math.max(1, limit))).query(`
          SELECT TOP(@limit)
            c.*, 
            a.FirstName + ' ' + a.LastName AS AttorneyName,
            a.Email AS AttorneyEmail,
            a.LawFirmName,
            a.PhoneNumber AS AttorneyPhone,
            a.StateBarNumber,
            ISNULL(c.RequiredJurors, 7) AS RequiredJurors
          FROM dbo.Cases c
          LEFT JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
          WHERE c.AdminApprovalStatus = 'pending' AND c.IsDeleted = 0
          ORDER BY c.CreatedAt ASC
        `);

      return result.recordset;
    });
  } catch (error) {
    console.error(
      "❌ [Case.getCasesPendingAdminApproval] Error:",
      error.message
    );
    throw error;
  }
}

async function getAvailableCasesForJurors(county = null, jurorId = null, state = null) {
  try {
    console.log('🔍 [Case.getAvailableCasesForJurors] Called with params:', {
      county,
      jurorId,
      state,
      countyType: typeof county,
      stateType: typeof state,
      countyTrimmed: county?.trim(),
      stateTrimmed: state?.trim()
    });

    return await executeQuery(async (pool) => {
      const request = pool.request();

      let query = `
        SELECT
          c.CaseId, c.AttorneyId, c.CaseType, c.CaseTier, c.State, c.County, c.CaseTitle,
          c.CaseDescription, c.PaymentMethod, c.PaymentAmount, c.ScheduledDate, c.ScheduledTime,
          c.PlaintiffGroups, c.DefendantGroups, c.VoirDire1Questions, c.VoirDire2Questions,
          c.AttorneyStatus, c.AdminApprovalStatus, c.CreatedAt,
          a.FirstName + ' ' + a.LastName AS AttorneyName, a.LawFirmName,
          ISNULL(c.RequiredJurors, 7) AS RequiredJurors,
          (SELECT COUNT(*) FROM dbo.JurorApplications ja
           WHERE ja.CaseId = c.CaseId AND ja.Status = 'approved') AS ApprovedJurors,
          (SELECT COUNT(*) FROM dbo.JurorApplications ja
           WHERE ja.CaseId = c.CaseId AND ja.Status = 'pending') AS PendingApplications
        FROM dbo.Cases c
        LEFT JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
        WHERE c.AttorneyStatus = 'war_room'
          AND c.AdminApprovalStatus = 'approved'
          AND c.IsDeleted = 0
          -- ✅ IMPORTANT: Only show cases with future trial dates (not expired)
          -- Use attorney's local timezone to determine if case is in the future
          AND DATEDIFF(DAY,
            DATEADD(MINUTE, CASE
              WHEN a.State IN ('Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'New Hampshire', 'New Jersey', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'Vermont', 'Virginia', 'West Virginia') THEN -300
              WHEN a.State IN ('Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska', 'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas', 'Wisconsin') THEN -360
              WHEN a.State IN ('Arizona', 'Colorado', 'Idaho', 'Montana', 'New Mexico', 'Utah', 'Wyoming') THEN -420
              WHEN a.State IN ('California', 'Nevada', 'Oregon', 'Washington') THEN -480
              WHEN a.State = 'Alaska' THEN -540
              WHEN a.State = 'Hawaii' THEN -600
              WHEN a.State = 'India' THEN 330
              ELSE 0
            END, GETDATE()),
            c.ScheduledDate
          ) >= 0
      `;

      // Filter by State (REQUIRED for location matching)
      if (state) {
        query += " AND UPPER(LTRIM(RTRIM(c.State))) = UPPER(LTRIM(RTRIM(@state)))";
        request.input("state", sql.NVarChar, state.trim());
        console.log('  ➕ Added state filter:', state.trim());
      }

      // Filter by County (REQUIRED for location matching)
      if (county) {
        query += " AND LOWER(LTRIM(RTRIM(c.County))) = LOWER(LTRIM(RTRIM(@county)))";
        request.input("county", sql.NVarChar, county.trim());
        console.log('  ➕ Added county filter:', county.trim());
      }

      if (jurorId) {
        const id = parseInt(jurorId, 10);
        if (!isNaN(id) && id > 0) {
          query += `
            AND c.CaseId NOT IN (
              SELECT CaseId FROM dbo.JurorApplications WHERE JurorId = @jurorId
            )`;
          request.input("jurorId", sql.Int, id);
          console.log('  ➕ Added jurorId filter:', id);
        }
      }

      // Enforce maximum 7 jurors limit - hide cases that already have 7 approved jurors
      query += `
        AND (
          SELECT COUNT(*) FROM dbo.JurorApplications ja
          WHERE ja.CaseId = c.CaseId AND ja.Status = 'approved'
        ) < 7
        ORDER BY c.ScheduledDate ASC, c.CreatedAt DESC
      `;

      console.log('📋 [Case.getAvailableCasesForJurors] Executing query...');
      const result = await request.query(query);
      console.log('✅ [Case.getAvailableCasesForJurors] Query result:', {
        rowCount: result.recordset.length,
        cases: result.recordset.map(c => ({
          id: c.CaseId,
          title: c.CaseTitle,
          state: c.State,
          county: c.County
        }))
      });
      return result.recordset;
    });
  } catch (error) {
    console.error("❌ [Case.getAvailableCasesForJurors] Error:", error.message);
    throw error;
  }
}

async function getAllCases(options = {}) {
  try {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const offset = (page - 1) * limit;

    return await executeQuery(async (pool) => {
      const request = pool
        .request()
        .input("limit", sql.Int, limit)
        .input("offset", sql.Int, offset);

      const whereClauses = ["c.IsDeleted = 0"];

      if (options.adminApprovalStatus) {
        whereClauses.push("c.AdminApprovalStatus = @adminApprovalStatus");
        request.input(
          "adminApprovalStatus",
          sql.NVarChar,
          options.adminApprovalStatus
        );
      }

      if (options.attorneyStatus) {
        whereClauses.push("c.AttorneyStatus = @attorneyStatus");
        request.input("attorneyStatus", sql.NVarChar, options.attorneyStatus);
      }

      if (options.county) {
        whereClauses.push("c.County = @county");
        request.input("county", sql.NVarChar, options.county);
      }

      if (options.caseType) {
        whereClauses.push("c.CaseType = @caseType");
        request.input("caseType", sql.NVarChar, options.caseType);
      }

      if (options.search) {
        const searchTerm = `%${options.search}%`;
        whereClauses.push(
          "(c.CaseTitle LIKE @search OR c.CaseDescription LIKE @search)"
        );
        request.input("search", sql.NVarChar, searchTerm);
      }

      const whereClause = whereClauses.join(" AND ");

      const query = `
        SELECT 
          c.*,
          a.FirstName + ' ' + a.LastName AS AttorneyName,
          a.Email AS AttorneyEmail,
          a.LawFirmName,
          ISNULL(c.RequiredJurors, 7) AS RequiredJurors,
          (SELECT COUNT(*) FROM dbo.JurorApplications ja
           WHERE ja.CaseId = c.CaseId AND ja.Status = 'approved') AS ApprovedJurors
        FROM dbo.Cases c
        LEFT JOIN dbo.Attorneys a ON c.AttorneyId = a.AttorneyId
        WHERE ${whereClause}
        ORDER BY c.ScheduledDate DESC, c.CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

        SELECT COUNT(*) AS total
        FROM dbo.Cases c
        WHERE ${whereClause};
      `;

      const result = await request.query(query);

      return {
        cases: result.recordsets[0],
        total: result.recordsets[1][0].total,
        page,
        limit,
        totalPages: Math.ceil(result.recordsets[1][0].total / limit),
      };
    });
  } catch (error) {
    console.error("❌ [Case.getAllCases] Error:", error.message);
    throw error;
  }
}

// ============================================
// UPDATE
// ============================================

async function updateCaseStatus(caseId, statusUpdates) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid case ID is required");

    const {
      attorneyStatus,
      adminApprovalStatus,
      adminComments,
      adminId,
      juryChargeStatus,
      juryChargeReleasedAt,
      juryChargeReleasedBy,
    } = statusUpdates;

    return await executeQuery(async (pool) => {
      const req = pool.request().input("id", sql.Int, id);
      const updates = ["UpdatedAt = GETUTCDATE()"];

      if (attorneyStatus) {
        if (!Object.values(ATTORNEY_CASE_STATES).includes(attorneyStatus)) {
          throw new Error(`Invalid attorney status: ${attorneyStatus}`);
        }
        updates.push("AttorneyStatus = @attorneyStatus");
        req.input("attorneyStatus", sql.NVarChar, attorneyStatus);
      }

      if (adminApprovalStatus) {
        if (
          !Object.values(ADMIN_APPROVAL_STATUSES).includes(adminApprovalStatus)
        ) {
          throw new Error(
            `Invalid admin approval status: ${adminApprovalStatus}`
          );
        }

        updates.push("AdminApprovalStatus = @adminApprovalStatus");
        req.input("adminApprovalStatus", sql.NVarChar, adminApprovalStatus);

        if (adminApprovalStatus === ADMIN_APPROVAL_STATUSES.APPROVED) {
          updates.push(
            "AttorneyStatus = 'war_room'",
            "ApprovedAt = GETUTCDATE()"
          );
          if (adminId) {
            updates.push("ApprovedBy = @adminId");
            req.input("adminId", sql.Int, parseInt(adminId));
          }
        } else if (adminApprovalStatus === ADMIN_APPROVAL_STATUSES.REJECTED) {
          updates.push("RejectedAt = GETUTCDATE()");
          if (adminId) {
            updates.push("RejectedBy = @adminId");
            req.input("adminId", sql.Int, parseInt(adminId));
          }
        }
      }

      if (adminComments !== undefined) {
        updates.push("AdminComments = @adminComments");
        req.input("adminComments", sql.NVarChar, adminComments?.trim() || null);
      }

      if (juryChargeStatus !== undefined) {
        updates.push("JuryChargeStatus = @juryChargeStatus");
        req.input("juryChargeStatus", sql.NVarChar, juryChargeStatus?.trim() || "pending");
      }

      if (juryChargeReleasedAt !== undefined) {
        updates.push("JuryChargeReleasedAt = @juryChargeReleasedAt");
        req.input("juryChargeReleasedAt", sql.DateTime, juryChargeReleasedAt);
      }

      if (juryChargeReleasedBy !== undefined) {
        updates.push("JuryChargeReleasedBy = @juryChargeReleasedBy");
        req.input("juryChargeReleasedBy", sql.Int, juryChargeReleasedBy);
      }

      if (updates.length === 1) {
        throw new Error("No valid fields to update");
      }

      await req.query(`
        UPDATE dbo.Cases 
        SET ${updates.join(", ")} 
        WHERE CaseId = @id AND IsDeleted = 0
      `);

      return true;
    });
  } catch (error) {
    console.error("❌ [Case.updateCaseStatus] Error:", error.message);
    throw error;
  }
}

async function updateCaseDetails(caseId, updates) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid case ID is required");

    console.log(`\n🔄 [updateCaseDetails] Updating case ${id} with:`, JSON.stringify(updates));

    const allowed = {
      caseTitle: sql.NVarChar,
      caseDescription: sql.NVarChar,
      scheduledDate: sql.Date,
      scheduledTime: sql.Time,
      paymentAmount: sql.Decimal(10, 2),
      paymentMethod: sql.NVarChar,
      requiredJurors: sql.Int,
      voirDire1Questions: sql.NVarChar,
      voirDire2Questions: sql.NVarChar,
      plaintiffGroups: sql.NVarChar,
      defendantGroups: sql.NVarChar,
    };

    return await executeQuery(async (pool) => {
      const req = pool.request().input("id", sql.Int, id);
      const fields = ["UpdatedAt = GETUTCDATE()"];

      for (const [key, value] of Object.entries(updates)) {
        if (allowed[key] !== undefined) {
          const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
          fields.push(`${fieldName} = @${key}`);

          // Handle scheduledDate
          if (key === "scheduledDate") {
            console.log(`📅 [updateCaseDetails] Setting scheduledDate: "${value}"`);
            req.input(key, allowed[key], value);
          }
          // Handle scheduledTime - convert to Date object for sql.Time
          else if (key === "scheduledTime") {
            const trimmedTime = value.trim();
            const timeParts = trimmedTime.split(':');

            // Ensure we have HH:MM:SS format
            let hours, minutes, seconds;
            if (timeParts.length === 2) {
              hours = timeParts[0].padStart(2, '0');
              minutes = timeParts[1].padStart(2, '0');
              seconds = '00';
            } else if (timeParts.length === 3) {
              hours = timeParts[0].padStart(2, '0');
              minutes = timeParts[1].padStart(2, '0');
              seconds = timeParts[2].padStart(2, '0');
            } else {
              throw new Error(`Invalid time format: ${value}`);
            }

            // Create a Date object with today's date and the specified time
            const timeValue = new Date();
            timeValue.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);

            console.log(`🕐 [updateCaseDetails] Converting scheduledTime: "${value}" → ${hours}:${minutes}:${seconds}`);
            req.input(key, allowed[key], timeValue);
          }
          // Handle JSON fields
          else if (
            [
              "voirDire1Questions",
              "voirDire2Questions",
              "plaintiffGroups",
              "defendantGroups",
            ].includes(key)
          ) {
            req.input(key, allowed[key], safeJSONStringify(value));
          } else if (allowed[key] === sql.Decimal(10, 2)) {
            req.input(key, allowed[key], parseFloat(value));
          } else if (allowed[key] === sql.Int) {
            req.input(key, allowed[key], parseInt(value));
          } else {
            req.input(key, allowed[key], value);
          }
        }
      }

      if (fields.length === 1) {
        throw new Error("No valid fields to update");
      }

      const sqlQuery = `
        UPDATE dbo.Cases
        SET ${fields.join(", ")}
        WHERE CaseId = @id AND IsDeleted = 0
      `;

      console.log(`📝 [updateCaseDetails] Executing SQL:`, sqlQuery);
      await req.query(sqlQuery);
      console.log(`✅ [updateCaseDetails] Case ${id} updated successfully`);

      return true;
    });
  } catch (error) {
    console.error("❌ [Case.updateCaseDetails] Error:", error.message);
    throw error;
  }
}

async function softDeleteCase(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid case ID is required");

    await executeQuery(async (pool) => {
      await pool.request().input("id", sql.Int, id).query(`
          UPDATE dbo.Cases
          SET IsDeleted = 1, UpdatedAt = GETUTCDATE()
          WHERE CaseId = @id
        `);
    });

    return true;
  } catch (error) {
    console.error("❌ [Case.softDeleteCase] Error:", error.message);
    throw error;
  }
}

// ============================================
// RESCHEDULE METHODS
// ============================================

/**
 * Check if a time slot is available (not already booked by another case)
 * @param {string} scheduledDate - Date in YYYY-MM-DD format
 * @param {string} scheduledTime - Time in HH:MM or HH:MM:SS format
 * @param {number|null} excludeCaseId - Case ID to exclude from check (for updating existing case)
 * @returns {Promise<{available: boolean, conflictingCaseId?: number}>}
 */
async function checkSlotAvailability(scheduledDate, scheduledTime, excludeCaseId = null) {
  try {
    console.log(`🔍 [checkSlotAvailability] Checking slot: ${scheduledDate} ${scheduledTime}`);

    // Normalize time to HH:MM:SS format
    let timeFormatted = scheduledTime.trim();
    const timeParts = timeFormatted.split(':');
    if (timeParts.length === 2) {
      timeFormatted = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
    } else if (timeParts.length === 3) {
      timeFormatted = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`;
    }

    return await executeQuery(async (pool) => {
      const request = pool.request()
        .input("scheduledDate", sql.Date, scheduledDate)
        .input("scheduledTime", sql.VarChar, timeFormatted);

      let query = `
        SELECT TOP 1 CaseId, CaseTitle, AttorneyId
        FROM dbo.Cases
        WHERE ScheduledDate = @scheduledDate
          AND ScheduledTime = @scheduledTime
          AND IsDeleted = 0
          AND AdminApprovalStatus IN ('pending', 'approved')
      `;

      if (excludeCaseId) {
        query += " AND CaseId != @excludeCaseId";
        request.input("excludeCaseId", sql.Int, parseInt(excludeCaseId));
      }

      const result = await request.query(query);

      if (result.recordset.length > 0) {
        const conflictingCase = result.recordset[0];
        console.log(`❌ [checkSlotAvailability] Slot is BLOCKED by case ${conflictingCase.CaseId}`);
        return {
          available: false,
          conflictingCaseId: conflictingCase.CaseId,
          conflictingCaseTitle: conflictingCase.CaseTitle
        };
      }

      console.log(`✅ [checkSlotAvailability] Slot is AVAILABLE`);
      return { available: true };
    });
  } catch (error) {
    console.error("❌ [Case.checkSlotAvailability] Error:", error.message);
    throw error;
  }
}

/**
 * Admin requests reschedule by providing alternate slots (0 or 3)
 * @param {number} caseId - Case ID
 * @param {number} adminId - Admin ID who is requesting reschedule
 * @param {Array<{date: string, time: string}>} alternateSlots - Array of 0 (attorney picks) or 3 (admin suggests) alternate time slots
 * @returns {Promise<boolean>}
 */
async function requestReschedule(caseId, adminId, alternateSlots) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid case ID is required");

    // ✅ FIX: Allow 0 or 3 slots (0 = attorney picks their own, 3 = admin provides suggestions)
    if (!Array.isArray(alternateSlots) || (alternateSlots.length !== 0 && alternateSlots.length !== 3)) {
      throw new Error("Alternate slots must be either 0 (attorney picks) or 3 (admin suggests)");
    }

    console.log(`📋 [requestReschedule] Case ${id} - Admin ${adminId} requesting reschedule with ${alternateSlots.length} slots`);

    // Get current case data to store original scheduled time
    const caseData = await findById(id);
    if (!caseData) {
      throw new Error("Case not found");
    }

    return await executeQuery(async (pool) => {
      await pool.request()
        .input("id", sql.Int, id)
        .input("adminId", sql.Int, parseInt(adminId))
        .input("alternateSlots", sql.NVarChar, JSON.stringify(alternateSlots))
        .input("originalDate", sql.Date, caseData.ScheduledDate)
        .input("originalTime", sql.VarChar, caseData.ScheduledTime)
        .query(`
          UPDATE dbo.Cases
          SET
            RescheduleRequired = 1,
            AlternateSlots = @alternateSlots,
            OriginalScheduledDate = @originalDate,
            OriginalScheduledTime = @originalTime,
            RescheduleRequestedBy = @adminId,
            RescheduleRequestedAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
          WHERE CaseId = @id AND IsDeleted = 0
        `);

      console.log(`✅ [requestReschedule] Case ${id} marked for reschedule`);
      return true;
    });
  } catch (error) {
    console.error("❌ [Case.requestReschedule] Error:", error.message);
    throw error;
  }
}

/**
 * Attorney confirms reschedule by selecting one of the 3 alternate slots
 * This moves the case from pending_approval to war_room state
 * @param {number} caseId - Case ID
 * @param {object} selectedSlot - Selected slot {date: string, time: string}
 * @returns {Promise<boolean>}
 */
async function confirmReschedule(caseId, selectedSlot) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid case ID is required");
    if (!selectedSlot?.date || !selectedSlot?.time) {
      throw new Error("Valid selected slot with date and time is required");
    }

    console.log(`✅ [confirmReschedule] Case ${id} - Attorney confirming reschedule to ${selectedSlot.date} ${selectedSlot.time}`);

    // Check if the selected slot is still available
    const availability = await checkSlotAvailability(selectedSlot.date, selectedSlot.time, id);
    if (!availability.available) {
      const err = new Error("Selected time slot is no longer available. Please choose another slot.");
      err.code = "SLOT_UNAVAILABLE";
      err.statusCode = 409;
      err.conflictingCaseId = availability.conflictingCaseId;
      throw err;
    }

    // Normalize time to HH:MM:SS format
    let timeFormatted = selectedSlot.time.trim();
    const timeParts = timeFormatted.split(':');
    if (timeParts.length === 2) {
      timeFormatted = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
    }

    return await executeQuery(async (pool) => {
      await pool.request()
        .input("id", sql.Int, id)
        .input("scheduledDate", sql.Date, selectedSlot.date)
        .input("scheduledTime", sql.VarChar, timeFormatted)
        .query(`
          UPDATE dbo.Cases
          SET
            ScheduledDate = @scheduledDate,
            ScheduledTime = @scheduledTime,
            RescheduleRequired = 0,
            AlternateSlots = NULL,
            AdminApprovalStatus = 'approved',
            AttorneyStatus = 'war_room',
            ApprovedAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
          WHERE CaseId = @id AND IsDeleted = 0 AND RescheduleRequired = 1
        `);

      console.log(`✅ [confirmReschedule] Case ${id} rescheduled and moved to war_room`);
      return true;
    });
  } catch (error) {
    console.error("❌ [Case.confirmReschedule] Error:", error.message);
    throw error;
  }
}

/**
 * Get all cases that need rescheduling for a specific attorney
 * @param {number} attorneyId - Attorney ID
 * @returns {Promise<Array>} - Array of cases needing reschedule
 */
async function getRescheduleCasesForAttorney(attorneyId) {
  try {
    const id = parseInt(attorneyId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid attorney ID is required");

    return await executeQuery(async (pool) => {
      const result = await pool.request()
        .input("attorneyId", sql.Int, id)
        .query(`
          SELECT
            c.CaseId, c.CaseTitle, c.CaseDescription,
            c.ScheduledDate, c.ScheduledTime,
            c.OriginalScheduledDate, c.OriginalScheduledTime,
            c.AlternateSlots,
            c.RescheduleRequestedAt,
            c.AdminApprovalStatus, c.AttorneyStatus,
            a.FirstName + ' ' + a.LastName AS AdminName
          FROM dbo.Cases c
          LEFT JOIN dbo.Admins a ON c.RescheduleRequestedBy = a.AdminId
          WHERE c.AttorneyId = @attorneyId
            AND c.RescheduleRequired = 1
            AND c.IsDeleted = 0
          ORDER BY c.RescheduleRequestedAt DESC
        `);

      // Parse AlternateSlots JSON for each case
      const cases = result.recordset.map(caseData => ({
        ...caseData,
        AlternateSlots: safeJSONParse(caseData.AlternateSlots, [])
      }));

      console.log(`📋 [getRescheduleCasesForAttorney] Found ${cases.length} cases needing reschedule for attorney ${id}`);
      return cases;
    });
  } catch (error) {
    console.error("❌ [Case.getRescheduleCasesForAttorney] Error:", error.message);
    throw error;
  }
}

// ============================================
// STATS + HELPERS
// ============================================

async function getApprovedJurorsCount(caseId) {
  try {
    const id = parseInt(caseId, 10);
    if (isNaN(id) || id <= 0) throw new Error("Valid case ID is required");

    return await executeQuery(async (pool) => {
      const result = await pool.request().input("id", sql.Int, id).query(`
          SELECT COUNT(*) AS count 
          FROM dbo.JurorApplications 
          WHERE CaseId = @id AND Status = 'approved'
        `);

      return result.recordset[0].count;
    });
  } catch (error) {
    console.error("❌ [Case.getApprovedJurorsCount] Error:", error.message);
    throw error;
  }
}

async function validateCaseStateTransition(caseId, newStatus) {
  try {
    const caseData = await findById(caseId);
    if (!caseData) {
      return { valid: false, message: "Case not found" };
    }

    const current = caseData.AttorneyStatus;
    const validTransitions = {
      pending: ["cancelled"],
      war_room: ["join_trial", "cancelled"],
      join_trial: ["view_details", "completed"],
      view_details: ["completed"],
      cancelled: [],
      completed: [],
    };

    if (!validTransitions[current]?.includes(newStatus)) {
      return {
        valid: false,
        message: `Cannot transition from ${current} to ${newStatus}`,
      };
    }

    if (newStatus === ATTORNEY_CASE_STATES.JOIN_TRIAL) {
      if (caseData.AdminApprovalStatus !== ADMIN_APPROVAL_STATUSES.APPROVED) {
        return { valid: false, message: "Case must be approved by admin" };
      }

      const required = caseData.RequiredJurors || 7;
      const approved = await getApprovedJurorsCount(caseId);
      if (approved < required) {
        return {
          valid: false,
          message: `Need ${required} jurors, only ${approved} approved`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error(
      "❌ [Case.validateCaseStateTransition] Error:",
      error.message
    );
    return { valid: false, message: "Error validating transition" };
  }
}

async function getCaseStatistics() {
  try {
    return await executeQuery(async (pool) => {
      const result = await pool.request().query(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN AdminApprovalStatus = 'pending' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN AdminApprovalStatus = 'approved' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN AdminApprovalStatus = 'rejected' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS rejected,
          SUM(CASE WHEN AttorneyStatus = 'war_room' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS warRoom,
          SUM(CASE WHEN AttorneyStatus = 'join_trial' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS joinTrial,
          SUM(CASE WHEN AttorneyStatus = 'completed' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN AttorneyStatus = 'cancelled' AND IsDeleted = 0 THEN 1 ELSE 0 END) AS cancelled
        FROM dbo.Cases
        WHERE IsDeleted = 0
      `);

      return result.recordset[0];
    });
  } catch (error) {
    console.error("❌ [Case.getCaseStatistics] Error:", error.message);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Create
  createCase,

  // Read
  findById,
  getCasesByAttorney,
  getCasesPendingAdminApproval,
  getAvailableCasesForJurors,
  getAllCases,

  // Update
  updateCaseStatus,
  updateCaseDetails,
  softDeleteCase,

  // Reschedule
  checkSlotAvailability,
  requestReschedule,
  confirmReschedule,
  getRescheduleCasesForAttorney,

  // Helpers
  validateCaseStateTransition,
  getCaseStatistics,
  getApprovedJurorsCount,

  // Constants
  ATTORNEY_CASE_STATES,
  ADMIN_APPROVAL_STATUSES,
  CASE_TYPES,
  CASE_JURISDICTIONS,
  CASE_TIERS,
};
