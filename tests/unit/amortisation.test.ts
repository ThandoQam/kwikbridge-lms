/**
 * Unit tests for amortisation engine.
 * Critical for fintech: incorrect schedule = wrong borrower repayment = legal risk.
 */
import { describe, it, expect } from 'vitest';
import { generateSchedule } from '../../src/lib/amortisation';

describe('generateSchedule', () => {
  it('generates a 12-month amortising schedule with correct totals', () => {
    const result = generateSchedule({
      principal: 100000,
      annualRate: 12,
      termMonths: 12,
      method: 'reducing_balance',
      frequency: 'monthly',
      repaymentType: 'Amortising',
    });
    expect(result.schedule).toHaveLength(12);
    // Sum of principal payments should equal original principal (within R1)
    const totalPrincipal = result.schedule.reduce((s, r) => s + r.principal, 0);
    expect(Math.round(totalPrincipal)).toBe(100000);
    // Closing balance of last period should be 0 (within rounding)
    expect(Math.abs(result.schedule[11].closing)).toBeLessThan(1);
    // Total interest should be > 0 and reasonable
    expect(result.summary.totalInterest).toBeGreaterThan(5000);
    expect(result.summary.totalInterest).toBeLessThan(8000);
  });

  it('handles zero-interest loan correctly', () => {
    const result = generateSchedule({
      principal: 60000,
      annualRate: 0,
      termMonths: 6,
      repaymentType: 'Amortising',
    });
    expect(result.summary.totalInterest).toBe(0);
    expect(Math.round(result.schedule[0].payment)).toBe(10000);
  });

  it('bullet loan keeps principal at end', () => {
    const result = generateSchedule({
      principal: 100000,
      annualRate: 24,
      termMonths: 6,
      repaymentType: 'Bullet',
    });
    // Bullet: pay only interest until maturity, full principal at end
    const interestPayments = result.schedule.slice(0, -1);
    interestPayments.forEach((row) => {
      expect(row.principal).toBe(0);
      expect(row.interest).toBeGreaterThan(0);
    });
    // Last row pays full principal
    expect(Math.round(result.schedule[result.schedule.length - 1].principal)).toBe(100000);
  });

  it('rejects negative principal', () => {
    expect(() =>
      generateSchedule({
        principal: -1000,
        annualRate: 10,
        termMonths: 12,
      })
    ).toThrow();
  });

  it('rejects negative interest rate', () => {
    expect(() =>
      generateSchedule({
        principal: 100000,
        annualRate: -5,
        termMonths: 12,
      })
    ).toThrow();
  });

  it('rejects zero or negative term', () => {
    expect(() =>
      generateSchedule({
        principal: 100000,
        annualRate: 10,
        termMonths: 0,
      })
    ).toThrow();
  });

  it('handles grace period correctly', () => {
    const result = generateSchedule({
      principal: 100000,
      annualRate: 12,
      termMonths: 12,
      gracePeriodMonths: 3,
      repaymentType: 'Amortising',
    });
    // First 3 periods should have no principal payment
    expect(result.schedule[0].principal).toBe(0);
    expect(result.schedule[1].principal).toBe(0);
    expect(result.schedule[2].principal).toBe(0);
    // Period 4 onwards has principal
    expect(result.schedule[3].principal).toBeGreaterThan(0);
  });
});
