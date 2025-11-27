// =============================================
// Verdict.js - Jury Charge Verdict Model
// Handles juror verdict submission for jury charge questions
// =============================================

const { poolPromise, sql } = require("../config/db");

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate verdict data
 */
function validateVerdictData(data) {
  const errors = [];

  if (!data.caseId || isNaN(parseInt(data.caseId))) {
    errors.push("Valid case ID is required");
  }
  if (!data.jurorId || isNaN(parseInt(data.jurorId))) {
    errors.push("Valid juror ID is required");
  }
  if (!data.responses || typeof data.responses !== "object") {
    errors.push("Responses object is required");
  }

  if (errors.length > 0) {
    throw new Error(`Verdict validation failed: ${errors.join(", ")}`);
  }
}

/**
 * Safe JSON parse/stringify helpers
 */
function safeJSONParse(value, fallback = {}) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value || fallback;
  } catch (error) {
    console.warn("⚠️  JSON parse error:", error.message);
    return fallback;
  }
}

function safeJSONStringify(value) {
  try {
    return typeof value === "string" ? value : JSON.stringify(value || {});
  } catch (error) {
    console.warn("⚠️  JSON stringify error:", error.message);
    return "{}";
  }
}

// ============================================
// CREATE
// ============================================

/**
 * Submit verdict for a juror
 * @param {Object} verdictData - { caseId, jurorId, responses }
 * @returns {Promise<number>} Verdict ID
 */
async function submitVerdict(verdictData) {
  try {
    validateVerdictData(verdictData);

    const pool = await poolPromise;

    // Check if verdict already exists (prevent duplicate submission)
    const existingResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(verdictData.caseId))
      .input("jurorId", sql.Int, parseInt(verdictData.jurorId))
      .query(`
        SELECT VerdictId FROM dbo.Verdicts
        WHERE CaseId = @caseId AND JurorId = @jurorId
      `);

    if (existingResult.recordset.length > 0) {
      throw new Error("Verdict already submitted for this juror");
    }

    // Verify jury charge has been released
    const caseStatus = await pool
      .request()
      .input("caseId", sql.Int, parseInt(verdictData.caseId))
      .query(`
        SELECT JuryChargeStatus, JuryChargeReleasedAt
        FROM dbo.Cases
        WHERE CaseId = @caseId
      `);

    if (caseStatus.recordset.length === 0) {
      throw new Error("Case not found");
    }

    if (caseStatus.recordset[0].JuryChargeStatus !== "completed") {
      throw new Error("Jury charge has not been released yet");
    }

    // Insert new verdict
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(verdictData.caseId))
      .input("jurorId", sql.Int, parseInt(verdictData.jurorId))
      .input(
        "responses",
        sql.NVarChar(sql.MAX),
        safeJSONStringify(verdictData.responses)
      )
      .query(`
        INSERT INTO dbo.Verdicts (CaseId, JurorId, Responses, SubmittedAt)
        VALUES (@caseId, @jurorId, @responses, GETUTCDATE());
        SELECT SCOPE_IDENTITY() AS VerdictId;
      `);

    return result.recordset[0].VerdictId;
  } catch (error) {
    console.error("❌ [Verdict.submitVerdict] Error:", error.message);
    throw error;
  }
}

/**
 * Save verdict draft (can be updated later)
 * Stores draft in Verdicts table with IsSubmitted = 0
 * @param {Object} draftData - { caseId, jurorId, responses }
 */
