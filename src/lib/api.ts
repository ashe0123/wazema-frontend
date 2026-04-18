// ── Wazema API client ─────────────────────────────────────────────────────────
const API_BASE = '/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('wazema_token');
}
export function getUser(): { role: string; id?: string; name?: string } | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(sessionStorage.getItem('wazema_user') || 'null'); } catch { return null; }
}
export function setSession(token: string, user: object) {
  sessionStorage.setItem('wazema_token', token);
  sessionStorage.setItem('wazema_user', JSON.stringify(user));
}
export function clearSession() {
  const token = getToken();
  if (token) {
    fetch(API_BASE + '/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    }).catch(() => {});
  }
  sessionStorage.clear();
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) };
}

async function handleRes(r: Response) {
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as any).error || `Request failed (${r.status})`);
  }
  return r.json();
}

export const api = {
  get:    (path: string)             => fetch(API_BASE + path, { headers: authHeaders() }).then(handleRes),
  post:   (path: string, body: any)  => fetch(API_BASE + path, { method: 'POST',  headers: authHeaders(), body: JSON.stringify(body) }).then(handleRes),
  patch:  (path: string, body: any)  => fetch(API_BASE + path, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) }).then(handleRes),
  delete: (path: string)             => fetch(API_BASE + path, { method: 'DELETE', headers: authHeaders() }).then(handleRes),
  upload: (path: string, form: FormData) =>
    fetch(API_BASE + path, { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: form }).then(handleRes),
};

// ── Formatters ────────────────────────────────────────────────────────────────
export function fmt(n: any): string {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  return 'ETB ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtDate(str: string | null | undefined): string {
  if (!str) return '—';
  try { return new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return str; }
}
export function currentMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}
export function monthOffset(base: string, n: number): string {
  const [y, m] = base.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function formatMonthLabel(ym: string): string {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
export function savingBadge(s: string)  { return ({ paid:'success', late:'warning', pending_review:'warning', overdue:'danger' } as any)[s] || 'muted'; }
export function loanBadge(s: string)    { return ({ active:'success', pending:'warning', completed:'info', rejected:'danger' } as any)[s] || 'muted'; }
export function repayBadge(s: string)   { return ({ paid:'success', due:'warning', pending:'muted', overdue:'danger', pending_review:'warning' } as any)[s] || 'muted'; }

// ── Month options for select ──────────────────────────────────────────────────
export function buildMonthOptions(pastCount = 12, futureCount = 6): { value: string; label: string }[] {
  const cm = currentMonth();
  const opts = [];
  for (let i = pastCount - 1; i >= 1; i--) {
    const m = monthOffset(cm, -i);
    opts.push({ value: m, label: formatMonthLabel(m) });
  }
  opts.push({ value: cm, label: formatMonthLabel(cm) + ' (Current)' });
  for (let i = 1; i <= futureCount; i++) {
    const m = monthOffset(cm, i);
    opts.push({ value: m, label: formatMonthLabel(m) + ' (Advance)' });
  }
  return opts;
}
