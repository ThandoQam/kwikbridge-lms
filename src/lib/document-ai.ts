// KwikBridge LMS — Intelligent Document Processing (ENH-12)
// AI-powered document extraction and auto-verification.
// Uses Claude Vision API for OCR, falls back to manual review.
//
// Supported document types:
//   SA ID, CIPC Registration, Bank Confirmation, Financial Statements,
//   BEE Certificate, Tax Clearance

import type { Customer, Document } from "../types/index";

// ═══ Types ═══

export interface ExtractionResult {
  success: boolean;
  documentType: string;
  confidence: number;           // 0-1
  extractedFields: Record<string, ExtractedField>;
  rawText?: string;
  processingTime: number;       // ms
  error?: string;
}

export interface ExtractedField {
  value: string;
  confidence: number;           // 0-1
  label: string;
}

export interface VerificationResult {
  documentId: string;
  documentType: string;
  checks: VerificationCheck[];
  overallStatus: "verified" | "mismatch" | "review_required";
  autoVerified: boolean;
}

export interface VerificationCheck {
  field: string;
  label: string;
  extracted: string;
  expected: string;
  match: boolean;
  confidence: number;
}

// ═══ Document Type Detection ═══

const DOC_TYPE_PATTERNS: Record<string, string[]> = {
  sa_id: ["identity", "id document", "department of home affairs", "identity number", "republic of south africa"],
  cipc: ["company registration", "cipc", "companies and intellectual property", "registration certificate", "ck number"],
  bank_confirm: ["bank confirmation", "banking details", "account confirmation", "account holder"],
  financials: ["financial statements", "income statement", "balance sheet", "statement of comprehensive income", "annual financial"],
  bee_cert: ["bee certificate", "broad-based black economic empowerment", "b-bbee", "empowerment", "bee level"],
  tax_clearance: ["tax clearance", "sars", "south african revenue service", "tax compliance"],
};

