const { getPool, sql } = require("../config/db");

async function findById(witnessId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("witnessId", sql.Int, witnessId)
    .query("SELECT * FROM CaseWitnesses WHERE WitnessId = @witnessId");
  return result.recordset[0] || null;
}

async function findByCaseId(caseId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("caseId", sql.Int, caseId)
    .query("SELECT * FROM CaseWitnesses WHERE CaseId = @caseId ORDER BY OrderIndex ASC");
  return result.recordset;
}

module.exports = { findById, findByCaseId };
