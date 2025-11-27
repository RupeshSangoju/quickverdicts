// =============================================
// Verdict Controller
// Handles jury charge verdict submission and aggregation
// =============================================

const Verdict = require("../models/Verdict");
const Case = require("../models/Case");
const websocketService = require("../services/websocketService");

// ============================================
// SUBMIT VERDICT
// ============================================

/**
 * Submit verdict for a juror
 * POST /api/verdicts/submit
 * Body: { caseId, jurorId, responses }
 */
async function submitVerdict(req, res) {
  try {
    console.log("📝 [Verdict.submitVerdict] Starting verdict submission...");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { caseId, jurorId, responses } = req.body;

    // Validation
    if (!caseId || isNaN(parseInt(caseId))) {
      return res.status(400).json({
        success: false,
        error: "Valid case ID is required",
      });
    }

    if (!jurorId || isNaN(parseInt(jurorId))) {
      return res.status(400).json({
        success: false,
        error: "Valid juror ID is required",
      });
    }

    if (!responses || typeof responses !== "object") {
      return res.status(400).json({
        success: false,
        error: "Responses object is required",
      });
    }

    // Verify juror is authorized for this case
    const jurorResult = await require("../config/db")
      .poolPromise.then((pool) =>
        pool
          .request()
          .input("caseId", require("../config/db").sql.Int, parseInt(caseId))
          .input("jurorId", require("../config/db").sql.Int, parseInt(jurorId))
          .query(`
            SELECT ApplicationId
            FROM dbo.JurorApplications
            WHERE CaseId = @caseId AND JurorId = @jurorId AND Status = 'approved'
          `)
      );

    if (jurorResult.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Juror is not authorized for this case",
      });
    }

    // Submit verdict
    const verdictId = await Verdict.submitVerdict({
      caseId: parseInt(caseId),
      jurorId: parseInt(jurorId),
      responses,
    });

    console.log(`✅ [Verdict.submitVerdict] Verdict submitted: ${verdictId}`);

    // Get juror name for notification
    const jurorData = await require("../config/db")
      .poolPromise.then((pool) =>
        pool
          .request()
          .input("jurorId", require("../config/db").sql.Int, parseInt(jurorId))
          .query(`SELECT Name FROM dbo.Jurors WHERE JurorId = @jurorId`)
      );

    const jurorName = jurorData.recordset[0]?.Name || `Juror #${jurorId}`;
    console.log(`📝 [Verdict.submitVerdict] Juror name: ${jurorName}`);

    // Send WebSocket notification to admin
    console.log(`📡 [Verdict.submitVerdict] Sending WebSocket notifications for case ${caseId}...`);
    try {
      websocketService.notifyVerdictSubmitted(parseInt(caseId), {
        verdictId,
        jurorId: parseInt(jurorId),
        jurorName,
      });
      console.log(`✅ [Verdict.submitVerdict] WebSocket verdict:submitted notification sent`);
    } catch (wsError) {
      console.error(`❌ [Verdict.submitVerdict] WebSocket verdict:submitted error:`, wsError);
    }

    // Get and send updated verdict status
    try {
      const status = await Verdict.getSubmissionStatus(parseInt(caseId));
      console.log(`📊 [Verdict.submitVerdict] Current status:`, {
        totalJurors: status.totalJurors,
        submitted: status.submitted,
        pending: status.pending
      });
      websocketService.notifyVerdictStatusUpdate(parseInt(caseId), status);
      console.log(`✅ [Verdict.submitVerdict] WebSocket verdict:status_update notification sent`);
    } catch (wsError) {
      console.error(`❌ [Verdict.submitVerdict] WebSocket verdict:status_update error:`, wsError);
    }

    res.status(201).json({
      success: true,
      message: "Verdict submitted successfully",
      verdictId,
    });
  } catch (error) {
    console.error("❌ [Verdict.submitVerdict] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// SAVE DRAFT
// ============================================

/**
 * Save verdict draft (can be updated later)
 * POST /api/verdicts/draft
 * Body: { caseId, jurorId, responses }
 */
async function saveDraft(req, res) {
  try {
    console.log("💾 [Verdict.saveDraft] Saving verdict draft...");

    const { caseId, jurorId, responses } = req.body;

    // Validation
    if (!caseId || !jurorId || !responses) {
      return res.status(400).json({
        success: false,
        error: "Case ID, juror ID, and responses are required",
      });
    }

    const result = await Verdict.saveDraft({
      caseId: parseInt(caseId),
      jurorId: parseInt(jurorId),
      responses,
    });

    console.log("✅ [Verdict.saveDraft] Draft saved successfully");

    res.status(200).json({
      success: true,
      message: "Draft saved successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ [Verdict.saveDraft] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// GET VERDICT BY ID
// ============================================

/**
 * Get verdict by ID
 * GET /api/verdicts/:verdictId
 */
async function getVerdictById(req, res) {
  try {
    const { verdictId } = req.params;

    console.log(`🔍 [Verdict.getVerdictById] Fetching verdict: ${verdictId}`);

    if (!verdictId || isNaN(parseInt(verdictId))) {
      return res.status(400).json({
        success: false,
        error: "Valid verdict ID is required",
      });
    }

    const verdict = await Verdict.findById(parseInt(verdictId));

    if (!verdict) {
      return res.status(404).json({
        success: false,
        error: "Verdict not found",
      });
    }

    console.log("✅ [Verdict.getVerdictById] Verdict retrieved");

    res.status(200).json({
      success: true,
      data: verdict,
    });
  } catch (error) {
    console.error("❌ [Verdict.getVerdictById] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// GET VERDICT BY JUROR
// ============================================

/**
 * Get verdict for a specific juror in a case
 * GET /api/verdicts/juror/:caseId/:jurorId
 */
async function getVerdictByJuror(req, res) {
  try {
    const { caseId, jurorId } = req.params;

    console.log(
      `🔍 [Verdict.getVerdictByJuror] Fetching verdict for case ${caseId}, juror ${jurorId}`
    );

    if (!caseId || !jurorId) {
      return res.status(400).json({
        success: false,
        error: "Case ID and juror ID are required",
      });
    }

    const verdict = await Verdict.getVerdictByJuror(
      parseInt(caseId),
      parseInt(jurorId)
    );

    if (!verdict) {
      return res.status(404).json({
        success: false,
        error: "Verdict not found",
      });
    }

    console.log("✅ [Verdict.getVerdictByJuror] Verdict retrieved");

    res.status(200).json({
      success: true,
      data: verdict,
    });
  } catch (error) {
    console.error("❌ [Verdict.getVerdictByJuror] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// GET ALL VERDICTS FOR CASE
// ============================================

/**
 * Get all verdicts for a case
 * GET /api/verdicts/case/:caseId
 * Admin only
 */
async function getVerdictsByCase(req, res) {
  try {
    const { caseId } = req.params;

    console.log(
      `🔍 [VerdictController.getVerdictsByCase] Fetching verdicts for case ${caseId}`
    );
    console.log(`🔍 [VerdictController.getVerdictsByCase] User role: ${req.userRole}, User type: ${req.user?.type}`);

    if (!caseId || isNaN(parseInt(caseId))) {
      return res.status(400).json({
        success: false,
        error: "Valid case ID is required",
      });
    }

    // Verify admin or attorney access
    const userRole = req.userRole || req.user?.type;
    console.log(`🔍 [VerdictController.getVerdictsByCase] Checking access - userRole: ${userRole}`);

    if (userRole !== "admin" && userRole !== "attorney") {
      console.warn(`⚠️  [VerdictController.getVerdictsByCase] Access denied for role: ${userRole}`);
      return res.status(403).json({
        success: false,
        error: "Admin or attorney access required",
      });
    }

    const verdicts = await Verdict.getVerdictsByCase(parseInt(caseId));

    console.log(
      `✅ [VerdictController.getVerdictsByCase] Retrieved ${verdicts.length} verdicts`
    );
    if (verdicts.length > 0) {
      console.log(`📝 [VerdictController.getVerdictsByCase] First verdict sample:`, {
        VerdictId: verdicts[0].VerdictId,
        JurorName: verdicts[0].JurorName,
        ResponsesCount: Object.keys(verdicts[0].Responses || {}).length
      });
    }

    res.status(200).json({
      success: true,
      count: verdicts.length,
      data: verdicts,
    });
  } catch (error) {
    console.error("❌ [VerdictController.getVerdictsByCase] Error:", error.message);
    console.error("❌ [VerdictController.getVerdictsByCase] Stack:", error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// GET SUBMISSION STATUS
// ============================================

/**
 * Get verdict submission status for a case
 * GET /api/verdicts/status/:caseId
 * Returns: { totalJurors, submitted, pending, jurors: [...] }
 */
async function getSubmissionStatus(req, res) {
  try {
    const { caseId } = req.params;

    console.log(
      `📊 [Verdict.getSubmissionStatus] Fetching submission status for case ${caseId}`
    );

    if (!caseId || isNaN(parseInt(caseId))) {
      return res.status(400).json({
        success: false,
        error: "Valid case ID is required",
      });
    }

    // Verify admin or attorney access
    if (req.userRole !== "admin" && req.userRole !== "attorney") {
      return res.status(403).json({
        success: false,
        error: "Admin or attorney access required",
      });
    }

    const status = await Verdict.getSubmissionStatus(parseInt(caseId));

    console.log(
      `✅ [Verdict.getSubmissionStatus] Status: ${status.submitted}/${status.totalJurors} submitted`
    );

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("❌ [Verdict.getSubmissionStatus] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// GET AGGREGATED RESULTS
// ============================================

/**
 * Get aggregated results for all verdicts in a case
 * GET /api/verdicts/results/:caseId
 * Admin or attorney only
 * Returns statistical aggregation per question
 */
async function getAggregatedResults(req, res) {
  try {
    const { caseId } = req.params;

    console.log(
      `📈 [Verdict.getAggregatedResults] Fetching aggregated results for case ${caseId}`
    );

    if (!caseId || isNaN(parseInt(caseId))) {
      return res.status(400).json({
        success: false,
        error: "Valid case ID is required",
      });
    }

    // Verify admin or attorney access
    if (req.userRole !== "admin" && req.userRole !== "attorney") {
      return res.status(403).json({
        success: false,
        error: "Admin or attorney access required",
      });
    }

    const results = await Verdict.getAggregatedResults(parseInt(caseId));

    console.log(
      `✅ [Verdict.getAggregatedResults] Retrieved results for ${results.questions.length} questions`
    );

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("❌ [Verdict.getAggregatedResults] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// PUBLISH RESULTS TO ATTORNEY
// ============================================

/**
 * Publish verdict results to attorney
 * POST /api/verdicts/publish/:caseId
 * Admin only - marks results as published and notifies attorney
 */
async function publishResults(req, res) {
  try {
    const { caseId } = req.params;

    console.log(
      `📢 [Verdict.publishResults] Publishing results for case ${caseId}`
    );

    if (!caseId || isNaN(parseInt(caseId))) {
      return res.status(400).json({
        success: false,
        error: "Valid case ID is required",
      });
    }

    // Verify admin access
    if (req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    // Check if all jurors have submitted
    const status = await Verdict.getSubmissionStatus(parseInt(caseId));

    if (status.pending > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot publish results - ${status.pending} juror(s) have not submitted`,
        status,
      });
    }

    // Update case to mark results as published
    const pool = await require("../config/db").poolPromise;
    await pool
      .request()
      .input("caseId", require("../config/db").sql.Int, parseInt(caseId))
      .query(`
        UPDATE dbo.Cases
        SET VerdictStatus = 'published',
            VerdictPublishedAt = GETUTCDATE()
        WHERE CaseId = @caseId
      `);

    // Get aggregated results
    const results = await Verdict.getAggregatedResults(parseInt(caseId));

    // ✅ FIX: Send notification to attorney about verdict publication
    try {
      const Notification = require("../models/Notification");
      const Case = require("../models/Case");

      // Get case details to find attorney
      const caseDetails = await Case.findById(parseInt(caseId));

      if (caseDetails && caseDetails.AttorneyId) {
        await Notification.createNotification({
          userId: caseDetails.AttorneyId,
          userType: 'attorney',
          caseId: parseInt(caseId),
          type: 'verdict_published',
          title: 'Verdict Results Published',
          message: `The jury verdict for "${caseDetails.CaseTitle}" has been published and is now available for review.`
        });

        console.log(`✅ Notification sent to attorney ${caseDetails.AttorneyId} about verdict publication`);
      }
    } catch (notifError) {
      console.error("⚠️ Failed to send verdict notification:", notifError.message);
      // Don't fail the whole request if notification fails
    }

    console.log("✅ [Verdict.publishResults] Results published successfully");

    res.status(200).json({
      success: true,
      message: "Results published successfully",
      data: results,
    });
  } catch (error) {
    console.error("❌ [Verdict.publishResults] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// DELETE VERDICT
// ============================================

/**
 * Delete a verdict (admin only, for corrections)
 * DELETE /api/verdicts/:verdictId
 */
async function deleteVerdict(req, res) {
  try {
    const { verdictId } = req.params;

    console.log(`🗑️  [Verdict.deleteVerdict] Deleting verdict: ${verdictId}`);

    if (!verdictId || isNaN(parseInt(verdictId))) {
      return res.status(400).json({
        success: false,
        error: "Valid verdict ID is required",
      });
    }

    // Verify admin access
    if (req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    // Check if verdict exists
    const verdict = await Verdict.findById(parseInt(verdictId));
    if (!verdict) {
      return res.status(404).json({
        success: false,
        error: "Verdict not found",
      });
    }

    // Delete verdict
    await Verdict.deleteVerdict(parseInt(verdictId));

    console.log("✅ [Verdict.deleteVerdict] Verdict deleted successfully");

    res.status(200).json({
      success: true,
      message: "Verdict deleted successfully",
    });
  } catch (error) {
    console.error("❌ [Verdict.deleteVerdict] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// CHECK IF JUROR HAS ALREADY SUBMITTED
// ============================================

/**
 * Check if juror has already submitted verdict for case
 * GET /api/verdicts/check/:caseId/:jurorId
 */
async function checkSubmissionStatus(req, res) {
  try {
    const { caseId, jurorId } = req.params;

    console.log(
      `🔍 [Verdict.checkSubmissionStatus] Checking submission for case ${caseId}, juror ${jurorId}`
    );

    if (!caseId || !jurorId) {
      return res.status(400).json({
        success: false,
        error: "Case ID and juror ID are required",
      });
    }

    const verdict = await Verdict.getVerdictByJuror(
      parseInt(caseId),
      parseInt(jurorId)
    );

    res.status(200).json({
      success: true,
      hasSubmitted: verdict !== null,
      verdict: verdict || null,
    });
  } catch (error) {
    console.error(
      "❌ [Verdict.checkSubmissionStatus] Error:",
      error.message
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  submitVerdict,
  saveDraft,
  getVerdictById,
  getVerdictByJuror,
  getVerdictsByCase,
  getSubmissionStatus,
  getAggregatedResults,
  publishResults,
  deleteVerdict,
  checkSubmissionStatus,
};
