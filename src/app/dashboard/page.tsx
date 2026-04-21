'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  api, fmt, fmtDate, currentMonth, formatMonthLabel,
  buildMonthOptions, loanBadge, savingBadge, repayBadge, getUser,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import { ToastProvider, useToast } from '@/components/Toast';

const NAV = [
  { icon: '📊', label: 'Overview',      section: 'overview' },
  { icon: '🔔', label: 'Notifications', section: 'notifications' },
  { icon: '💰', label: 'My Savings',    section: 'savings' },
  { icon: '🏦', label: 'Loan',          section: 'loan' },
  { icon: '📋', label: 'Repayments',    section: 'repayments' },
  { icon: '📄', label: 'Statement',     section: 'statement' },
  { icon: '💸', label: 'Dividends',     section: 'dividends' },
  { icon: '👤', label: 'Profile',       section: 'profile' },
];

// ── shared select style (visible on dark bg) ──────────────────────────────────
const SEL: React.CSSProperties = {
  background: '#1a2540',
  border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 'var(--radius-sm)',
  color: '#e2eaf8',
  padding: '0.6rem 0.85rem',
  fontSize: '0.88rem',
  width: '100%',
};

function Empty({ msg = 'No records.', cols = 99 }: { msg?: string; cols?: number }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>{msg}</td></tr>;
}

// ── File viewer (works with auth-gated uploads) ───────────────────────────────
function FileLink({ url, label = 'View' }: { url?: string | null; label?: string }) {
  if (!url) return <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>—</span>;
  const isImg = /\.(jpg|jpeg|png|webp)$/i.test(url);
  function open() {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('wazema_token') : '';
    fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob())
      .then(blob => { const u = URL.createObjectURL(blob); window.open(u, '_blank'); })
      .catch(() => window.open(url, '_blank'));
  }
  return (
    <button onClick={open}
      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: 'var(--primary-light)', cursor: 'pointer' }}>
      {isImg ? '🖼' : '📄'} {label}
    </button>
  );
}

