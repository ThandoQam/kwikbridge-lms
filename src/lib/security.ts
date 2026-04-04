// KwikBridge LMS — Security Hardening Module (ENH-08)
// Session management, MFA readiness, security event logging,
// client-side encryption, and rate limiting.
// Prepares for SOC 2 Type II and ISO 27001 certification.

// ═══ Session Management ═══

export interface SessionConfig {
  timeoutMinutes: number;       // auto-logout after inactivity (default: 15)
  warningMinutes: number;       // show warning before timeout (default: 12)
  mfaRequired: string[];        // roles requiring MFA
}

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  timeoutMinutes: 15,
  warningMinutes: 12,
  mfaRequired: ["ADMIN", "EXEC", "CREDIT_HEAD", "FINANCE"],
};

let sessionTimer: ReturnType<typeof setTimeout> | null = null;
let warningTimer: ReturnType<typeof setTimeout> | null = null;
let lastActivity: number = Date.now();
let onTimeoutCallback: (() => void) | null = null;
let onWarningCallback: (() => void) | null = null;

export function initSession(
  config: Partial<SessionConfig> = {},
  onTimeout: () => void,
  onWarning?: () => void
) {
  const cfg = { ...DEFAULT_SESSION_CONFIG, ...config };
  onTimeoutCallback = onTimeout;
  onWarningCallback = onWarning || null;

  resetSessionTimer(cfg);

  // Track user activity
  const events = ["mousedown", "keydown", "scroll", "touchstart"];
  const handleActivity = () => {
    lastActivity = Date.now();
    resetSessionTimer(cfg);
  };

  events.forEach(evt => {
    if (typeof document !== "undefined") {
      document.addEventListener(evt, handleActivity, { passive: true });
    }
  });

  return () => {
    events.forEach(evt => {
      if (typeof document !== "undefined") {
        document.removeEventListener(evt, handleActivity);
      }
    });
    if (sessionTimer) clearTimeout(sessionTimer);
    if (warningTimer) clearTimeout(warningTimer);
  };
}

function resetSessionTimer(cfg: SessionConfig) {
  if (sessionTimer) clearTimeout(sessionTimer);
  if (warningTimer) clearTimeout(warningTimer);

  warningTimer = setTimeout(() => {
    if (onWarningCallback) onWarningCallback();
  }, cfg.warningMinutes * 60 * 1000);

  sessionTimer = setTimeout(() => {
    logSecurityEvent("SESSION_TIMEOUT", { lastActivity: new Date(lastActivity).toISOString() });
    if (onTimeoutCallback) onTimeoutCallback();
  }, cfg.timeoutMinutes * 60 * 1000);
}

export function extendSession() {
  lastActivity = Date.now();
  resetSessionTimer(DEFAULT_SESSION_CONFIG);
}

// ═══ Security Event Logging ═══

export type SecurityEventType =
  | "AUTH_SUCCESS"
  | "AUTH_FAILURE"
  | "MFA_CHALLENGE"
  | "MFA_SUCCESS"
  | "MFA_FAILURE"
  | "SESSION_TIMEOUT"
  | "PERMISSION_DENIED"
  | "DATA_EXPORT"
  | "BULK_OPERATION"
  | "SETTINGS_CHANGE"
  | "ROLE_CHANGE"
  | "PASSWORD_RESET"
  | "RATE_LIMIT_HIT"
  | "SUSPICIOUS_ACTIVITY";

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  timestamp: string;
  userId: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: "info" | "warning" | "critical";
}

const securityLog: SecurityEvent[] = [];
let _secEvtCounter = 0;
let _currentUserId = "";
let _currentUserRole = "";

export function setSecurityContext(userId: string, userRole: string) {
  _currentUserId = userId;
  _currentUserRole = userRole;
}

