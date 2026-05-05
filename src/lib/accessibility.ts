/**
 * Accessibility utilities — WCAG 2.1 AA compliance helpers.
 *
 * Pure functions for ARIA generation, contrast checking, and focus
 * management. All UI primitives consume these to ensure screen-reader
 * support, keyboard navigation, and visual contrast meet WCAG AA.
 *
 * Standards reference:
 *   - WCAG 2.1 AA: https://www.w3.org/TR/WCAG21/
 *   - ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
 *   - SA POPIA accessibility provisions
 */

// ═══ Contrast Ratio (WCAG 2.1 1.4.3) ═══

/**
 * Parse hex colour into RGB components.
 * Accepts "#RGB", "#RRGGBB", or "RRGGBB" formats.
 */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

/**
 * Compute relative luminance per WCAG formula.
 * sRGB → linear → weighted sum.
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const norm = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * norm(r) + 0.7152 * norm(g) + 0.0722 * norm(b);
}

/**
 * Compute WCAG contrast ratio between two hex colours.
 * Returns ratio in [1, 21]. WCAG AA requires:
 *   - Normal text: ≥ 4.5
 *   - Large text (18pt+, or 14pt+ bold): ≥ 3.0
 *   - UI components and graphical objects: ≥ 3.0
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const c1 = parseHex(hex1);
  const c2 = parseHex(hex2);
  if (!c1 || !c2) return 1;
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG AA pass check.
 *
 * @param size 'normal' (default) requires 4.5; 'large' requires 3.0;
 *             'ui' for icons/borders requires 3.0
 */
export function meetsWcagAA(
  fg: string,
  bg: string,
  size: 'normal' | 'large' | 'ui' = 'normal'
): boolean {
  const ratio = contrastRatio(fg, bg);
  const threshold = size === 'normal' ? 4.5 : 3.0;
  return ratio >= threshold;
}

// ═══ ARIA Helpers ═══

/**
 * Build ARIA props for a labelled button or interactive element.
 * Handles disabled/pressed/expanded states cleanly.
 */
export function ariaButton(opts: {
  label?: string;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  describedBy?: string;
  disabled?: boolean;
}): Record<string, string | boolean | undefined> {
  const props: Record<string, string | boolean | undefined> = {};
  if (opts.label) props['aria-label'] = opts.label;
  if (opts.pressed !== undefined) props['aria-pressed'] = String(opts.pressed);
  if (opts.expanded !== undefined) props['aria-expanded'] = String(opts.expanded);
  if (opts.controls) props['aria-controls'] = opts.controls;
  if (opts.describedBy) props['aria-describedby'] = opts.describedBy;
  if (opts.disabled) props['aria-disabled'] = 'true';
  return props;
}

/**
 * Build ARIA props for a modal dialog.
 * Returns props for the dialog container and a generated title ID.
 */
export function ariaDialog(titleId: string, descId?: string): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
  };
  if (descId) props['aria-describedby'] = descId;
  return props;
}

/**
 * Build ARIA props for a tablist + individual tab.
 */
export function ariaTab(opts: {
  selected: boolean;
  controls: string;
  id: string;
}): Record<string, string | boolean> {
  return {
    role: 'tab',
    'aria-selected': String(opts.selected),
    'aria-controls': opts.controls,
    id: opts.id,
    tabIndex: opts.selected ? 0 : -1,
  } as Record<string, string | boolean>;
}

export function ariaTablist(label: string): Record<string, string> {
  return { role: 'tablist', 'aria-label': label };
}

export function ariaTabpanel(opts: { id: string; labelledBy: string }): Record<string, string | number> {
  return {
    role: 'tabpanel',
    id: opts.id,
    'aria-labelledby': opts.labelledBy,
    tabIndex: 0,
  };
}

/**
 * Build ARIA props for a data table with caption support.
 */
