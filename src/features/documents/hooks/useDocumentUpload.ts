// @ts-nocheck
// KwikBridge LMS — Document Upload Hook
// Wraps file upload, validation, and document record creation.
// Used by both Portal (borrower upload) and Staff (document management).

import { uploadFile, getSignedUrl, validateFile, FILE_CONSTANTS } from "../../lib/storage";

/**
 * Upload a file and create a document record.
 *
 * @param file - File from <input type="file">
 * @param custId - Customer ID
 * @param docType - Document type key (sa_id, financials, etc.)
 * @param docName - Human-readable document name
 * @param category - Document category (kyc, financial, legal, etc.)
 * @param appId - Application ID (optional)
 * @param uploadedBy - User who uploaded
 * @param token - Auth token (optional)
 *
 * @returns Document record with storagePath, or error
 */
export async function uploadDocument(
  file,
  custId,
  docType,
  docName,
  category,
  appId,
  uploadedBy,
  token
) {
  // 1. Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. Upload to Supabase Storage
  const result = await uploadFile(file, custId, docType, token);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // 3. Build document record (to be saved via DataProvider)
  const doc = {
    custId,
    appId: appId || null,
    name: docName,
    type: docType,
    category,
    docType,
    status: "Pending Review",
    uploadedAt: Date.now(),
    uploadedBy,
    storagePath: result.path,
    fileSize: file.size,
    mimeType: file.type,
    originalName: file.name,
  };

  return { success: true, doc };
}

/**
 * Get a viewable/downloadable URL for a document.
 * Returns a 15-minute signed URL.
 */
export async function getDocumentUrl(storagePath, token) {
  if (!storagePath) return { success: false, error: "No file attached" };
  return getSignedUrl(storagePath, token);
}

/**
 * File input accept string for <input type="file">
 */
export const ACCEPT_STRING = FILE_CONSTANTS.ALLOWED_EXTENSIONS.join(",");

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { FILE_CONSTANTS };
