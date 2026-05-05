/**
 * catalogue-bootstrap.jsx — entry point for the component catalogue.
 *
 * Loaded only when ?catalogue is in the URL. Imports REAL production
 * UI primitives from src/components/ui/ and renders the catalogue.
 * Lazy-loaded so it doesn't bloat the main bundle.
 *
 * Now uses production primitives (was test stubs before UI Primitives
 * sprint Step 2). The catalogue is a true design-system reference.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ComponentCatalogue } from './features/catalogue'
import {
  Btn, Badge, Field, Input, Textarea, Select,
  KPI, SectionCard, ProgressBar, Tab, Table, InfoGrid,
  Modal, statusBadge,
  C, T, I,
} from './components/ui'
import { fmt, cell } from './lib/format'

export function renderCatalogue() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ComponentCatalogue />
    </React.StrictMode>
  )
}