export function ariaTable(opts: {
  caption?: string;
  rowCount?: number;
  colCount?: number;
}): Record<string, string | number | undefined> {
  const props: Record<string, string | number | undefined> = { role: 'table' };
  if (opts.caption) props['aria-label'] = opts.caption;
  if (opts.rowCount !== undefined) props['aria-rowcount'] = opts.rowCount;
  if (opts.colCount !== undefined) props['aria-colcount'] = opts.colCount;
  return props;
}

// ═══ Focus Management ═══

/**
 * Returns a list of focusable element selectors for trap purposes.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Find first and last focusable elements within a container.
 * Used to implement a focus trap inside modals.
 */
export function getFocusableBounds(container: HTMLElement): {
  first: HTMLElement | null;
  last: HTMLElement | null;
} {
  const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const visible = Array.from(focusables).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
  return {
    first: visible[0] || null,
    last: visible[visible.length - 1] || null,
  };
}

/**
 * Handle Tab key for focus trap inside a modal.
 * Wrap-around: Tab from last → first, Shift+Tab from first → last.
 */
export function trapFocus(
  container: HTMLElement,
  event: KeyboardEvent
): void {
  if (event.key !== 'Tab') return;
  const { first, last } = getFocusableBounds(container);
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

// ═══ Live Region Announcements ═══

/**
 * Announce a message to assistive tech via an aria-live region.
 * Creates a visually hidden element if one doesn't already exist.
 *
 * Use 'polite' for non-urgent updates (success messages),
 * 'assertive' for urgent updates (errors, validation failures).
 */
export function announce(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  if (typeof document === 'undefined') return;
  const id = priority === 'polite' ? 'kb-live-polite' : 'kb-live-assertive';
  let region = document.getElementById(id);
  if (!region) {
    region = document.createElement('div');
    region.id = id;
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
    document.body.appendChild(region);
  }
  // Clear and re-set to ensure SR picks up repeated identical messages
  region.textContent = '';
  setTimeout(() => {
    if (region) region.textContent = message;
  }, 50);
}

// ═══ Skip Links (WCAG 2.4.1 Bypass Blocks) ═══

/**
 * Generate skip-link href targets for known landmarks.
 * The actual <a> tag is rendered by the SkipLink component,
 * this just ensures consistent IDs across the app.
 */
export const LANDMARKS = {
  main: 'kb-main-content',
  navigation: 'kb-main-nav',
  search: 'kb-global-search',
} as const;

// ═══ Form Field Association ═══

/**
 * Build props for associating a label with an input.
 * Generates stable IDs and ARIA references for error messages
 * and help text.
 */
export function fieldAria(opts: {
  id: string;
  invalid?: boolean;
  required?: boolean;
  errorId?: string;
  helpId?: string;
}): Record<string, string | boolean | undefined> {
  const describedBy = [opts.errorId, opts.helpId].filter(Boolean).join(' ') || undefined;
  return {
    id: opts.id,
    'aria-invalid': opts.invalid ? 'true' : undefined,
    'aria-required': opts.required ? 'true' : undefined,
    'aria-describedby': describedBy,
  };
}

// ═══ Keyboard Shortcut Helpers ═══

/**
 * Match a KeyboardEvent against a shortcut spec.
 * Spec format: 'mod+k' (where 'mod' = Ctrl on Win/Linux, Cmd on Mac).
 */
export function matchShortcut(
  event: KeyboardEvent,
  spec: string
): boolean {
  const parts = spec.toLowerCase().split('+').map((p) => p.trim());
  const key = parts.pop() || '';
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const wantsMod = parts.includes('mod') || parts.includes('cmd') || parts.includes('ctrl');
  const wantsShift = parts.includes('shift');
  const wantsAlt = parts.includes('alt') || parts.includes('option');

  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  if (wantsMod && !modPressed) return false;
  if (!wantsMod && modPressed) return false;
  if (wantsShift !== event.shiftKey) return false;
  if (wantsAlt !== event.altKey) return false;
  return event.key.toLowerCase() === key;
}