export function detectDocumentType(text: string): { type: string; confidence: number } {
  const lower = text.toLowerCase();
  let bestType = "other";
  let bestScore = 0;

  for (const [type, patterns] of Object.entries(DOC_TYPE_PATTERNS)) {
    const matches = patterns.filter(p => lower.includes(p)).length;
    const score = matches / patterns.length;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return { type: bestType, confidence: Math.min(1, bestScore * 2) };
}

// ═══ Extraction Prompts ═══

const EXTRACTION_PROMPTS: Record<string, string> = {
  sa_id: `Extract the following from this South African ID document:
- ID Number (13-digit number)
- Full Name (first name and surname)
- Date of Birth (DD/MM/YYYY)
- Citizenship Status (SA Citizen / Permanent Resident)
- Gender (Male / Female)

Respond ONLY with JSON: {"idNumber":"","fullName":"","dateOfBirth":"","citizenship":"","gender":""}`,

  cipc: `Extract the following from this CIPC company registration document:
- Company Name
- Registration Number (e.g. 2017/313869/07)
- Registration Date
- Directors (comma-separated list of names)
- Company Type (Pty Ltd / CC / NPC etc)

Respond ONLY with JSON: {"companyName":"","regNumber":"","regDate":"","directors":"","companyType":""}`,

  bank_confirm: `Extract the following from this bank confirmation letter:
- Bank Name
- Branch Code
- Account Number
- Account Holder Name
- Account Type (Current / Savings / Business)

Respond ONLY with JSON: {"bankName":"","branchCode":"","accountNumber":"","accountHolder":"","accountType":""}`,

  financials: `Extract the following key figures from these financial statements:
- Period (e.g. "Year ended Feb 2026")
- Revenue / Turnover (Rand amount)
- Net Profit / Loss (Rand amount)
- Total Assets (Rand amount)
- Total Liabilities (Rand amount)
- Current Assets (Rand amount)
- Current Liabilities (Rand amount)

Respond ONLY with JSON: {"period":"","revenue":0,"netProfit":0,"totalAssets":0,"totalLiabilities":0,"currentAssets":0,"currentLiabilities":0}`,

  bee_cert: `Extract the following from this BEE certificate:
- BEE Level (1-8)
- Expiry Date
- Verification Agency
- Black Ownership Percentage
- Company Name

Respond ONLY with JSON: {"beeLevel":0,"expiryDate":"","agency":"","blackOwnership":0,"companyName":""}`,

  tax_clearance: `Extract the following from this tax clearance certificate:
- Tax Reference Number
- Taxpayer Name
- Compliance Status (Good Standing / Non-Compliant)
- Valid From
- Valid To

Respond ONLY with JSON: {"taxNumber":"","taxpayerName":"","status":"","validFrom":"","validTo":""}`,
};

// ═══ AI Extraction ═══

/**
 * Extract structured data from a document image using Claude Vision API.
 * Falls back gracefully if API is unavailable.
 */
export async function extractFromDocument(
  imageBase64: string,
  documentType: string,
  mimeType: string = "image/jpeg",
  apiEndpoint?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const prompt = EXTRACTION_PROMPTS[documentType];

  if (!prompt) {
    return {
      success: false, documentType, confidence: 0,
      extractedFields: {}, processingTime: Date.now() - startTime,
      error: `No extraction prompt for document type: ${documentType}`,
    };
  }

  try {
    const endpoint = apiEndpoint || "https://api.anthropic.com/v1/messages";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const extracted = JSON.parse(jsonMatch[0]);
    const fields: Record<string, ExtractedField> = {};

    for (const [key, value] of Object.entries(extracted)) {
      fields[key] = {
        value: String(value),
        confidence: value ? 0.85 : 0,
        label: key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
      };
    }

    return {
      success: true, documentType, confidence: 0.85,
      extractedFields: fields, rawText: text,
      processingTime: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false, documentType, confidence: 0,
      extractedFields: {}, processingTime: Date.now() - startTime,
      error: `Extraction failed: ${err.message}. Manual review required.`,
    };
  }
}

// ═══ Auto-Verification ═══

/**
 * Verify extracted document data against the customer/application record.
 */
export function verifyExtraction(
  extraction: ExtractionResult,
  customer: Partial<Customer>,
  _document: Partial<Document>
): VerificationResult {
  const checks: VerificationCheck[] = [];

  switch (extraction.documentType) {
    case "sa_id": {
      const f = extraction.extractedFields;
      if (f.idNumber) {
        checks.push({
          field: "idNumber", label: "ID Number",
          extracted: f.idNumber.value, expected: customer.idNum || "",
          match: f.idNumber.value === customer.idNum,
          confidence: f.idNumber.confidence,
        });
      }
      if (f.fullName) {
        const nameMatch = customer.name
          ? f.fullName.value.toLowerCase().includes(customer.name.toLowerCase().split(" ")[0])
          : false;
        checks.push({
          field: "fullName", label: "Full Name",
          extracted: f.fullName.value, expected: customer.name || "",
          match: nameMatch, confidence: f.fullName.confidence,
        });
      }
      break;
    }

    case "cipc": {
      const f = extraction.extractedFields;
      if (f.regNumber) {
        checks.push({
          field: "regNumber", label: "Registration Number",
          extracted: f.regNumber.value, expected: customer.regNum || "",
          match: f.regNumber.value.replace(/\s/g, "") === (customer.regNum || "").replace(/\s/g, ""),
          confidence: f.regNumber.confidence,
        });
      }
      if (f.companyName) {
        const nameMatch = customer.name
          ? f.companyName.value.toLowerCase().includes(customer.name.toLowerCase().split(" ")[0])
          : false;
        checks.push({
          field: "companyName", label: "Company Name",
          extracted: f.companyName.value, expected: customer.name || "",
          match: nameMatch, confidence: f.companyName.confidence,
        });
      }
      break;
    }

    case "bee_cert": {
      const f = extraction.extractedFields;
      if (f.beeLevel) {
        const extractedLevel = parseInt(f.beeLevel.value) || 0;
        checks.push({
          field: "beeLevel", label: "BEE Level",
          extracted: f.beeLevel.value, expected: String(customer.beeLevel || ""),
          match: extractedLevel === (customer.beeLevel || 0),
          confidence: f.beeLevel.confidence,
        });
      }
      break;
    }

    default:
      // For other document types, extraction is informational (no auto-verify)
      break;
  }

  const allMatch = checks.length > 0 && checks.every(c => c.match);
  const anyMismatch = checks.some(c => !c.match && c.confidence > 0.5);

  return {
    documentId: _document.id || "",
    documentType: extraction.documentType,
    checks,
    overallStatus: allMatch ? "verified" : anyMismatch ? "mismatch" : "review_required",
    autoVerified: allMatch && checks.every(c => c.confidence >= 0.8),
  };
}

// ═══ Duplicate Detection ═══

/**
 * Check if a document has already been uploaded (by content hash).
 * Uses a simple hash of the first 10KB of content.
 */
export async function checkDuplicate(
  fileContent: ArrayBuffer,
  existingDocuments: Document[]
): Promise<{ isDuplicate: boolean; matchingDoc?: Document }> {
  const hash = await hashContent(fileContent);

  for (const doc of existingDocuments) {
    if ((doc as any).contentHash === hash) {
      return { isDuplicate: true, matchingDoc: doc };
    }
  }

  return { isDuplicate: false };
}

async function hashContent(content: ArrayBuffer): Promise<string> {
  try {
    // Use first 10KB for performance
    const slice = content.slice(0, 10240);
    const hashBuffer = await crypto.subtle.digest("SHA-256", slice);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `fallback-${content.byteLength}-${Date.now()}`;
  }
}

// ═══ Pre-Population Helper ═══

/**
 * Convert extracted financial data into the FinancialInputs format
 * used by the decisioning engine (ENH-03).
 */
export function extractedToFinancials(extraction: ExtractionResult): Record<string, number> {
  if (extraction.documentType !== "financials") return {};

  const f = extraction.extractedFields;
  return {
    revenue: parseFloat(f.revenue?.value || "0") || 0,
    netProfit: parseFloat(f.netProfit?.value || "0") || 0,
    totalAssets: parseFloat(f.totalAssets?.value || "0") || 0,
    totalLiabilities: parseFloat(f.totalLiabilities?.value || "0") || 0,
    currentAssets: parseFloat(f.currentAssets?.value || "0") || 0,
    currentLiabilities: parseFloat(f.currentLiabilities?.value || "0") || 0,
  };
}
