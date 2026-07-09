// =============================================
// witnessController.js - Case Witnesses Management
// FIXED: Added defensive programming, validation, transaction support
// =============================================

const { poolPromise, sql } = require("../config/db");

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
 * Validate witness data
 * FIXED: Added input validation
 */
function validateWitness(witness) {
  if (!witness.name || witness.name.trim().length === 0) {
    return { isValid: false, error: "Witness name is required" };
  }

  if (witness.name.trim().length > 200) {
    return {
      isValid: false,
      error: "Witness name too long (max 200 characters)",
    };
  }

  const validSides = [
    "Plaintiff",
    "Defendant",
    "Prosecution",
    "Defense",
    "Neutral",
  ];
  if (!witness.side || !validSides.includes(witness.side)) {
    return {
      isValid: false,
      error: `Witness side must be one of: ${validSides.join(", ")}`,
    };
  }

  if (witness.description && witness.description.trim().length > 1000) {
    return {
      isValid: false,
      error: "Description too long (max 1000 characters)",
    };
  }

  return { isValid: true };
}

// ============================================
// WITNESS MANAGEMENT
// ============================================

/**
 * Add or update witnesses for a case (Attorney only)
 * FIXED: Added validation, defensive checks, and transaction support
 */
async function saveWitnesses(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { caseId } = req.params;
    const { witnesses } = req.body;
    const attorneyId = req.user.id;

    // Validate input
    if (!Array.isArray(witnesses)) {
      return res.status(400).json({
        success: false,
        message: "Witnesses must be an array",
      });
    }

    // Validate each witness
    for (const witness of witnesses) {
      const validation = validateWitness(witness);
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
      // Delete existing witnesses for this case
      await transaction
        .request()
        .input("caseId", sql.Int, caseId)
        .query("DELETE FROM CaseWitnesses WHERE CaseId = @caseId");

      // Insert new witnesses
      if (witnesses.length > 0) {
        for (let i = 0; i < witnesses.length; i++) {
          const witness = witnesses[i];
          await transaction
            .request()
            .input("caseId", sql.Int, caseId)
            .input("witnessName", sql.NVarChar, witness.name.trim())
            .input("side", sql.NVarChar, witness.side)
            .input(
              "description",
              sql.NVarChar,
              witness.description?.trim() || null
            )
            .input("orderIndex", sql.Int, i).query(`
              INSERT INTO CaseWitnesses (CaseId, WitnessName, Side, Description, OrderIndex)
              VALUES (@caseId, @witnessName, @side, @description, @orderIndex)
            `);
        }
      }

      // Commit transaction
      await transaction.commit();

      res.json({
        success: true,
        message: "Witnesses saved successfully",
        witnessesCount: witnesses.length,
      });
    } catch (error) {
      // Rollback on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error saving witnesses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save witnesses",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get witnesses for a case (Attorney and Admin)
 * FIXED: Added input validation
 */
async function getWitnesses(req, res) {
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
        "SELECT * FROM CaseWitnesses WHERE CaseId = @caseId ORDER BY OrderIndex ASC"
      );

    res.json({
      success: true,
      witnesses: result.recordset,
      count: result.recordset.length,
    });
  } catch (error) {
    console.error("Error fetching witnesses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch witnesses",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Update a single witness (Attorney only)
 * FIXED: Added validation and defensive checks
 */
async function updateWitness(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { witnessId } = req.params;
    const { name, side, description } = req.body;
    const attorneyId = req.user.id;

    // Validate witness data
    const validation = validateWitness({ name, side, description });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const pool = await poolPromise;

    // Verify attorney owns the case this witness belongs to
    const verifyResult = await pool
      .request()
      .input("witnessId", sql.Int, witnessId)
      .input("attorneyId", sql.Int, attorneyId).query(`
        SELECT cw.WitnessId 
        FROM CaseWitnesses cw 
        JOIN Cases c ON cw.CaseId = c.CaseId 
        WHERE cw.WitnessId = @witnessId AND c.AttorneyId = @attorneyId
      `);

    if (verifyResult.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this witness",
      });
    }

    // Update witness
    await pool
      .request()
      .input("witnessId", sql.Int, witnessId)
      .input("name", sql.NVarChar, name.trim())
      .input("side", sql.NVarChar, side)
      .input("description", sql.NVarChar, description?.trim() || null).query(`
        UPDATE CaseWitnesses 
        SET WitnessName = @name, Side = @side, Description = @description 
        WHERE WitnessId = @witnessId
      `);

    res.json({
      success: true,
      message: "Witness updated successfully",
    });
  } catch (error) {
    console.error("Error updating witness:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update witness",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Delete a witness (Attorney only)
 * FIXED: Added defensive checks
 */
async function deleteWitness(req, res) {
  try {
    // FIXED: Defensive check for req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { witnessId } = req.params;
    const attorneyId = req.user.id;

    const pool = await poolPromise;

    // Verify attorney owns the case this witness belongs to
    const verifyResult = await pool
      .request()
      .input("witnessId", sql.Int, witnessId)
      .input("attorneyId", sql.Int, attorneyId).query(`
        SELECT cw.WitnessId 
        FROM CaseWitnesses cw 
        JOIN Cases c ON cw.CaseId = c.CaseId 
        WHERE cw.WitnessId = @witnessId AND c.AttorneyId = @attorneyId
      `);

    if (verifyResult.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this witness",
      });
    }

    // Delete witness
    await pool
      .request()
      .input("witnessId", sql.Int, witnessId)
      .query("DELETE FROM CaseWitnesses WHERE WitnessId = @witnessId");

    res.json({
      success: true,
      message: "Witness deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting witness:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete witness",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Export witnesses as text file format (Admin)
 * FIXED: Added better formatting
 */
async function exportAsText(req, res) {
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
        "SELECT * FROM CaseWitnesses WHERE CaseId = @caseId ORDER BY OrderIndex ASC"
      );

    let textContent = "WITNESSES FOR CREDIBILITY EVALUATION\n";
    textContent += "=====================================\n";
    textContent += `Case ID: ${caseId}\n`;
    textContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    if (result.recordset.length === 0) {
      textContent += "No witnesses have been added for this case.\n";
    } else {
      result.recordset.forEach((witness, index) => {
        textContent += `Witness ${index + 1}: ${witness.WitnessName}\n`;
        textContent += `Side: ${witness.Side}\n`;
        if (witness.Description) {
          textContent += `Description: ${witness.Description}\n`;
        }
        textContent += "\n---\n\n";
      });
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="witnesses-case-${caseId}.txt"`
    );
    res.send(textContent);
  } catch (error) {
    console.error("Error exporting witnesses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export witnesses",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  saveWitnesses,
  getWitnesses,
  updateWitness,
  deleteWitness,
  exportAsText,
};