async function saveDraft(draftData) {
  try {
    // ✅ FIX: Implement draft storage using Verdicts table
    const { caseId, jurorId, responses } = draftData;

    if (!caseId || !jurorId || !responses) {
      throw new Error("caseId, jurorId, and responses are required");
    }

    const pool = await poolPromise;

    // Check if draft already exists
    const existing = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .input("jurorId", sql.Int, parseInt(jurorId))
      .query(`
        SELECT VerdictId, IsSubmitted
        FROM dbo.Verdicts
        WHERE CaseId = @caseId AND JurorId = @jurorId
      `);

    const responsesJson = JSON.stringify(responses);

    if (existing.recordset.length > 0) {
      const verdict = existing.recordset[0];

      // Don't allow updating submitted verdicts
      if (verdict.IsSubmitted) {
        throw new Error("Cannot update draft - verdict already submitted");
      }

      // Update existing draft
      await pool
        .request()
        .input("verdictId", sql.Int, verdict.VerdictId)
        .input("responses", sql.NVarChar(sql.MAX), responsesJson)
        .query(`
          UPDATE dbo.Verdicts
          SET VerdictResponses = @responses,
              UpdatedAt = GETUTCDATE()
          WHERE VerdictId = @verdictId
        `);

      console.log(`💾 Verdict draft updated for juror ${jurorId}, case ${caseId}`);
      return { success: true, message: "Draft updated", verdictId: verdict.VerdictId };
    } else {
      // Create new draft
      const result = await pool
        .request()
        .input("caseId", sql.Int, parseInt(caseId))
        .input("jurorId", sql.Int, parseInt(jurorId))
        .input("responses", sql.NVarChar(sql.MAX), responsesJson)
        .input("isSubmitted", sql.Bit, 0)
        .query(`
          INSERT INTO dbo.Verdicts (CaseId, JurorId, VerdictResponses, IsSubmitted, CreatedAt, UpdatedAt)
          VALUES (@caseId, @jurorId, @responses, @isSubmitted, GETUTCDATE(), GETUTCDATE());
          SELECT SCOPE_IDENTITY() AS VerdictId;
        `);

      const verdictId = result.recordset[0].VerdictId;
      console.log(`💾 Verdict draft created for juror ${jurorId}, case ${caseId}`);
      return { success: true, message: "Draft saved", verdictId };
    }
  } catch (error) {
    console.error("❌ [Verdict.saveDraft] Error:", error.message);
    throw error;
  }
}

/**
 * Load verdict draft for a juror
 * @param {number} caseId
 * @param {number} jurorId
 * @returns {Promise<Object|null>}
 */
async function loadDraft(caseId, jurorId) {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .input("jurorId", sql.Int, parseInt(jurorId))
      .query(`
        SELECT VerdictId, VerdictResponses, IsSubmitted, CreatedAt, UpdatedAt
        FROM dbo.Verdicts
        WHERE CaseId = @caseId AND JurorId = @jurorId
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const verdict = result.recordset[0];

    return {
      verdictId: verdict.VerdictId,
      responses: JSON.parse(verdict.VerdictResponses || "{}"),
      isSubmitted: verdict.IsSubmitted,
      createdAt: verdict.CreatedAt,
      updatedAt: verdict.UpdatedAt,
    };
  } catch (error) {
    console.error("❌ [Verdict.loadDraft] Error:", error.message);
    throw error;
  }
}

// ============================================
// READ
// ============================================

/**
 * Get verdict by ID
 * @param {number} verdictId
 * @returns {Promise<Object|null>}
 */
async function findById(verdictId) {
  try {
    const id = parseInt(verdictId, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error("Valid verdict ID is required");
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("verdictId", sql.Int, id)
      .query(`
        SELECT
          v.*,
          j.Name AS JurorName,
          j.Email AS JurorEmail,
          c.CaseTitle,
          c.CaseType
        FROM dbo.Verdicts v
        INNER JOIN dbo.Jurors j ON v.JurorId = j.JurorId
        INNER JOIN dbo.Cases c ON v.CaseId = c.CaseId
        WHERE v.VerdictId = @verdictId
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const verdict = result.recordset[0];
    verdict.Responses = safeJSONParse(verdict.Responses);
    return verdict;
  } catch (error) {
    console.error("❌ [Verdict.findById] Error:", error.message);
    throw error;
  }
}

/**
 * Get verdict for a specific juror in a case
 * @param {number} caseId
 * @param {number} jurorId
 * @returns {Promise<Object|null>}
 */