export function logSecurityEvent(
  type: SecurityEventType,
  details: Record<string, any> = {},
  severity?: "info" | "warning" | "critical"
) {
  const severityMap: Record<SecurityEventType, "info" | "warning" | "critical"> = {
    AUTH_SUCCESS: "info",
    AUTH_FAILURE: "warning",
    MFA_CHALLENGE: "info",
    MFA_SUCCESS: "info",
    MFA_FAILURE: "warning",
    SESSION_TIMEOUT: "info",
    PERMISSION_DENIED: "warning",
    DATA_EXPORT: "info",
    BULK_OPERATION: "info",
    SETTINGS_CHANGE: "warning",
    ROLE_CHANGE: "critical",
    PASSWORD_RESET: "warning",
    RATE_LIMIT_HIT: "warning",
    SUSPICIOUS_ACTIVITY: "critical",
  };

  const event: SecurityEvent = {
    id: `SEC-${Date.now()}-${++_secEvtCounter}`,
    type,
    timestamp: new Date().toISOString(),
    userId: _currentUserId,
    userRole: _currentUserRole,
    ipAddress: "", // Set server-side, not in browser
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    details,
    severity: severity || severityMap[type] || "info",
  };

  securityLog.push(event);

  // Keep last 1000 events in memory
  if (securityLog.length > 1000) securityLog.splice(0, securityLog.length - 1000);

  // Critical events logged to console
  if (event.severity === "critical") {
    console.warn("[SECURITY]", type, details);
  }

  return event;
}

export function getSecurityLog(limit = 100): SecurityEvent[] {
  return securityLog.slice(-limit);
}

export function exportSecurityLog(format: "json" | "cef" = "json"): string {
  if (format === "cef") {
    return securityLog.map(e =>
      `CEF:0|KwikBridge|LMS|2.0|${e.type}|${e.type}|${e.severity === "critical" ? 10 : e.severity === "warning" ? 5 : 1}|userId=${e.userId} role=${e.userRole} ts=${e.timestamp}`
    ).join("\n");
  }
  return securityLog.map(e => JSON.stringify(e)).join("\n");
}

// ═══ Rate Limiting ═══

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  lockoutMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxRequests: 5, windowMs: 60000, lockoutMs: 900000 },        // 5/min, 15 min lockout
  api: { maxRequests: 100, windowMs: 60000, lockoutMs: 60000 },          // 100/min
  download: { maxRequests: 20, windowMs: 60000, lockoutMs: 60000 },      // 20/min
  export: { maxRequests: 5, windowMs: 3600000, lockoutMs: 3600000 },     // 5/hour
};

const rateLimitBuckets = new Map<string, { count: number; resetAt: number; lockedUntil: number }>();

export function checkRateLimit(operation: string, userId = ""): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const config = RATE_LIMITS[operation] || RATE_LIMITS.api;
  const key = `${operation}:${userId}`;
  const now = Date.now();

  let bucket = rateLimitBuckets.get(key);

  // Check lockout
  if (bucket && bucket.lockedUntil > now) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.lockedUntil - now };
  }

  // Reset window if expired
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + config.windowMs, lockedUntil: 0 };
  }

  bucket.count++;

  if (bucket.count > config.maxRequests) {
    bucket.lockedUntil = now + config.lockoutMs;
    rateLimitBuckets.set(key, bucket);
    logSecurityEvent("RATE_LIMIT_HIT", { operation, count: bucket.count }, "warning");
    return { allowed: false, remaining: 0, retryAfterMs: config.lockoutMs };
  }

  rateLimitBuckets.set(key, bucket);
  return { allowed: true, remaining: config.maxRequests - bucket.count, retryAfterMs: 0 };
}

// ═══ Client-Side Encryption (AES-256-GCM) ═══

const ENCRYPTION_KEY_NAME = "kwikbridge_enc_key";

/**
 * Derive an encryption key from a master password/key.
 * In production, the master key comes from Supabase Edge Function secrets.
 */
