// KwikBridge LMS — File Storage Service
// Handles file upload, download (signed URLs), and validation
// Uses Supabase Storage with the "documents" bucket.

import { SUPABASE_URL, SUPABASE_KEY } from "./supabase";

const BUCKET = "documents";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const SIGNED_URL_EXPIRY = 900; // 15 minutes

// ═══ Storage URL helpers ═══

const storageUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

const storageHeaders = (token?: string) => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
});

// ═══ File Validation ═══

export interface FileValidation {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidation {
  if (!file) return { valid: false, error: "No file selected" };
  if (file.size > MAX_SIZE) return { valid: false, error: `File exceeds ${MAX_SIZE / 1024 / 1024}MB limit` };
  if (file.size === 0) return { valid: false, error: "File is empty" };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `File type "${file.type}" not allowed. Accepted: PDF, JPEG, PNG` };
  }
  return { valid: true };
}

// ═══ Upload ═══

export interface UploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Upload a file to Supabase Storage.
 * Path format: {customerId}/{docType}_{timestamp}.{ext}
 *
 * @param file - The File object from an <input type="file">
 * @param customerId - Customer ID (used as folder name for RLS)
 * @param docType - Document type key (sa_id, financials, etc.)
 * @param token - Auth token (optional, uses anon key if not provided)
 */
export async function uploadFile(
  file: File,
  customerId: string,
  docType: string,
  token?: string
): Promise<UploadResult> {
  // Validate
  const validation = validateFile(file);
  if (!validation.valid) return { success: false, error: validation.error };

  // Build storage path: {custId}/{docType}_{timestamp}.{ext}
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const timestamp = Date.now();
  const path = `${customerId}/${docType}_${timestamp}.${ext}`;

  try {
    const response = await fetch(storageUrl(path), {
      method: "POST",
      headers: {
        ...storageHeaders(token),
        "Content-Type": file.type,
        "x-upsert": "true", // overwrite if exists
      },
      body: file,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Upload failed" }));
      return { success: false, error: err.message || `Upload failed (${response.status})` };
    }

    return { success: true, path };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error during upload" };
  }
}

// ═══ Download (Signed URL) ═══

export interface SignedUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Get a time-limited signed URL for downloading/viewing a file.
 * URL expires after 15 minutes.
 */
export async function getSignedUrl(
  path: string,
  token?: string
): Promise<SignedUrlResult> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          ...storageHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRY }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `Failed to generate URL (${response.status})` };
    }

    const data = await response.json();
    const signedUrl = `${SUPABASE_URL}/storage/v1${data.signedURL}`;
    return { success: true, url: signedUrl };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to get signed URL" };
  }
}

// ═══ Public URL (for non-sensitive files) ═══

export function getPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ═══ File Info ═══

export interface FileInfo {
  name: string;
  size: number;
  mimeType: string;
  lastModified: string;
}

/**
 * Get metadata about an uploaded file.
 */
export async function getFileInfo(
  path: string,
  token?: string
): Promise<FileInfo | null> {
  try {
    const response = await fetch(storageUrl(path), {
      method: "HEAD",
      headers: storageHeaders(token),
    });

    if (!response.ok) return null;

    return {
      name: path.split("/").pop() || "",
      size: parseInt(response.headers.get("content-length") || "0"),
      mimeType: response.headers.get("content-type") || "application/octet-stream",
      lastModified: response.headers.get("last-modified") || "",
    };
  } catch {
    return null;
  }
}

// ═══ Constants (exported for UI) ═══

export const FILE_CONSTANTS = {
  MAX_SIZE,
  MAX_SIZE_MB: MAX_SIZE / 1024 / 1024,
  ALLOWED_TYPES,
  ALLOWED_EXTENSIONS: [".pdf", ".jpg", ".jpeg", ".png"],
  BUCKET,
  SIGNED_URL_EXPIRY,
};
