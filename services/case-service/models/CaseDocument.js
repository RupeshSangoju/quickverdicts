// =============================================
// CaseDocument.js - Case Document Model
// =============================================

const { poolPromise, sql } = require("../config/db");

const DOCUMENT_TYPES = {
  EVIDENCE: "evidence",
  EXHIBIT: "exhibit",
  BRIEF: "brief",
  MOTION: "motion",
  PLEADING: "pleading",
  OTHER: "other",
};

async function uploadDocument(documentData) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(documentData.caseId))
      .input("attorneyId", sql.Int, parseInt(documentData.attorneyId))
      .input("documentType", sql.NVarChar, documentData.documentType)
      .input("fileName", sql.NVarChar, documentData.fileName)
      .input("fileSize", sql.BigInt, documentData.fileSize || null)
      .input("filePath", sql.NVarChar, documentData.filePath || null)
      .input("fileUrl", sql.NVarChar, documentData.fileUrl || null)
      .input("mimeType", sql.NVarChar, documentData.mimeType || null)
      .input("description", sql.NVarChar, documentData.description || null)
      .query(`
        INSERT INTO dbo.CaseDocuments 
        (CaseId, AttorneyId, DocumentType, FileName, FileSize, FilePath, FileUrl, MimeType, Description, UploadedAt)
        VALUES 
        (@caseId, @attorneyId, @documentType, @fileName, @fileSize, @filePath, @fileUrl, @mimeType, @description, GETUTCDATE());
        SELECT SCOPE_IDENTITY() as DocumentId;
      `);

    return result.recordset[0].DocumentId;
  } catch (error) {
    console.error("Error uploading document:", error);
    throw error;
  }
}

async function getDocumentsByCase(caseId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId)).query(`
        SELECT 
          cd.*,
          a.FirstName + ' ' + a.LastName as AttorneyName,
          a.Email as AttorneyEmail,
          va.FirstName + ' ' + va.LastName as VerifiedByName
        FROM dbo.CaseDocuments cd
        LEFT JOIN dbo.Attorneys a ON cd.AttorneyId = a.AttorneyId
        LEFT JOIN dbo.Admins va ON cd.VerifiedBy = va.AdminId
        WHERE cd.CaseId = @caseId
        ORDER BY cd.UploadedAt DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error("Error getting documents by case:", error);
    throw error;
  }
}

async function findById(documentId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("documentId", sql.Int, parseInt(documentId)).query(`
        SELECT 
          cd.*,
          a.FirstName + ' ' + a.LastName as AttorneyName,
          c.CaseTitle
        FROM dbo.CaseDocuments cd
        LEFT JOIN dbo.Attorneys a ON cd.AttorneyId = a.AttorneyId
        LEFT JOIN dbo.Cases c ON cd.CaseId = c.CaseId
        WHERE cd.DocumentId = @documentId
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error finding document by ID:", error);
    throw error;
  }
}

async function verifyDocument(documentId, adminId) {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("documentId", sql.Int, parseInt(documentId))
      .input("adminId", sql.Int, parseInt(adminId)).query(`
        UPDATE dbo.CaseDocuments
        SET IsVerified = 1, VerifiedBy = @adminId, VerifiedAt = GETUTCDATE()
        WHERE DocumentId = @documentId
      `);
  } catch (error) {
    console.error("Error verifying document:", error);
    throw error;
  }
}

async function deleteDocument(documentId) {
  try {
    const pool = await poolPromise;
    await pool.request().input("documentId", sql.Int, parseInt(documentId))
      .query(`
        DELETE FROM dbo.CaseDocuments
        WHERE DocumentId = @documentId
      `);
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
}

async function getDocumentStats(caseId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("caseId", sql.Int, parseInt(caseId)).query(`
        SELECT 
          COUNT(*) as TotalDocuments,
          SUM(CASE WHEN IsVerified = 1 THEN 1 ELSE 0 END) as VerifiedDocuments,
          SUM(FileSize) as TotalSize,
          COUNT(DISTINCT DocumentType) as DocumentTypes
        FROM dbo.CaseDocuments
        WHERE CaseId = @caseId
      `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error getting document stats:", error);
    throw error;
  }
}

module.exports = {
  DOCUMENT_TYPES,
  uploadDocument,
  getDocumentsByCase,
  findById,
  verifyDocument,
  deleteDocument,
  getDocumentStats,
};
