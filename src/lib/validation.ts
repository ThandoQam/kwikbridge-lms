/**
 * Input validation helpers for fintech-grade data integrity.
 *
 * Used by forms throughout the app to ensure:
 * - Currency amounts are positive numbers within reasonable bounds
 * - SA ID numbers pass Luhn checksum
 * - SA company registration numbers match CIPC format
 * - SA phone numbers are properly formatted
 * - Email addresses are properly formatted
 * - DSCR/financial ratios are within reasonable bounds
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const ok = (): ValidationResult => ({ valid: true });
const fail = (error: string): ValidationResult => ({ valid: false, error });

// ─── Currency ───
export const validateCurrency = (
  value: string | number,
  opts: { min?: number; max?: number; required?: boolean } = {}
): ValidationResult => {
  if (value === '' || value === null || value === undefined) {
    return opts.required ? fail('Amount is required') : ok();
  }
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(num)) return fail('Must be a valid number');
  if (num < 0) return fail('Amount cannot be negative');
  if (opts.min !== undefined && num < opts.min) {
    return fail(`Minimum amount is R${opts.min.toLocaleString('en-ZA')}`);
  }
  if (opts.max !== undefined && num > opts.max) {
    return fail(`Maximum amount is R${opts.max.toLocaleString('en-ZA')}`);
  }
  return ok();
};

// ─── SA ID Number (13 digits + Luhn checksum) ───
export const validateSAIDNumber = (id: string): ValidationResult => {
  if (!id) return fail('ID number is required');
  const cleaned = id.replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return fail('ID number must be exactly 13 digits');

  // Validate date portion (YYMMDD)
  const yy = parseInt(cleaned.slice(0, 2), 10);
  const mm = parseInt(cleaned.slice(2, 4), 10);
  const dd = parseInt(cleaned.slice(4, 6), 10);
  if (mm < 1 || mm > 12) return fail('Invalid month in ID number');
  if (dd < 1 || dd > 31) return fail('Invalid day in ID number');

  // Luhn checksum (SA ID uses standard Luhn)
  let sum = 0;
  let alternate = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let n = parseInt(cleaned[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  if (sum % 10 !== 0) return fail('ID number checksum invalid');

  return ok();
};

// ─── SA Company Registration (CIPC format: YYYY/NNNNNN/07 or /08 or /23) ───
export const validateCIPCNumber = (regNum: string): ValidationResult => {
  if (!regNum) return fail('Registration number is required');
  const cleaned = regNum.replace(/\s/g, '');
  // Format: YYYY/NNNNNN/NN where NN is entity type code
  if (!/^\d{4}\/\d{6}\/\d{2}$/.test(cleaned)) {
    return fail('Format: YYYY/NNNNNN/07 (private), /08 (public), /23 (NPC)');
  }
  const [year, , entityCode] = cleaned.split('/');
  const yearNum = parseInt(year, 10);
  const currentYear = new Date().getFullYear();
  if (yearNum < 1900 || yearNum > currentYear) return fail(`Year must be 1900–${currentYear}`);
  const validCodes = ['06', '07', '08', '09', '10', '11', '21', '23', '24', '25', '26'];
  if (!validCodes.includes(entityCode)) {
    return fail(`Entity code ${entityCode} not recognised`);
  }
  return ok();
};

// ─── SA Phone Number ───
export const validateSAPhone = (phone: string): ValidationResult => {
  if (!phone) return fail('Phone number is required');
  const cleaned = phone.replace(/[\s()-]/g, '');
  // Accept: 0XXXXXXXXX, +27XXXXXXXXX, 27XXXXXXXXX
  if (/^0\d{9}$/.test(cleaned)) return ok();
  if (/^\+27\d{9}$/.test(cleaned)) return ok();
  if (/^27\d{9}$/.test(cleaned)) return ok();
  return fail('Format: 0XX XXX XXXX or +27XX XXX XXXX');
};

// ─── Email ───
export const validateEmail = (email: string): ValidationResult => {
  if (!email) return fail('Email is required');
  if (email.length > 254) return fail('Email is too long');
  // RFC 5322 simplified
  const valid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  if (!valid) return fail('Please enter a valid email address');
  return ok();
};

// ─── Password (complexity) ───
export const validatePassword = (password: string): ValidationResult => {
  if (!password) return fail('Password is required');
  if (password.length < 8) return fail('Password must be at least 8 characters');
  if (password.length > 128) return fail('Password is too long');
  // Suggest but don't strictly enforce complexity
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const score = [hasUpper, hasLower, hasDigit].filter(Boolean).length;
  if (score < 2) return fail('Password should mix uppercase, lowercase, and numbers');
  return ok();
};

// ─── Loan term (months) ───
export const validateLoanTerm = (
  term: string | number,
  opts: { min?: number; max?: number } = {}
): ValidationResult => {
  if (term === '' || term === null || term === undefined) return fail('Term is required');
  const num = typeof term === 'string' ? parseInt(term, 10) : term;
  if (isNaN(num)) return fail('Term must be a number');
  if (!Number.isInteger(num)) return fail('Term must be a whole number of months');
  if (num < 1) return fail('Minimum term is 1 month');
  if (opts.min !== undefined && num < opts.min) return fail(`Minimum term is ${opts.min} months`);
  if (opts.max !== undefined && num > opts.max) return fail(`Maximum term is ${opts.max} months`);
  return ok();
};

// ─── Interest rate ───
export const validateInterestRate = (rate: string | number): ValidationResult => {
  if (rate === '' || rate === null || rate === undefined) return fail('Rate is required');
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(num)) return fail('Rate must be a number');
  if (num < 0) return fail('Rate cannot be negative');
  if (num > 200) return fail('Rate exceeds NCA maximum (consult Compliance)');
  return ok();
};

// ─── DSCR ───
export const validateDSCR = (dscr: string | number): ValidationResult => {
  if (dscr === '' || dscr === null || dscr === undefined) return ok(); // Optional
  const num = typeof dscr === 'string' ? parseFloat(dscr) : dscr;
  if (isNaN(num)) return fail('DSCR must be a number');
  if (num < 0) return fail('DSCR cannot be negative');
  if (num > 100) return fail('DSCR seems unrealistic (>100x)');
  return ok();
};

// ─── Bank account number ───
export const validateBankAccount = (acc: string): ValidationResult => {
  if (!acc) return fail('Account number is required');
  const cleaned = acc.replace(/\s/g, '');
  if (!/^\d+$/.test(cleaned)) return fail('Account number must be digits only');
  if (cleaned.length < 6 || cleaned.length > 11) {
    return fail('SA bank account numbers are 6–11 digits');
  }
  return ok();
};

// ─── Composite validator — run multiple validations and collect errors ───
export const validateAll = (
  validations: Array<{ field: string; result: ValidationResult }>
): { valid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  for (const { field, result } of validations) {
    if (!result.valid && result.error) {
      errors[field] = result.error;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
};

// ─── XSS-safe text sanitizer ───
// Use this BEFORE storing user-supplied text that will be rendered as HTML
export const sanitiseText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
