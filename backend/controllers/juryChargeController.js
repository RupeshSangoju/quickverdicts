// =============================================
// juryChargeController.js - Jury Charge Questions Management
// FIXED: Added defensive programming, validation, transaction support
// =============================================

const { poolPromise, sql } = require("../config/db");
const websocketService = require("../services/websocketService");

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verify attorney owns case
 * FIXED: Centralized authorization check
 */
async function verifyAttorneyOwnsCase(pool, caseId, attorneyId) {
  const result = await pool
    .request()
    .input("caseId", sql.Int, caseId)
    .input("attorneyId", sql.Int, attorneyId)
    .query(
      "SELECT CaseId FROM Cases WHERE CaseId = @caseId AND AttorneyId = @attorneyId"
    );

  return result.recordset.length > 0;
}

/**
 * Validate question data
 * FIXED: Added input validation
 */
function validateQuestion(question) {
  if (!question.questionText || question.questionText.trim().length === 0) {
    return { isValid: false, error: "Question text is required" };
  }

  if (question.questionText.trim().length > 1000) {
    return {
      isValid: false,
      error: "Question text too long (max 1000 characters)",
    };
  }

  const validTypes = [
    "Multiple Choice",
    "Yes/No",
    "Text Response",
    "Numeric Response",
  ];
  if (!question.questionType || !validTypes.includes(question.questionType)) {
    return {
      isValid: false,
      error: `Question type must be one of: ${validTypes.join(", ")}`,
    };
  }

  if (question.questionType === "Multiple Choice") {
    if (
      !question.options ||
      !Array.isArray(question.options) ||
      question.options.length < 2
    ) {
      return {
        isValid: false,
        error: "Multiple choice questions must have at least 2 options",
      };
    }
  }

  return { isValid: true };
}

/**
 * Safe JSON parse
 */
function safeJSONParse(jsonString, fallback = []) {
  try {
    if (!jsonString) return fallback;
    return JSON.parse(jsonString) || fallback;
  } catch (error) {
    console.error("JSON parse error:", error);
    return fallback;
  }
}

// ============================================
// QUESTION MANAGEMENT
// ============================================

/**
 * Save jury charge questions for a case (Attorney only)
 * FIXED: Added validation, defensive checks, and transaction support
 */
