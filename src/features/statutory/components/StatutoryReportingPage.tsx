/**
 * StatutoryReportingPage — NCR regulatory reporting calendar.
 *
 * Tracks Form 39 (quarterly/annual) and other NCR submissions
 * (NCRCP22396). Provides deadline countdown, urgency banners,
 * status workflow (Not Started → In Progress → Under Review →
 * Submitted), and submission guide.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useActions } from '../../../contexts/ActionsContext';
import { useAuth } from '../../../contexts/AuthContext';

interface StatutoryReportingPageProps {
  KPI: any;
  Tab: any;
  Table: any;
  Badge: any;
  SectionCard: any;
  Btn: any;
  ProgressBar: any;
  statusBadge: (s: string) => any;
  fmt: any;
  I: any;
  C: any;
}

export function StatutoryReportingPage({
  KPI, Tab, Table, Badge, SectionCard, Btn, ProgressBar, statusBadge, fmt, I, C,
}: StatutoryReportingPageProps) {
  // ═══ Context-driven dependencies (Phase 2 migration) ═══
  const { statutoryReports, loans, settings } = useData();
  const { updateStatutoryStatus } = useActions();
  const { canDo } = useAuth();

    const reports = statutoryReports || [];
    const [tab, setTab] = useState("upcoming");
    const today = new Date();
    const upcoming = reports.filter(r => r.status !== "Submitted").sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    const submitted = reports.filter(r => r.status === "Submitted");
    const daysUntil = d => { const diff = Math.ceil((new Date(d) - today) / 864e5); return diff; };

    const urgencyColor = days => days < 0 ? C.red : days <= 30 ? C.red : days <= 60 ? C.amber : C.textDim;
    const urgencyBadge = days => days < 0 ? <span style={{ fontSize:11, fontWeight:600, color:C.red }}>OVERDUE ({Math.abs(days)}d)</span> : days <= 14 ? <span style={{ fontSize:11, fontWeight:600, color:C.red }}>{days}d – Urgent</span> : days <= 30 ? <span style={{ fontSize:11, fontWeight:600, color:C.red }}>{days} days</span> : days <= 60 ? <span style={{ fontSize:11, fontWeight:500, color:C.amber }}>{days} days</span> : <span style={{ fontSize:11, color:C.textDim }}>{days} days</span>;

    const totalDisbursedAmt = loans.reduce((s,l)=>s+l.amount,0);
    const form39Frequency = totalDisbursedAmt > 15000000 ? "Quarterly" : "Annual";

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>NCR Statutory Reporting</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Regulatory reporting calendar, deadlines & submission tracking — NCRCP22396</p>

      {/* Critical deadline banner */}
      {upcoming.length > 0 && (() => {
        const next = upcoming[0];
        const days = daysUntil(next.dueDate);
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap:16 }}>
            <div style={{ flexShrink: 0 }}>{I.warning}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Next Deadline: {next.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Due: {fmt.date(new Date(next.dueDate))} · Period: {next.period} · Submit to: {next.submitTo}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: urgencyColor(days), lineHeight: 1 }}>{days < 0 ? "OVERDUE" : days}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{days < 0 ? `${Math.abs(days)} days overdue` : "days remaining"}</div>
            </div>
          </div>
        );
      })()}

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <KPI label="Pending Reports" value={upcoming.length} accent={C.amber} sub={`${upcoming.filter(r => daysUntil(r.dueDate) <= 60).length} due within 60 days`} />
        <KPI label="Submitted" value={submitted.length} accent={C.green} />
        <KPI label="Form 39 Frequency" value={form39Frequency} sub={`Disbursements: ${fmt.cur(totalDisbursedAmt)} ${totalDisbursedAmt > 15000000 ? "(> R15M)" : "(< R15M)"}`} accent={C.blue} />
        <KPI label="Year-End" value={settings?.yearEnd || "28 Feb 2026"} sub={`Annual reports due: ${settings?.annualDueDate || "31 Aug 2026"}`} accent={C.purple} />
      </div>

      <Tab tabs={[
        { key: "upcoming", label: "Upcoming Deadlines", count: upcoming.length },
        { key: "calendar", label: "Full Calendar" },
        { key: "submitted", label: "Submitted", count: submitted.length },
        { key: "guide", label: "Submission Guide" },
      ]} active={tab} onChange={setTab} />

      {tab === "upcoming" && (<div>
        {upcoming.map(r => {
          const days = daysUntil(r.dueDate);
          return (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom:12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.name}</span>
                    <Badge color={r.type === "Form 39" ? "blue" : "purple"}>{r.type}</Badge>
                    {statusBadge(r.status)}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim }}>Period: {r.period} · Submit to: <span style={{ color: C.accent, fontWeight: 600 }}>{r.submitTo}</span></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {urgencyBadge(days)}
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Due: {fmt.date(new Date(r.dueDate))}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom:12, lineHeight: 1.5 }}>{r.notes}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {r.status === "Not Started" && canDo("statutory","update") && <Btn size="sm" variant="secondary" onClick={() => updateStatutoryStatus(r.id, "In Progress")}>Start Preparation</Btn>}
                {r.status === "In Progress" && canDo("statutory","update") && <Btn size="sm" variant="secondary" onClick={() => updateStatutoryStatus(r.id, "Under Review")}>Submit for Review</Btn>}
                {r.status === "Under Review" && canDo("statutory","update") && <Btn size="sm" onClick={() => updateStatutoryStatus(r.id, "Submitted")}>Mark as Submitted</Btn>}
                {!canDo("statutory","update") && <span style={{ fontSize:10, color:C.textMuted }}>View only</span>}
                {r.preparer && <span style={{ fontSize: 11, color: C.textMuted }}>Preparer: {r.preparer}</span>}
                {r.reviewer && <span style={{ fontSize: 11, color: C.textMuted }}>Reviewer: {r.reviewer}</span>}
              </div>
              {/* Countdown bar */}
              <div style={{ marginTop: 10 }}>
                <ProgressBar value={Math.max(0, 100 - Math.max(0, days) / 1.8)} color={urgencyColor(days)} height={4} />
              </div>
            </div>
          );
        })}
      </div>)}

      {tab === "calendar" && (<div>
        <SectionCard title="Annual Statutory Reports (Due within 6 months of year-end)">
          <div style={{ fontSize: 12, color: C.textDim, marginBottom:16, lineHeight: 1.6, padding: "10px 14px", background: C.surface2 }}>
            Credit providers registered under the NCA must submit the following reports to the NCR within <span style={{ fontWeight: 600, color: C.text }}>6 months</span> of their financial year-end. Year-end: <span style={{ fontWeight: 600, color: C.text }}>{settings?.yearEnd}</span> → Deadline: <span style={{ fontWeight: 600, color: C.red }}>{settings?.annualDueDate}</span>
          </div>
          <Table columns={[
            { label: "Report", render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
            { label: "Period", key: "period" },
            { label: "Due Date", render: r => <span style={{ fontWeight: 700, color: urgencyColor(daysUntil(r.dueDate)) }}>{fmt.date(new Date(r.dueDate))}</span> },
            { label: "Days Left", render: r => urgencyBadge(daysUntil(r.dueDate)) },
            { label: "Submit To", render: r => <span style={{ fontSize: 11, color: C.accent }}>{r.submitTo}</span> },
            { label: "Status", render: r => statusBadge(r.status) },
          ]} rows={reports.filter(r => r.type === "Annual" && r.status !== "Submitted")} />
        </SectionCard>

        <SectionCard title="Form 39 – Statistical Returns (Quarterly)">
          <div style={{ fontSize: 12, color: C.textDim, marginBottom:16, lineHeight: 1.6, padding: "10px 14px", background: C.surface2 }}>
            Annual disbursements: <span style={{ fontWeight: 700, color: C.text }}>{fmt.cur(totalDisbursedAmt)}</span> — {totalDisbursedAmt > 15000000
              ? <span style={{ color: C.red, fontWeight: 700 }}>Exceeds R15 million → Form 39 must be submitted QUARTERLY</span>
              : <span style={{ color: C.green, fontWeight: 700 }}>Below R15 million → Form 39 submitted annually (1 Jan – 31 Dec)</span>
            }
          </div>
          <Table columns={[
            { label: "Quarter", render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
            { label: "Period", key: "period" },
            { label: "Due Date", render: r => <span style={{ fontWeight: 700, color: urgencyColor(daysUntil(r.dueDate)) }}>{fmt.date(new Date(r.dueDate))}</span> },
            { label: "Days Left", render: r => urgencyBadge(daysUntil(r.dueDate)) },
            { label: "Status", render: r => statusBadge(r.status) },
          ]} rows={reports.filter(r => r.type === "Form 39")} />

          <div style={{ marginTop: 16, padding: "12px 14px", background: C.surface2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Form 39 Quarterly Schedule</div>
            <table style={{ width: "100%", fontSize: 12, color: C.textDim, borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Quarter</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Reporting Period</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Due Date</th>
              </tr></thead>
              <tbody>
                {[["Q1","1 January – 31 March","15 May"],["Q2","1 April – 30 June","15 August"],["Q3","1 July – 30 September","15 November"],["Q4","1 October – 31 December","15 February (following year)"]].map(([q,p,d],i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: C.accent }}>{q}</td>
                    <td style={{ padding: "8px 10px" }}>{p}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: C.amber }}>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>)}

      {tab === "submitted" && (
        <Table columns={[
          { label: "Report", render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
          { label: "Type", render: r => <Badge color={r.type === "Form 39" ? "blue" : "purple"}>{r.type}</Badge> },
          { label: "Period", key: "period" },
          { label: "Due Date", render: r => fmt.date(new Date(r.dueDate)) },
          { label: "Submitted", render: r => <span style={{ fontWeight: 600, color: C.green }}>{fmt.date(new Date(r.submittedDate))}</span> },
          { label: "Submit To", render: r => <span style={{ fontSize: 11, color: C.accent }}>{r.submitTo}</span> },
          { label: "Status", render: () => <Badge color="green">Submitted</Badge> },
        ]} rows={submitted} />
      )}

      {tab === "guide" && (<div>
        <SectionCard title="NCR Submission Requirements">
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.8 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom:8 }}>Annual Statutory Reports</div>
              <div>Registered credit providers must submit the following within <span style={{ fontWeight: 700, color: C.amber }}>6 months of their financial year-end</span>:</div>
              <div style={{ padding: "10px 0 10px 16px" }}>
                {["Annual Compliance Report", "Annual Financial Statements (must include auditor's report)", "Annual Financial & Operational Return", "Assurance Engagement Report"].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ color: C.accent }}>{I.check}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom:8 }}>Form 39 – Statistical Returns</div>
              <div style={{ padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, marginBottom:12 }}>
                <span style={{ fontWeight: 700 }}>Current annual disbursements: {fmt.cur(totalDisbursedAmt)}</span> — {totalDisbursedAmt > 15000000
                  ? <span style={{ color: C.red, fontWeight: 700 }}>Exceeds R15 million → Quarterly submission required</span>
                  : <span style={{ color: C.green, fontWeight: 700 }}>Below R15 million → Annual submission (1 Jan – 31 Dec)</span>
                }
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom:8 }}>Submission Channels</div>
              <div className="kb-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap:12 }}>
                {[
                  ["Annual Statutory Reports", "submissions@ncr.org.za", C.purple],
                  ["Form 39 Statistical Returns", "returns@ncr.org.za", C.blue],
                  ["Hand Delivery", settings?.ncrAddress, C.amber],
                  ["Courier / Post", settings?.ncrPO, C.green],
                ].map(([label, value, color], i) => (
                  <div key={i} style={{ background: C.surface2, padding: "8px 12px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginTop: 3, wordBreak: "break-all" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom:8 }}>Company Details</div>
              <InfoGrid items={[
                ["Registered Name", settings?.companyName],
                ["NCR Registration", settings?.ncrReg],
                ["Registration Expiry", settings?.ncrExpiry],
                ["Branch", settings?.branch],
                ["Financial Year-End", settings?.yearEnd || "28 February"],
                ["Annual Reports Deadline", settings?.annualDueDate || "31 August"],
              ]} />
            </div>
          </div>
        </SectionCard>
      </div>)}
    </div>);
}
