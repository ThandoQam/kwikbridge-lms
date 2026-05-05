/**
 * UI primitives — single import point for all design-system components.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 *
 * Usage:
 *   import { Btn, Field, Input, KPI, C, I, T } from '@/components/ui';
 *
 * Or for the conventional barrel:
 *   import { Btn, KPI, statusBadge } from '../../components/ui';
 *
 * Components:
 *   Form: Field, Input, Textarea, Select
 *   Display: Btn, Badge, KPI, Table, InfoGrid, ProgressBar
 *   Layout: SectionCard, Tab
 *   Feedback: Modal, EmptyState
 *   Navigation: SkipLinks, StepTracker
 *
 * Helpers:
 *   statusBadge(status) — maps status string to coloured Badge
 *
 * Tokens:
 *   C — colour palette
 *   T — typography scale, spacing, radius, shadows
 *   I — SVG icon glyphs
 */
export { Badge, statusBadge } from './Badge';
export { Btn } from './Btn';
export { EmptyState } from './EmptyState';
export { Field } from './Field';
export { InfoGrid } from './InfoGrid';
export { Input } from './Input';
export { KPI } from './KPI';
export { Modal } from './Modal';
export { ProgressBar } from './ProgressBar';
export { SectionCard } from './SectionCard';
export { Select } from './Select';
export { SkipLinks } from './SkipLinks';
export { StepTracker } from './StepTracker';
export { Tab } from './Tab';
export { Table } from './Table';
export { Textarea } from './Textarea';

// Tokens
export { C, T, I } from './tokens';
export type { ColorToken } from './tokens/colors';
