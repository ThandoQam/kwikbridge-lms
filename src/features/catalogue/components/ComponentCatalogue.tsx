/**
 * ComponentCatalogue — design system reference page.
 *
 * Lightweight alternative to Storybook. Displays every UI primitive
 * with representative usage examples. Lives in the main app build,
 * uses the same components as production, requires no extra
 * dependencies.
 *
 * Access:
 *   - URL: /?catalogue
 *   - Query param routing in main.jsx (or App.jsx)
 *   - Never linked from production navigation
 *
 * Purpose:
 *   - Visual reference for designers and developers
 *   - Test surface for new component variants
 *   - Documents the design system without separate tooling
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';
import { Badge, Btn, C, Field, I, InfoGrid, Input, KPI, Modal, ProgressBar, SectionCard, Select, Tab, Table, Textarea, statusBadge } from '../../../components/ui';
import { cell, fmt } from '../../../lib/format';

export function ComponentCatalogue() {
  const [activeTab, setActiveTab] = useState('buttons');
  const [modalOpen, setModalOpen] = useState(false);
  const [inputDemo, setInputDemo] = useState('');
  const [selectDemo, setSelectDemo] = useState('option1');
  const [textareaDemo, setTextareaDemo] = useState('');

  const SectionTitle = ({ children }: any) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 12px', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>{children}</h3>
  );

  const Demo = ({ label, code, children }: any) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8, fontFamily: 'monospace' }}>{label}</div>
      <div style={{ padding: 16, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 8 }}>{children}</div>
      {code && <pre style={{ margin: 0, padding: 12, background: '#0f1419', color: '#abb2bf', fontSize: 11, borderRadius: 0, overflow: 'auto' }}>{code}</pre>}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', fontFamily: "'Outfit',system-ui,sans-serif", color: C.text, background: C.bg, minHeight: '100vh' }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700 }}>KwikBridge Component Catalogue</h1>
        <p style={{ margin: 0, fontSize: 13, color: C.textDim }}>
          Design system reference. Every UI primitive with representative usage examples and code snippets.
          Access via <code>?catalogue</code> query param.
        </p>
      </header>

      <Tab
        tabs={[
          { key: 'buttons', label: 'Buttons & Actions' },
          { key: 'forms', label: 'Forms & Inputs' },
          { key: 'data', label: 'Data Display' },
          { key: 'feedback', label: 'Feedback & Status' },
          { key: 'layout', label: 'Layout' },
          { key: 'tokens', label: 'Design Tokens' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      <div style={{ marginTop: 24 }}>
        {activeTab === 'buttons' && (
          <>
            <SectionTitle>Button variants</SectionTitle>
            <Demo label="Btn — variants" code={`<Btn>Primary</Btn>\n<Btn variant="ghost">Ghost</Btn>\n<Btn variant="danger">Danger</Btn>`}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Btn>Primary</Btn>
                <Btn variant="ghost">Ghost</Btn>
                <Btn variant="danger">Danger</Btn>
              </div>
            </Demo>
            <Demo label="Btn — sizes" code={`<Btn size="sm">Small</Btn>\n<Btn>Medium (default)</Btn>\n<Btn size="lg">Large</Btn>`}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn size="sm">Small</Btn>
                <Btn>Medium</Btn>
                <Btn size="lg">Large</Btn>
              </div>
            </Demo>
            <Demo label="Btn — with icon" code={`<Btn icon={I.plus}>Add Customer</Btn>\n<Btn icon={I.download} variant="ghost">Export</Btn>`}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Btn icon={I.plus}>Add Customer</Btn>
                <Btn icon={I.download} variant="ghost">Export</Btn>
              </div>
            </Demo>
            <Demo label="Btn — disabled state" code={`<Btn disabled>Cannot click</Btn>`}>
              <Btn disabled>Cannot click</Btn>
            </Demo>
            <Demo label="Badge variants" code={`<Badge color="green">Verified</Badge>\n<Badge color="red">Failed</Badge>\n<Badge color="amber">Pending</Badge>`}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Badge color="green">Verified</Badge>
                <Badge color="red">Failed</Badge>
                <Badge color="amber">Pending</Badge>
                <Badge color="blue">In Review</Badge>
                <Badge color="purple">Approved</Badge>
                <Badge color="slate">Default</Badge>
              </div>
            </Demo>
          </>
        )}

        {activeTab === 'forms' && (
          <>
            <SectionTitle>Form inputs</SectionTitle>
            <Demo label="Input — text" code={`<Field label="Business Name *">\n  <Input value={...} onChange={...} placeholder="..." />\n</Field>`}>
              <Field label="Business Name *">
                <Input value={inputDemo} onChange={(e: any) => setInputDemo(e.target.value)} placeholder="e.g. Acme (Pty) Ltd" />
              </Field>
            </Demo>
            <Demo label="Field — with hint" code={`<Field label="Email" hint="We'll never share your email" />`}>
              <Field label="Email" hint="We'll never share your email">
                <Input type="email" placeholder="user@example.com" />
              </Field>
            </Demo>
            <Demo label="Field — with error" code={`<Field label="ID Number" error="Invalid SA ID" />`}>
              <Field label="ID Number *" error="Invalid SA ID number">
                <Input value="123" />
              </Field>
            </Demo>
            <Demo label="Select" code={`<Select value={...} onChange={...} options={[...]} />`}>
              <Field label="Industry">
                <Select
                  value={selectDemo}
                  onChange={(e: any) => setSelectDemo(e.target.value)}
                  options={[
                    { value: 'option1', label: 'Manufacturing' },
                    { value: 'option2', label: 'Retail' },
                    { value: 'option3', label: 'Agriculture' },
                  ]}
                />
              </Field>
            </Demo>
            <Demo label="Textarea" code={`<Textarea value={...} onChange={...} rows={3} />`}>
              <Field label="Purpose">
                <Textarea
                  value={textareaDemo}
                  onChange={(e: any) => setTextareaDemo(e.target.value)}
                  rows={3}
                  placeholder="Describe how funds will be used..."
                />
              </Field>
            </Demo>
          </>
        )}

        {activeTab === 'data' && (
          <>
            <SectionTitle>Data display components</SectionTitle>
            <Demo label="KPI card">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <KPI label="Total Loan Book" value={fmt.cur(125_000_000)} sub="42 active loans" trend="up" />
                <KPI label="ECL Provision" value={fmt.cur(3_750_000)} sub="IFRS 9" />
                <KPI label="Arrears" value={fmt.cur(8_500_000)} sub="7 accounts" alert={true} trend="down" />
                <KPI label="Pipeline" value={fmt.cur(45_000_000)} sub="12 pending" />
              </div>
            </Demo>
            <Demo label="Table">
              <Table
                columns={[
                  { label: 'ID', key: 'id' },
                  { label: 'Customer', render: (r: any) => cell.name(r.name) },
                  { label: 'Amount', render: (r: any) => cell.money(r.amount) },
                  { label: 'Status', render: (r: any) => <Badge color={r.status === 'Active' ? 'green' : 'amber'}>{r.status}</Badge> },
                ]}
                rows={[
                  { id: 'L-001', name: 'Acme Trading', amount: 500_000, status: 'Active' },
                  { id: 'L-002', name: 'Bright Co-op', amount: 250_000, status: 'Active' },
                  { id: 'L-003', name: 'Caspian Pty', amount: 1_200_000, status: 'Pending' },
                ]}
              />
            </Demo>
            <Demo label="Table — empty state">
              <Table
                columns={[{ label: 'ID' }, { label: 'Customer' }]}
                rows={[]}
                emptyMsg="No applications yet — start by clicking 'New Application'"
              />
            </Demo>
            <Demo label="InfoGrid — key/value pairs">
              <InfoGrid
                items={[
                  ['Customer ID', 'C-001'],
                  ['Industry', 'Manufacturing'],
                  ['BEE Level', '2'],
                  ['Annual Revenue', fmt.cur(5_000_000)],
                  ['Employees', '18'],
                  ['Years in Business', '6'],
                ]}
              />
            </Demo>
          </>
        )}

        {activeTab === 'feedback' && (
          <>
            <SectionTitle>Feedback & status components</SectionTitle>
            <Demo label="ProgressBar">
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>Onboarding 25%</div>
                  <ProgressBar value={25} />
                </div>
                <div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>Underwriting 60%</div>
                  <ProgressBar value={60} />
                </div>
                <div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>Complete 100%</div>
                  <ProgressBar value={100} />
                </div>
              </div>
            </Demo>
            <Demo label="Modal">
              <Btn onClick={() => setModalOpen(true)}>Open Modal</Btn>
              <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirm Action" width={420}>
                <p style={{ margin: '0 0 16px', fontSize: 13 }}>
                  Are you sure you want to proceed? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
                  <Btn onClick={() => setModalOpen(false)}>Confirm</Btn>
                </div>
              </Modal>
            </Demo>
            <Demo label="statusBadge — semantic status colours">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {statusBadge('Active')}
                {statusBadge('Pending')}
                {statusBadge('Approved')}
                {statusBadge('Declined')}
                {statusBadge('Submitted')}
                {statusBadge('Verified')}
              </div>
            </Demo>
          </>
        )}

        {activeTab === 'layout' && (
          <>
            <SectionTitle>Layout & containment</SectionTitle>
            <Demo label="SectionCard">
              <SectionCard
                title="Customer Profile"
                actions={<Btn size="sm" variant="ghost">Edit</Btn>}
              >
                <p style={{ margin: 0, fontSize: 13 }}>
                  Card body content with optional actions in the header.
                </p>
              </SectionCard>
            </Demo>
            <Demo label="Tab — section navigation">
              <Tab
                tabs={[
                  { key: 'overview', label: 'Overview' },
                  { key: 'history', label: 'History', count: 12 },
                  { key: 'docs', label: 'Documents', count: 4 },
                ]}
                active="overview"
                onChange={() => {}}
              />
            </Demo>
          </>
        )}

        {activeTab === 'tokens' && (
          <>
            <SectionTitle>Colour tokens</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              {Object.entries(C).map(([name, value]) => (
                <div key={name} style={{ border: `1px solid ${C.border}` }}>
                  <div style={{ height: 64, background: value as string }} />
                  <div style={{ padding: 8, background: C.surface, fontSize: 11, fontFamily: 'monospace' }}>
                    <div style={{ fontWeight: 600 }}>C.{name}</div>
                    <div style={{ color: C.textDim }}>{String(value)}</div>
                  </div>
                </div>
              ))}
            </div>

            <SectionTitle>Icon tokens</SectionTitle>
            <p style={{ fontSize: 12, color: C.textDim, margin: '0 0 12px' }}>
              Icons are accessed via <code>I.&lt;name&gt;</code> and render as inline glyphs.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {['plus', 'edit', 'trash', 'download', 'upload', 'check', 'x', 'search', 'menu',
                'home', 'users', 'file', 'book', 'alert', 'info', 'grid', 'settings',
                'logout', 'eye', 'back', 'governance'].map(iconKey => (
                <div key={iconKey} style={{ padding: 8, border: `1px solid ${C.border}`, fontSize: 11, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{I[iconKey]}</span>
                  <span>I.{iconKey}</span>
                </div>
              ))}
            </div>

            <SectionTitle>Formatters (fmt.*)</SectionTitle>
            <Table
              columns={[
                { label: 'Formatter', key: 'fn' },
                { label: 'Input', key: 'input' },
                { label: 'Output', key: 'output' },
              ]}
              rows={[
                { fn: 'fmt.cur(500000)', input: '500000', output: fmt.cur(500_000) },
                { fn: 'fmt.num(1234567)', input: '1234567', output: fmt.num(1_234_567) },
                { fn: 'fmt.pct(0.125)', input: '0.125', output: fmt.pct(0.125) },
                { fn: 'fmt.date(now)', input: 'now', output: fmt.date(Date.now()) },
                { fn: 'fmt.dt(now)', input: 'now', output: fmt.dt(Date.now()) },
                { fn: 'fmt.short("...")', input: '"long string"', output: fmt.short('long string about something', 12) },
              ]}
            />
          </>
        )}
      </div>

      <footer style={{ marginTop: 64, padding: '24px 0', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted }}>
        Component Catalogue — KwikBridge LMS · A lightweight alternative to Storybook · Lives in the main app build · Access via <code>?catalogue</code> query param
      </footer>
    </div>
  );
}