async function getVerdictByJuror(caseId, jurorId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .input("jurorId", sql.Int, parseInt(jurorId))
      .query(`
        SELECT
          v.*,
          j.Name AS JurorName
        FROM dbo.Verdicts v
        INNER JOIN dbo.Jurors j ON v.JurorId = j.JurorId
        WHERE v.CaseId = @caseId AND v.JurorId = @jurorId
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const verdict = result.recordset[0];
    verdict.Responses = safeJSONParse(verdict.Responses);
    return verdict;
  } catch (error) {
    console.error("❌ [Verdict.getVerdictByJuror] Error:", error.message);
    throw error;
  }
}

/**
 * Get all verdicts for a case
 * @param {number} caseId
 * @returns {Promise<Array>}
 */
async function getVerdictsByCase(caseId) {
  try {
    console.log(`🔍 [Verdict.getVerdictsByCase] Fetching verdicts for case ${caseId}...`);
    const pool = await poolPromise;

    // First, check if verdicts exist in the table
    const checkResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT COUNT(*) as VerdictCount
        FROM dbo.Verdicts
        WHERE CaseId = @caseId
      `);

    console.log(`📊 [Verdict.getVerdictsByCase] Total verdicts in Verdicts table: ${checkResult.recordset[0].VerdictCount}`);

    // Get all verdicts with juror info
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT
          v.VerdictId,
          v.CaseId,
          v.JurorId,
          v.Responses,
          v.Decision,
          v.SubmittedAt,
          j.Name AS JurorName,
          j.Email AS JurorEmail
        FROM dbo.Verdicts v
        LEFT JOIN dbo.Jurors j ON v.JurorId = j.JurorId
        WHERE v.CaseId = @caseId
        ORDER BY v.SubmittedAt ASC
      `);

    console.log(`✅ [Verdict.getVerdictsByCase] Found ${result.recordset.length} verdicts with LEFT JOIN`);

    if (result.recordset.length > 0) {
      console.log(`📝 [Verdict.getVerdictsByCase] Sample verdict:`, {
        VerdictId: result.recordset[0].VerdictId,
        JurorId: result.recordset[0].JurorId,
        JurorName: result.recordset[0].JurorName,
        HasResponses: !!result.recordset[0].Responses
      });
    }

    const verdicts = result.recordset.map((verdict) => ({
      ...verdict,
      JurorName: verdict.JurorName || `Juror #${verdict.JurorId}`,
      JurorEmail: verdict.JurorEmail || 'Unknown',
      Responses: safeJSONParse(verdict.Responses),
    }));

    console.log(`🎯 [Verdict.getVerdictsByCase] Returning ${verdicts.length} verdicts`);
    return verdicts;
  } catch (error) {
    console.error("❌ [Verdict.getVerdictsByCase] Error:", error.message);
    console.error("❌ [Verdict.getVerdictsByCase] Stack:", error.stack);
    throw error;
  }
}

/**
 * Get verdict submission status for a case
 * @param {number} caseId
 * @returns {Promise<Object>} { totalJurors, submitted, pending, jurors: [...] }
 */
