/**
 * catalogue-bootstrap.jsx — entry point for the component catalogue.
 *
 * Loaded only when ?catalogue is in the URL. Imports the UI stubs from
 * tests/component (which mirror production UI primitives semantically)
 * and renders the catalogue. Lazy-loaded so it doesn't bloat the main
 * bundle.
 *
 * Future enhancement: extract production UI primitives from the
 * monolith into src/components/ui/ so this can use the real ones.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ComponentCatalogue } from './features/catalogue'

// Production UI primitives are still inside the monolith. For now the
// catalogue uses the same semantic stubs the component tests use.
// When the primitives are extracted to src/components/ui/, swap these
// imports for the production ones.
import {
  Btn, Badge, Field, Input, Textarea, Select,
  KPI, SectionCard, ProgressBar, Tab, Table, InfoGrid,
  I, C, fmt, statusBadge,
} from '../tests/component/ui-stubs'

// Minimal Modal stub (not in ui-stubs)
const Modal = ({ open, onClose, title, width = 480, children }) =>
  open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          padding: 24,
          width,
          maxWidth: 'calc(100vw - 32px)',
          border: '1px solid #e5e7eb',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>{title}</h2>
        {children}
      </div>
    </div>
  ) : null

// Minimal cell formatter
const cell = {
  id: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>,
  name: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
  text: (v) => <span>{v}</span>,
  money: (v) => <span style={{ fontFamily: 'monospace' }}>{typeof v === 'number' ? fmt.cur(v) : v}</span>,
  date: (v) => <span style={{ color: C.textDim }}>{v ? fmt.date(v) : '—'}</span>,
  pct: (v) => <span style={{ fontFamily: 'monospace' }}>{typeof v === 'number' ? v.toFixed(1) + '%' : v}</span>,
  count: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
  badge: (v) => <span>{v || '—'}</span>,
  dim: (v) => <span style={{ color: C.textMuted }}>{v || '—'}</span>,
  mono: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
}

export function renderCatalogue() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ComponentCatalogue
        Btn={Btn}
        Badge={Badge}
        Field={Field}
        Input={Input}
        Textarea={Textarea}
        Select={Select}
        KPI={KPI}
        SectionCard={SectionCard}
        ProgressBar={ProgressBar}
        Tab={Tab}
        Table={Table}
        InfoGrid={InfoGrid}
        Modal={Modal}
        cell={cell}
        I={I}
        C={C}
        fmt={fmt}
        statusBadge={statusBadge}
      />
    </React.StrictMode>
  )
}
