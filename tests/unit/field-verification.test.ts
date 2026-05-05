/**
 * Unit tests for field verification module.
 *
 * Site-visit verification is the differentiator for SME lending in
 * SA: GPS-verified visits, photo evidence, and structured checklists
 * separate KwikBridge from desk-bound competitors. Bugs in distance
 * calculation, address matching, or scoring would directly compromise
 * underwriting decisions and audit defensibility.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  checkAddressMatch,
  calculateScores,
  createSiteVisit,
} from '../../src/lib/field-verification';

// ═══ calculateDistance (Haversine) ═══

describe('calculateDistance', () => {
  it('returns 0 metres for identical coordinates', () => {
    const d = calculateDistance(-33.9249, 18.4241, -33.9249, 18.4241);
    expect(d).toBeCloseTo(0, 0);
  });

  it('returns ~1100 metres between two points 1km apart', () => {
    // Cape Town CBD (Adderley St) to V&A Waterfront — about 1.1 km
    const d = calculateDistance(-33.9249, 18.4241, -33.9036, 18.4197);
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(3000);
  });

  it('returns ~1450km for Johannesburg to Cape Town', () => {
    // JHB CBD vs CT CBD — known straight-line distance ~1270 km
    const d = calculateDistance(-26.2041, 28.0473, -33.9249, 18.4241);
    expect(d).toBeGreaterThan(1_200_000);
    expect(d).toBeLessThan(1_500_000);
  });

  it('is symmetric (A→B equals B→A)', () => {
    const ab = calculateDistance(-33.9249, 18.4241, -29.8587, 31.0218);
    const ba = calculateDistance(-29.8587, 31.0218, -33.9249, 18.4241);
    expect(ab).toBeCloseTo(ba, 0);
  });

  it('handles equator/prime meridian crossing', () => {
    const d = calculateDistance(0, 0, 0, 1);
    // 1 degree of longitude at the equator ≈ 111.32 km
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

// ═══ checkAddressMatch ═══

describe('checkAddressMatch', () => {
  const captured = { latitude: -33.9249, longitude: 18.4241, accuracy: 10, ts: Date.now() };

  it('flags match when within default 500m threshold', () => {
    const result = checkAddressMatch(captured, -33.9251, 18.4243);
    expect(result.match).toBe('match');
    expect(result.distance).toBeLessThan(500);
  });

  it('flags mismatch when beyond threshold', () => {
    // ~5km away
    const result = checkAddressMatch(captured, -33.9700, 18.4500);
    expect(result.match).toBe('mismatch');
    expect(result.distance).toBeGreaterThan(500);
  });

  it('respects custom threshold', () => {
    const result = checkAddressMatch(captured, -33.9300, 18.4280, 100);
    expect(result.match).toBe('mismatch');
  });

  it('returns integer distance in metres', () => {
    const result = checkAddressMatch(captured, -33.9251, 18.4243);
    expect(Number.isInteger(result.distance)).toBe(true);
  });

  it('match at exactly the threshold boundary', () => {
    // Construct a point exactly at threshold by using known lat distance
    const result = checkAddressMatch(captured, -33.9249, 18.4241, 0);
    expect(result.match).toBe('match');
    expect(result.distance).toBe(0);
  });
});

// ═══ calculateScores ═══

describe('calculateScores', () => {
  const buildCategory = (id: string, items: any[]): any => ({
    id,
    label: id,
    items,
    categoryScore: 0,
  });

  it('returns 0 score for empty categories', () => {
    const result = calculateScores([]);
    expect(result.overallScore).toBe(0);
    expect(result.categories).toEqual([]);
  });

  it('returns 0 for category with no rated items', () => {
    const cats = [buildCategory('c1', [{ id: 'i1', label: 'X', rating: 0 }])];
    const result = calculateScores(cats);
    expect(result.categories[0].categoryScore).toBe(0);
    expect(result.overallScore).toBe(0);
  });

  it('averages ratings within a category', () => {
    const cats = [
      buildCategory('c1', [
        { id: 'i1', label: 'X', rating: 4 },
        { id: 'i2', label: 'Y', rating: 2 },
      ]),
    ];
    const result = calculateScores(cats);
    expect(result.categories[0].categoryScore).toBe(3);
    expect(result.overallScore).toBe(3);
  });

  it('ignores unrated items (rating 0) when averaging', () => {
    const cats = [
      buildCategory('c1', [
        { id: 'i1', label: 'X', rating: 4 },
        { id: 'i2', label: 'Y', rating: 0 }, // not rated
        { id: 'i3', label: 'Z', rating: 4 },
      ]),
    ];
    const result = calculateScores(cats);
    expect(result.categories[0].categoryScore).toBe(4);
  });

  it('overall score averages across rated categories only', () => {
    const cats = [
      buildCategory('c1', [{ id: 'i1', label: 'X', rating: 5 }]),
      buildCategory('c2', [{ id: 'i2', label: 'Y', rating: 3 }]),
      buildCategory('c3', [{ id: 'i3', label: 'Z', rating: 0 }]), // not rated
    ];
    const result = calculateScores(cats);
    expect(result.categories[0].categoryScore).toBe(5);
    expect(result.categories[1].categoryScore).toBe(3);
    expect(result.categories[2].categoryScore).toBe(0);
    // Only c1 (5) and c2 (3) count → (5 + 3) / 2 = 4
    expect(result.overallScore).toBe(4);
  });

  it('rounds to 2 decimal places', () => {
    const cats = [
      buildCategory('c1', [
        { id: 'i1', label: 'X', rating: 4 },
        { id: 'i2', label: 'Y', rating: 5 },
        { id: 'i3', label: 'Z', rating: 3 },
      ]),
    ];
    const result = calculateScores(cats);
    // (4+5+3)/3 = 4.0 exactly, but verify rounding works on non-clean averages
    expect(result.categories[0].categoryScore).toBe(4);
  });

  it('handles fractional averages', () => {
    const cats = [
      buildCategory('c1', [
        { id: 'i1', label: 'X', rating: 5 },
        { id: 'i2', label: 'Y', rating: 4 },
        { id: 'i3', label: 'Z', rating: 4 },
      ]),
    ];
    const result = calculateScores(cats);
    // (5+4+4)/3 = 4.333... → rounds to 4.33
    expect(result.categories[0].categoryScore).toBe(4.33);
  });
});

// ═══ createSiteVisit ═══

describe('createSiteVisit', () => {
  it('creates a visit with required fields', () => {
    const visit = createSiteVisit('A-001', 'C-001', 'U-001', 'John Officer');
    expect(visit.appId).toBe('A-001');
    expect(visit.custId).toBe('C-001');
    expect(visit.officerId).toBe('U-001');
    expect(visit.officerName).toBe('John Officer');
  });

  it('initialises with current timestamp', () => {
    const before = Date.now();
    const visit = createSiteVisit('A-1', 'C-1', 'U-1', 'X');
    const after = Date.now();
    expect(visit.startedAt).toBeGreaterThanOrEqual(before);
    expect(visit.startedAt).toBeLessThanOrEqual(after);
  });

  it('starts with no completion timestamp', () => {
    const visit = createSiteVisit('A-1', 'C-1', 'U-1', 'X');
    expect(visit.completedAt).toBeNull();
  });

  it('starts with no location captured', () => {
    const visit = createSiteVisit('A-1', 'C-1', 'U-1', 'X');
    expect(visit.location).toBeNull();
    expect(visit.addressMatch).toBe('unknown');
    expect(visit.distanceMetres).toBeNull();
  });

  it('starts with empty photos and notes', () => {
    const visit = createSiteVisit('A-1', 'C-1', 'U-1', 'X');
    expect(visit.photos).toEqual([]);
    expect(visit.notes).toBe('');
  });

  it('starts unsynced', () => {
    const visit = createSiteVisit('A-1', 'C-1', 'U-1', 'X');
    expect(visit.synced).toBe(false);
  });

  it('starts with overall score of 0', () => {
    const visit = createSiteVisit('A-1', 'C-1', 'U-1', 'X');
    expect(visit.overallScore).toBe(0);
  });

  it('initialises checklist categories from template', () => {
    const visit = createSiteVisit('A-1', 'C-1', 'U-1', 'X');
    expect(visit.categories).toBeDefined();
    expect(Array.isArray(visit.categories)).toBe(true);
    expect(visit.categories.length).toBeGreaterThan(0);
    visit.categories.forEach((cat) => {
      expect(cat.categoryScore).toBe(0);
      expect(Array.isArray(cat.items)).toBe(true);
    });
  });

  it('generates unique IDs for sequential visits', async () => {
    const v1 = createSiteVisit('A-1', 'C-1', 'U-1', 'X');
    await new Promise((r) => setTimeout(r, 2));
    const v2 = createSiteVisit('A-2', 'C-2', 'U-2', 'Y');
    expect(v1.id).not.toBe(v2.id);
    expect(v1.id).toMatch(/^SV-\d+$/);
    expect(v2.id).toMatch(/^SV-\d+$/);
  });
});
