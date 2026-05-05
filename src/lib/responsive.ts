/**
 * Responsive design helpers — hooks and utilities for mobile-first
 * UI rendering without rewriting components.
 *
 * Usage:
 *   const { isMobile, isTablet, isDesktop } = useResponsive();
 *   const cols = isMobile ? 1 : isTablet ? 2 : 4;
 */

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;

export interface Responsive {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const getResponsive = (): Responsive => {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800, isMobile: false, isTablet: false, isDesktop: true };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    isMobile: width < MOBILE_BREAKPOINT,
    isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
    isDesktop: width >= TABLET_BREAKPOINT,
  };
};

export const useResponsive = (): Responsive => {
  const [state, setState] = useState<Responsive>(getResponsive);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      // Debounce — 100ms after resize stops
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setState(getResponsive()), 100);
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return state;
};

// Helper for responsive grid columns
export const gridCols = (
  responsive: Responsive,
  opts: { mobile?: number; tablet?: number; desktop?: number } = {}
): string => {
  const m = opts.mobile ?? 1;
  const t = opts.tablet ?? 2;
  const d = opts.desktop ?? 4;
  const n = responsive.isMobile ? m : responsive.isTablet ? t : d;
  return `repeat(${n}, 1fr)`;
};