async function saveJuryChargeQuestions(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const { questions } = req.body;
    const attorneyId = req.user.id;

    // Validate input
    if (!Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: "Questions must be an array",
      });
    }

    // Validate each question
    for (const question of questions) {
      const validation = validateQuestion(question);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }
    }

    const pool = await poolPromise;

    // Verify attorney owns this case
    const ownsCase = await verifyAttorneyOwnsCase(pool, caseId, attorneyId);
    if (!ownsCase) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this case",
      });
    }

    // FIXED: Use transaction for atomic operation
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Delete existing questions for this case
      await transaction
        .request()
        .input("caseId", sql.Int, caseId)
        .query("DELETE FROM JuryChargeQuestions WHERE CaseId = @caseId");

      // Insert new questions
      if (questions.length > 0) {
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];

          // For multiple choice, convert options array to JSON string
          let optionsJson = null;
          if (question.questionType === "Multiple Choice" && question.options) {
            optionsJson = JSON.stringify(question.options);
          }

          await transaction
            .request()
            .input("caseId", sql.Int, caseId)
            .input("questionText", sql.NVarChar, question.questionText.trim())
            .input("questionType", sql.NVarChar, question.questionType)
            .input("options", sql.NVarChar, optionsJson)
            .input("orderIndex", sql.Int, i).query(`
              INSERT INTO JuryChargeQuestions (CaseId, QuestionText, QuestionType, Options, OrderIndex)
              VALUES (@caseId, @questionText, @questionType, @options, @orderIndex)
            `);
        }
      }

      // Commit transaction
      await transaction.commit();

      res.json({
        success: true,
        message: "Jury charge questions saved successfully",
        questionsCount: questions.length,
      });
    } catch (error) {
      // Rollback on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error saving jury charge questions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save jury charge questions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Add a single jury charge question (Attorney only)
 * FIXED: New function for adding single questions with WebSocket support
 */
async function addQuestion(req, res) {
  try {
    // Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId, questionText, questionType, options, isRequired, minValue, maxValue } = req.body;
    const attorneyId = req.user.id;

    // Validate input
    if (!caseId || isNaN(parseInt(caseId))) {
      return res.status(400).json({
        success: false,
        message: "Valid case ID is required",
      });
    }

    // Validate question data
    const validation = validateQuestion({
      questionText,
      questionType,
      options,
    });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const pool = await poolPromise;

    // Verify attorney owns this case
    const ownsCase = await verifyAttorneyOwnsCase(pool, parseInt(caseId), attorneyId);
    if (!ownsCase) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this case",
      });
    }

    // Check if jury charge is locked
    const lockResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query("SELECT JuryChargeStatus FROM Cases WHERE CaseId = @caseId");

    if (lockResult.recordset.length > 0 && lockResult.recordset[0].JuryChargeStatus === "completed") {
      return res.status(403).json({
        success: false,
        message: "Jury charge is locked and cannot be edited",
      });
    }

    // Get current max order index
    const orderResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query("SELECT ISNULL(MAX(OrderIndex), -1) as maxOrder FROM JuryChargeQuestions WHERE CaseId = @caseId");

    const nextOrder = orderResult.recordset[0].maxOrder + 1;

    // Convert options to JSON if provided
    let optionsJson = null;
    if (questionType === "Multiple Choice" && options) {
      optionsJson = JSON.stringify(options);
    }

    // Insert question
    const insertResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .input("questionText", sql.NVarChar, questionText.trim())
      .input("questionType", sql.NVarChar, questionType)
      .input("options", sql.NVarChar, optionsJson)
      .input("orderIndex", sql.Int, nextOrder)
      .input("isRequired", sql.Bit, isRequired !== false)
      .input("minValue", sql.Int, minValue || null)
      .input("maxValue", sql.Int, maxValue || null).query(`
        INSERT INTO JuryChargeQuestions (CaseId, QuestionText, QuestionType, Options, OrderIndex, IsRequired, MinValue, MaxValue)
        OUTPUT INSERTED.*
        VALUES (@caseId, @questionText, @questionType, @options, @orderIndex, @isRequired, @minValue, @maxValue)
      `);

    const newQuestion = insertResult.recordset[0];

    // Emit WebSocket event
    try {
      websocketService.notifyQuestionAdded(parseInt(caseId), {
        ...newQuestion,
        Options: safeJSONParse(newQuestion.Options, []),
      });
    } catch (wsError) {
      console.error("WebSocket notification failed:", wsError);
      // Don't fail the request if WebSocket fails
    }

    res.json({
      success: true,
      message: "Question added successfully",
      question: {
        ...newQuestion,
        Options: safeJSONParse(newQuestion.Options, []),
      },
    });
  } catch (error) {
    console.error("Error adding jury charge question:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add question",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get jury charge questions for a case (Attorney and Admin)
 * FIXED: Added safe JSON parsing
 */
async function getJuryChargeQuestions(req, res) {
  try {
    const { caseId } = req.params;

    if (!caseId || isNaN(parseInt(caseId))) {
      return res.status(400).json({
        success: false,
        message: "Valid case ID is required",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("caseId", sql.Int, caseId)
      .query(
        "SELECT * FROM JuryChargeQuestions WHERE CaseId = @caseId ORDER BY OrderIndex ASC"
      );

    // FIXED: Safe JSON parsing
    const questions = result.recordset.map((q) => ({
      ...q,
      Options: safeJSONParse(q.Options, []),
    }));

    res.json({
      success: true,
      questions,
      count: questions.length,
    });
  } catch (error) {
    console.error("Error fetching jury charge questions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch jury charge questions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Update a single question (Attorney only)
 * FIXED: Added validation and defensive checks
 */
async function updateJuryChargeQuestion(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { questionId } = req.params;
    const { questionText, questionType, options } = req.body;
    const attorneyId = req.user.id;

    // Validate question data
    const validation = validateQuestion({
      questionText,
      questionType,
      options,
    });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const pool = await poolPromise;

    // Verify attorney owns the case this question belongs to
    const verifyResult = await pool
      .request()
      .input("questionId", sql.Int, questionId)
      .input("attorneyId", sql.Int, attorneyId).query(`
        SELECT jcq.QuestionId 
        FROM JuryChargeQuestions jcq 
        JOIN Cases c ON jcq.CaseId = c.CaseId 
        WHERE jcq.QuestionId = @questionId AND c.AttorneyId = @attorneyId
      `);

    if (verifyResult.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this question",
      });
    }

    // Convert options to JSON if provided
    let optionsJson = null;
    if (questionType === "Multiple Choice" && options) {
      optionsJson = JSON.stringify(options);
    }

    // Update question
    const updateResult = await pool
      .request()
      .input("questionId", sql.Int, questionId)
      .input("questionText", sql.NVarChar, questionText.trim())
      .input("questionType", sql.NVarChar, questionType)
      .input("options", sql.NVarChar, optionsJson).query(`
        UPDATE JuryChargeQuestions
        SET QuestionText = @questionText, QuestionType = @questionType, Options = @options
        OUTPUT INSERTED.*
        WHERE QuestionId = @questionId
      `);

    const updatedQuestion = updateResult.recordset[0];

    // Get caseId for WebSocket notification
    const caseResult = await pool
      .request()
      .input("questionId", sql.Int, questionId)
      .query("SELECT CaseId FROM JuryChargeQuestions WHERE QuestionId = @questionId");

    const caseId = caseResult.recordset[0]?.CaseId;

    // Emit WebSocket event
    if (caseId) {
      try {
        websocketService.notifyQuestionUpdated(caseId, {
          ...updatedQuestion,
          Options: safeJSONParse(updatedQuestion.Options, []),
        });
      } catch (wsError) {
        console.error("WebSocket notification failed:", wsError);
      }
    }

    res.json({
      success: true,
      message: "Question updated successfully",
      question: {
        ...updatedQuestion,
        Options: safeJSONParse(updatedQuestion.Options, []),
      },
    });
  } catch (error) {
    console.error("Error updating jury charge question:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update question",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Delete a question (Attorney only)
 * FIXED: Added defensive checks
 */
async function deleteJuryChargeQuestion(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { questionId } = req.params;
    const attorneyId = req.user.id;

    const pool = await poolPromise;

    // Verify attorney owns the case this question belongs to and get caseId
    const verifyResult = await pool
      .request()
      .input("questionId", sql.Int, questionId)
      .input("attorneyId", sql.Int, attorneyId).query(`
        SELECT jcq.QuestionId, jcq.CaseId
        FROM JuryChargeQuestions jcq
        JOIN Cases c ON jcq.CaseId = c.CaseId
        WHERE jcq.QuestionId = @questionId AND c.AttorneyId = @attorneyId
      `);

    if (verifyResult.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this question",
      });
    }

    const caseId = verifyResult.recordset[0].CaseId;

    // Delete question
    await pool
      .request()
      .input("questionId", sql.Int, questionId)
      .query("DELETE FROM JuryChargeQuestions WHERE QuestionId = @questionId");

    // Emit WebSocket event
    try {
      websocketService.notifyQuestionDeleted(caseId, parseInt(questionId));
    } catch (wsError) {
      console.error("WebSocket notification failed:", wsError);
    }

    res.json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting jury charge question:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete question",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export questions as text file format (Admin)
 * FIXED: Added safe JSON parsing
 */
async function exportAsText(req, res) {
  try {
    const { caseId } = req.params;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("caseId", sql.Int, caseId)
      .query(
        "SELECT * FROM JuryChargeQuestions WHERE CaseId = @caseId ORDER BY OrderIndex ASC"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No questions found for this case",
      });
    }

    let textContent = "JURY CHARGE QUESTIONS\n";
    textContent += "======================\n\n";

    result.recordset.forEach((q, index) => {
      textContent += `Question ${index + 1}: ${q.QuestionText}\n`;
      textContent += `Type: ${q.QuestionType}\n`;

      if (q.Options) {
        const options = safeJSONParse(q.Options, []);
        if (options.length > 0) {
          textContent += "Options:\n";
          options.forEach((opt, optIndex) => {
            textContent += `  ${optIndex + 1}. ${opt}\n`;
          });
        }
      }

      textContent += "\n---\n\n";
    });

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="jury-charge-case-${caseId}.txt"`
    );
    res.send(textContent);
  } catch (error) {
    console.error("Error exporting jury charge questions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export questions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Export questions as MS Forms template (Admin)
 * FIXED: Added safe JSON parsing
 */
async function exportAsMSFormsTemplate(req, res) {
  try {
    const { caseId } = req.params;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("caseId", sql.Int, caseId)
      .query(
        "SELECT * FROM JuryChargeQuestions WHERE CaseId = @caseId ORDER BY OrderIndex ASC"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No questions found for this case",
      });
    }

    // Create a JSON template that can be used to create MS Forms
    const formTemplate = {
      title: `Jury Charge - Case ${caseId}`,
      description:
        "Please answer the following questions based on the evidence presented.",
      questions: [],
    };

    result.recordset.forEach((q, index) => {
      const questionObj = {
        id: index + 1,
        text: q.QuestionText,
        type: q.QuestionType,
        required: true,
      };

      if (q.QuestionType === "Multiple Choice" && q.Options) {
        questionObj.choices = safeJSONParse(q.Options, []);
      } else if (q.QuestionType === "Yes/No") {
        questionObj.choices = ["Yes", "No"];
      }

      formTemplate.questions.push(questionObj);
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ms-forms-template-case-${caseId}.json"`
    );
    res.json(formTemplate);
  } catch (error) {
    console.error("Error exporting MS Forms template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export MS Forms template",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ============================================
// EXPORTS
// ============================================

/**
 * Release jury charge to jurors (Admin only)
 * Locks the jury charge permanently - attorney can no longer edit
 */
async function releaseToJury(req, res) {
  try {
    if (!req.user || req.user.type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can release jury charge to jurors",
      });
    }

    const { caseId } = req.params;
    const adminId = req.user.id;
    const pool = await poolPromise;

    // Check if jury charge already released
    const caseResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT JuryChargeStatus, JuryChargeReleasedAt
        FROM Cases
        WHERE CaseId = @caseId
      `);

    if (caseResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    const caseData = caseResult.recordset[0];
    if (caseData.JuryChargeStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Jury charge already released",
        releasedAt: caseData.JuryChargeReleasedAt,
      });
    }

    // Get question count
    const questionsResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT COUNT(*) as count
        FROM JuryChargeQuestions
        WHERE CaseId = @caseId
      `);

    const questionCount = questionsResult.recordset[0].count;
    if (questionCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot release jury charge with no questions",
      });
    }

    // Update case status - LOCK JURY CHARGE
    await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .input("adminId", sql.Int, adminId)
      .query(`
        UPDATE Cases
        SET
          JuryChargeStatus = 'completed',
          JuryChargeReleasedAt = GETUTCDATE(),
          JuryChargeReleasedBy = @adminId,
          UpdatedAt = GETUTCDATE()
        WHERE CaseId = @caseId
      `);

    // Get approved jurors count
    const jurorResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT COUNT(*) as count
        FROM JurorApplications
        WHERE CaseId = @caseId AND Status = 'approved'
      `);

    const jurorCount = jurorResult.recordset[0].count;

    const releaseData = {
      releasedAt: new Date().toISOString(),
      releasedBy: adminId,
      questionCount,
      jurorCount,
    };

    // Emit WebSocket event to notify all parties
    try {
      websocketService.notifyJuryChargeReleased(parseInt(caseId), releaseData);
    } catch (wsError) {
      console.error("WebSocket notification failed:", wsError);
    }

    res.json({
      success: true,
      message: "Jury charge released to jurors successfully",
      ...releaseData,
    });
  } catch (error) {
    console.error("❌ [releaseToJury] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to release jury charge",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get jury charge questions for jurors (after release)
 */
async function getQuestionsForJuror(req, res) {
  try {
    const { caseId } = req.params;
    const pool = await poolPromise;

    // Verify jury charge has been released
    const caseResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT JuryChargeStatus, JuryChargeReleasedAt
        FROM Cases
        WHERE CaseId = @caseId
      `);

    if (caseResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    if (caseResult.recordset[0].JuryChargeStatus !== "completed") {
      return res.status(403).json({
        success: false,
        message: "Jury charge has not been released yet",
      });
    }

    // Get questions
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT
          QuestionId,
          QuestionText,
          QuestionType,
          Options,
          OrderIndex,
          IsRequired,
          MinValue,
          MaxValue
        FROM JuryChargeQuestions
        WHERE CaseId = @caseId
        ORDER BY OrderIndex ASC
      `);

    const questions = result.recordset.map((q) => ({
      ...q,
      Options: safeJSONParse(q.Options, []),
    }));

    res.json({
      success: true,
      questions,
      totalQuestions: questions.length,
      releasedAt: caseResult.recordset[0].JuryChargeReleasedAt,
    });
  } catch (error) {
    console.error("❌ [getQuestionsForJuror] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get jury charge questions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Check if jury charge is locked (released to jurors)
 */
async function checkIfLocked(req, res) {
  try {
    const { caseId } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT
          JuryChargeStatus,
          JuryChargeReleasedAt,
          JuryChargeReleasedBy
        FROM Cases
        WHERE CaseId = @caseId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    const data = result.recordset[0];
    const isLocked = data.JuryChargeStatus === "completed";

    res.json({
      success: true,
      isLocked,
      status: data.JuryChargeStatus,
      releasedAt: data.JuryChargeReleasedAt,
      releasedBy: data.JuryChargeReleasedBy,
    });
  } catch (error) {
    console.error("❌ [checkIfLocked] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check lock status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Submit jury charge responses (Juror only)
 */
async function submitResponses(req, res) {
  try {
    const { caseId, responses } = req.body;

    console.log('📝 [submitResponses] Starting submission for case:', caseId);
    console.log('📝 [submitResponses] User:', req.user);
    console.log('📝 [submitResponses] Responses:', responses);

    // Verify juror authentication
    if (!req.user || req.user.type !== 'juror') {
      console.error('❌ [submitResponses] Not a juror:', req.user?.type);
      return res.status(403).json({
        success: false,
        message: "Only jurors can submit responses"
      });
    }

    const jurorId = req.user.id;
    const pool = await poolPromise;

    // Verify jury charge has been released
    const caseResult = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT JuryChargeStatus, JuryChargeReleasedAt
        FROM Cases
        WHERE CaseId = @caseId
      `);

    if (caseResult.recordset.length === 0) {
      console.error('❌ [submitResponses] Case not found:', caseId);
      return res.status(404).json({
        success: false,
        message: "Case not found"
      });
    }

    if (caseResult.recordset[0].JuryChargeStatus !== "completed") {
      console.error('❌ [submitResponses] Jury charge not released yet');
      return res.status(403).json({
        success: false,
        message: "Jury charge has not been released yet"
      });
    }

    // Verify juror is approved for this case
    const jurorCheck = await pool
      .request()
      .input("jurorId", sql.Int, jurorId)
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT JurorId
        FROM Jurors
        WHERE JurorId = @jurorId
        AND CaseId = @caseId
        AND AdminApprovalStatus = 'approved'
      `);

    if (jurorCheck.recordset.length === 0) {
      console.error('❌ [submitResponses] Juror not approved for case');
      return res.status(403).json({
        success: false,
        message: "You are not approved for this case"
      });
    }

    // Validate responses array
    if (!Array.isArray(responses) || responses.length === 0) {
      console.error('❌ [submitResponses] Invalid responses array');
      return res.status(400).json({
        success: false,
        message: "Invalid responses data"
      });
    }

    console.log('✅ [submitResponses] Validation passed, inserting responses...');

    // Insert or update each response
    let successCount = 0;
    const errors = [];

    for (const resp of responses) {
      try {
        const { QuestionId, Response } = resp;

        if (!QuestionId || Response === undefined || Response === null) {
          errors.push(`Invalid response for question ${QuestionId}`);
          continue;
        }

        // Check if response already exists
        const existingResponse = await pool
          .request()
          .input("questionId", sql.Int, parseInt(QuestionId))
          .input("jurorId", sql.Int, jurorId)
          .query(`
            SELECT ResponseId
            FROM JuryChargeResponses
            WHERE QuestionId = @questionId AND JurorId = @jurorId
          `);

        if (existingResponse.recordset.length > 0) {
          // Update existing response
          await pool
            .request()
            .input("questionId", sql.Int, parseInt(QuestionId))
            .input("jurorId", sql.Int, jurorId)
            .input("response", sql.NVarChar(sql.MAX), String(Response))
            .query(`
              UPDATE JuryChargeResponses
              SET Response = @response, SubmittedAt = GETUTCDATE()
              WHERE QuestionId = @questionId AND JurorId = @jurorId
            `);
          console.log(`✅ [submitResponses] Updated response for question ${QuestionId}`);
        } else {
          // Insert new response
          await pool
            .request()
            .input("questionId", sql.Int, parseInt(QuestionId))
            .input("jurorId", sql.Int, jurorId)
            .input("response", sql.NVarChar(sql.MAX), String(Response))
            .query(`
              INSERT INTO JuryChargeResponses (QuestionId, JurorId, Response, SubmittedAt)
              VALUES (@questionId, @jurorId, @response, GETUTCDATE())
            `);
          console.log(`✅ [submitResponses] Inserted response for question ${QuestionId}`);
        }

        successCount++;
      } catch (err) {
        console.error(`❌ [submitResponses] Error processing question ${resp.QuestionId}:`, err);
        errors.push(`Failed to save response for question ${resp.QuestionId}`);
      }
    }

    console.log(`✅ [submitResponses] Completed: ${successCount}/${responses.length} responses saved`);

    if (successCount === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to save any responses",
        errors
      });
    }

    res.json({
      success: true,
      message: `Successfully submitted ${successCount} response(s)`,
      savedCount: successCount,
      totalCount: responses.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("❌ [submitResponses] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit responses",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get all verdicts for a case (Admin only)
 */
async function getVerdicts(req, res) {
  try {
    const { caseId } = req.params;
    const pool = await poolPromise;

    // Verify admin access
    const adminId = req.user?.id;
    if (!req.user || req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only admins can download verdicts"
      });
    }

    // Get all verdicts with question text and juror info
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId))
      .query(`
        SELECT
          jcr.ResponseId,
          jcr.QuestionId,
          jcr.Response,
          jcr.SubmittedAt,
          jcq.QuestionText,
          jcq.QuestionType,
          j.Name as JurorName,
          j.Email as JurorEmail
        FROM JuryChargeResponses jcr
        INNER JOIN JuryChargeQuestions jcq ON jcr.QuestionId = jcq.QuestionId
        INNER JOIN Jurors j ON jcr.JurorId = j.JurorId
        WHERE jcq.CaseId = @caseId
        ORDER BY jcr.SubmittedAt DESC
      `);

    res.json({
      success: true,
      verdicts: result.recordset
    });
  } catch (error) {
    console.error("❌ [getVerdicts] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get verdicts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  addQuestion, // NEW - Add single question with WebSocket
  saveJuryChargeQuestions, // Bulk save/replace all questions
  getJuryChargeQuestions,
  updateJuryChargeQuestion, // Updated with WebSocket
  deleteJuryChargeQuestion, // Updated with WebSocket
  exportAsText,
  exportAsMSFormsTemplate,
  releaseToJury, // Admin releases to jury - Updated with WebSocket
  getQuestionsForJuror, // Jurors get questions
  submitResponses, // Jurors submit responses
  checkIfLocked, // Check if locked
  getVerdicts, // Admin downloads all verdicts
};
