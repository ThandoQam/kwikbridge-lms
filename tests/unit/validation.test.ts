import { describe, it, expect } from 'vitest';
import {
  validateSAIDNumber,
  validateCIPCNumber,
  validateSAPhone,
  validateEmail,
  validateCurrency,
  validatePassword,
  validateLoanTerm,
  validateInterestRate,
} from '../../src/lib/validation';

describe('validateSAIDNumber', () => {
  it('accepts a valid SA ID with correct Luhn checksum', () => {
    // 8001015009087 — valid test ID (DOB 1980-01-01)
    const r = validateSAIDNumber('8001015009087');
    expect(r.valid).toBe(true);
  });

  it('rejects ID with wrong length', () => {
    expect(validateSAIDNumber('123').valid).toBe(false);
    expect(validateSAIDNumber('12345678901234').valid).toBe(false);
  });

  it('rejects ID with non-digit characters', () => {
    expect(validateSAIDNumber('800101A009087').valid).toBe(false);
  });

  it('rejects ID with invalid month', () => {
    expect(validateSAIDNumber('8013015009087').valid).toBe(false);
  });

  it('rejects ID with invalid day', () => {
    expect(validateSAIDNumber('8001325009087').valid).toBe(false);
  });

  it('rejects empty input with required error', () => {
    const r = validateSAIDNumber('');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('required');
  });
});

describe('validateCIPCNumber', () => {
  it('accepts a valid private company registration', () => {
    expect(validateCIPCNumber('2017/313869/07').valid).toBe(true);
  });

  it('accepts valid public company /08', () => {
    expect(validateCIPCNumber('2020/123456/08').valid).toBe(true);
  });

  it('rejects wrong format', () => {
    expect(validateCIPCNumber('2017-313869-07').valid).toBe(false);
    expect(validateCIPCNumber('2017/31386/07').valid).toBe(false);
  });

  it('rejects future year', () => {
    const future = new Date().getFullYear() + 5;
    expect(validateCIPCNumber(`${future}/123456/07`).valid).toBe(false);
  });
});

describe('validateSAPhone', () => {
  it('accepts 0XX XXX XXXX format', () => {
    expect(validateSAPhone('0711234567').valid).toBe(true);
    expect(validateSAPhone('071 123 4567').valid).toBe(true);
  });

  it('accepts +27 international format', () => {
    expect(validateSAPhone('+27711234567').valid).toBe(true);
  });

  it('rejects too short', () => {
    expect(validateSAPhone('071123').valid).toBe(false);
  });
});

describe('validateEmail', () => {
  it('accepts standard email', () => {
    expect(validateEmail('user@example.co.za').valid).toBe(true);
  });

  it('rejects missing @', () => {
    expect(validateEmail('userexample.com').valid).toBe(false);
  });

  it('rejects missing TLD', () => {
    expect(validateEmail('user@example').valid).toBe(false);
  });

  it('rejects very long emails', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(validateEmail(long).valid).toBe(false);
  });
});

describe('validateCurrency', () => {
  it('accepts positive numbers', () => {
    expect(validateCurrency(50000).valid).toBe(true);
    expect(validateCurrency('50000').valid).toBe(true);
    expect(validateCurrency('R 50,000').valid).toBe(true);
  });

  it('rejects negative', () => {
    expect(validateCurrency(-1000).valid).toBe(false);
  });

  it('enforces min and max', () => {
    expect(validateCurrency(500, { min: 1000 }).valid).toBe(false);
    expect(validateCurrency(2000000, { max: 1000000 }).valid).toBe(false);
    expect(validateCurrency(50000, { min: 1000, max: 100000 }).valid).toBe(true);
  });

  it('treats empty as optional unless required', () => {
    expect(validateCurrency('', { required: false }).valid).toBe(true);
    expect(validateCurrency('', { required: true }).valid).toBe(false);
  });
});

describe('validatePassword', () => {
  it('rejects passwords under 8 characters', () => {
    expect(validatePassword('Pass1').valid).toBe(false);
  });

  it('requires complexity (mix of types)', () => {
    expect(validatePassword('alllowercase').valid).toBe(false);
    expect(validatePassword('11111111').valid).toBe(false);
  });

  it('accepts strong passwords', () => {
    expect(validatePassword('Pass1234').valid).toBe(true);
    expect(validatePassword('MySecure123').valid).toBe(true);
  });
});

describe('validateLoanTerm', () => {
  it('accepts whole month numbers', () => {
    expect(validateLoanTerm(12).valid).toBe(true);
    expect(validateLoanTerm('36').valid).toBe(true);
  });

  it('rejects fractional months', () => {
    expect(validateLoanTerm(12.5).valid).toBe(false);
  });

  it('enforces min/max term', () => {
    expect(validateLoanTerm(2, { min: 6 }).valid).toBe(false);
    expect(validateLoanTerm(120, { max: 60 }).valid).toBe(false);
  });
});

describe('validateInterestRate', () => {
  it('accepts reasonable rates', () => {
    expect(validateInterestRate(14.5).valid).toBe(true);
    expect(validateInterestRate(42).valid).toBe(true);
  });

  it('rejects negative rates', () => {
    expect(validateInterestRate(-5).valid).toBe(false);
  });

  it('warns on extreme rates above NCA cap', () => {
    expect(validateInterestRate(250).valid).toBe(false);
  });
});
