/**
 * CustomersPage — customer management with onboarding form.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 * Larger props surface due to UI building blocks; all dependencies
 * still come from the monolith for now.
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';

interface CustomersPageProps {
  customers: any[];
  search: string;
  now: number;
  day: number;
  canDo: (mod: string, action: string) => boolean;
  createCustomer: (data: any) => void;
  showToast: (msg: string) => void;
  setDetail: (d: any) => void;
  Btn: any;
  SectionCard: any;
  Field: any;
  Input: any;
  Select: any;
  Tab: any;
  Table: any;
  Badge: any;
  cell: any;
  statusBadge: (s: string) => any;
  I: any;
  C: any;
}

export function CustomersPage({
  customers,
  search,
  now,
  day,
  canDo,
  createCustomer,
  showToast,
  setDetail,
  Btn,
  SectionCard,
  Field,
  Input,
  Select,
  Tab,
  Table,
  Badge,
  cell,
  statusBadge,
  I,
  C,
}: CustomersPageProps) {
  const [tab, setTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [cForm, setCForm] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    idNum: '',
    regNum: '',
    industry: 'Retail',
    sector: '',
    revenue: '',
    employees: '',
    years: '',
    beeLevel: 3,
    address: '',
    province: 'Eastern Cape',
    womenOwned: 0,
    youthOwned: 0,
    disabilityOwned: 0,
  });

  const tabs = [
    { key: 'all', label: 'All', count: customers.length },
    {
      key: 'pending',
      label: 'FICA Pending',
      count: customers.filter((c) => c.ficaStatus === 'Pending' || c.ficaStatus === 'Under Review').length,
    },
    { key: 'verified', label: 'Verified', count: customers.filter((c) => c.ficaStatus === 'Verified').length },
    {
      key: 'beeExpiring',
      label: 'BEE Expiring',
      count: customers.filter((c) => c.beeExpiry && c.beeExpiry < now + 90 * day).length,
    },
  ];

  let filtered = customers.filter(
    (c) => !search || [c.name, c.contact, c.industry, c.id].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );
  if (tab === 'pending')
    filtered = filtered.filter((c) => c.ficaStatus === 'Pending' || c.ficaStatus === 'Under Review');
  if (tab === 'verified') filtered = filtered.filter((c) => c.ficaStatus === 'Verified');
  if (tab === 'beeExpiring') filtered = filtered.filter((c) => c.beeExpiry && c.beeExpiry < now + 90 * day);

  const handleCreate = () => {
    if (!cForm.name || !cForm.contact || !cForm.idNum || !cForm.regNum) {
      showToast('Name, contact, ID number, and registration number are required.');
      return;
    }
    createCustomer({
      ...cForm,
      revenue: +cForm.revenue || 0,
      employees: +cForm.employees || 0,
      years: +cForm.years || 0,
      beeLevel: +cForm.beeLevel || 3,
    });
    setShowCreate(false);
    setCForm({
      name: '',
      contact: '',
      email: '',
      phone: '',
      idNum: '',
      regNum: '',
      industry: 'Retail',
      sector: '',
      revenue: '',
      employees: '',
      years: '',
      beeLevel: 3,
      address: '',
      province: 'Eastern Cape',
      womenOwned: 0,
      youthOwned: 0,
      disabilityOwned: 0,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.text }}>Customer Management</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
            Onboarding, KYC/FICA verification, BEE profiling & relationship management
          </p>
        </div>
        {canDo('customers', 'create') && (
          <Btn onClick={() => setShowCreate(!showCreate)} icon={I.plus}>
            New Customer
          </Btn>
        )}
      </div>

      {showCreate && (
        <SectionCard title="Register New Customer">
          <div className="kb-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Business Name *">
              <Input value={cForm.name} onChange={(e: any) => setCForm({ ...cForm, name: e.target.value })} placeholder="e.g. Nomsa Trading (Pty) Ltd" />
            </Field>
            <Field label="Contact Person *">
              <Input value={cForm.contact} onChange={(e: any) => setCForm({ ...cForm, contact: e.target.value })} placeholder="Full name" />
            </Field>
            <Field label="Email">
              <Input value={cForm.email} onChange={(e: any) => setCForm({ ...cForm, email: e.target.value })} placeholder="email@company.co.za" />
            </Field>
          </div>
          <div className="kb-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Phone">
              <Input value={cForm.phone} onChange={(e: any) => setCForm({ ...cForm, phone: e.target.value })} placeholder="0XX XXX XXXX" />
            </Field>
            <Field label="ID Number *">
              <Input value={cForm.idNum} onChange={(e: any) => setCForm({ ...cForm, idNum: e.target.value })} placeholder="13-digit SA ID" />
            </Field>
            <Field label="Company Registration *">
              <Input value={cForm.regNum} onChange={(e: any) => setCForm({ ...cForm, regNum: e.target.value })} placeholder="YYYY/XXXXXX/07" />
            </Field>
          </div>
          <div className="kb-grid-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Industry">
              <Select
                value={cForm.industry}
                onChange={(e: any) => setCForm({ ...cForm, industry: e.target.value })}
                options={['Retail', 'Agriculture', 'Technology', 'Construction', 'Food Processing', 'Transport', 'Manufacturing', 'Professional Services', 'Other'].map((v) => ({ value: v, label: v }))}
              />
            </Field>
            <Field label="Sector">
              <Input value={cForm.sector} onChange={(e: any) => setCForm({ ...cForm, sector: e.target.value })} placeholder="e.g. Consumer Goods" />
            </Field>
            <Field label="Annual Revenue (R)">
              <Input type="number" value={cForm.revenue} onChange={(e: any) => setCForm({ ...cForm, revenue: e.target.value })} />
            </Field>
            <Field label="Employees">
              <Input type="number" value={cForm.employees} onChange={(e: any) => setCForm({ ...cForm, employees: e.target.value })} />
            </Field>
          </div>
          <div className="kb-grid-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Years in Business">
              <Input type="number" value={cForm.years} onChange={(e: any) => setCForm({ ...cForm, years: e.target.value })} />
            </Field>
            <Field label="BEE Level">
              <Select
                value={cForm.beeLevel}
                onChange={(e: any) => setCForm({ ...cForm, beeLevel: e.target.value })}
                options={[1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({ value: v, label: `Level ${v}` }))}
              />
            </Field>
            <Field label="Women Ownership %">
              <Input type="number" min="0" max="100" value={cForm.womenOwned} onChange={(e: any) => setCForm({ ...cForm, womenOwned: e.target.value })} placeholder="0-100" />
            </Field>
            <Field label="Youth Ownership %">
              <Input type="number" min="0" max="100" value={cForm.youthOwned} onChange={(e: any) => setCForm({ ...cForm, youthOwned: e.target.value })} placeholder="0-100" />
            </Field>
            <Field label="Disability Ownership %">
              <Input type="number" min="0" max="100" value={cForm.disabilityOwned} onChange={(e: any) => setCForm({ ...cForm, disabilityOwned: e.target.value })} placeholder="0-100" />
            </Field>
            <Field label="Address">
              <Input value={cForm.address} onChange={(e: any) => setCForm({ ...cForm, address: e.target.value })} />
            </Field>
            <Field label="Province">
              <Select
                value={cForm.province}
                onChange={(e: any) => setCForm({ ...cForm, province: e.target.value })}
                options={['Eastern Cape', 'Western Cape', 'Gauteng', 'KwaZulu-Natal', 'Free State', 'North West', 'Limpopo', 'Mpumalanga', 'Northern Cape'].map((v) => ({ value: v, label: v }))}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={handleCreate}>Register Customer</Btn>
            <Btn variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Btn>
          </div>
        </SectionCard>
      )}

      <Tab tabs={tabs} active={tab} onChange={setTab} />
      <Table
        columns={[
          { label: 'ID', render: (r: any) => cell.id(r.id) },
          { label: 'Business Name', render: (r: any) => cell.name(r.name) },
          { label: 'Contact', key: 'contact' },
          { label: 'Industry', key: 'industry' },
          { label: 'Revenue', render: (r: any) => cell.money(r.revenue) },
          { label: 'BEE', render: (r: any) => <Badge color="purple">Level {r.beeLevel}</Badge> },
          { label: 'FICA', render: (r: any) => statusBadge(r.ficaStatus) },
          {
            label: 'Risk',
            render: (r: any) =>
              r.riskCategory ? (
                <Badge color={r.riskCategory === 'Low' ? 'green' : r.riskCategory === 'Medium' ? 'amber' : 'red'}>
                  {r.riskCategory}
                </Badge>
              ) : (
                <span style={{ fontSize: 10, color: C.textMuted }}>—</span>
              ),
          },
          { label: '', render: () => <span style={{ color: C.accent }}>{I.chev}</span> },
        ]}
        rows={filtered}
        onRowClick={(r: any) => setDetail({ type: 'customer', id: r.id })}
      />
    </div>
  );
}