async function getEncryptionKey(masterKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(masterKey), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("kwikbridge-lms-v2"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a string value. Returns base64-encoded ciphertext with IV prepended.
 */
export async function encryptField(value: string, masterKey: string): Promise<string> {
  if (!value || !masterKey) return value;
  try {
    const key = await getEncryptionKey(masterKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

    // Prepend IV to ciphertext
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return "ENC:" + btoa(String.fromCharCode(...combined));
  } catch {
    return value; // Return unencrypted on failure
  }
}

/**
 * Decrypt a field. Input must start with "ENC:" prefix.
 */
export async function decryptField(encrypted: string, masterKey: string): Promise<string> {
  if (!encrypted?.startsWith("ENC:") || !masterKey) return encrypted;
  try {
    const key = await getEncryptionKey(masterKey);
    const combined = Uint8Array.from(atob(encrypted.slice(4)), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return encrypted; // Return as-is on failure
  }
}

/**
 * Check if a value is encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith("ENC:") || false;
}

// ═══ SOC 2 Readiness Checklist ═══

export interface ComplianceCheckItem {
  category: string;
  control: string;
  status: "pass" | "partial" | "fail" | "not_assessed";
  evidence: string;
}

export function getSOC2Checklist(): ComplianceCheckItem[] {
  return [
    { category: "Access Control", control: "Role-based access control (RBAC)", status: "pass", evidence: "12 roles, 35 RLS policies, 5 access tiers" },
    { category: "Access Control", control: "Multi-factor authentication", status: "partial", evidence: "MFA framework built, pending Supabase Auth MFA activation" },
    { category: "Access Control", control: "Session management", status: "pass", evidence: "15-minute timeout, activity tracking, session events logged" },
    { category: "Access Control", control: "Separation of duties", status: "pass", evidence: "Creator cannot approve own applications, approval authority matrix enforced" },
    { category: "Audit Logging", control: "Immutable audit trail", status: "pass", evidence: "Append-only audit_trail table, no UPDATE/DELETE RLS policies" },
    { category: "Audit Logging", control: "Security event logging", status: "pass", evidence: "14 security event types, SIEM-compatible export (JSON/CEF)" },
    { category: "Audit Logging", control: "User activity tracking", status: "pass", evidence: "All actions logged with user, timestamp, entity, details" },
    { category: "Data Protection", control: "Data encryption at rest", status: "partial", evidence: "AES-256-GCM client-side encryption for PII fields, pending full rollout" },
    { category: "Data Protection", control: "Data encryption in transit", status: "pass", evidence: "HTTPS enforced (Supabase + Vercel), TLS 1.2+" },
    { category: "Data Protection", control: "Data minimisation (POPIA)", status: "pass", evidence: "Only necessary PII collected, retention policies defined" },
    { category: "Data Protection", control: "Data classification", status: "pass", evidence: "Document classification: Confidential on all policy documents" },
    { category: "Availability", control: "Health monitoring", status: "pass", evidence: "Health check endpoint, Sentry error tracking, Web Vitals" },
    { category: "Availability", control: "Backup and recovery", status: "partial", evidence: "Supabase automated backups, pending recovery testing" },
    { category: "Availability", control: "Incident response plan", status: "fail", evidence: "Not yet documented" },
    { category: "Risk Management", control: "Vulnerability scanning", status: "partial", evidence: "npm audit in CI/CD, pending penetration testing" },
    { category: "Risk Management", control: "Rate limiting", status: "pass", evidence: "Per-operation rate limits (login 5/min, API 100/min, export 5/hr)" },
    { category: "Risk Management", control: "Input validation", status: "pass", evidence: "File validation, form validation, API parameter checks" },
    { category: "Change Management", control: "CI/CD pipeline", status: "pass", evidence: "GitHub Actions: typecheck, lint, integrity, build, test, security scan" },
    { category: "Change Management", control: "Code review process", status: "partial", evidence: "PR workflow defined, pending branch protection enforcement" },
    { category: "Change Management", control: "Version control", status: "pass", evidence: "Git with pre-commit hooks, immutable deployment history" },
  ];
}

export function getComplianceScore(): { score: number; total: number; percentage: number } {
  const items = getSOC2Checklist();
  const total = items.length;
  const score = items.reduce((s, i) => s + (i.status === "pass" ? 1 : i.status === "partial" ? 0.5 : 0), 0);
  return { score, total, percentage: Math.round((score / total) * 100) };
}