async function getSubmissionStatus(caseId) {
  try {
    const pool = await poolPromise;

    // Get total approved jurors
    const jurorResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT
          j.JurorId,
          j.Name,
          j.Email,
          v.VerdictId,
          v.SubmittedAt
        FROM dbo.JurorApplications ja
        INNER JOIN dbo.Jurors j ON ja.JurorId = j.JurorId
        LEFT JOIN dbo.Verdicts v ON v.CaseId = ja.CaseId AND v.JurorId = j.JurorId
        WHERE ja.CaseId = @caseId AND ja.Status = 'approved'
        ORDER BY v.SubmittedAt ASC, j.Name ASC
      `);

    const jurors = jurorResult.recordset.map((row) => ({
      jurorId: row.JurorId,
      name: row.Name,
      email: row.Email,
      status: row.VerdictId ? "submitted" : "pending",
      submittedAt: row.SubmittedAt || null,
    }));

    const submitted = jurors.filter((j) => j.status === "submitted").length;
    const pending = jurors.filter((j) => j.status === "pending").length;

    return {
      totalJurors: jurors.length,
      submitted,
      pending,
      jurors,
    };
  } catch (error) {
    console.error("❌ [Verdict.getSubmissionStatus] Error:", error.message);
    throw error;
  }
}

// ============================================
// AGGREGATION & STATISTICS
// ============================================

/**
 * Get aggregated results for all verdicts in a case
 * @param {number} caseId
 * @returns {Promise<Object>} Aggregated statistics per question
 */
async function getAggregatedResults(caseId) {
  try {
    const pool = await poolPromise;

    // Get all verdicts for the case
    const verdicts = await getVerdictsByCase(caseId);

    if (verdicts.length === 0) {
      return {
        totalVerdicts: 0,
        questions: [],
      };
    }

    // Get jury charge questions for the case
    const questionsResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT
          QuestionId,
          QuestionText,
          QuestionType,
          Options,
          IsRequired
        FROM dbo.JuryChargeQuestions
        WHERE CaseId = @caseId
        ORDER BY OrderIndex ASC
      `);

    const questions = questionsResult.recordset.map((q) => {
      const questionId = q.QuestionId.toString();
      const responses = verdicts.map((v) => ({
        jurorId: v.JurorId,
        jurorName: v.JurorName,
        answer: v.Responses[questionId],
      }));

      let results = {};

      // Calculate statistics based on question type
      if (
        q.QuestionType === "Multiple Choice" ||
        q.QuestionType === "Yes/No"
      ) {
        // Count occurrences of each option
        const counts = {};
        responses.forEach((r) => {
          if (r.answer) {
            counts[r.answer] = (counts[r.answer] || 0) + 1;
          }
        });

        results = Object.entries(counts).map(([option, count]) => ({
          option,
          count,
          percentage: (count / verdicts.length) * 100,
        }));

        // Determine consensus
        const maxCount = Math.max(...Object.values(counts));
        const maxOption = Object.keys(counts).find(
          (key) => counts[key] === maxCount
        );
        const consensusPercentage = (maxCount / verdicts.length) * 100;

        results.consensus =
          consensusPercentage >= 75
            ? "STRONG_CONSENSUS"
            : consensusPercentage >= 51
            ? "MAJORITY"
            : "NO_CONSENSUS";
        results.consensusOption = maxOption;
        results.consensusPercentage = consensusPercentage;
      } else if (q.QuestionType === "Numeric Response") {
        // Calculate numerical statistics
        const numbers = responses
          .map((r) => parseFloat(r.answer))
          .filter((n) => !isNaN(n));

        if (numbers.length > 0) {
          numbers.sort((a, b) => a - b);
          const sum = numbers.reduce((acc, n) => acc + n, 0);
          const average = sum / numbers.length;
          const median =
            numbers.length % 2 === 0
              ? (numbers[numbers.length / 2 - 1] + numbers[numbers.length / 2]) /
                2
              : numbers[Math.floor(numbers.length / 2)];

          // Calculate mode
          const frequency = {};
          numbers.forEach((n) => {
            frequency[n] = (frequency[n] || 0) + 1;
          });
          const maxFreq = Math.max(...Object.values(frequency));
          const mode = parseFloat(
            Object.keys(frequency).find((key) => frequency[key] === maxFreq)
          );

          // Calculate standard deviation
          const variance =
            numbers.reduce((acc, n) => acc + Math.pow(n - average, 2), 0) /
            numbers.length;
          const stdDev = Math.sqrt(variance);

          results = {
            average: parseFloat(average.toFixed(2)),
            median: parseFloat(median.toFixed(2)),
            mode,
            min: numbers[0],
            max: numbers[numbers.length - 1],
            range: numbers[numbers.length - 1] - numbers[0],
            stdDev: parseFloat(stdDev.toFixed(2)),
            count: numbers.length,
          };
        }
      } else if (q.QuestionType === "Text Response") {
        // Just return all text responses
        results = {
          responses: responses
            .filter((r) => r.answer)
            .map((r) => ({
              jurorName: r.jurorName,
              answer: r.answer,
            })),
        };
      }

      return {
        questionId: q.QuestionId,
        questionText: q.QuestionText,
        questionType: q.QuestionType,
        isRequired: q.IsRequired,
        results,
        individual: responses,
      };
    });

    return {
      totalVerdicts: verdicts.length,
      questions,
    };
  } catch (error) {
    console.error("❌ [Verdict.getAggregatedResults] Error:", error.message);
    throw error;
  }
}

// ============================================
// DELETE
// ============================================

/**
 * Delete a verdict (admin only, for corrections)
 * @param {number} verdictId
 * @returns {Promise<boolean>}
 */
async function deleteVerdict(verdictId) {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("verdictId", sql.Int, parseInt(verdictId))
      .query(`DELETE FROM dbo.Verdicts WHERE VerdictId = @verdictId`);

    return true;
  } catch (error) {
    console.error("❌ [Verdict.deleteVerdict] Error:", error.message);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Create
  submitVerdict,
  saveDraft,
  loadDraft,

  // Read
  findById,
  getVerdictByJuror,
  getVerdictsByCase,
  getSubmissionStatus,

  // Aggregation
  getAggregatedResults,

  // Delete
  deleteVerdict,
};
