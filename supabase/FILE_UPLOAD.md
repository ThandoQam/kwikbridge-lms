# KwikBridge LMS — Real File Upload

## Overview

Replaces the metadata-only document records with actual file storage using
Supabase Storage. Documents are uploaded to a private `documents` bucket
with signed URLs for secure access.

## Architecture

```
Browser                    Supabase Storage              Database
  ↓                             ↓                          ↓
[file input]                    │                          │
  ↓                             │                          │
validateFile()                  │                          │
  ↓                             │                          │
uploadFile() ─── POST ──► /storage/v1/object/documents/{custId}/{type}_{ts}.{ext}
  ↓                             │                          │
  ↓                             │                          │
save({documents:[...doc]}) ────────────────────────► documents table
  │                             │                   (with storage_path)
  │                             │                          │
getSignedUrl() ── POST ──► /storage/v1/object/sign ──► 15-min URL
  ↓                             │                          │
[preview/download]              │                          │
```

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/storage.ts` | Storage service (upload, signed URLs, validation) |
| `src/features/documents/hooks/useDocumentUpload.ts` | Upload hook for portal/staff |
| `src/types/index.ts` | Document interface updated with storage fields |
| `supabase/migrations/004_file_upload_storage.sql` | DB columns + Storage RLS |

## Storage Path Convention

Files are stored at: `{customerId}/{docType}_{timestamp}.{extension}`

Examples:
- `CUST-001/sa_id_1712345678901.pdf`
- `CUST-001/financials_1712345678902.pdf`
- `CUST-002/bee_cert_1712345678903.png`

The customer ID as the first folder segment enables RLS — borrowers can only
access files in their own folder.

## File Constraints

| Constraint | Value |
|------------|-------|
| Max file size | 10 MB |
| Allowed types | PDF, JPEG, PNG |
| Signed URL expiry | 15 minutes |
| Deletion | Blocked (regulatory retention) |

## Document Record (Updated)

```typescript
interface Document {
  id: string;
  custId: string;
  name: string;
  type: string;           // doc type key (sa_id, financials, etc.)
  status: "Pending Review" | "Under Review" | "Verified" | "Rejected";
  uploadedAt: number;
  uploadedBy: string;
  // NEW — file storage fields:
  storagePath?: string;    // "CUST-001/sa_id_1712345678901.pdf"
  fileSize?: number;       // bytes
  mimeType?: string;       // "application/pdf"
  originalName?: string;   // "My_ID_Document.pdf"
}
```

## RLS Policies (Storage)

| Who | Read | Upload | Delete |
|-----|------|--------|--------|
| Staff | All files | Non-read-only roles | Blocked |
| Borrower | Own folder only | Own folder only | Blocked |
| Anon | — | Yes (public form) | Blocked |
| No one | — | — | **All deletions blocked** |

## How to Apply

### 1. Run the SQL migration

Paste `supabase/migrations/004_file_upload_storage.sql` into Supabase SQL Editor.

### 2. Create the Storage bucket

In Supabase Dashboard → Storage:
1. Click **New Bucket**
2. Name: `documents`
3. Public: **OFF**
4. File size limit: **10 MB**
5. Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`

### 3. Apply Storage RLS policies

The policies in `004_file_upload_storage.sql` reference `storage.objects`.
These run automatically when applied via SQL Editor.

## Usage in Code

### Portal (Borrower Upload)
```typescript
import { uploadDocument, ACCEPT_STRING } from "../hooks/useDocumentUpload";

// In JSX:
<input type="file" accept={ACCEPT_STRING} onChange={async (e) => {
  const file = e.target.files[0];
  const result = await uploadDocument(
    file, myCustomer.id, "sa_id", "SA ID Document",
    "kyc", appId, myCustomer.name, authSession?.token
  );
  if (result.success) {
    save({...data, documents: [...documents, { id: uid(), ...result.doc }]});
  } else {
    alert(result.error);
  }
}} />
```

### Staff (Document Review)
```typescript
import { getDocumentUrl } from "../hooks/useDocumentUpload";

// View document:
const { success, url } = await getDocumentUrl(doc.storagePath, authSession?.token);
if (success) window.open(url, "_blank");
```

## Integration with Existing Monolith

The monolith's portal document "upload" currently creates metadata-only records.
To enable real file upload, the portal section needs:

1. Add `<input type="file">` elements next to each document type
2. Call `uploadDocument()` on file selection
3. Include `storagePath`, `fileSize`, `mimeType`, `originalName` in the saved record
4. Add a "View" button on staff document review that calls `getDocumentUrl()`

This integration happens when the portal feature is wired to replace the monolith.