// ── Bank selector ─────────────────────────────────────────────────────────────
function BankSelector({ banks, value, onChange }: {
  banks: any[];
  value: string;
  onChange: (id: string, name: string, acc: string) => void;
}) {
  return (
    <select value={value} style={SEL} onChange={e => {
      const opt = banks.find((b: any) => String(b.id) === e.target.value);
      onChange(e.target.value, opt?.bank_name || '', opt?.account_number || '');
    }}>
      <option value="" style={{ background: '#1a2540', color: '#e2eaf8' }}>— Select bank you paid to —</option>
      {banks.map((b: any) => (
        <option key={b.id} value={String(b.id)} style={{ background: '#1a2540', color: '#e2eaf8' }}>
          {b.bank_name} — {b.account_number}
        </option>
      ))}
    </select>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function MemberDashboard() {
  const router = useRouter();
  const toast  = useToast();
  const [section, setSection] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [member, setMember]   = useState<any>(null);
  const [savings, setSavings] = useState<any[]>([]);
  const [loans, setLoans]     = useState<any[]>([]);
  const [banks, setBanks]     = useState<any[]>([]);
  const [orgSettings, setOrgSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'member') { router.push('/'); return; }
    loadAll();
    api.get('/settings/banks').then((d: any) => setBanks(Array.isArray(d) ? d : [])).catch(() => {});
    api.get('/settings').then((d: any) => {
      const map: Record<string, string> = {};
      (Array.isArray(d) ? d : []).forEach((s: any) => { map[s.key] = s.value; });
      setOrgSettings(map);
    }).catch(() => {});
  }, []);

  async function loadAll() {
    try {
      const [m, s, l] = await Promise.all([
        api.get('/members'),
        api.get('/savings'),
        api.get('/loans'),
      ]);
      setMember(Array.isArray(m) ? null : m);
      setSavings(Array.isArray(s) ? s : []);
      setLoans(Array.isArray(l) ? l : []);
    } catch (e: any) { toast(e.message, 'danger'); }
  }

  const activeLoan  = loans.find(l => l.status === 'active');
  const pendingLoan = loans.find(l => l.status === 'pending');
  const totalSaved  = savings.filter(s => ['paid','late'].includes(s.status)).reduce((a, s) => a + Number(s.amount), 0);
  const loanElig    = totalSaved * Number(orgSettings.loan_multiplier || 3);

  // Notification count: pending savings + pending loan + overdue repayments
  const pendingSavings = savings.filter(s => s.status === 'pending_review').length;
  const pendingLoanCount = pendingLoan ? 1 : 0;
  const notifCount = pendingSavings + pendingLoanCount;

  return (
    <div className="app-layout">
      <Sidebar 
        active={section} 
        onSelect={setSection} 
        items={NAV} 
        role="member" 
        badge={notifCount > 0 ? notifCount : undefined}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="main-content">
        <div className="topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>☰</button>
          <span style={{ fontWeight: 700 }}>{member?.name || 'Member Portal'}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{member?.id}</span>
        </div>
        <div className="page-content">
          {section === 'overview'      && <OverviewSection member={member} savings={savings} loans={loans} totalSaved={totalSaved} loanElig={loanElig} toast={toast} />}
          {section === 'notifications' && <MemberNotificationsSection member={member} savings={savings} loans={loans} toast={toast} onRefresh={loadAll} />}
          {section === 'savings'       && <SavingsSection savings={savings} member={member} totalSaved={totalSaved} banks={banks} toast={toast} onRefresh={loadAll} />}
          {section === 'loan'       && <LoanSection loans={loans} activeLoan={activeLoan} pendingLoan={pendingLoan} loanElig={loanElig} orgSettings={orgSettings} toast={toast} onRefresh={loadAll} />}
          {section === 'repayments' && <RepaymentsSection activeLoan={activeLoan} banks={banks} toast={toast} onRefresh={loadAll} />}
          {section === 'statement'  && <StatementSection member={member} savings={savings} loans={loans} orgSettings={orgSettings} toast={toast} />}
          {section === 'dividends'  && <DividendsSection toast={toast} />}
          {section === 'profile'    && <ProfileSection member={member} toast={toast} />}
        </div>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewSection({ member, savings, loans, totalSaved, loanElig, toast }: any) {
  const [anns, setAnns] = useState<any[]>([]);
  useEffect(() => { api.get('/settings/announcements').then((d: any) => setAnns(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  const cm          = currentMonth();
  const thisSaving  = savings.find((s: any) => s.month === cm);
  const activeLoan  = loans.find((l: any) => l.status === 'active');
  const pendingLoan = loans.find((l: any) => l.status === 'pending');
  const pendingSavings = savings.filter((s: any) => s.status === 'pending_review');

  const payStatus = thisSaving?.status === 'paid' ? 'paid' : thisSaving?.status === 'pending_review' ? 'pending' : 'due';
  const bannerCls = payStatus === 'paid' ? 'alert-success' : payStatus === 'pending' ? 'alert-warning' : 'alert-danger';
  const bannerMsg = payStatus === 'paid'
    ? `✅ Savings confirmed for ${formatMonthLabel(cm)}`
    : payStatus === 'pending'
    ? `⏳ Savings under review for ${formatMonthLabel(cm)}`
    : `⚠️ Savings due for ${formatMonthLabel(cm)} — ETB ${member?.monthly_saving || '—'} required`;

  // Loan repayment progress
  const reps        = activeLoan?.repayments || [];
  const repaid      = reps.filter((r: any) => r.status === 'paid').reduce((a: number, r: any) => a + Number(r.amount), 0);
  const remaining   = reps.filter((r: any) => r.status !== 'paid').reduce((a: number, r: any) => a + Number(r.amount), 0);
  const loanPct     = reps.length ? Math.round(reps.filter((r: any) => r.status === 'paid').length / reps.length * 100) : 0;
  const overdueReps = reps.filter((r: any) => r.status === 'overdue');
  const dueReps     = reps.filter((r: any) => r.status === 'due');

  const recent = [...savings].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 5);

  return (
    <>
      <div className="page-title">Overview</div>

      {/* Savings status banner */}
      <div className={`alert ${bannerCls}`} style={{ marginBottom: '0.75rem' }}><span>{bannerMsg}</span></div>

      {/* Pending savings notification */}
      {pendingSavings.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
          <span>⏳</span>
          <div>
            <strong>{pendingSavings.length} payment{pendingSavings.length > 1 ? 's' : ''} awaiting admin approval</strong>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              {pendingSavings.map((s: any) => `${formatMonthLabel(s.month)}: ${fmt(s.amount)}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Overdue loan repayment alert */}
      {overdueReps.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>
          <span>🔴</span>
          <div>
            <strong>{overdueReps.length} overdue loan repayment{overdueReps.length > 1 ? 's' : ''}</strong>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              {overdueReps.map((r: any) => `${formatMonthLabel(r.month)}: ${fmt(r.amount)}`).join(' · ')} — Pay immediately to avoid penalties
            </div>
          </div>
        </div>
      )}

      {/* Due loan repayment alert */}
      {dueReps.length > 0 && overdueReps.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
          <span>⚠️</span>
          <div>
            <strong>Loan repayment due for {formatMonthLabel(dueReps[0].month)}</strong>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Amount: {fmt(dueReps[0].amount)} — Please pay before the due date</div>
          </div>
        </div>
      )}

      {/* Pending loan notification */}
      {pendingLoan && (
        <div className="alert alert-info" style={{ marginBottom: '0.75rem' }}>
          <span>🏦</span>
          <div>
            <strong>Loan application pending approval</strong>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Amount: {fmt(pendingLoan.amount)} · Queue: #{pendingLoan.queue_position || '—'}</div>
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          ['Member ID',       member?.id || '—'],
          ['Total Saved',     fmt(totalSaved)],
          ['Loan Eligibility',fmt(loanElig)],
          ['Account Type',    member?.account_type || '—'],
        ].map(([l, v]) => (
          <div key={l} className="kpi-card">
            <div className="kpi-label">{l}</div>
            <div className="kpi-value" style={{ fontSize: '1.1rem' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Active loan summary */}
      {activeLoan && (
        <div className="card" style={{ marginBottom: '1.25rem', border: overdueReps.length > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700 }}>🏦 Active Loan</div>
            <span className="badge badge-success">Active</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {[
              ['Loan Amount',  fmt(activeLoan.amount)],
              ['Total Repaid', fmt(repaid)],
              ['Remaining',    fmt(remaining)],
              ['Progress',     loanPct + '%'],
            ].map(([l, v]) => (
              <div key={l} className="kpi-card" style={{ padding: '0.6rem 0.75rem' }}>
                <div className="kpi-label">{l}</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.2rem' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
              <span>Repayment Progress</span><span>{loanPct}% ({reps.filter((r: any) => r.status === 'paid').length}/{reps.length} months)</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${loanPct}%` }} /></div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
            <span>Approved: {fmtDate(activeLoan.approve_date)}</span>
            {activeLoan.third_party_ref && <span>Ref: {activeLoan.third_party_ref}</span>}
            {activeLoan.guarantor_name && <span>Guarantor: {activeLoan.guarantor_name}</span>}
          </div>
        </div>
      )}

      {/* Recent savings */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>💰 Recent Savings</div>
        <div className="table-wrap"><table>
          <thead><tr><th>Month</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>{recent.length === 0 ? <Empty msg="No savings yet." /> : recent.map((s: any) => (
            <tr key={s.id}><td>{formatMonthLabel(s.month)}</td><td>{fmt(s.amount)}</td><td>{fmtDate(s.paid_date)}</td>
              <td><span className={`badge badge-${savingBadge(s.status)}`}>{s.status}</span></td></tr>
          ))}</tbody>
        </table></div>
      </div>

      {/* Announcements */}
      {anns.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📢 Announcements</div>
          {anns.map((a: any) => (
            <div key={a.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span>{a.priority === 'urgent' ? '🚨' : a.priority === 'important' ? '📢' : '📣'}</span>
                <strong style={{ fontSize: '0.88rem' }}>{a.title}</strong>
                <span className={`badge badge-${a.priority === 'urgent' ? 'danger' : a.priority === 'important' ? 'warning' : 'info'}`} style={{ fontSize: '0.65rem' }}>{a.priority}</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.25rem', marginLeft: '1.5rem' }}>{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Member Notifications ──────────────────────────────────────────────────────
function MemberNotificationsSection({ member, savings, loans, toast, onRefresh }: any) {
  const activeLoan  = loans.find((l: any) => l.status === 'active');
  const pendingLoan = loans.find((l: any) => l.status === 'pending');
  const reps        = activeLoan?.repayments || [];
  const cm          = currentMonth();

  const notifications: { type: string; title: string; message: string; action?: string; cls: string; icon: string }[] = [];

  // Savings notifications
  savings.filter((s: any) => s.status === 'pending_review').forEach((s: any) => {
    notifications.push({
      type: 'saving_pending', cls: 'alert-warning', icon: '⏳',
      title: `Savings payment under review — ${formatMonthLabel(s.month)}`,
      message: `ETB ${Number(s.amount).toFixed(2)} submitted on ${fmtDate(s.paid_date)}. Awaiting admin confirmation.`,
    });
  });

  // Check unpaid months
  if (member?.join_date) {
    const joinMonth = member.join_date.substring(0, 7);
    let cur = joinMonth;
    while (cur <= cm) {
      const record = savings.find((s: any) => s.month === cur);
      if (!record) {
        notifications.push({
          type: 'saving_unpaid', cls: 'alert-danger', icon: '❌',
          title: `Savings unpaid — ${formatMonthLabel(cur)}`,
          message: `ETB ${member.monthly_saving} is due for ${formatMonthLabel(cur)}. Please submit your payment.`,
          action: cur,
        });
      }
      const [y, m] = cur.split('-').map(Number);
      const next = new Date(y, m, 1);
      cur = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  // Loan notifications
  if (pendingLoan) {
    notifications.push({
      type: 'loan_pending', cls: 'alert-info', icon: '🏦',
      title: 'Loan application pending approval',
      message: `ETB ${Number(pendingLoan.amount).toFixed(2)} requested. Queue position: #${pendingLoan.queue_position || '—'}`,
    });
  }

  // Overdue repayments
  reps.filter((r: any) => r.status === 'overdue').forEach((r: any) => {
    notifications.push({
      type: 'repay_overdue', cls: 'alert-danger', icon: '🔴',
      title: `Overdue loan repayment — ${formatMonthLabel(r.month)}`,
      message: `ETB ${Number(r.amount).toFixed(2)} was due on ${fmtDate(r.due_date)}. Penalty is accumulating. Pay immediately.`,
    });
  });

  // Due repayments
  reps.filter((r: any) => r.status === 'due').forEach((r: any) => {
    notifications.push({
      type: 'repay_due', cls: 'alert-warning', icon: '⚠️',
      title: `Loan repayment due — ${formatMonthLabel(r.month)}`,
      message: `ETB ${Number(r.amount).toFixed(2)} is due on ${fmtDate(r.due_date)}. Pay before the due date to avoid penalties.`,
    });
  });

  // Pending repayments
  reps.filter((r: any) => r.status === 'pending_review').forEach((r: any) => {
    notifications.push({
      type: 'repay_pending', cls: 'alert-info', icon: '⏳',
      title: `Repayment under review — ${formatMonthLabel(r.month)}`,
      message: `ETB ${Number(r.amount).toFixed(2)} submitted. Awaiting admin confirmation.`,
    });
  });

  return (
    <>
      <div className="page-title">Notifications</div>
      <div className="page-sub">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</div>
      {notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>All caught up!</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No pending actions or alerts.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map((n, i) => (
            <div key={i} className={`alert ${n.cls}`} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{n.icon}</span>
                <strong style={{ fontSize: '0.9rem' }}>{n.title}</strong>
              </div>
              <p style={{ fontSize: '0.82rem', marginLeft: '1.6rem', opacity: 0.9 }}>{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}// ── Savings ───────────────────────────────────────────────────────────────────
function SavingsSection({ savings, member, totalSaved, banks, toast, onRefresh }: any) {
  const minAmount = Number(member?.monthly_saving || 0);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [form, setForm] = useState({
    month: currentMonth(), amount: String(minAmount),
    paid_date: new Date().toISOString().split('T')[0],
    bank_id: '', bank_name: '', account_number: '', txn_ref: '',
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (minAmount > 0) setForm(f => ({ ...f, amount: String(minAmount) }));
  }, [minAmount]);

  // Build complete month timeline from join date to current month
  function buildMonthTimeline(): { month: string; record: any | null }[] {
    if (!member?.join_date) return [];
    const joinMonth = member.join_date.substring(0, 7); // YYYY-MM
    const cm = currentMonth();
    const timeline: { month: string; record: any | null }[] = [];
    let cur = joinMonth;
    while (cur <= cm) {
      const record = savings.find((s: any) => s.month === cur) || null;
      timeline.push({ month: cur, record });
      // advance month
      const [y, m] = cur.split('-').map(Number);
      const next = new Date(y, m, 1); // m is already 1-based, so this goes to next month
      cur = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    }
    return timeline.reverse(); // newest first
  }

  const timeline = buildMonthTimeline();
  const paidCount   = timeline.filter(t => t.record && ['paid','late'].includes(t.record.status)).length;
  const unpaidCount = timeline.filter(t => !t.record || t.record.status === 'pending_review').length;

  function openPayForm(month: string) {
    setForm({ month, amount: String(minAmount), paid_date: new Date().toISOString().split('T')[0], bank_id: '', bank_name: '', account_number: '', txn_ref: '' });
    setReceipt(null);
    setShowForm(true);
  }

  async function submitSaving() {
    const amt = Number(form.amount);
    if (!form.paid_date) { toast('Select payment date', 'warning'); return; }
    if (amt < minAmount) { toast(`Amount must be at least ETB ${minAmount}`, 'warning'); return; }
    // Block if month already paid/pending
    const existing = savings.find((s: any) => s.month === form.month);
    if (existing && ['paid', 'late', 'pending_review'].includes(existing.status)) {
      toast(`${formatMonthLabel(form.month)} already has a ${existing.status} payment. Choose a different month.`, 'danger');
      return;
    }
    if (!form.bank_id) { toast('Select the bank you paid to', 'warning'); return; }
    if (!form.txn_ref) { toast('Enter your transaction reference number', 'warning'); return; }
    if (!receipt) { toast('Receipt is required', 'warning'); return; }
    setSaving(true);
    try {
      const res = await api.post('/savings', {
        month: form.month, amount: amt, paid_date: form.paid_date,
        bank_name: form.bank_name,
        account_number: form.account_number + ' | Ref: ' + form.txn_ref,
      });
      try {
        const fd = new FormData();
        fd.append('file', receipt); fd.append('type', 'saving'); fd.append('record_id', res.id);
        await api.upload('/uploads/receipt', fd);
      } catch { toast('Payment saved but receipt upload failed', 'warning'); }
      toast(`✅ Payment for ${formatMonthLabel(form.month)} submitted for review`, 'success');
      setShowForm(false); setReceipt(null);
      setForm({ month: currentMonth(), amount: String(minAmount), paid_date: new Date().toISOString().split('T')[0], bank_id: '', bank_name: '', account_number: '', txn_ref: '' });
      onRefresh();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setSaving(false); }
  }

  function statusStyle(record: any | null): React.CSSProperties {
    if (!record) return { background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid var(--danger)' };
    if (record.status === 'paid') return { background: 'rgba(16,185,129,0.06)', borderLeft: '3px solid var(--success)' };
    if (record.status === 'late') return { background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid var(--warning)' };
    if (record.status === 'pending_review') return { background: 'rgba(99,102,241,0.08)', borderLeft: '3px solid var(--info)' };
    return {};
  }

  const monthOpts = buildMonthOptions(12, 6);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <div className="page-title">My Savings</div>
          <div className="page-sub">Complete payment history from {member?.join_date?.substring(0,7) || '—'}</div>
        </div>
        <button className="btn btn-primary" onClick={() => openPayForm(currentMonth())}>+ Submit Payment</button>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          ['Total Saved', fmt(totalSaved)],
          ['Months Paid', String(paidCount)],
          ['Months Unpaid', String(unpaidCount)],
          ['Monthly Amount', fmt(minAmount)],
        ].map(([l, v]) => (
          <div key={l} className="kpi-card"
            style={{ borderLeft: l === 'Months Unpaid' && unpaidCount > 0 ? '3px solid var(--danger)' : undefined }}>
            <div className="kpi-label">{l}</div>
            <div className="kpi-value" style={{ fontSize: '1.2rem', color: l === 'Months Unpaid' && unpaidCount > 0 ? 'var(--danger)' : undefined }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
        {[
          ['✅ Paid', 'var(--success)'],
          ['⚠️ Late', 'var(--warning)'],
          ['⏳ Pending Review', 'var(--info)'],
          ['❌ Unpaid', 'var(--danger)'],
        ].map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: c as string, fontWeight: 600 }}>{l}</span>
        ))}
      </div>

      {/* Month-by-month timeline */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.82rem' }}>
          Monthly Payment Timeline ({timeline.length} months)
        </div>
        {timeline.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No data yet</div>
        ) : (
          <div>
            {timeline.map(({ month, record }) => {
              const cm = currentMonth();
              const isFuture = month > cm;
              const canPay = !record && !isFuture;
              const isPending = record?.status === 'pending_review';
              return (
                <div key={month} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', ...statusStyle(record) }}>
                  {/* Month label */}
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{formatMonthLabel(month)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{month}</div>
                  </div>
                  {/* Status badge */}
                  <div style={{ width: 130, flexShrink: 0 }}>
                    {!record ? (
                      <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>
                        ❌ UNPAID
                      </span>
                    ) : record.status === 'paid' ? (
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>
                        ✅ PAID
                      </span>
                    ) : record.status === 'late' ? (
                      <span style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>
                        ⚠️ LATE
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--info)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>
                        ⏳ REVIEW
                      </span>
                    )}
                  </div>
                  {/* Amount */}
                  <div style={{ flex: 1 }}>
                    {record ? (
                      <div>
                        <span style={{ fontWeight: 700 }}>{fmt(record.amount)}</span>
                        {record.penalty > 0 && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>+{fmt(record.penalty)} penalty</span>}
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                          {fmtDate(record.paid_date)} {record.bank_name ? `· ${record.bank_name}` : ''}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                        {isFuture ? 'Future month' : `ETB ${minAmount} due`}
                      </span>
                    )}
                  </div>
                  {/* Receipt */}
                  <div style={{ width: 60, textAlign: 'center' }}>
                    {record?.receipt_url && <FileLink url={record.receipt_url} />}
                  </div>
                  {/* Action */}
                  <div style={{ width: 100, textAlign: 'right' }}>
                    {canPay && (
                      <button className="btn btn-danger btn-sm" onClick={() => openPayForm(month)}>
                        Pay Now
                      </button>
                    )}
                    {isPending && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--info)' }}>Awaiting admin</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setReceipt(null); }} title="Submit Savings Payment">
        {banks.length > 0 && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#10b981', marginBottom: '0.5rem' }}>🏦 Pay to one of these accounts:</div>
            {banks.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.82rem' }}>
                <span style={{ color: '#e2eaf8' }}>{b.bank_name}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fbbf24', letterSpacing: '1px' }}>{b.account_number}</span>
              </div>
            ))}
          </div>
        )}
        {/* Month selector — always shown so member can choose which month they're paying */}
        <div className="form-group">
          <label>Month You Are Paying For *</label>
          <select value={form.month} style={SEL} onChange={e => setForm({ ...form, month: e.target.value })}>
            {buildMonthOptions(24, 6).map(o => {
              const existing = savings.find((s: any) => s.month === o.value);
              const isBlocked = existing && ['paid', 'late', 'pending_review'].includes(existing.status);
              return (
                <option key={o.value} value={o.value} disabled={isBlocked}
                  style={{ background: '#1a2540', color: isBlocked ? '#666' : '#e2eaf8' }}>
                  {o.label}{isBlocked ? ` — ${existing.status.toUpperCase()}` : ''}
                </option>
              );
            })}
          </select>
          {savings.find((s: any) => s.month === form.month && ['paid', 'late', 'pending_review'].includes(s.status)) && (
            <span style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>
              ⛔ This month already has a {savings.find((s: any) => s.month === form.month)?.status} payment — choose a different month
            </span>
          )}
        </div>
        {/* Show interest if applicable */}
        {member?.saving_interest_pct > 0 && (
          <div className="alert alert-info" style={{ marginBottom: '0.75rem', padding: '0.6rem 0.85rem' }}>
            <span>📈</span>
            <span style={{ fontSize: '0.82rem' }}>
              Your account earns <strong>{member.saving_interest_pct}% annual interest</strong>.
              Monthly interest on ETB {fmt(totalSaved)}: <strong>{fmt(totalSaved * (member.saving_interest_pct / 100) / 12)}</strong>
            </span>
          </div>
        )}
        <div className="form-group">
          <label>Amount (ETB) * — minimum: ETB {minAmount}</label>
          <input type="number" min={minAmount} value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            style={{ borderColor: Number(form.amount) < minAmount ? 'var(--danger)' : undefined }} />
          {Number(form.amount) > 0 && Number(form.amount) < minAmount && (
            <span style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>⚠️ Must be at least ETB {minAmount}</span>
          )}
        </div>
        <div className="form-group"><label>Payment Date *</label><input type="date" value={form.paid_date} onChange={e => setForm({ ...form, paid_date: e.target.value })} /></div>
        <div className="form-group">
          <label>Bank You Paid To *</label>
          <BankSelector banks={banks} value={form.bank_id} onChange={(id, name, acc) => setForm({ ...form, bank_id: id, bank_name: name, account_number: acc })} />
        </div>
        <div className="form-group"><label>Transaction / Reference Number *</label>
          <input value={form.txn_ref} onChange={e => setForm({ ...form, txn_ref: e.target.value })} placeholder="e.g. TXN123456789" />
        </div>
        <div className="form-group">
          <label>Payment Receipt * (required)</label>
          <input type="file" accept=".jpg,.jpeg,.png,.pdf,.webp" onChange={e => setReceipt(e.target.files?.[0] || null)} />
          {!receipt && <span style={{ color: 'var(--warning)', fontSize: '0.78rem' }}>⚠️ Receipt is mandatory</span>}
          {receipt && <span style={{ color: 'var(--success)', fontSize: '0.78rem' }}>✅ {receipt.name}</span>}
        </div>
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}><span>ℹ️</span><span>Your payment will be reviewed by admin before confirmation.</span></div>
        <button className="btn btn-primary btn-full" onClick={submitSaving}
          disabled={saving || Number(form.amount) < minAmount || !receipt || !!savings.find((s: any) => s.month === form.month && ['paid','late','pending_review'].includes(s.status))}>
          {saving ? 'Submitting…' : 'Submit Payment'}
        </button>
      </Modal>
    </>
  );
}

// ── Loan ──────────────────────────────────────────────────────────────────────
function LoanSection({ loans, activeLoan, pendingLoan, loanElig, orgSettings, toast, onRefresh }: any) {
  const maxMonths = Number(orgSettings.repayment_months || 60);
  const defaultRate = Number(orgSettings.interest_rate || 0.05);
  const [amtInput, setAmtInput] = useState('');
  const [months, setMonths]     = useState(String(Number(orgSettings.repayment_months || 12)));
  const [applying, setApplying] = useState(false);

  const amt      = Number(amtInput) || 0;
  const mo       = Math.min(Math.max(1, Number(months) || 12), maxMonths);
  const interest = amt * defaultRate;
  const total    = amt + interest;
  const monthly  = mo > 0 ? total / mo : 0;

  const amtErr    = amt > 0 && amt > loanElig ? `Exceeds max eligibility of ETB ${loanElig.toLocaleString()}` : '';
  const monthsErr = Number(months) > maxMonths ? `Max ${maxMonths} months` : Number(months) < 1 ? 'Min 1 month' : '';

  async function applyLoan() {
    if (amt <= 0) { toast('Enter a valid amount', 'warning'); return; }
    if (amt > loanElig) { toast(`Amount exceeds your eligibility of ETB ${loanElig.toLocaleString()}`, 'warning'); return; }
    if (mo < 1 || mo > maxMonths) { toast(`Duration must be 1–${maxMonths} months`, 'warning'); return; }
    setApplying(true);
    try {
      await api.post('/loans', { amount: amt });
      toast('Loan application submitted', 'success');
      onRefresh();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setApplying(false); }
  }

  if (activeLoan) {
    const reps      = activeLoan.repayments || [];
    const repaid    = reps.filter((r: any) => r.status === 'paid').reduce((a: number, r: any) => a + Number(r.amount), 0);
    const remaining = reps.filter((r: any) => r.status !== 'paid').reduce((a: number, r: any) => a + Number(r.amount), 0);
    const pct       = reps.length ? Math.round(reps.filter((r: any) => r.status === 'paid').length / reps.length * 100) : 0;
    return (
      <>
        <div className="page-title">Active Loan</div>
        <div className="card">
          <div className="kpi-grid">
            {[['Loan Amount', fmt(activeLoan.amount)], ['Total Repaid', fmt(repaid)], ['Remaining', fmt(remaining)], ['Approved', fmtDate(activeLoan.approve_date)]].map(([l, v]) => (
              <div key={l} className="kpi-card"><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: '1.1rem' }}>{v}</div></div>
            ))}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.4rem' }}><span>Repayment Progress</span><span>{pct}%</span></div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          </div>
          {activeLoan.guarantor_name && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>GUARANTOR</div>
              <div style={{ fontWeight: 600 }}>{activeLoan.guarantor_name} {activeLoan.guarantor_phone || ''}</div>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div className="card"><div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>3rd Party Ref</div><div style={{ fontFamily: 'monospace', color: 'var(--primary-light)' }}>{activeLoan.third_party_ref || '—'}</div></div>
          <div className="card"><div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Disbursed</div><div>{fmtDate(activeLoan.disbursement_date)}</div></div>
        </div>
      </>
    );
  }

  if (pendingLoan) return (
    <>
      <div className="page-title">Loan Application</div>
      <div className="card">
        <div className="alert alert-warning"><span>⏳</span>
          <div><strong>Pending Approval</strong>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Amount: {fmt(pendingLoan.amount)} · Queue position: #{pendingLoan.queue_position || '—'}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="page-title">Apply for Loan</div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Loan Application & Calculator</div>
        <div className="form-row">
          {/* Amount input */}
          <div className="form-group">
            <label>Loan Amount (ETB) * — max: {fmt(loanElig)}</label>
            <input
              type="number" min={1} max={loanElig} value={amtInput}
              onChange={e => setAmtInput(e.target.value)}
              placeholder={`Up to ETB ${loanElig.toLocaleString()}`}
              style={{ borderColor: amtErr ? 'var(--danger)' : undefined }}
            />
            {amtErr && <span style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>⚠️ {amtErr}</span>}
          </div>
          {/* Duration input */}
          <div className="form-group">
            <label>Repayment Duration (months) * — max: {maxMonths}</label>
            <input
              type="number" min={1} max={maxMonths} value={months}
              onChange={e => setMonths(e.target.value)}
              style={{ borderColor: monthsErr ? 'var(--danger)' : undefined }}
            />
            {monthsErr && <span style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>⚠️ {monthsErr}</span>}
          </div>
        </div>
        {/* Live calculator */}
        {amt > 0 && (
          <div className="kpi-grid" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            {[
              ['Principal', fmt(amt)],
              [`Interest (${(defaultRate * 100).toFixed(0)}%)`, fmt(interest)],
              ['Total Repayable', fmt(total)],
              [`Monthly (${mo} mo)`, fmt(monthly)],
            ].map(([l, v]) => (
              <div key={l} className="kpi-card"><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: '1rem' }}>{v}</div></div>
            ))}
          </div>
        )}
        {loanElig === 0 && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}><span>⚠️</span><span>You need savings to be eligible for a loan.</span></div>}
        <button
          className="btn btn-primary btn-full"
          onClick={applyLoan}
          disabled={applying || amt <= 0 || amt > loanElig || !!amtErr || !!monthsErr}
        >
          {applying ? 'Applying…' : 'Apply for Loan'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Rejected Loans</div>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Reason</th></tr></thead>
            <tbody>{loans.filter((l: any) => l.status === 'rejected').length === 0 ? <Empty msg="None" /> : loans.filter((l: any) => l.status === 'rejected').map((l: any) => (
              <tr key={l.id}><td>{fmtDate(l.request_date)}</td><td>{fmt(l.amount)}</td><td style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>{l.rejection_reason || '—'}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Completed Loans</div>
          <div className="table-wrap"><table><thead><tr><th>ID</th><th>Amount</th><th>Approved</th></tr></thead>
            <tbody>{loans.filter((l: any) => l.status === 'completed').length === 0 ? <Empty msg="None" /> : loans.filter((l: any) => l.status === 'completed').map((l: any) => (
              <tr key={l.id}><td><code style={{ fontSize: '0.75rem' }}>{l.id}</code></td><td>{fmt(l.amount)}</td><td>{fmtDate(l.approve_date)}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}

// ── Repayments ────────────────────────────────────────────────────────────────
function RepaymentsSection({ activeLoan, banks, toast, onRefresh }: any) {
  const [schedData, setSchedData] = useState<any>(null);
  const [payModal, setPayModal]   = useState<any>(null);
  const [payAmt, setPayAmt]       = useState('');
  const [payForm, setPayForm]     = useState({ paid_date: '', bank_id: '', bank_name: '', account_number: '', txn_ref: '' });
  const [receipt, setReceipt]     = useState<File | null>(null);
  const [paying, setPaying]       = useState(false);

  function loadSchedule() {
    if (!activeLoan) return;
    api.get(`/repayments/schedule/${activeLoan.id}`).then(setSchedData).catch((e: any) => toast(e.message, 'danger'));
  }
  useEffect(loadSchedule, [activeLoan]);

  const minPay = payModal ? Number(payModal.amount) : 0;

  async function payRepayment() {
    const amt = Number(payAmt);
    if (!payForm.paid_date) { toast('Select payment date', 'warning'); return; }
    if (amt < minPay) { toast(`Amount must be at least ETB ${minPay} (monthly installment)`, 'warning'); return; }
    if (!payForm.bank_id) { toast('Select the bank you paid to', 'warning'); return; }
    if (!payForm.txn_ref) { toast('Enter transaction reference', 'warning'); return; }
    if (!receipt) { toast('Receipt is required', 'warning'); return; }
    setPaying(true);
    try {
      const res = await api.post('/repayments/record', {
        loan_id: activeLoan.id,
        month: payModal.month,
        paid_date: payForm.paid_date,
        bank_name: payForm.bank_name,
        account_number: payForm.account_number + ' | Ref: ' + payForm.txn_ref,
      });
      // Upload receipt
      try {
        const fd = new FormData();
        fd.append('file', receipt);
        fd.append('type', 'repayment');
        fd.append('record_id', payModal.id);
        await api.upload('/uploads/receipt', fd);
      } catch { toast('Repayment saved but receipt upload failed', 'warning'); }
      toast(res.completed ? '🎉 Loan fully repaid!' : 'Repayment submitted for review. Balance will update after admin approval.', 'success');
      setPayModal(null);
      setReceipt(null);
      onRefresh();
      loadSchedule();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setPaying(false); }
  }

  if (!activeLoan) return (
    <>
      <div className="page-title">Repayments</div>
      <div className="alert alert-info"><span>ℹ️</span><span>No active loan. Repayment schedule will appear here once a loan is approved.</span></div>
    </>
  );

  const cm   = currentMonth();
  const reps = schedData?.repayments || [];
  const sum  = schedData?.summary;

  return (
    <>
      <div className="page-title">Repayment Schedule</div>
      <div className="page-sub">Loan {activeLoan.id} — {fmt(activeLoan.amount)}</div>
      {sum && (
        <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
          {[['Repaid', fmt(sum.totalPaid)], ['Remaining', fmt(sum.remaining)], ['Progress', sum.progress + '%'], ['Penalties', fmt(sum.totalPenalty)]].map(([l, v]) => (
            <div key={l} className="kpi-card"><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: '1.1rem' }}>{v}</div></div>
          ))}
        </div>
      )}
      <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
        <span>ℹ️</span><span>After you submit a payment, the admin will confirm it. Your remaining balance updates automatically after confirmation.</span>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.82rem' }}>
          Monthly Repayment Schedule ({reps.length} installments)
        </div>
        {reps.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No schedule yet</div>
        ) : reps.map((r: any, i: number) => {
          const isFuture = r.month > cm;
          const isPaid   = r.status === 'paid';
          const isOverdue = r.status === 'overdue';
          const isDue    = r.status === 'due';
          const isPending = r.status === 'pending_review';

          const rowStyle: React.CSSProperties = isPaid
            ? { background: 'rgba(16,185,129,0.06)', borderLeft: '3px solid var(--success)' }
            : isOverdue
            ? { background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid var(--danger)' }
            : isDue
            ? { background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid var(--warning)' }
            : isPending
            ? { background: 'rgba(99,102,241,0.08)', borderLeft: '3px solid var(--info)' }
            : isFuture
            ? { borderLeft: '3px solid var(--border)' }
            : { borderLeft: '3px solid var(--border)' };

          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', ...rowStyle }}>
              {/* # */}
              <div style={{ width: 32, flexShrink: 0, color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 700 }}>{i + 1}</div>
              {/* Month */}
              <div style={{ width: 150, flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{formatMonthLabel(r.month)}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Due: {fmtDate(r.due_date)}</div>
              </div>
              {/* Status */}
              <div style={{ width: 130, flexShrink: 0 }}>
                {isPaid ? (
                  <span style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>✅ PAID</span>
                ) : isOverdue ? (
                  <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>🔴 OVERDUE</span>
                ) : isDue ? (
                  <span style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>⚠️ DUE NOW</span>
                ) : isPending ? (
                  <span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--info)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>⏳ REVIEW</span>
                ) : isFuture ? (
                  <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>📅 UPCOMING</span>
                ) : (
                  <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>PENDING</span>
                )}
              </div>
              {/* Amount */}
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700 }}>{fmt(r.amount)}</span>
                {r.penalty > 0 && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>+{fmt(r.penalty)} penalty</span>}
                {isPaid && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>Paid: {fmtDate(r.paid_date)}</div>}
              </div>
              {/* Action */}
              <div style={{ width: 110, textAlign: 'right' }}>
                {r.can_pay && (
                  <button
                    className={`btn btn-sm ${isOverdue || isDue ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={() => { setPayModal(r); setPayAmt(String(r.amount)); setPayForm({ paid_date: new Date().toISOString().split('T')[0], bank_id: '', bank_name: '', account_number: '', txn_ref: '' }); setReceipt(null); }}
                  >
                    {isFuture ? '⏩ Advance Pay' : isOverdue ? '🔴 Pay Now' : 'Pay'}
                  </button>
                )}
                {isPending && <span style={{ fontSize: '0.72rem', color: 'var(--info)' }}>Awaiting admin</span>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Pay — ${formatMonthLabel(payModal?.month)}`}>
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          <span>📅</span>
          <div>Monthly installment: <strong>{fmt(payModal?.amount)}</strong><br />
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>You can pay more than the installment amount.</span>
          </div>
        </div>
        {/* Bank accounts */}
        {banks.length > 0 && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#10b981', marginBottom: '0.4rem' }}>🏦 Pay to:</div>
            {banks.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0' }}>
                <span style={{ color: '#e2eaf8' }}>{b.bank_name}</span>
                <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{b.account_number}</span>
              </div>
            ))}
          </div>
        )}
        {/* Amount — min = installment */}
        <div className="form-group">
          <label>Amount to Pay (ETB) * — min: {fmt(minPay)}</label>
          <input
            type="number" min={minPay} value={payAmt}
            onChange={e => setPayAmt(e.target.value)}
            style={{ borderColor: Number(payAmt) < minPay ? 'var(--danger)' : undefined }}
          />
          {Number(payAmt) > 0 && Number(payAmt) < minPay && (
            <span style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>⚠️ Must be at least ETB {minPay}</span>
          )}
          {Number(payAmt) > minPay && (
            <span style={{ color: 'var(--success)', fontSize: '0.78rem' }}>✅ Extra ETB {fmt(Number(payAmt) - minPay)} will reduce your remaining balance</span>
          )}
        </div>
        <div className="form-group"><label>Payment Date *</label><input type="date" value={payForm.paid_date} onChange={e => setPayForm({ ...payForm, paid_date: e.target.value })} /></div>
        <div className="form-group">
          <label>Bank You Paid To *</label>
          <BankSelector banks={banks} value={payForm.bank_id} onChange={(id, name, acc) => setPayForm({ ...payForm, bank_id: id, bank_name: name, account_number: acc })} />
        </div>
        <div className="form-group"><label>Transaction Reference *</label><input value={payForm.txn_ref} onChange={e => setPayForm({ ...payForm, txn_ref: e.target.value })} placeholder="e.g. TXN123456789" /></div>
        <div className="form-group">
          <label>Payment Receipt * (required)</label>
          <input type="file" accept=".jpg,.jpeg,.png,.pdf,.webp" onChange={e => setReceipt(e.target.files?.[0] || null)} />
          {!receipt && <span style={{ color: 'var(--warning)', fontSize: '0.78rem' }}>⚠️ Receipt is mandatory</span>}
          {receipt && <span style={{ color: 'var(--success)', fontSize: '0.78rem' }}>✅ {receipt.name}</span>}
        </div>
        <button
          className="btn btn-primary btn-full"
          onClick={payRepayment}
          disabled={paying || Number(payAmt) < minPay || !receipt}
        >
          {paying ? 'Submitting…' : 'Submit Payment'}
        </button>
      </Modal>
    </>
  );
}

// ── Statement ─────────────────────────────────────────────────────────────────
function StatementSection({ member, savings, loans, orgSettings, toast }: any) {
  const totalSaved   = savings.filter((s: any) => ['paid', 'late'].includes(s.status)).reduce((a: number, s: any) => a + Number(s.amount), 0);
  const totalPenalty = savings.reduce((a: number, s: any) => a + Number(s.penalty || 0), 0);
  const orgName      = orgSettings.org_name  || 'Wazema Saving and Credit Basic Cooperative';
  const orgPhone     = orgSettings.org_phone || '';
  const orgEmail     = orgSettings.org_email || '';
  const orgAddress   = orgSettings.org_address || 'Addis Ababa, Ethiopia';
  const currency     = orgSettings.currency || 'ETB';
  const today        = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── CSV download ──────────────────────────────────────────────────────────
  function downloadCSV() {
    const header = [
      orgName,
      `Phone: ${orgPhone} | Email: ${orgEmail} | Address: ${orgAddress}`,
      `Member Statement — ${member?.name || ''} (${member?.id || ''})`,
      `Generated: ${today}`,
      '',
      'SAVINGS HISTORY',
      'Month,Amount,Paid Date,Status,Penalty',
      ...savings.map((s: any) => `${s.month},${s.amount},${s.paid_date || ''},${s.status},${s.penalty || 0}`),
      '',
      'LOAN HISTORY',
      'Loan ID,Amount,Status,Request Date,Approve Date',
      ...loans.map((l: any) => `${l.id},${l.amount},${l.status},${l.request_date || ''},${l.approve_date || ''}`),
      '',
      'SUMMARY',
      `Total Saved,${totalSaved}`,
      `Total Penalties,${totalPenalty}`,
      `Total Loans,${loans.length}`,
    ].join('\n');
    const blob = new Blob([header], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `statement_${member?.id || 'member'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('CSV downloaded', 'success');
  }

  // ── Excel (TSV) download ──────────────────────────────────────────────────
  function downloadExcel() {
    const rows = [
      [orgName],
      [`Phone: ${orgPhone}`, `Email: ${orgEmail}`, `Address: ${orgAddress}`],
      [`Member Statement`, member?.name || '', member?.id || ''],
      [`Generated: ${today}`],
      [],
      ['SAVINGS HISTORY'],
      ['Month', 'Amount', 'Paid Date', 'Status', 'Penalty'],
      ...savings.map((s: any) => [formatMonthLabel(s.month), `${currency} ${Number(s.amount).toFixed(2)}`, s.paid_date || '', s.status, s.penalty ? `${currency} ${Number(s.penalty).toFixed(2)}` : '0']),
      [],
      ['LOAN HISTORY'],
      ['Loan ID', 'Amount', 'Status', 'Request Date', 'Approve Date'],
      ...loans.map((l: any) => [l.id, `${currency} ${Number(l.amount).toFixed(2)}`, l.status, l.request_date || '', l.approve_date || '']),
      [],
      ['SUMMARY'],
      ['Total Saved', `${currency} ${totalSaved.toFixed(2)}`],
      ['Total Penalties', `${currency} ${totalPenalty.toFixed(2)}`],
      ['Total Loans', loans.length],
    ];
    const tsv  = rows.map(r => r.join('\t')).join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `statement_${member?.id || 'member'}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('Excel file downloaded', 'success');
  }

  // ── PDF (print window) ────────────────────────────────────────────────────
  function downloadPDF() {
    const savingsRows = savings.map((s: any) => `
      <tr>
        <td>${formatMonthLabel(s.month)}</td>
        <td>${currency} ${Number(s.amount).toFixed(2)}</td>
        <td>${s.paid_date || '—'}</td>
        <td><span style="padding:2px 8px;border-radius:12px;font-size:11px;background:${s.status === 'paid' ? '#d1fae5' : s.status === 'late' ? '#fef3c7' : '#fee2e2'};color:${s.status === 'paid' ? '#065f46' : s.status === 'late' ? '#92400e' : '#991b1b'}">${s.status}</span></td>
        <td>${s.penalty ? `${currency} ${Number(s.penalty).toFixed(2)}` : '—'}</td>
      </tr>`).join('');
    const loanRows = loans.map((l: any) => `
      <tr>
        <td>${l.id}</td>
        <td>${currency} ${Number(l.amount).toFixed(2)}</td>
        <td>${l.status}</td>
        <td>${l.request_date || '—'}</td>
        <td>${l.approve_date || '—'}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Statement — ${member?.name}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;padding:2rem;max-width:900px;margin:0 auto}
      .header{text-align:center;border-bottom:3px double #1a6bff;padding-bottom:1rem;margin-bottom:1.5rem}
      .org-name{font-size:1.6rem;font-weight:900;color:#1a1a2e;letter-spacing:-0.02em}
      .org-sub{font-size:0.85rem;color:#555;margin-top:4px}
      .stamp{display:inline-block;border:3px solid #1a6bff;border-radius:50%;width:80px;height:80px;line-height:80px;text-align:center;font-weight:900;font-size:0.7rem;color:#1a6bff;float:right;margin-top:-60px}
      .member-info{background:#f8faff;border:1px solid #dde;border-radius:8px;padding:1rem;margin-bottom:1.5rem;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem}
      .mi-row{display:flex;gap:0.5rem;font-size:0.88rem}
      .mi-label{color:#666;min-width:120px}
      .mi-val{font-weight:600}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem}
      .sum-card{background:#f0f4ff;border-radius:8px;padding:0.75rem;text-align:center}
      .sum-label{font-size:0.72rem;color:#666;text-transform:uppercase;letter-spacing:0.05em}
      .sum-val{font-size:1.2rem;font-weight:800;color:#1a1a2e;margin-top:4px}
      h3{font-size:0.9rem;text-transform:uppercase;letter-spacing:0.08em;color:#1a6bff;margin:1.5rem 0 0.5rem;border-bottom:1px solid #dde;padding-bottom:0.3rem}
      table{width:100%;border-collapse:collapse;font-size:0.85rem;margin-bottom:1rem}
      th{background:#1a1a2e;color:#fff;padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;text-transform:uppercase}
      td{padding:0.5rem 0.75rem;border-bottom:1px solid #eee}
      tr:nth-child(even) td{background:#f9f9f9}
      .footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #dde;font-size:0.78rem;color:#888;text-align:center}
      @media print{button{display:none!important}}
    </style></head><body>
    <div class="header">
      <div class="org-name">${orgName}</div>
      <div class="org-sub">${orgAddress} | ${orgPhone} | ${orgEmail}</div>
      <div class="stamp">WAZEMA<br/>SCBC</div>
    </div>
    <div class="member-info">
      <div class="mi-row"><span class="mi-label">Member ID:</span><span class="mi-val">${member?.id || '—'}</span></div>
      <div class="mi-row"><span class="mi-label">Full Name:</span><span class="mi-val">${member?.name || '—'}</span></div>
      <div class="mi-row"><span class="mi-label">Phone:</span><span class="mi-val">${member?.phone || '—'}</span></div>
      <div class="mi-row"><span class="mi-label">Account Type:</span><span class="mi-val">${member?.account_type || '—'}</span></div>
      <div class="mi-row"><span class="mi-label">Join Date:</span><span class="mi-val">${member?.join_date || '—'}</span></div>
      <div class="mi-row"><span class="mi-label">Statement Date:</span><span class="mi-val">${today}</span></div>
    </div>
    <div class="summary">
      <div class="sum-card"><div class="sum-label">Total Saved</div><div class="sum-val">${currency} ${totalSaved.toFixed(2)}</div></div>
      <div class="sum-card"><div class="sum-label">Total Penalties</div><div class="sum-val">${currency} ${totalPenalty.toFixed(2)}</div></div>
      <div class="sum-card"><div class="sum-label">Total Loans</div><div class="sum-val">${loans.length}</div></div>
    </div>
    <h3>Savings History</h3>
    <table><thead><tr><th>Month</th><th>Amount</th><th>Paid Date</th><th>Status</th><th>Penalty</th></tr></thead>
    <tbody>${savingsRows || '<tr><td colspan="5" style="text-align:center;color:#888">No savings</td></tr>'}</tbody></table>
    <h3>Loan History</h3>
    <table><thead><tr><th>Loan ID</th><th>Amount</th><th>Status</th><th>Request Date</th><th>Approve Date</th></tr></thead>
    <tbody>${loanRows || '<tr><td colspan="5" style="text-align:center;color:#888">No loans</td></tr>'}</tbody></table>
    <div class="footer">
      This statement was generated on ${today} by ${orgName}.<br/>
      For inquiries contact: ${orgPhone} | ${orgEmail}
    </div>
    <br/><button onclick="window.print()" style="padding:0.5rem 1.5rem;background:#1a6bff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem">🖨️ Print / Save as PDF</button>
    </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    toast('PDF preview opened — use Print → Save as PDF', 'info');
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div><div className="page-title">Statement</div><div className="page-sub">Full financial summary — {member?.name}</div></div>
      </div>
      {/* Download buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button className="btn btn-danger" onClick={downloadPDF}>📄 Download PDF</button>
        <button className="btn btn-success" onClick={downloadExcel}>📊 Download Excel</button>
        <button className="btn btn-ghost" onClick={downloadCSV}>📋 Download CSV</button>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print</button>
      </div>
      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        {[['Total Saved', fmt(totalSaved)], ['Total Penalties', fmt(totalPenalty)], ['Total Loans', loans.length]].map(([l, v]) => (
          <div key={l} className="kpi-card"><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: '1.2rem' }}>{v}</div></div>
        ))}
      </div>
      {/* Savings table */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Savings History</div>
        <div className="table-wrap"><table>
          <thead><tr><th>Month</th><th>Amount</th><th>Date</th><th>Status</th><th>Penalty</th></tr></thead>
          <tbody>{[...savings].sort((a, b) => b.month.localeCompare(a.month)).map((s: any) => (
            <tr key={s.id}><td>{formatMonthLabel(s.month)}</td><td>{fmt(s.amount)}</td><td>{fmtDate(s.paid_date)}</td>
              <td><span className={`badge badge-${savingBadge(s.status)}`}>{s.status}</span></td>
              <td>{s.penalty ? fmt(s.penalty) : '—'}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
      {/* Loans table */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Loan History</div>
        <div className="table-wrap"><table>
          <thead><tr><th>ID</th><th>Amount</th><th>Status</th><th>Requested</th><th>Approved</th></tr></thead>
          <tbody>{loans.length === 0 ? <Empty msg="No loans." /> : loans.map((l: any) => (
            <tr key={l.id}><td><code style={{ fontSize: '0.75rem' }}>{l.id}</code></td><td>{fmt(l.amount)}</td>
              <td><span className={`badge badge-${loanBadge(l.status)}`}>{l.status}</span></td>
              <td>{fmtDate(l.request_date)}</td><td>{fmtDate(l.approve_date)}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

// ── Dividends ─────────────────────────────────────────────────────────────────
function DividendsSection({ toast }: any) {
  const [divs, setDivs] = useState<any[]>([]);
  useEffect(() => { api.get('/settings/dividends').then((d: any) => setDivs(Array.isArray(d) ? d : [])).catch((e: any) => toast(e.message, 'danger')); }, []);
  const total = divs.reduce((a, d) => a + Number(d.member_share), 0);
  const paid  = divs.filter(d => d.status === 'paid').reduce((a, d) => a + Number(d.member_share), 0);
  return (
    <>
      <div className="page-title">Dividends</div>
      <div className="page-sub">Your annual profit share</div>
      <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
        {[['Total Earned', fmt(total)], ['Total Paid', fmt(paid)]].map(([l, v]) => (
          <div key={l} className="kpi-card"><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: '1.2rem' }}>{v}</div></div>
        ))}
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Year</th><th>Shares</th><th>Pool</th><th>My Share</th><th>Status</th><th>Paid Date</th></tr></thead>
        <tbody>{divs.length === 0 ? <Empty msg="No dividend records yet." /> : divs.map((d: any) => (
          <tr key={d.id}><td style={{ fontWeight: 700 }}>{d.year}</td><td>{d.share_qty}</td><td>{fmt(d.total_pool)}</td>
            <td style={{ fontWeight: 700, color: '#fbbf24' }}>{fmt(d.member_share)}</td>
            <td><span className={`badge badge-${d.status === 'paid' ? 'success' : 'warning'}`}>{d.status}</span></td>
            <td>{d.paid_date ? fmtDate(d.paid_date) : '—'}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function ProfileSection({ member, toast }: any) {
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changing, setChanging] = useState(false);
  async function changePassword() {
    if (pwForm.newPassword !== pwForm.confirm) { toast('Passwords do not match', 'warning'); return; }
    if (pwForm.newPassword.length < 6) { toast('Min 6 characters', 'warning'); return; }
    setChanging(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast('Password changed. Please log in again.', 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) { toast(e.message, 'danger'); } finally { setChanging(false); }
  }
  return (
    <>
      <div className="page-title">Profile</div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Personal Information</div>
        {member ? (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {[['Member ID', member.id], ['Full Name', member.name], ['Phone', member.phone], ['Email', member.email || '—'], ['Account Type', member.account_type], ['Monthly Saving', fmt(member.monthly_saving)], ['Share Qty', member.share_qty], ['Join Date', fmtDate(member.join_date)], ['Status', member.status]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{k}</span>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      </div>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Change Password</div>
        <div className="form-group"><label>Current Password</label><input type="password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label>New Password</label><input type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} /></div>
          <div className="form-group"><label>Confirm</label><input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary" onClick={changePassword} disabled={changing}>{changing ? 'Changing…' : 'Change Password'}</button>
      </div>
    </>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  return <ToastProvider><MemberDashboard /></ToastProvider>;
}
