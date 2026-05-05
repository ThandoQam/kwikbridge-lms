/**
 * SkipLinks — accessibility helper that lets keyboard users jump
 * past the chrome (header/sidebar) directly to the main content.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 375 of kwikbridge-lms-v2.jsx.
 *
 * The visual styling (hidden until focused) is in the global CSS
 * via the .kb-skip-link class. Render this at the top of your
 * app layout, just before <main>.
 */
import React from 'react';

export function SkipLinks() {
  return (
    <a href="#kb-main-content" className="kb-skip-link">
      Skip to main content
    </a>
  );
}
