'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, fmt, fmtDate, currentMonth, formatMonthLabel, buildMonthOptions, loanBadge, savingBadge, repayBadge, getUser } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import { ToastProvider, useToast } from '@/components/Toast';

const NAV = [
  { icon: '📊', label: 'Overview',         section: 'overview' },
  { icon: '👥', label: 'Members',          section: 'members' },
  { icon: '💰', label: 'Savings',          section: 'savings' },
  { icon: '🏦', label: 'Loans',            section: 'loans' },
  { icon: '📋', label: 'Repayments',       section: 'repayments' },
  { icon: '📊', label: 'Reports',          section: 'reports' },
  { icon: '🔔', label: 'Notifications',    section: 'notifications' },
  { icon: '🚪', label: 'Member Exits',     section: 'exits' },
  { icon: '⚙️',  label: 'Settings',        section: 'settings' },
];

function Empty({ msg = 'No records found.', cols = 99 }: { msg?: string; cols?: number }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>{msg}</td></tr>;
}
function Spinner({ cols = 99 }: { cols?: number }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Loading…</td></tr>;
}

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
    <button onClick={open} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: 'var(--primary-light)', cursor: 'pointer' }}>
      {isImg ? '🖼' : '📄'} {label}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function AdminDashboard() {
  const router = useRouter();
  const toast  = useToast();
  const [section, setSection] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'admin') { router.push('/'); return; }
    pollPending();
    const iv = setInterval(pollPending, 30000);
    return () => clearInterval(iv);
  }, []);

  async function pollPending() {
    try {
      const [ps, pr, pl] = await Promise.all([
        api.get('/savings/pending'),
        api.get('/repayments?month=' + currentMonth()),
        api.get('/loans?status=pending'),
      ]);
      const pendingReps  = Array.isArray(pr) ? pr.filter((r: any) => r.status === 'pending_review').length : 0;
      const pendingLoans = Array.isArray(pl) ? pl.length : 0;
      setPendingCount((Array.isArray(ps) ? ps.length : 0) + pendingReps + pendingLoans);
    } catch {}
  }

  return (
    <div className="app-layout">
      <Sidebar 
        active={section} 
        onSelect={setSection} 
        items={NAV} 
        role="admin" 
        badge={pendingCount > 0 ? pendingCount : undefined}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="main-content">
        <div className="topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>☰</button>
          <span style={{ fontWeight: 700 }}>Admin Panel</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {pendingCount > 0 && (
              <button onClick={() => setSection('savings')}
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '0.25rem 0.75rem', color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                🔔 {pendingCount} pending
              </button>
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>WAZEMA Cooperative</span>
          </div>
        </div>
        <div className="page-content">
          {section === 'overview'      && <OverviewSection toast={toast} />}
          {section === 'members'       && <MembersSection toast={toast} />}
          {section === 'savings'       && <SavingsSection toast={toast} />}
          {section === 'loans'         && <LoansSection toast={toast} />}
          {section === 'repayments'    && <RepaymentsSection toast={toast} />}
          {section === 'reports'       && <ReportsSection toast={toast} />}
          {section === 'notifications' && <NotificationsSection toast={toast} />}
          {section === 'exits'         && <ExitsSection toast={toast} />}
          {section === 'settings'      && <SettingsSection toast={toast} />}
        </div>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewSection({ toast }: { toast: any }) {
  const [stats, setStats]   = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [anns, setAnns]     = useState<any[]>([]);

  useEffect(() => {
    api.get('/settings/dashboard-stats').then(setStats).catch(() => {});
    api.get('/settings/due-alerts').then(setAlerts).catch(() => {});
    api.get('/settings/announcements').then((d: any) => setAnns(Array.isArray(d) ? d.slice(0,3) : [])).catch(() => {});
  }, []);

  const urgencyColor = (u: string) => u === 'overdue' ? 'var(--danger)' : u === 'due_soon' ? 'var(--warning)' : 'var(--muted)';
  const urgencyIcon  = (u: string) => u === 'overdue' ? '🔴' : u === 'due_soon' ? '🟡' : '🟢';

  return (
    <>
      <div className="page-title">Overview</div>
      <div className="page-sub">Dashboard for {formatMonthLabel(currentMonth())}</div>

      {/* KPI Grid */}
      {stats && (
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Active Members',   value: stats.totalMembers },
            { label: 'Total Savings',    value: fmt(stats.totalSavings) },
            { label: 'Active Loan Book', value: fmt(stats.totalLoanBook) },
            { label: 'Pending Loans',    value: stats.pendingLoans },
            { label: 'Collection Rate',  value: (stats.collectionRate ?? 0) + '%' },
            { label: 'Total Penalties',  value: fmt(stats.totalPenalties) },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ fontSize: '1.3rem' }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Due Date Alerts */}
      {alerts && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Savings due alert */}
          <div className={`alert ${alerts.savings_overdue ? 'alert-danger' : alerts.days_until_savings_due <= 3 ? 'alert-warning' : 'alert-info'}`}>
            <span>{alerts.savings_overdue ? '🔴' : alerts.days_until_savings_due <= 3 ? '🟡' : '📅'}</span>
            <div>
              <strong>Savings Due: Day {alerts.savings_due_day}</strong>
              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                {alerts.savings_overdue
                  ? `OVERDUE — ${alerts.unpaid_savings?.length || 0} members unpaid`
                  : `${alerts.days_until_savings_due} days remaining — ${alerts.unpaid_savings?.length || 0} unpaid`}
              </div>
            </div>
          </div>
          {/* Repayment due alert */}
          <div className={`alert ${alerts.repay_overdue ? 'alert-danger' : alerts.days_until_repay_due <= 3 ? 'alert-warning' : 'alert-info'}`}>
            <span>{alerts.repay_overdue ? '🔴' : alerts.days_until_repay_due <= 3 ? '🟡' : '📋'}</span>
            <div>
              <strong>Repayments Due: Day {alerts.repay_due_day}</strong>
              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                {alerts.repay_overdue
                  ? `OVERDUE — ${alerts.unpaid_repayments?.length || 0} members unpaid`
                  : `${alerts.days_until_repay_due} days remaining — ${alerts.unpaid_repayments?.length || 0} unpaid`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending approvals summary */}
      {alerts && (alerts.summary?.pending_approvals > 0 || alerts.summary?.pending_loans > 0) && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '0.75rem' }}>⏳ Pending Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
            {[
              ['Savings Approvals', alerts.summary?.pending_approvals, 'badge-warning'],
              ['Loan Applications', alerts.summary?.pending_loans, 'badge-warning'],
              ['Overdue Repayments', alerts.summary?.overdue_count, 'badge-danger'],
            ].map(([l, v, cls]) => (
              <div key={String(l)} className="kpi-card" style={{ textAlign: 'center' }}>
                <div className="kpi-label">{l}</div>
                <div className={`badge ${cls}`} style={{ fontSize: '1.1rem', padding: '0.3rem 0.8rem', marginTop: '0.3rem' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members near due date */}
      {alerts?.unpaid_savings?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
            💰 Unpaid Savings This Month ({alerts.unpaid_savings.length})
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {alerts.unpaid_savings.slice(0, 10).map((m: any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: urgencyColor(m.urgency) }}>{urgencyIcon(m.urgency)}</span>
                  {' '}<strong>{m.name}</strong> <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>({m.id})</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{m.phone}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(m.monthly_saving)}</span>
                </div>
              </div>
            ))}
            {alerts.unpaid_savings.length > 10 && <div style={{ color: 'var(--muted)', fontSize: '0.78rem', padding: '0.4rem 0' }}>+{alerts.unpaid_savings.length - 10} more…</div>}
          </div>
        </div>
      )}

      {/* Announcements */}
      {anns.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📢 Active Announcements</div>
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

      {/* 6-month trend */}
      {stats?.trend && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>6-Month Savings Trend</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Month</th><th>Collected</th><th>Payments</th></tr></thead>
              <tbody>
                {stats.trend.map((t: any) => (
                  <tr key={t.month}><td>{formatMonthLabel(t.month)}</td><td>{fmt(t.total)}</td><td>{t.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}



// ── Members ───────────────────────────────────────────────────────────────────
const SEL_STYLE: React.CSSProperties = {
  background: '#1a2540', border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 'var(--radius-sm)', color: '#e2eaf8',
  padding: '0.6rem 0.85rem', fontSize: '0.88rem', width: '100%',
};

function MembersSection({ toast }: { toast: any }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewM, setViewM] = useState<any>(null);
  const [editM, setEditM] = useState<any>(null);
  const [showReg, setShowReg] = useState(false);
  const [resetPwId, setResetPwId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);

  const SHARE_PRICE = 1000;
  const REG_FEE_DEFAULT = 300;

  const EMPTY_REG = {
    first_name: '', middle_name: '', last_name: '',
    phone: '', email: '', date_of_birth: '', gender: 'Male', address: '',
    join_date: new Date().toISOString().split('T')[0],
    account_type: 'Regular', monthly_saving: '',
    share_qty: '1', registration_fee: String(REG_FEE_DEFAULT),
    saving_interest_pct: '0', password: '',
    share_paid: true, reg_fee_paid: true,
  };
  const [reg, setReg] = useState({ ...EMPTY_REG });
  const [photoFile, setPhotoFile]     = useState<File | null>(null);
  const [idFile, setIdFile]           = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Computed initial payment
  const shareTotal   = (Number(reg.share_qty) || 1) * SHARE_PRICE;
  const regFee       = Number(reg.registration_fee) || 0;
  const monthlySav   = Number(reg.monthly_saving) || 0;
  const initialTotal = shareTotal + regFee + monthlySav;

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/members'),
      api.get('/loans'),
    ]).then(([d, l]: any[]) => {
      const memberList = Array.isArray(d) ? d : d.data ?? [];
      const loanList   = Array.isArray(l) ? l : l.data ?? [];
      // Attach loan info to each member
      const withLoans = memberList.map((m: any) => {
        const memberLoans = loanList.filter((loan: any) => loan.member_id === m.id);
        const activeLoan  = memberLoans.find((loan: any) => loan.status === 'active');
        const pendingLoan = memberLoans.find((loan: any) => loan.status === 'pending');
        return { ...m, activeLoan, pendingLoan, totalLoans: memberLoans.length };
      });
      setMembers(withLoans);
    }).catch((e: any) => toast(e.message, 'danger')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = members.filter(m =>
    !search ||
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.id?.toLowerCase().includes(search.toLowerCase()) ||
    m.phone?.includes(search)
  );

  async function registerMember() {
    // Validate required fields
    if (!reg.first_name.trim())  { toast('First name is required', 'warning'); return; }
    if (!reg.middle_name.trim()) { toast('Middle name is required', 'warning'); return; }
    if (!reg.last_name.trim())   { toast('Last name is required', 'warning'); return; }
    if (!reg.phone.trim())       { toast('Phone number is required', 'warning'); return; }
    // Validate Ethiopian phone: must start with 09, be 10 digits
    const phoneLocal = reg.phone.replace(/^\+251/, '0').replace(/^251/, '0');
    if (!/^09\d{8}$/.test(phoneLocal)) { toast('Phone must start with 09 and be 10 digits (e.g. 0911234567)', 'warning'); return; }
    if (!reg.date_of_birth)      { toast('Date of birth is required', 'warning'); return; }
    if (!reg.address.trim())     { toast('Address / Kebele is required', 'warning'); return; }
    if (!reg.monthly_saving)     { toast('Monthly saving amount is required', 'warning'); return; }
    if (!reg.password || reg.password.length < 4) { toast('Password must be at least 4 characters', 'warning'); return; }
    if (!photoFile)   { toast('Member photo is required', 'warning'); return; }
    if (!idFile)      { toast('ID document is required', 'warning'); return; }
    if (!receiptFile) { toast('Payment receipt is required', 'warning'); return; }

    setSaving(true);
    try {
      const phone = reg.phone.startsWith('+251') ? reg.phone : '+251' + reg.phone.replace(/^0/, '');
      const res = await api.post('/members', {
        ...reg, phone,
        share_qty: Number(reg.share_qty) || 1,
        share_amount: shareTotal,
        monthly_saving: monthlySav,
        registration_fee: regFee,
        saving_interest_pct: Number(reg.saving_interest_pct) || 0,
      });
      const memberId = res.id;
      // Upload documents
      const uploads: Promise<any>[] = [];
      if (photoFile) {
        const fd = new FormData(); fd.append('file', photoFile); fd.append('type', 'member_photo'); fd.append('record_id', memberId);
        uploads.push(api.upload('/uploads/receipt', fd));
      }
      if (idFile) {
        const fd = new FormData(); fd.append('file', idFile); fd.append('type', 'member_id'); fd.append('record_id', memberId);
        uploads.push(api.upload('/uploads/receipt', fd));
      }
      if (receiptFile) {
        const fd = new FormData(); fd.append('file', receiptFile); fd.append('type', 'member_receipt'); fd.append('record_id', memberId);
        uploads.push(api.upload('/uploads/receipt', fd));
      }
      await Promise.allSettled(uploads);
      toast(`✅ Member ${memberId} registered successfully`, 'success');
      setShowReg(false);
      setReg({ ...EMPTY_REG });
      setPhotoFile(null); setIdFile(null); setReceiptFile(null);
      load();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setSaving(false); }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api.patch(`/members/${editM.id}`, editM);
      toast('Member updated', 'success'); setEditM(null); load();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setSaving(false); }
  }

  async function doResetPw() {
    if (!newPw || newPw.length < 4) { toast('Password must be at least 4 characters', 'warning'); return; }
    try {
      await api.patch(`/members/${resetPwId}/reset-password`, { new_password: newPw });
      toast('Password reset', 'success'); setResetPwId(null); setNewPw('');
    } catch (e: any) { toast(e.message, 'danger'); }
  }

  async function toggleStatus(m: any) {
    const ns = m.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`${ns === 'inactive' ? 'Deactivate' : 'Activate'} ${m.name}?`)) return;
    try { await api.patch(`/members/${m.id}/status`, { status: ns }); toast('Status updated', 'success'); load(); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  const r = reg; const setR = (k: string, v: any) => setReg(prev => ({ ...prev, [k]: v }));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div><div className="page-title">Members</div><div className="page-sub">{members.length} registered</div></div>
        <button className="btn btn-primary" onClick={() => setShowReg(true)}>+ Register Member</button>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, phone…"
        style={{ width: '100%', maxWidth: 320, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '0.55rem 0.85rem', fontSize: '0.88rem', marginBottom: '1rem' }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Type</th><th>Monthly</th><th>Member Status</th><th>Loan Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <Spinner /> : filtered.length === 0 ? <Empty /> : filtered.map((m: any) => (
              <tr key={m.id}>
                <td><code style={{ fontSize: '0.8rem' }}>{m.id}</code></td>
                <td>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{m.email || ''}</div>
                </td>
                <td>{m.phone}</td>
                <td>{m.account_type}</td>
                <td>{fmt(m.monthly_saving)}</td>
                <td><span className={`badge badge-${m.status === 'active' ? 'success' : m.status === 'exited' ? 'muted' : 'danger'}`}>{m.status}</span></td>
                <td>
                  {m.activeLoan ? (
                    <div>
                      <span className="badge badge-success">Active</span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>{fmt(m.activeLoan.amount)}</div>
                    </div>
                  ) : m.pendingLoan ? (
                    <div>
                      <span className="badge badge-warning">Pending</span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>{fmt(m.pendingLoan.amount)}</div>
                    </div>
                  ) : (
                    <span className="badge badge-muted">No Loan</span>
                  )}
                </td>
                <td><div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewM(m)}>View</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditM({ ...m })}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setResetPwId(m.id); setNewPw(''); }}>🔑 PW</button>
                  <button className={`btn btn-sm ${m.status === 'active' ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleStatus(m)}>
                    {m.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewM} onClose={() => setViewM(null)} title="Member Details" wide>
        {viewM && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--teal-light)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Personal Info</div>
              {[['ID', viewM.id], ['Full Name', viewM.name], ['Phone', viewM.phone], ['Email', viewM.email || '—'], ['Date of Birth', fmtDate(viewM.date_of_birth)], ['Gender', viewM.gender || '—'], ['Address', viewM.address || '—'], ['Joined', fmtDate(viewM.join_date)], ['Status', viewM.status]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{k}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--teal-light)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Financial Info</div>
              {[['Account Type', viewM.account_type], ['Monthly Saving', fmt(viewM.monthly_saving)], ['Share Qty', viewM.share_qty], ['Share Amount', fmt(viewM.share_amount)], ['Reg Fee', fmt(viewM.registration_fee)], ['Share Paid', viewM.share_paid ? '✅ Yes' : '❌ No'], ['Reg Fee Paid', viewM.reg_fee_paid ? '✅ Yes' : '❌ No'], ['Interest Rate', (viewM.saving_interest_pct || 0) + '%']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{k}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v}</span>
                </div>
              ))}
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--teal-light)', textTransform: 'uppercase', margin: '1rem 0 0.75rem' }}>Loan Status</div>
              {viewM.activeLoan ? (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}><span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Status</span><span className="badge badge-success">Active</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}><span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Amount</span><span style={{ fontWeight: 600 }}>{fmt(viewM.activeLoan.amount)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Approved</span><span style={{ fontWeight: 600 }}>{fmtDate(viewM.activeLoan.approve_date)}</span></div>
                </div>
              ) : viewM.pendingLoan ? (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}><span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Status</span><span className="badge badge-warning">Pending</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Amount</span><span style={{ fontWeight: 600 }}>{fmt(viewM.pendingLoan.amount)}</span></div>
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No active or pending loan</div>
              )}
              {/* Documents */}
              {(viewM.photo_url || viewM.id_document_url || viewM.payment_receipt_url) && (
                <>
                  <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--teal-light)', textTransform: 'uppercase', margin: '1rem 0 0.75rem' }}>Documents</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {viewM.photo_url && <FileLink url={viewM.photo_url} label="Photo" />}
                    {viewM.id_document_url && <FileLink url={viewM.id_document_url} label="ID Doc" />}
                    {viewM.payment_receipt_url && <FileLink url={viewM.payment_receipt_url} label="Receipt" />}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editM} onClose={() => setEditM(null)} title="Edit Member" wide>
        {editM && <>
          <div className="form-row">
            <div className="form-group"><label>First Name</label><input value={editM.first_name} onChange={e => setEditM({ ...editM, first_name: e.target.value })} /></div>
            <div className="form-group"><label>Middle Name</label><input value={editM.middle_name || ''} onChange={e => setEditM({ ...editM, middle_name: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Last Name</label><input value={editM.last_name || ''} onChange={e => setEditM({ ...editM, last_name: e.target.value })} /></div>
            <div className="form-group"><label>Phone</label><input value={editM.phone} onChange={e => setEditM({ ...editM, phone: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Monthly Saving (ETB)</label><input type="number" value={editM.monthly_saving} onChange={e => setEditM({ ...editM, monthly_saving: e.target.value })} /></div>
            <div className="form-group"><label>Account Type</label>
              <select value={editM.account_type} style={SEL_STYLE} onChange={e => setEditM({ ...editM, account_type: e.target.value })}>
                <option style={{ background: '#1a2540' }}>Regular</option>
                <option style={{ background: '#1a2540' }}>Interest</option>
                <option style={{ background: '#1a2540' }}>Childrens</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-full" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </>}
      </Modal>

      {/* Reset PW Modal */}
      <Modal open={!!resetPwId} onClose={() => setResetPwId(null)} title="Reset Password">
        <div className="form-group"><label>New Password (min 4 chars)</label><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
        <button className="btn btn-primary btn-full" onClick={doResetPw}>Reset Password</button>
      </Modal>

      {/* Register Modal — properly ordered, with file uploads and auto-calculated initial payment */}
      <Modal open={showReg} onClose={() => { setShowReg(false); setReg({ ...EMPTY_REG }); setPhotoFile(null); setIdFile(null); setReceiptFile(null); }} title="Register New Member" wide>

        {/* ── SECTION 1: Personal Information ── */}
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          1. Personal Information
        </div>
        <div className="form-row">
          <div className="form-group">
            <input value={r.first_name} onChange={e => setR('first_name', e.target.value)} placeholder=" " style={{ borderColor: !r.first_name ? 'rgba(239,68,68,0.4)' : undefined }} />
            <label>First Name (ስም) *</label>
          </div>
          <div className="form-group">
            <input value={r.middle_name} onChange={e => setR('middle_name', e.target.value)} placeholder=" " style={{ borderColor: !r.middle_name ? 'rgba(239,68,68,0.4)' : undefined }} />
            <label>Middle Name (የአባት ስም) *</label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <input value={r.last_name} onChange={e => setR('last_name', e.target.value)} placeholder=" " />
            <label>Last Name (የአያት ስም) *</label>
          </div>
          <div className="form-group">
            <input value={r.phone} onChange={e => setR('phone', e.target.value)} placeholder="09XXXXXXXX"
              style={{ borderColor: r.phone && !/^09\d{8}$/.test(r.phone.replace(/^\+251/, '0').replace(/^251/, '0')) ? 'var(--danger)' : undefined }} />
            <label>Phone * (must start with 09, 10 digits)</label>
            {r.phone && !/^09\d{8}$/.test(r.phone.replace(/^\+251/, '0').replace(/^251/, '0')) && (
              <span style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>⚠️ Must be 09XXXXXXXX (10 digits)</span>
            )}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <input type="date" value={r.date_of_birth} onChange={e => setR('date_of_birth', e.target.value)} />
            <label>Date of Birth *</label>
          </div>
          <div className="form-group">
            <select value={r.gender} style={SEL_STYLE} onChange={e => setR('gender', e.target.value)}>
              <option style={{ background: '#1a2540' }}>Male</option>
              <option style={{ background: '#1a2540' }}>Female</option>
            </select>
            <label>Gender</label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <input value={r.address} onChange={e => setR('address', e.target.value)} placeholder="e.g. Kebele 05, Addis Ababa" />
            <label>Kebele / Address *</label>
          </div>
          <div className="form-group">
            <input type="email" value={r.email} onChange={e => setR('email', e.target.value)} placeholder="optional" />
            <label>Email</label>
          </div>
        </div>

        {/* ── SECTION 2: Account Settings ── */}
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-light)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '1rem 0 0.75rem' }}>
          2. Account Settings
        </div>
        <div className="form-row">
          <div className="form-group">
            <input type="date" value={r.join_date} onChange={e => setR('join_date', e.target.value)} />
            <label>Join Date *</label>
          </div>
          <div className="form-group">
            <select value={r.account_type} style={SEL_STYLE} onChange={e => setR('account_type', e.target.value)}>
              <option style={{ background: '#1a2540' }}>Regular</option>
              <option style={{ background: '#1a2540' }}>Interest</option>
              <option style={{ background: '#1a2540' }}>Childrens</option>
            </select>
            <label>Account Type</label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <input type="number" min={1} value={r.share_qty} onChange={e => setR('share_qty', e.target.value)} />
            <label>Number of Shares * (1 share = ETB {SHARE_PRICE.toLocaleString()})</label>
          </div>
          <div className="form-group">
            <input value={`ETB ${shareTotal.toLocaleString()}`} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
            <label>Share Amount (auto-calculated)</label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <input type="number" min={0} value={r.monthly_saving} onChange={e => setR('monthly_saving', e.target.value)} placeholder="e.g. 500" />
            <label>Monthly Saving Amount (ETB) *</label>
          </div>
          <div className="form-group">
            <input type="number" min={0} value={r.registration_fee} onChange={e => setR('registration_fee', e.target.value)} />
            <label>Registration Fee (ETB) *</label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <input type="number" min={0} max={100} step={0.1} value={r.saving_interest_pct} onChange={e => setR('saving_interest_pct', e.target.value)} />
            <label>Saving Interest Rate (%)</label>
          </div>
          <div className="form-group">
            <select value={r.share_paid ? '1' : '0'} style={SEL_STYLE} onChange={e => setR('share_paid', e.target.value === '1')}>
              <option value="1" style={{ background: '#1a2540' }}>✅ Yes — Paid</option>
              <option value="0" style={{ background: '#1a2540' }}>❌ No — Pending</option>
            </select>
            <label>Share Paid?</label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <select value={r.reg_fee_paid ? '1' : '0'} style={SEL_STYLE} onChange={e => setR('reg_fee_paid', e.target.value === '1')}>
              <option value="1" style={{ background: '#1a2540' }}>✅ Yes — Paid</option>
              <option value="0" style={{ background: '#1a2540' }}>❌ No — Pending</option>
            </select>
            <label>Registration Fee Paid?</label>
          </div>
          <div className="form-group">
            <input type="password" value={r.password} onChange={e => setR('password', e.target.value)} placeholder="Min 4 characters" />
            <label>Initial Password *</label>
          </div>
        </div>

        {/* ── Initial Payment Summary ── */}
        <div style={{ background: 'rgba(26,107,255,0.08)', border: '1px solid rgba(26,107,255,0.2)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--primary-light)' }}>💰 Initial Payment Summary</div>
          {[
            [`Share Amount (${r.share_qty || 1} × ETB ${SHARE_PRICE.toLocaleString()})`, shareTotal],
            ['Registration Fee', regFee],
            ['First Month Saving', monthlySav],
          ].map(([label, val]) => (
            <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.2rem 0' }}>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
              <span>ETB {Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <span>Total Initial Payment</span>
            <span style={{ color: '#fbbf24' }}>ETB {initialTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* ── SECTION 3: Documents ── */}
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          3. Documents & Photo
        </div>
        <div className="form-row">
          <div className="form-group">
            <input type="file" accept="image/*" capture="user" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
            <label>Member Photo * (📷 camera or upload)</label>
            {photoFile && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>✅ {photoFile.name}</span>}
            {!photoFile && <span style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>Required</span>}
          </div>
          <div className="form-group">
            <input type="file" accept="image/*,.pdf" capture="environment" onChange={e => setIdFile(e.target.files?.[0] || null)} />
            <label>ID Card / Kebele ID * (📷 scan or upload)</label>
            {idFile && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>✅ {idFile.name}</span>}
            {!idFile && <span style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>Required</span>}
          </div>
        </div>
        <div className="form-group">
          <input type="file" accept="image/*,.pdf" capture="environment" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
          <label>Initial Payment Receipt * (📷 scan or upload)</label>
          {receiptFile && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>✅ {receiptFile.name}</span>}
          {!receiptFile && <span style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>Required — upload receipt for share + registration fee payment</span>}
        </div>

        <button className="btn btn-primary btn-full" onClick={registerMember}
          disabled={saving || !photoFile || !idFile || !receiptFile}>
          {saving ? 'Registering…' : 'Register Member'}
        </button>
      </Modal>
    </>
  );
}

// ── Savings ───────────────────────────────────────────────────────────────────
function SavingsSection({ toast }: { toast: any }) {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recModal, setRecModal] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [rec, setRec] = useState({ member_id: '', month: currentMonth(), amount: '', paid_date: new Date().toISOString().split('T')[0], status: 'paid', penalty: '0' });
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Include future months for advance payments (6 months ahead)
  const monthOpts = buildMonthOptions(24, 6);

  function load() {
    setLoading(true);
    Promise.all([
      api.get(`/savings/summary?month=${month}`),
      api.get('/savings/pending'),
    ]).then(([s, p]) => {
      setSummary(s);
      setPending(Array.isArray(p) ? p : []);
      setSelectedIds(new Set()); // Clear selection on reload
    }).catch((e: any) => toast(e.message, 'danger')).finally(() => setLoading(false));
  }
  useEffect(load, [month]);

  // Load members for record modal
  useEffect(() => {
    api.get('/members').then((d: any) => setMembers(Array.isArray(d) ? d : d.data ?? [])).catch(() => {});
  }, []);

  async function confirmSaving(id: string, status = 'paid') {
    try { await api.patch(`/savings/${id}/confirm`, { status, penalty: 0 }); toast('Confirmed', 'success'); load(); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function recordSaving() {
    if (!rec.member_id) { toast('Select a member', 'warning'); return; }
    if (!rec.amount || Number(rec.amount) <= 0) { toast('Enter a valid amount', 'warning'); return; }
    setSaving(true);
    try {
      await api.post('/savings', { ...rec, amount: Number(rec.amount), penalty: Number(rec.penalty) });
      toast('Saving recorded', 'success'); setRecModal(false);
      setRec({ member_id: '', month: currentMonth(), amount: '', paid_date: new Date().toISOString().split('T')[0], status: 'paid', penalty: '0' });
      load();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setSaving(false); }
  }

  async function bulkConfirm() {
    if (selectedIds.size === 0) {
      toast('No payments selected', 'warning');
      return;
    }
    if (!confirm(`Confirm ${selectedIds.size} selected payment(s) as PAID?`)) return;
    
    setBulkProcessing(true);
    try {
      const result = await api.post('/savings/bulk-confirm', { 
        ids: Array.from(selectedIds),
        status: 'paid'
      });
      toast(`✅ ${result.confirmed} of ${result.total} payment(s) confirmed`, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBulkProcessing(false);
    }
  }

  async function bulkConfirmAll() {
    if (pending.length === 0) return;
    if (!confirm(`Confirm ALL ${pending.length} pending payment(s) as PAID?`)) return;
    
    setBulkProcessing(true);
    try {
      const allIds = pending.map(s => s.id);
      const result = await api.post('/savings/bulk-confirm', { 
        ids: allIds,
        status: 'paid'
      });
      toast(`✅ ${result.confirmed} of ${result.total} payment(s) confirmed`, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBulkProcessing(false);
    }
  }

  function toggleSelection(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  function toggleSelectAll() {
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map(s => s.id)));
    }
  }

  return (
    <>
      <div className="page-title">Savings</div>
      <div className="page-sub">Monthly savings management</div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={month} style={{ background: '#1a2540', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 'var(--radius-sm)', color: '#e2eaf8', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
          onChange={e => setMonth(e.target.value)}>
          {monthOpts.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2540', color: '#e2eaf8' }}>{o.label}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setRecModal(true)}>+ Record Saving</button>
        {pending.length > 0 && (
          <>
            {selectedIds.size > 0 && (
              <button className="btn btn-success btn-sm" onClick={bulkConfirm} disabled={bulkProcessing}>
                ✅ Approve Selected ({selectedIds.size})
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={bulkConfirmAll} disabled={bulkProcessing}>
              ✅ Approve All ({pending.length})
            </button>
          </>
        )}
      </div>

      {/* Pending approvals — always shown at top when there are any */}
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.9rem' }}>⏳ Pending Approvals ({pending.length})</div>
            <span className="badge badge-warning">{pending.length} awaiting confirmation</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === pending.length && pending.length > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th>Member</th><th>Month</th><th>Amount</th><th>Date</th><th>Bank Paid To</th><th>Receipt</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((s: any) => {
                  const isAdv = s.month > currentMonth();
                  return (
                    <tr key={s.id}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelection(s.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.member_name}</div>
                        <code style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{s.member_id}</code>
                      </td>
                      <td>
                        {formatMonthLabel(s.month)}
                        {isAdv && <span className="badge badge-info" style={{ fontSize: '0.6rem', marginLeft: '0.3rem' }}>ADVANCE</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(s.amount)}</td>
                      <td>{fmtDate(s.paid_date)}</td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {s.bank_name ? <><div style={{ fontWeight: 600 }}>{s.bank_name}</div><div style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>{s.account_number}</div></> : '—'}
                      </td>
                      <td><FileLink url={s.receipt_url} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button className="btn btn-success btn-sm" onClick={() => confirmSaving(s.id)}>✓ Confirm</button>
                          <button className="btn btn-danger btn-sm" onClick={() => confirmSaving(s.id, 'late')}>✗ Reject</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KPI summary */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
          {[['Paid', summary.paidCount], ['Unpaid', summary.unpaidCount], ['Collected', fmt(summary.totalCollected)], ['Pending Review', summary.pendingReview]].map(([l, v]) => (
            <div key={l} className="kpi-card"><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: '1.2rem' }}>{v}</div></div>
          ))}
        </div>
      )}

      {/* Monthly status table */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Monthly Status — {formatMonthLabel(month)}</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Monthly</th><th>Paid Amount</th><th>Date</th><th>Status</th><th>Penalty</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <Spinner /> : !summary ? <Empty /> : summary.summary.map((m: any) => {
                const p = m.payment;
                return (
                  <tr key={m.id}>
                    <td><code style={{ fontSize: '0.8rem' }}>{m.id}</code></td>
                    <td>{m.name}</td>
                    <td>{fmt(m.monthly_saving)}</td>
                    <td>{p ? fmt(p.amount) : '—'}</td>
                    <td>{p ? fmtDate(p.paid_date) : '—'}</td>
                    <td>{p ? <span className={`badge badge-${savingBadge(p.status)}`}>{p.status === 'pending_review' ? '⏳ REVIEW' : p.status}</span> : <span className="badge badge-danger">Unpaid</span>}</td>
                    <td>{p?.penalty ? fmt(p.penalty) : '—'}</td>
                    <td>
                      {!p && <button className="btn btn-primary btn-sm" onClick={() => { setRec({ member_id: m.id, month, amount: String(m.monthly_saving), paid_date: new Date().toISOString().split('T')[0], status: 'paid', penalty: '0' }); setRecModal(true); }}>Record</button>}
                      {p?.status === 'pending_review' && <button className="btn btn-success btn-sm" onClick={() => confirmSaving(p.id)}>Confirm</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Saving Modal */}
      <Modal open={recModal} onClose={() => setRecModal(false)} title="Record Saving">
        <div className="form-group">
          <label>Member *</label>
          <select value={rec.member_id} style={{ background: '#1a2540', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 'var(--radius-sm)', color: '#e2eaf8', padding: '0.6rem 0.85rem', fontSize: '0.88rem', width: '100%' }}
            onChange={e => setRec({ ...rec, member_id: e.target.value })}>
            <option value="" style={{ background: '#1a2540' }}>Select member…</option>
            {members.map((m: any) => <option key={m.id} value={m.id} style={{ background: '#1a2540' }}>{m.id} — {m.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Month (including future for advance)</label>
            <select value={rec.month} style={{ background: '#1a2540', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 'var(--radius-sm)', color: '#e2eaf8', padding: '0.6rem 0.85rem', fontSize: '0.88rem', width: '100%' }}
              onChange={e => setRec({ ...rec, month: e.target.value })}>
              {monthOpts.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2540' }}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Amount (ETB) *</label><input type="number" value={rec.amount} onChange={e => setRec({ ...rec, amount: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Paid Date</label><input type="date" value={rec.paid_date} onChange={e => setRec({ ...rec, paid_date: e.target.value })} /></div>
          <div className="form-group">
            <label>Status</label>
            <select value={rec.status} style={{ background: '#1a2540', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 'var(--radius-sm)', color: '#e2eaf8', padding: '0.6rem 0.85rem', fontSize: '0.88rem', width: '100%' }}
              onChange={e => setRec({ ...rec, status: e.target.value })}>
              <option value="paid" style={{ background: '#1a2540' }}>Paid</option>
              <option value="late" style={{ background: '#1a2540' }}>Late</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>Penalty (ETB)</label><input type="number" value={rec.penalty} onChange={e => setRec({ ...rec, penalty: e.target.value })} /></div>
        <button className="btn btn-primary btn-full" onClick={recordSaving} disabled={saving}>{saving ? 'Recording…' : 'Record Saving'}</button>
      </Modal>
    </>
  );
}
// ── Loans ─────────────────────────────────────────────────────────────────────
function LoansSection({ toast }: { toast: any }) {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [schedModal, setSchedModal] = useState<any>(null);
  const [schedData, setSchedData] = useState<any>(null);
  const [approveModal, setApproveModal] = useState<any>(null);
  const [refiModal, setRefiModal] = useState<any>(null);
  const [apprForm, setApprForm] = useState({ third_party_ref:'', approve_date:new Date().toISOString().split('T')[0], repayment_months:'12', interest_rate:'5', guarantor_name:'', guarantor_phone:'' });
  const [apprDoc, setApprDoc] = useState<File | null>(null);
  const [refiForm, setRefiForm] = useState({ new_amount:'', repayment_months:'12', interest_rate:'5', reason:'' });
  const [acting, setActing] = useState(false);

  function load() {
    setLoading(true);
    const url = statusFilter ? `/loans?status=${statusFilter}` : '/loans';
    api.get(url).then((d: any) => setLoans(Array.isArray(d) ? d : d.data ?? [])).catch((e: any) => toast(e.message, 'danger')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  async function viewSchedule(loan: any) {
    setSchedModal(loan); setSchedData(null);
    try { const d = await api.get(`/repayments/schedule/${loan.id}`); setSchedData(d); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function approveLoan() {
    if (!apprForm.third_party_ref || !apprForm.approve_date) { toast('Third party ref and date required', 'warning'); return; }
    setActing(true);
    try {
      const res = await api.post(`/loans/${approveModal.id}/approve`, { ...apprForm, repayment_months: Number(apprForm.repayment_months), interest_rate: Number(apprForm.interest_rate) });
      // Upload third-party document if provided
      if (apprDoc) {
        try {
          const fd = new FormData();
          fd.append('file', apprDoc);
          fd.append('type', 'third_party');
          fd.append('record_id', approveModal.id);
          await api.upload('/uploads/receipt', fd);
        } catch { toast('Loan approved but document upload failed', 'warning'); }
      }
      toast(`✅ Loan approved! Monthly payment: ${fmt(res.monthly_payment)}`, 'success');
      setApproveModal(null); setApprDoc(null); load();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setActing(false); }
  }

  async function rejectLoan(loan: any) {
    const reason = prompt('Rejection reason (required):');
    if (!reason?.trim()) return;
    try { await api.post(`/loans/${loan.id}/reject`, { rejection_reason: reason.trim() }); toast('Loan rejected', 'warning'); load(); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function refinanceLoan() {
    if (!refiForm.new_amount || !refiForm.reason) { toast('Amount and reason required', 'warning'); return; }
    setActing(true);
    try {
      await api.post(`/loans/${refiModal.id}/refinance`, { new_amount: Number(refiForm.new_amount), repayment_months: Number(refiForm.repayment_months), interest_rate: Number(refiForm.interest_rate), reason: refiForm.reason });
      toast('Loan refinanced', 'success'); setRefiModal(null); load();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setActing(false); }
  }

  return (
    <>
      <div className="page-title">Loans</div>
      <div className="page-sub">Loan applications and management</div>
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem' }}>
        {['','pending','active','completed','rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding:'0.4rem 0.9rem', borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer', fontWeight:600, fontSize:'0.82rem', background: statusFilter===s ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: statusFilter===s ? '#fff' : 'var(--muted)' }}>
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Member</th><th>Amount</th><th>Status</th><th>Requested</th><th>Approved</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <Spinner /> : loans.length === 0 ? <Empty /> : loans.map((l: any) => (
              <tr key={l.id}>
                <td><code style={{fontSize:'0.8rem'}}>{l.id}</code></td>
                <td>{l.member_name || l.member_id}</td>
                <td>{fmt(l.amount)}</td>
                <td><span className={`badge badge-${loanBadge(l.status)}`}>{l.status}</span></td>
                <td>{fmtDate(l.request_date)}</td>
                <td>{fmtDate(l.approve_date)}</td>
                <td><div style={{display:'flex',gap:'0.3rem',flexWrap:'wrap'}}>
                  <button className="btn btn-ghost btn-sm" onClick={() => viewSchedule(l)}>Schedule</button>
                  {l.status === 'pending' && <>
                    <button className="btn btn-success btn-sm" onClick={() => { setApproveModal(l); setApprForm({...apprForm,approve_date:new Date().toISOString().split('T')[0]}); }}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => rejectLoan(l)}>Reject</button>
                  </>}
                  {l.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => { setRefiModal(l); setRefiForm({new_amount:String(l.amount),repayment_months:'12',interest_rate:'5',reason:''}); }}>🔄 Refi</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!schedModal} onClose={() => setSchedModal(null)} title={`Schedule — ${schedModal?.id}`} wide>
        {!schedData ? <p style={{color:'var(--muted)'}}>Loading…</p> : (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem',marginBottom:'1rem'}}>
              <div className="kpi-card"><div className="kpi-label">Total Paid</div><div className="kpi-value" style={{fontSize:'1.1rem'}}>{fmt(schedData.summary?.totalPaid)}</div></div>
              <div className="kpi-card"><div className="kpi-label">Remaining</div><div className="kpi-value" style={{fontSize:'1.1rem'}}>{fmt(schedData.summary?.remaining)}</div></div>
              <div className="kpi-card"><div className="kpi-label">Progress</div><div className="kpi-value" style={{fontSize:'1.1rem'}}>{schedData.summary?.progress}%</div></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Month</th><th>Amount</th><th>Due</th><th>Paid</th><th>Status</th><th>Penalty</th></tr></thead>
                <tbody>
                  {(schedData.repayments || []).map((r: any, i: number) => (
                    <tr key={r.id}><td>{i+1}</td><td>{formatMonthLabel(r.month)}</td><td>{fmt(r.amount)}</td><td>{fmtDate(r.due_date)}</td><td>{fmtDate(r.paid_date)}</td>
                      <td><span className={`badge badge-${repayBadge(r.status)}`}>{r.status}</span></td><td>{r.penalty ? fmt(r.penalty) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!approveModal} onClose={() => { setApproveModal(null); setApprDoc(null); }} title={`Approve Loan — ${approveModal?.member_name}`} wide>
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          <span>🏦</span><span>Loan Amount: <strong>{fmt(approveModal?.amount)}</strong></span>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Third Party Reference * (Agreement No.)</label><input value={apprForm.third_party_ref} onChange={e => setApprForm({...apprForm,third_party_ref:e.target.value})} placeholder="e.g. TP-2026-001" /></div>
          <div className="form-group"><label>Approve Date *</label><input type="date" value={apprForm.approve_date} onChange={e => setApprForm({...apprForm,approve_date:e.target.value})} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Repayment Months</label><input type="number" value={apprForm.repayment_months} onChange={e => setApprForm({...apprForm,repayment_months:e.target.value})} /></div>
          <div className="form-group"><label>Interest Rate %</label><input type="number" value={apprForm.interest_rate} onChange={e => setApprForm({...apprForm,interest_rate:e.target.value})} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Guarantor Name</label><input value={apprForm.guarantor_name} onChange={e => setApprForm({...apprForm,guarantor_name:e.target.value})} /></div>
          <div className="form-group"><label>Guarantor Phone</label><input value={apprForm.guarantor_phone} onChange={e => setApprForm({...apprForm,guarantor_phone:e.target.value})} /></div>
        </div>
        <div className="form-group">
          <label>Third-Party Agreement Document (📷 scan or upload)</label>
          <input type="file" accept="image/*,.pdf" onChange={e => setApprDoc(e.target.files?.[0] || null)} />
          {apprDoc && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>✅ {apprDoc.name}</span>}
          {!apprDoc && <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Optional — upload signed agreement paper</span>}
        </div>
        <button className="btn btn-success btn-full" onClick={approveLoan} disabled={acting}>{acting?'Approving…':'✅ Approve Loan'}</button>
      </Modal>

      <Modal open={!!refiModal} onClose={() => setRefiModal(null)} title={`Refinance — ${refiModal?.id}`}>
        <div className="alert alert-warning" style={{marginBottom:'1rem'}}><span>⚠️</span><span>Unpaid installments will be replaced with a new schedule.</span></div>
        <div className="form-row">
          <div className="form-group"><label>New Amount (ETB) *</label><input type="number" value={refiForm.new_amount} onChange={e => setRefiForm({...refiForm,new_amount:e.target.value})} /></div>
          <div className="form-group"><label>Months</label><input type="number" value={refiForm.repayment_months} onChange={e => setRefiForm({...refiForm,repayment_months:e.target.value})} /></div>
        </div>
        <div className="form-group"><label>Reason *</label><input value={refiForm.reason} onChange={e => setRefiForm({...refiForm,reason:e.target.value})} /></div>
        <button className="btn btn-primary btn-full" onClick={refinanceLoan} disabled={acting}>{acting?'Refinancing…':'Refinance Loan'}</button>
      </Modal>
    </>
  );
}

// ── Repayments ────────────────────────────────────────────────────────────────
function RepaymentsSection({ toast }: { toast: any }) {
  const [month, setMonth] = useState(currentMonth());
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  function load() {
    setLoading(true);
    api.get(`/repayments?month=${month}`).then((d: any) => {
      setRepayments(Array.isArray(d) ? d : []);
      setSelectedIds(new Set()); // Clear selection on reload
    }).catch((e: any) => toast(e.message, 'danger')).finally(() => setLoading(false));
  }
  useEffect(load, [month]);

  async function confirm(id: string) {
    try { const r = await api.patch(`/repayments/${id}/confirm`, {}); toast(r.completed ? '🎉 Loan fully repaid!' : 'Repayment confirmed', 'success'); load(); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function bulkConfirm() {
    if (selectedIds.size === 0) {
      toast('No repayments selected', 'warning');
      return;
    }
    if (!confirm(`Confirm ${selectedIds.size} selected repayment(s)?`)) return;
    
    setBulkProcessing(true);
    try {
      const result = await api.post('/repayments/bulk-confirm', { 
        ids: Array.from(selectedIds)
      });
      toast(`✅ ${result.confirmed} of ${result.total} repayment(s) confirmed`, 'success');
      if (result.loans_affected > 0) {
        toast(`📊 ${result.loans_affected} loan(s) updated`, 'info');
      }
      load();
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBulkProcessing(false);
    }
  }

  async function bulkConfirmAll() {
    const pending = repayments.filter(r => r.status === 'pending_review');
    if (pending.length === 0) return;
    if (!confirm(`Confirm ALL ${pending.length} pending repayment(s)?`)) return;
    
    setBulkProcessing(true);
    try {
      const allIds = pending.map(r => r.id);
      const result = await api.post('/repayments/bulk-confirm', { 
        ids: allIds
      });
      toast(`✅ ${result.confirmed} of ${result.total} repayment(s) confirmed`, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBulkProcessing(false);
    }
  }

  function toggleSelection(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  function toggleSelectAll() {
    const pending = repayments.filter(r => r.status === 'pending_review');
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map(r => r.id)));
    }
  }

  const monthOpts = buildMonthOptions(12, 6);
  const pendingCount = repayments.filter(r => r.status === 'pending_review').length;

  return (
    <>
      <div className="page-title">Repayments</div>
      <div className="page-sub">Loan repayment records</div>
      
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'0.5rem 0.75rem', fontSize:'0.85rem' }}>
          {monthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {pendingCount > 0 && (
          <>
            {selectedIds.size > 0 && (
              <button className="btn btn-success btn-sm" onClick={bulkConfirm} disabled={bulkProcessing}>
                ✅ Approve Selected ({selectedIds.size})
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={bulkConfirmAll} disabled={bulkProcessing}>
              ✅ Approve All Pending ({pendingCount})
            </button>
          </>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {pendingCount > 0 && (
                <th style={{ width: '40px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === pendingCount && pendingCount > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
              )}
              <th>Member</th><th>Loan</th><th>Month</th><th>Amount</th><th>Status</th><th>Paid Date</th><th>Penalty</th><th>Bank</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <Spinner /> : repayments.length === 0 ? <Empty /> : repayments.map((r: any) => (
              <tr key={r.id}>
                {pendingCount > 0 && (
                  <td>
                    {r.status === 'pending_review' ? (
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelection(r.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    ) : null}
                  </td>
                )}
                <td>{r.member_name || r.member_id}</td>
                <td><code style={{fontSize:'0.75rem'}}>{r.loan_id}</code></td>
                <td>{formatMonthLabel(r.month)}</td>
                <td>{fmt(r.amount)}</td>
                <td><span className={`badge badge-${repayBadge(r.status)}`}>{r.status}</span></td>
                <td>{fmtDate(r.paid_date)}</td>
                <td>{r.penalty ? fmt(r.penalty) : '—'}</td>
                <td style={{fontSize:'0.75rem'}}>{r.bank_name || '—'}</td>
                <td>{r.status === 'pending_review' && <button className="btn btn-success btn-sm" onClick={() => confirm(r.id)}>✓ Confirm</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────
function ReportsSection({ toast }: { toast: any }) {
  const [from, setFrom] = useState(new Date().getFullYear() + '-01-01');
  const [to, setTo]     = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try { const d = await api.get(`/settings/financial-report?from=${from}&to=${to}`); setReport(d); }
    catch (e: any) { toast(e.message, 'danger'); } finally { setLoading(false); }
  }

  function exportCSV(type: string) {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('wazema_token') : '';
    fetch(`/api/${type}/export/csv`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob()).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${type}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        toast(`${type}.csv downloaded`, 'success');
      }).catch(() => toast('Export failed', 'danger'));
  }

  return (
    <>
      <div className="page-title">Financial Report</div>
      <div className="page-sub">Date range financial overview</div>
      <div className="card" style={{ marginBottom:'1rem' }}>
        <div className="form-row">
          <div className="form-group"><label>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="form-group"><label>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading?'Generating…':'📊 Generate'}</button>
          {['members','savings','loans','repayments'].map(t => (
            <button key={t} className="btn btn-ghost btn-sm" onClick={() => exportCSV(t)}>⬇️ {t}.csv</button>
          ))}
        </div>
      </div>
      {report && (
        <>
          <div className="kpi-grid">
            {[['Total Savings',fmt(report.savings?.total)],['Loans Approved',report.loans?.approved_count+' loans'],['Total Repaid',fmt(report.loans?.total_repaid)],['Overdue',fmt(report.loans?.overdue)]].map(([l,v]) => (
              <div key={l} className="kpi-card"><div className="kpi-label">{l}</div><div className="kpi-value" style={{fontSize:'1.2rem'}}>{v}</div></div>
            ))}
          </div>
          <div className="card" style={{ marginTop:'1rem' }}>
            <div style={{ fontWeight:700, marginBottom:'0.75rem' }}>Monthly Breakdown</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Month</th><th>Payments</th><th>Collected</th><th>Penalties</th></tr></thead>
                <tbody>
                  {(report.monthly_breakdown || []).map((m: any) => (
                    <tr key={m.month}><td>{formatMonthLabel(m.month)}</td><td>{m.payments}</td><td>{fmt(m.collected)}</td><td>{fmt(m.penalties)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
function NotificationsSection({ toast }: { toast: any }) {
  const [alerts, setAlerts]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [viewItem, setViewItem]   = useState<any>(null); // item being reviewed
  const [viewType, setViewType]   = useState<'saving' | 'repayment' | null>(null);
  const [penaltyOverride, setPenaltyOverride] = useState('');

  function load() {
    setLoading(true);
    api.get('/settings/due-alerts').then(setAlerts).catch((e: any) => toast(e.message, 'danger')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openReview(item: any, type: 'saving' | 'repayment') {
    setViewItem(item);
    setViewType(type);
    setPenaltyOverride(String(item.penalty || 0));
  }

  async function doConfirmSaving() {
    try {
      await api.patch(`/savings/${viewItem.id}/confirm`, { status: 'paid', penalty: Number(penaltyOverride) || 0 });
      toast('✅ Saving confirmed', 'success'); setViewItem(null); load();
    } catch (e: any) { toast(e.message, 'danger'); }
  }
  async function doRejectSaving() {
    if (!confirm('Reject this saving submission?')) return;
    try {
      await api.patch(`/savings/${viewItem.id}/confirm`, { status: 'late', penalty: Number(penaltyOverride) || 0 });
      toast('Saving rejected', 'warning'); setViewItem(null); load();
    } catch (e: any) { toast(e.message, 'danger'); }
  }
  async function doConfirmRepayment() {
    try {
      const r = await api.patch(`/repayments/${viewItem.id}/confirm`, { penalty: Number(penaltyOverride) || 0 });
      toast(r.completed ? '🎉 Loan fully repaid!' : '✅ Repayment confirmed', 'success'); setViewItem(null); load();
    } catch (e: any) { toast(e.message, 'danger'); }
  }
  async function confirmSaving(id: string) {
    try { await api.patch(`/savings/${id}/confirm`, { status: 'paid', penalty: 0 }); toast('✅ Saving confirmed', 'success'); load(); }
    catch (e: any) { toast(e.message, 'danger'); }
  }
  async function confirmRepayment(id: string) {
    try { const r = await api.patch(`/repayments/${id}/confirm`, {}); toast(r.completed ? '🎉 Loan fully repaid!' : '✅ Repayment confirmed', 'success'); load(); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  if (!alerts) return null;

  const totalPending = (alerts.summary?.pending_approvals || 0) + (alerts.summary?.pending_loans || 0) + (alerts.summary?.overdue_count || 0);

  return (
    <>
      <div className="page-title">Notifications</div>
      <div className="page-sub">{totalPending} item{totalPending !== 1 ? 's' : ''} requiring attention</div>

      {/* Due date alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className={`alert ${alerts.savings_overdue ? 'alert-danger' : alerts.days_until_savings_due <= 3 ? 'alert-warning' : 'alert-info'}`}>
          <span>{alerts.savings_overdue ? '🔴' : '📅'}</span>
          <div>
            <strong>Savings Due: Day {alerts.savings_due_day}</strong>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              {alerts.savings_overdue ? `OVERDUE — ${alerts.unpaid_savings?.length || 0} members unpaid` : `${alerts.days_until_savings_due} days remaining — ${alerts.unpaid_savings?.length || 0} unpaid`}
            </div>
          </div>
        </div>
        <div className={`alert ${alerts.repay_overdue ? 'alert-danger' : alerts.days_until_repay_due <= 3 ? 'alert-warning' : 'alert-info'}`}>
          <span>{alerts.repay_overdue ? '🔴' : '📋'}</span>
          <div>
            <strong>Repayments Due: Day {alerts.repay_due_day}</strong>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              {alerts.repay_overdue ? `OVERDUE — ${alerts.unpaid_repayments?.length || 0} members unpaid` : `${alerts.days_until_repay_due} days remaining — ${alerts.unpaid_repayments?.length || 0} unpaid`}
            </div>
          </div>
        </div>
      </div>

      {/* Pending savings approvals */}
      {alerts.pending_savings?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700, color: '#fbbf24' }}>⏳ Pending Savings Approvals ({alerts.pending_savings.length})</div>
            <button className="btn btn-success btn-sm" onClick={async () => {
              if (!confirm(`Confirm all ${alerts.pending_savings.length} pending savings?`)) return;
              for (const s of alerts.pending_savings) { try { await api.patch(`/savings/${s.id}/confirm`, { status: 'paid', penalty: 0 }); } catch {} }
              toast('All confirmed', 'success'); load();
            }}>✅ Confirm All</button>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Member</th><th>Month</th><th>Amount</th><th>Date</th><th>Bank</th><th>Receipt</th><th>Actions</th></tr></thead>
            <tbody>
              {alerts.pending_savings.map((s: any) => (
                <tr key={s.id}>
                  <td><div style={{ fontWeight: 600 }}>{s.member_name}</div><code style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{s.member_id}</code></td>
                  <td>{formatMonthLabel(s.month)}{s.month > currentMonth() && <span className="badge badge-info" style={{ fontSize: '0.6rem', marginLeft: '0.3rem' }}>ADVANCE</span>}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(s.amount)}{s.penalty > 0 && <div style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>+{fmt(s.penalty)} penalty</div>}</td>
                  <td>{fmtDate(s.paid_date)}</td>
                  <td style={{ fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: 600 }}>{s.bank_name || '—'}</div>
                    {s.account_number && <div style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.7rem' }}>{s.account_number}</div>}
                  </td>
                  <td>{s.receipt_url ? <FileLink url={s.receipt_url} /> : <span style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>No receipt</span>}</td>
                  <td><div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => openReview(s, 'saving')}>👁 Review</button>
                    <button className="btn btn-success btn-sm" onClick={() => confirmSaving(s.id)}>✓</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Pending repayment approvals */}
      {alerts.pending_repayments?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.35)' }}>
          <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '0.75rem' }}>⏳ Pending Repayment Approvals ({alerts.pending_repayments.length})</div>
          <div className="table-wrap"><table>
            <thead><tr><th>Member</th><th>Loan</th><th>Month</th><th>Amount</th><th>Date</th><th>Bank</th><th>Receipt</th><th>Actions</th></tr></thead>
            <tbody>
              {alerts.pending_repayments.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.member_name}</td>
                  <td><code style={{ fontSize: '0.75rem' }}>{r.loan_id}</code></td>
                  <td>{formatMonthLabel(r.month)}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(r.amount)}{r.penalty > 0 && <div style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>+{fmt(r.penalty)} penalty</div>}</td>
                  <td>{fmtDate(r.paid_date)}</td>
                  <td style={{ fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: 600 }}>{r.bank_name || '—'}</div>
                    {r.account_number && <div style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.7rem' }}>{r.account_number}</div>}
                  </td>
                  <td>{r.receipt_url ? <FileLink url={r.receipt_url} /> : <span style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>No receipt</span>}</td>
                  <td><div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => openReview(r, 'repayment')}>👁 Review</button>
                    <button className="btn btn-success btn-sm" onClick={() => confirmRepayment(r.id)}>✓</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Pending loan applications */}
      {alerts.pending_loans?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(99,102,241,0.35)' }}>
          <div style={{ fontWeight: 700, color: 'var(--info)', marginBottom: '0.75rem' }}>🏦 Pending Loan Applications ({alerts.pending_loans.length})</div>
          <div className="table-wrap"><table>
            <thead><tr><th>Queue</th><th>Member</th><th>Amount</th><th>Requested</th><th>Phone</th></tr></thead>
            <tbody>
              {alerts.pending_loans.map((l: any) => (
                <tr key={l.id}>
                  <td><span className="badge badge-warning">#{l.queue_position}</span></td>
                  <td><div style={{ fontWeight: 600 }}>{l.member_name}</div><code style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{l.member_id}</code></td>
                  <td style={{ fontWeight: 600 }}>{fmt(l.amount)}</td>
                  <td>{fmtDate(l.request_date)}</td>
                  <td style={{ fontSize: '0.82rem' }}>{l.member_phone}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Overdue repayments */}
      {alerts.overdue_repayments?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.35)' }}>
          <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.75rem' }}>🔴 Overdue Repayments ({alerts.overdue_repayments.length})</div>
          <div className="table-wrap"><table>
            <thead><tr><th>Member</th><th>Month</th><th>Amount</th><th>Due Date</th><th>Phone</th></tr></thead>
            <tbody>
              {alerts.overdue_repayments.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.member_name}</td>
                  <td>{formatMonthLabel(r.month)}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(r.amount)}</td>
                  <td>{fmtDate(r.due_date)}</td>
                  <td style={{ fontSize: '0.82rem' }}>{r.member_phone}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Unpaid savings this month */}
      {alerts.unpaid_savings?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>💰 Unpaid Savings This Month ({alerts.unpaid_savings.length})</div>
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {alerts.unpaid_savings.map((m: any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: m.urgency === 'overdue' ? 'var(--danger)' : m.urgency === 'due_soon' ? 'var(--warning)' : 'var(--muted)' }}>
                    {m.urgency === 'overdue' ? '🔴' : m.urgency === 'due_soon' ? '🟡' : '🟢'}
                  </span>
                  {' '}<strong>{m.name}</strong> <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>({m.id})</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{m.phone}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(m.monthly_saving)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalPending === 0 && alerts.unpaid_savings?.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <div style={{ fontWeight: 700 }}>All caught up!</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>No pending approvals or overdue items.</div>
        </div>
      )}

      {/* ── Review Detail Modal ── */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={viewType === 'saving' ? '📋 Review Savings Payment' : '📋 Review Repayment'} wide>
        {viewItem && (
          <>
            {/* Member & payment info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--teal-light)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Member</div>
                {[
                  ['Name', viewItem.member_name],
                  ['ID', viewItem.member_id],
                  ['Phone', viewItem.member_phone],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--muted)' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--teal-light)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Payment Details</div>
                {[
                  ['Month', formatMonthLabel(viewItem.month)],
                  ['Amount Paid', fmt(viewItem.amount)],
                  ['Payment Date', fmtDate(viewItem.paid_date)],
                  ...(viewType === 'repayment' ? [['Loan ID', viewItem.loan_id]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--muted)' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bank info */}
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#10b981', marginBottom: '0.5rem' }}>🏦 Bank Payment Info</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--muted)' }}>Bank</span>
                <span style={{ fontWeight: 600 }}>{viewItem.bank_name || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--muted)' }}>Account / Reference</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#fbbf24' }}>{viewItem.account_number || '—'}</span>
              </div>
            </div>

            {/* Receipt */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--teal-light)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Receipt</div>
              {viewItem.receipt_url
                ? <FileLink url={viewItem.receipt_url} label="View Receipt" />
                : <div className="alert alert-warning"><span>⚠️</span><span>No receipt uploaded</span></div>}
            </div>

            {/* Penalty override */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Penalty Amount (ETB) — adjust if needed</label>
              <input type="number" min={0} value={penaltyOverride} onChange={e => setPenaltyOverride(e.target.value)}
                style={{ maxWidth: 200 }} />
              {Number(penaltyOverride) > 0 && (
                <span style={{ color: 'var(--warning)', fontSize: '0.78rem' }}>⚠️ ETB {penaltyOverride} penalty will be recorded</span>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {viewType === 'saving' ? (
                <>
                  <button className="btn btn-success" onClick={doConfirmSaving}>✅ Confirm as Paid</button>
                  <button className="btn btn-danger" onClick={doRejectSaving}>✗ Reject</button>
                </>
              ) : (
                <button className="btn btn-success" onClick={doConfirmRepayment}>✅ Confirm Repayment</button>
              )}
              <button className="btn btn-ghost" onClick={() => setViewItem(null)}>Cancel</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}


function ExitsSection({ toast }: { toast: any }) {
  const [exits, setExits] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ member_id:'', reason:'voluntary', exit_date:'', notes:'' });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.get('/members/exits/list').then((d: any) => setExits(Array.isArray(d) ? d : [])).catch((e: any) => toast(e.message, 'danger')).finally(() => setLoading(false));
  }
  useEffect(() => { load(); api.get('/members').then((d: any) => setMembers(Array.isArray(d) ? d : d.data ?? [])).catch(() => {}); }, []);

  async function processExit() {
    if (!form.member_id || !form.exit_date) { toast('Member and exit date required', 'warning'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/members/${form.member_id}/exit`, { reason: form.reason, exit_date: form.exit_date, notes: form.notes });
      toast(`Exit processed. Refund: ${fmt(res.total_refund)}`, 'success'); setShowModal(false); setForm({member_id:'',reason:'voluntary',exit_date:'',notes:''}); load();
    } catch (e: any) { toast(e.message, 'danger'); } finally { setSaving(false); }
  }

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
        <div><div className="page-title">Member Exits</div><div className="page-sub">Voluntary withdrawals and exits</div></div>
        <button className="btn btn-danger" onClick={() => setShowModal(true)}>Process Exit</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Reason</th><th>Exit Date</th><th>Total Savings</th><th>Notes</th></tr></thead>
          <tbody>
            {loading ? <Spinner /> : exits.length === 0 ? <Empty msg="No exits recorded." /> : exits.map((e: any) => (
              <tr key={e.id}><td><code style={{fontSize:'0.8rem'}}>{e.id}</code></td><td>{e.name}</td>
                <td><span className="badge badge-muted">{e.exit_reason}</span></td><td>{fmtDate(e.exit_date)}</td>
                <td>{fmt(e.total_savings)}</td><td style={{color:'var(--muted)',fontSize:'0.82rem'}}>{e.exit_notes||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Process Member Exit">
        <div className="form-group"><label>Member *</label>
          <select value={form.member_id} onChange={e => setForm({...form,member_id:e.target.value})}>
            <option value="">Select member…</option>
            {members.filter((m: any) => m.status === 'active').map((m: any) => <option key={m.id} value={m.id}>{m.id} — {m.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Reason</label>
            <select value={form.reason} onChange={e => setForm({...form,reason:e.target.value})}>
              <option value="voluntary">Voluntary</option><option value="death">Death</option><option value="expulsion">Expulsion</option><option value="transfer">Transfer</option>
            </select>
          </div>
          <div className="form-group"><label>Exit Date *</label><input type="date" value={form.exit_date} onChange={e => setForm({...form,exit_date:e.target.value})} /></div>
        </div>
        <div className="form-group"><label>Notes</label><textarea rows={3} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} style={{resize:'vertical'}} /></div>
        <div className="alert alert-warning" style={{marginBottom:'1rem'}}><span>⚠️</span><span>Member must have no active loans. This deactivates the account.</span></div>
        <button className="btn btn-danger btn-full" onClick={processExit} disabled={saving}>{saving?'Processing…':'Confirm Exit'}</button>
      </Modal>
    </>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsSection({ toast }: { toast: any }) {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState<Record<string,string>>({});
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [editBank, setEditBank] = useState<any>(null);
  const [newBank, setNewBank] = useState({ bank_name:'', account_number:'', account_holder:'Wazema SCBC' });
  const [newAnn, setNewAnn] = useState({ title:'', body:'', priority:'normal' });
  const [pwForm, setPwForm] = useState({ current_password:'', new_password:'', confirm_password:'' });

  useEffect(() => {
    api.get('/settings').then((d: any) => {
      const map: Record<string,string> = {};
      (Array.isArray(d) ? d : []).forEach((s: any) => { map[s.key] = s.value; });
      setSettings(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'announcements') api.get('/settings/announcements').then((d: any) => setAnnouncements(Array.isArray(d) ? d : [])).catch(() => {});
    if (tab === 'banks') api.get('/settings/banks/all').then((d: any) => setBanks(Array.isArray(d) ? d : [])).catch(() => {});
    if (tab === 'audit') api.get('/settings/audit?limit=50').then((d: any) => setAudit(d.rows || [])).catch(() => {});
  }, [tab]);

  async function saveSettings() {
    setSaving(true);
    try { await api.patch('/settings', settings); toast('Settings saved', 'success'); }
    catch (e: any) { toast(e.message, 'danger'); } finally { setSaving(false); }
  }

  async function changeAdminPw() {
    if (pwForm.new_password !== pwForm.confirm_password) { toast('Passwords do not match', 'warning'); return; }
    if (pwForm.new_password.length < 6) { toast('Min 6 characters', 'warning'); return; }
    try { await api.post('/settings/change-admin-password', { current_password: pwForm.current_password, new_password: pwForm.new_password }); toast('Password updated', 'success'); setPwForm({current_password:'',new_password:'',confirm_password:''}); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function postAnn() {
    if (!newAnn.title || !newAnn.body) { toast('Title and body required', 'warning'); return; }
    try { await api.post('/settings/announcements', newAnn); toast('Posted', 'success'); setNewAnn({title:'',body:'',priority:'normal'}); const d = await api.get('/settings/announcements'); setAnnouncements(Array.isArray(d) ? d : []); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function deleteAnn(id: number) {
    if (!confirm('Delete?')) return;
    try { await api.delete(`/settings/announcements/${id}`); setAnnouncements(a => a.filter(x => x.id !== id)); toast('Deleted', 'success'); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function addBank() {
    if (!newBank.bank_name || !newBank.account_number) { toast('Bank name and account number required', 'warning'); return; }
    try { await api.post('/settings/banks', newBank); toast('Bank added', 'success'); setNewBank({bank_name:'',account_number:'',account_holder:'Wazema SCBC'}); const d = await api.get('/settings/banks/all'); setBanks(Array.isArray(d) ? d : []); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function saveBank() {
    try { await api.patch(`/settings/banks/${editBank.id}`, editBank); toast('Bank updated', 'success'); setEditBank(null); const d = await api.get('/settings/banks/all'); setBanks(Array.isArray(d) ? d : []); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function toggleBank(id: number, active: number) {
    try { await api.patch(`/settings/banks/${id}`, { is_active: active }); const d = await api.get('/settings/banks/all'); setBanks(Array.isArray(d) ? d : []); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  async function deleteBank(id: number, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    try { await api.delete(`/settings/banks/${id}`); setBanks(b => b.filter(x => x.id !== id)); toast('Deleted', 'success'); }
    catch (e: any) { toast(e.message, 'danger'); }
  }

  const TABS = ['general','password','announcements','banks','audit'];
  const set = (k: string) => (e: any) => setSettings(s => ({...s, [k]: e.target.value}));

  return (
    <>
      <div className="page-title">Settings</div>
      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'0.45rem 1rem', borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer', fontWeight:600, fontSize:'0.82rem', background: tab===t ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: tab===t ? '#fff' : 'var(--muted)', textTransform:'capitalize' }}>
            {t === 'general' ? '⚙️ General' : t === 'password' ? '🔑 Password' : t === 'announcements' ? '📢 Announcements' : t === 'banks' ? '🏦 Banks' : '📋 Audit Log'}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <>
          <div className="card" style={{marginBottom:'1rem'}}>
            <div style={{fontWeight:700,marginBottom:'1rem'}}>Organization Info</div>
            <div className="form-row">
              <div className="form-group"><label>Org Name</label><input value={settings.org_name||''} onChange={set('org_name')} /></div>
              <div className="form-group"><label>Phone</label><input value={settings.org_phone||''} onChange={set('org_phone')} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Email</label><input value={settings.org_email||''} onChange={set('org_email')} /></div>
              <div className="form-group"><label>Address</label><input value={settings.org_address||''} onChange={set('org_address')} /></div>
            </div>
          </div>
          <div className="card" style={{marginBottom:'1rem'}}>
            <div style={{fontWeight:700,marginBottom:'1rem'}}>Financial Rules</div>
            <div className="form-row">
              <div className="form-group"><label>Savings Due Day</label><input type="number" value={settings.savings_due_day||''} onChange={set('savings_due_day')} /></div>
              <div className="form-group"><label>Repayment Due Day</label><input type="number" value={settings.repayment_due_day||''} onChange={set('repayment_due_day')} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Grace Period (days)</label><input type="number" value={settings.grace_period_days||''} onChange={set('grace_period_days')} /></div>
              <div className="form-group"><label>Late Penalty Rate (e.g. 0.02)</label><input value={settings.late_penalty_rate||''} onChange={set('late_penalty_rate')} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Loan Multiplier</label><input type="number" value={settings.loan_multiplier||''} onChange={set('loan_multiplier')} /></div>
              <div className="form-group"><label>Interest Rate (e.g. 0.05)</label><input value={settings.interest_rate||''} onChange={set('interest_rate')} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Repayment Months</label><input type="number" value={settings.repayment_months||''} onChange={set('repayment_months')} /></div>
              <div className="form-group"><label>Currency</label><input value={settings.currency||''} onChange={set('currency')} /></div>
            </div>
            <div className="form-group" style={{maxWidth:300}}>
              <label>Savings Interest Accrual</label>
              <select value={settings.savings_interest_enabled||'0'} onChange={set('savings_interest_enabled')}>
                <option value="0">❌ Disabled</option><option value="1">✅ Enabled</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>{saving?'Saving…':'Save Settings'}</button>
        </>
      )}

      {tab === 'password' && (
        <div className="card" style={{maxWidth:420}}>
          <div style={{fontWeight:700,marginBottom:'1rem'}}>Change Admin Password</div>
          <div className="form-group"><label>Current Password</label><input type="password" value={pwForm.current_password} onChange={e => setPwForm({...pwForm,current_password:e.target.value})} /></div>
          <div className="form-group"><label>New Password</label><input type="password" value={pwForm.new_password} onChange={e => setPwForm({...pwForm,new_password:e.target.value})} /></div>
          <div className="form-group"><label>Confirm New Password</label><input type="password" value={pwForm.confirm_password} onChange={e => setPwForm({...pwForm,confirm_password:e.target.value})} /></div>
          <button className="btn btn-primary" onClick={changeAdminPw}>Update Password</button>
        </div>
      )}

      {tab === 'announcements' && (
        <>
          <div className="card" style={{marginBottom:'1rem'}}>
            <div style={{fontWeight:700,marginBottom:'1rem'}}>Post Announcement</div>
            <div className="form-group"><label>Title *</label><input value={newAnn.title} onChange={e => setNewAnn({...newAnn,title:e.target.value})} /></div>
            <div className="form-group"><label>Body *</label><textarea rows={3} value={newAnn.body} onChange={e => setNewAnn({...newAnn,body:e.target.value})} style={{resize:'vertical'}} /></div>
            <div className="form-group" style={{maxWidth:200}}><label>Priority</label>
              <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn,priority:e.target.value})}>
                <option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={postAnn}>Post</button>
          </div>
          <div className="card">
            <div style={{fontWeight:700,marginBottom:'1rem'}}>Active Announcements</div>
            {announcements.length === 0 ? <p style={{color:'var(--muted)',fontSize:'0.85rem'}}>No announcements.</p> :
              announcements.map((a: any) => (
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'0.75rem 0',borderBottom:'1px solid var(--border)'}}>
                  <div><strong style={{fontSize:'0.88rem'}}>{a.title}</strong> <span className={`badge badge-${a.priority==='urgent'?'danger':a.priority==='important'?'warning':'info'}`}>{a.priority}</span>
                    <p style={{fontSize:'0.82rem',color:'var(--muted)',marginTop:'0.25rem'}}>{a.body}</p></div>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteAnn(a.id)}>Delete</button>
                </div>
              ))}
          </div>
        </>
      )}

      {tab === 'banks' && (
        <>
          <div className="card" style={{marginBottom:'1rem'}}>
            <div style={{fontWeight:700,marginBottom:'1rem'}}>🏦 Add Bank Account</div>
            <div className="form-row">
              <div className="form-group"><label>Bank Name *</label>
                <select value={newBank.bank_name} onChange={e => setNewBank({...newBank,bank_name:e.target.value})}>
                  <option value="">— Select bank —</option>
                  {['Commercial Bank of Ethiopia (CBE)','Awash Bank','Abyssinia Bank','Dashen Bank','Bank of Abyssinia','Cooperative Bank of Oromia','Oromia International Bank','Nib International Bank','United Bank','Wegagen Bank'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Account Number *</label><input value={newBank.account_number} onChange={e => setNewBank({...newBank,account_number:e.target.value})} placeholder="Digits only" /></div>
            </div>
            <div className="form-group" style={{maxWidth:300}}><label>Account Holder</label><input value={newBank.account_holder} onChange={e => setNewBank({...newBank,account_holder:e.target.value})} /></div>
            <button className="btn btn-primary" onClick={addBank}>Add Bank</button>
          </div>
          <div className="card">
            <div style={{fontWeight:700,marginBottom:'1rem'}}>Payment Bank Accounts</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Bank</th><th>Account Number</th><th>Holder</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {banks.length === 0 ? <Empty /> : banks.map((b: any) => (
                    <tr key={b.id}>
                      <td style={{fontWeight:600}}>{b.bank_name}</td>
                      <td><code style={{letterSpacing:'1px',color:'var(--gold)'}}>{b.account_number}</code></td>
                      <td>{b.account_holder}</td>
                      <td><span className={`badge badge-${b.is_active ? 'success' : 'muted'}`}>{b.is_active ? 'Active' : 'Hidden'}</span></td>
                      <td><div style={{display:'flex',gap:'0.3rem'}}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditBank({...b})}>✏️ Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleBank(b.id, b.is_active ? 0 : 1)}>{b.is_active ? 'Hide' : 'Show'}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteBank(b.id, b.bank_name)}>Delete</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Modal open={!!editBank} onClose={() => setEditBank(null)} title="Edit Bank Account">
            {editBank && <>
              <div className="form-group"><label>Bank Name</label><input value={editBank.bank_name} onChange={e => setEditBank({...editBank,bank_name:e.target.value})} /></div>
              <div className="form-group"><label>Account Number *</label><input value={editBank.account_number} onChange={e => setEditBank({...editBank,account_number:e.target.value})} /></div>
              <div className="form-group"><label>Account Holder</label><input value={editBank.account_holder} onChange={e => setEditBank({...editBank,account_holder:e.target.value})} /></div>
              <button className="btn btn-primary btn-full" onClick={saveBank}>Save Changes</button>
            </>}
          </Modal>
        </>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div style={{fontWeight:700,marginBottom:'1rem'}}>Audit Log</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
              <tbody>
                {audit.length === 0 ? <Empty msg="No audit entries." /> : audit.map((a: any) => (
                  <tr key={a.id}><td>{fmtDate(a.created_at)}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.target||'—'}</td><td style={{color:'var(--muted)',fontSize:'0.8rem'}}>{a.detail||'—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  return <ToastProvider><AdminDashboard /></ToastProvider>;
}
