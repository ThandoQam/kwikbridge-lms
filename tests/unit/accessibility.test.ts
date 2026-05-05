/**
 * Unit tests for accessibility utilities.
 *
 * WCAG 2.1 AA compliance is non-optional for a regulated SA financial
 * service: users with visual impairments need screen reader support,
 * keyboard-only users need focus management, and the colour palette
 * must meet contrast ratios. These pure helper functions are the
 * foundation of the app's a11y compliance — bugs here propagate to
 * every UI primitive.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseHex,
  relativeLuminance,
  contrastRatio,
  meetsWcagAA,
  ariaButton,
  ariaDialog,
  ariaTab,
  ariaTablist,
  ariaTabpanel,
  ariaTable,
  fieldAria,
  matchShortcut,
} from '../../src/lib/accessibility';

// ═══ parseHex ═══

describe('parseHex', () => {
  it('parses 6-digit hex with hash', () => {
    expect(parseHex('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses 6-digit hex without hash', () => {
    expect(parseHex('00FF00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses 3-digit hex by doubling each char', () => {
    expect(parseHex('#F00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#0AB')).toEqual({ r: 0, g: 170, b: 187 });
  });

  it('returns null for invalid hex', () => {
    expect(parseHex('#GGGGGG')).toBeNull();
    expect(parseHex('not-a-colour')).toBeNull();
    expect(parseHex('#FF')).toBeNull();
    expect(parseHex('')).toBeNull();
  });

  it('handles lowercase hex', () => {
    expect(parseHex('#ff00ff')).toEqual({ r: 255, g: 0, b: 255 });
  });
});

// ═══ relativeLuminance ═══

describe('relativeLuminance', () => {
  it('white (255,255,255) → 1.0', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 4);
  });

  it('black (0,0,0) → 0.0', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0.0, 4);
  });

  it('mid-grey is between black and white', () => {
    const mid = relativeLuminance(128, 128, 128);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

// ═══ contrastRatio ═══

describe('contrastRatio', () => {
  it('white on black → 21:1 (maximum)', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  });

  it('same colour → 1:1 (minimum)', () => {
    expect(contrastRatio('#FF0000', '#FF0000')).toBeCloseTo(1, 4);
  });

  it('is symmetric (A vs B = B vs A)', () => {
    const ab = contrastRatio('#1A2B3C', '#FEDCBA');
    const ba = contrastRatio('#FEDCBA', '#1A2B3C');
    expect(ab).toBeCloseTo(ba, 4);
  });

  it('returns 1 for invalid input (no crash)', () => {
    expect(contrastRatio('not-a-colour', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#FFFFFF', 'invalid')).toBe(1);
  });

  it('typical KwikBridge text on background passes inspection', () => {
    // C.text on C.surface should comfortably exceed 4.5
    const ratio = contrastRatio('#1A1A1A', '#FFFFFF');
    expect(ratio).toBeGreaterThan(15);
  });
});

// ═══ meetsWcagAA ═══

describe('meetsWcagAA', () => {
  it('passes normal text at 4.5:1', () => {
    // contrast ratio 4.54
    expect(meetsWcagAA('#767676', '#FFFFFF', 'normal')).toBe(true);
  });

  it('fails normal text below 4.5:1', () => {
    // contrast ratio ~2.85
    expect(meetsWcagAA('#999999', '#FFFFFF', 'normal')).toBe(false);
  });

  it('passes large text at 3.0:1 with mid-tone grey', () => {
    // #888 on white ≈ 3.54, passes large/ui but not normal
    expect(meetsWcagAA('#888888', '#FFFFFF', 'large')).toBe(true);
    expect(meetsWcagAA('#888888', '#FFFFFF', 'normal')).toBe(false);
  });

  it('passes UI components at 3.0:1 threshold', () => {
    expect(meetsWcagAA('#888888', '#FFFFFF', 'ui')).toBe(true);
  });

  it('white on white fails all sizes', () => {
    expect(meetsWcagAA('#FFFFFF', '#FFFFFF', 'normal')).toBe(false);
    expect(meetsWcagAA('#FFFFFF', '#FFFFFF', 'large')).toBe(false);
    expect(meetsWcagAA('#FFFFFF', '#FFFFFF', 'ui')).toBe(false);
  });
});

// ═══ ariaButton ═══

describe('ariaButton', () => {
  it('returns empty object for no opts', () => {
    expect(ariaButton({})).toEqual({});
  });

  it('includes aria-label when provided', () => {
    expect(ariaButton({ label: 'Close dialog' })).toEqual({
      'aria-label': 'Close dialog',
    });
  });

  it('handles toggle button state', () => {
    const result = ariaButton({ pressed: true, label: 'Bold' });
    expect(result['aria-pressed']).toBe('true');
    expect(result['aria-label']).toBe('Bold');
  });

  it('handles expanded state for disclosure widgets', () => {
    expect(ariaButton({ expanded: false })['aria-expanded']).toBe('false');
    expect(ariaButton({ expanded: true })['aria-expanded']).toBe('true');
  });

  it('includes aria-disabled when disabled', () => {
    expect(ariaButton({ disabled: true })['aria-disabled']).toBe('true');
  });

  it('combines all states correctly', () => {
    const result = ariaButton({
      label: 'Submit',
      pressed: false,
      controls: 'panel-1',
      describedBy: 'help-1',
    });
    expect(result).toEqual({
      'aria-label': 'Submit',
      'aria-pressed': 'false',
      'aria-controls': 'panel-1',
      'aria-describedby': 'help-1',
    });
  });
});

// ═══ ariaDialog ═══

describe('ariaDialog', () => {
  it('returns role and aria-modal', () => {
    const result = ariaDialog('title-1');
    expect(result.role).toBe('dialog');
    expect(result['aria-modal']).toBe('true');
    expect(result['aria-labelledby']).toBe('title-1');
  });

  it('includes describedBy when provided', () => {
    const result = ariaDialog('title-1', 'desc-1');
    expect(result['aria-describedby']).toBe('desc-1');
  });

  it('omits describedBy when not provided', () => {
    const result = ariaDialog('title-1');
    expect(result['aria-describedby']).toBeUndefined();
  });
});

// ═══ ariaTab / ariaTablist / ariaTabpanel ═══

describe('ariaTab', () => {
  it('selected tab gets tabIndex 0 and aria-selected true', () => {
    const result = ariaTab({ selected: true, controls: 'panel-1', id: 'tab-1' });
    expect(result['aria-selected']).toBe('true');
    expect(result.tabIndex).toBe(0);
    expect(result['aria-controls']).toBe('panel-1');
  });

  it('non-selected tab gets tabIndex -1', () => {
    const result = ariaTab({ selected: false, controls: 'panel-2', id: 'tab-2' });
    expect(result['aria-selected']).toBe('false');
    expect(result.tabIndex).toBe(-1);
  });
});

describe('ariaTablist', () => {
  it('returns role and label', () => {
    expect(ariaTablist('Sections')).toEqual({
      role: 'tablist',
      'aria-label': 'Sections',
    });
  });
});

describe('ariaTabpanel', () => {
  it('returns role and labelling references', () => {
    const result = ariaTabpanel({ id: 'panel-1', labelledBy: 'tab-1' });
    expect(result.role).toBe('tabpanel');
    expect(result.id).toBe('panel-1');
    expect(result['aria-labelledby']).toBe('tab-1');
    expect(result.tabIndex).toBe(0);
  });
});

// ═══ ariaTable ═══

describe('ariaTable', () => {
  it('returns base role', () => {
    expect(ariaTable({}).role).toBe('table');
  });

  it('includes caption as aria-label', () => {
    expect(ariaTable({ caption: 'Loan portfolio' })['aria-label']).toBe('Loan portfolio');
  });

  it('includes row and column counts when provided', () => {
    const result = ariaTable({ rowCount: 50, colCount: 8 });
    expect(result['aria-rowcount']).toBe(50);
    expect(result['aria-colcount']).toBe(8);
  });
});

// ═══ fieldAria ═══

describe('fieldAria', () => {
  it('returns id only when no other props', () => {
    const result = fieldAria({ id: 'field-1' });
    expect(result.id).toBe('field-1');
    expect(result['aria-invalid']).toBeUndefined();
    expect(result['aria-required']).toBeUndefined();
    expect(result['aria-describedby']).toBeUndefined();
  });

  it('marks required fields', () => {
    expect(fieldAria({ id: 'f', required: true })['aria-required']).toBe('true');
  });

  it('marks invalid fields', () => {
    expect(fieldAria({ id: 'f', invalid: true })['aria-invalid']).toBe('true');
  });

  it('combines error and help into aria-describedby', () => {
    const result = fieldAria({ id: 'f', errorId: 'err-f', helpId: 'help-f' });
    expect(result['aria-describedby']).toBe('err-f help-f');
  });

  it('uses error alone when no help', () => {
    expect(fieldAria({ id: 'f', errorId: 'err-f' })['aria-describedby']).toBe('err-f');
  });
});

// ═══ matchShortcut ═══

describe('matchShortcut', () => {
  const buildEvent = (overrides: Partial<KeyboardEvent>): KeyboardEvent =>
    ({
      key: '',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...overrides,
    } as KeyboardEvent);

  it('matches plain key', () => {
    expect(matchShortcut(buildEvent({ key: 'Escape' }), 'escape')).toBe(true);
  });

  it('does not match plain key when modifier pressed', () => {
    expect(matchShortcut(buildEvent({ key: 'Escape', ctrlKey: true }), 'escape')).toBe(false);
  });

  it('matches Ctrl+K shortcut', () => {
    const event = buildEvent({ key: 'k', ctrlKey: true });
    expect(matchShortcut(event, 'mod+k')).toBe(true);
  });

  it('case-insensitive on key', () => {
    expect(matchShortcut(buildEvent({ key: 'K', ctrlKey: true }), 'mod+k')).toBe(true);
  });

  it('matches Shift+? for help', () => {
    expect(matchShortcut(buildEvent({ key: '?', shiftKey: true }), 'shift+?')).toBe(true);
  });

  it('does not match when shift expected but missing', () => {
    expect(matchShortcut(buildEvent({ key: '?' }), 'shift+?')).toBe(false);
  });

  it('does not match different key', () => {
    expect(matchShortcut(buildEvent({ key: 'a', ctrlKey: true }), 'mod+k')).toBe(false);
  });
});
