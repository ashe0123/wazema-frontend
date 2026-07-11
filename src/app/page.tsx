'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession, getUser } from '@/lib/api';
import { ToastProvider, useToast } from '@/components/Toast';

type View = 'login' | 'forgot' | 'admin-forgot';

function LoginForm() {
  const router = useRouter();
  const toast  = useToast();
  const [tab, setTab]   = useState<'member' | 'admin'>('member');
  const [view, setView] = useState<View>('login');
  const [id, setId]     = useState('');
  const [pw, setPw]     = useState('');
  const [err, setErr]   = useState('');
  const [loading, setLoading] = useState(false);

  // forgot — member
  const [fpId, setFpId]       = useState('');
  const [fpPhone, setFpPhone] = useState('');
  const [fpToken, setFpToken] = useState('');
  const [fpNewPw, setFpNewPw] = useState('');
  const [fpStep, setFpStep]   = useState<'request' | 'reset'>('request');

  // forgot — admin
  const [afUsername, setAfUsername] = useState('');
  const [afSecret, setAfSecret]     = useState('');
  const [afToken, setAfToken]       = useState('');
  const [afNewPw, setAfNewPw]       = useState('');
  const [afStep, setAfStep]         = useState<'request' | 'reset'>('request');

  useEffect(() => {
    const u = getUser();
    if (u) router.push(u.role === 'admin' ? '/admin' : '/dashboard');
  }, []);

  async function doLogin() {
    setErr('');
    if (!id || !pw) { setErr('Please fill all fields'); return; }
    setLoading(true);
    try {
      const d = await api.post('/auth/login', { identifier: id, password: pw, role: tab });
      setSession(d.token, { role: d.role, id: d.id, name: d.name });
      router.push(d.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function doForgot() {
    setErr('');
    if (!fpId || !fpPhone) { setErr('Member ID and phone are required'); return; }
    // Normalize and validate phone format
    const phoneLocal = fpPhone.replace(/^\+251/, '0').replace(/^251/, '0');
    if (!/^09\d{8}$/.test(phoneLocal)) { setErr('Phone must start with 09 and be 10 digits (e.g. 0911234567)'); return; }
    setLoading(true);
    try {
      // Send member_id + phone — matches backend /forgot-password handler
      const d = await api.post('/auth/forgot-password', { member_id: fpId.trim().toUpperCase(), phone: fpPhone.trim() });
      if (d.reset_token) {
        setFpToken(d.reset_token);
        setFpStep('reset');
        toast('Reset token generated. Enter it below to set a new password.', 'success');
      } else {
        toast(d.message || 'If details match, a token was generated. Contact your administrator.', 'info');
      }
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function doReset() {
    setErr('');
    if (!fpToken || !fpNewPw) { setErr('Token and new password are required'); return; }
    if (fpNewPw.length < 8) { setErr('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      // Send reset_token + new_password — matches backend /reset-password handler
      await api.post('/auth/reset-password', { reset_token: fpToken.trim(), new_password: fpNewPw });
      toast('Password reset successfully. You can now log in.', 'success');
      setView('login'); setFpId(''); setFpPhone(''); setFpToken(''); setFpNewPw(''); setFpStep('request');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  function goForgot()      { setView('forgot');       setErr(''); setFpStep('request'); setFpToken(''); }
  function goAdminForgot() { setView('admin-forgot'); setErr(''); setAfStep('request'); setAfToken(''); }
  function goLogin()       { setView('login');         setErr(''); }

  async function doAdminForgot() {
    setErr('');
    if (!afUsername || !afSecret) { setErr('Username and secret key are required'); return; }
    setLoading(true);
    try {
      const d = await api.post('/auth/admin-forgot-password', { username: afUsername.trim(), secret_key: afSecret });
      if (d.reset_token) {
        setAfToken(d.reset_token);
        setAfStep('reset');
        toast('Reset token generated. Enter it below to set a new password.', 'success');
      }
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function doAdminReset() {
    setErr('');
    if (!afToken || !afNewPw) { setErr('Token and new password are required'); return; }
    if (afNewPw.length < 8) { setErr('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/admin-reset-password', { reset_token: afToken.trim(), new_password: afNewPw });
      toast('Admin password reset successfully. You can now log in.', 'success');
      setView('login');
      setAfUsername(''); setAfSecret(''); setAfToken(''); setAfNewPw(''); setAfStep('request');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }
  return (
    <div className="login-page">
      <div className="login-left">
        <h2>WAZEMA</h2>
        <p>A trusted saving and credit cooperative for savings, loans, and financial empowerment.</p>
        <div className="login-features">
          {[
            ['💰', 'Monthly savings tracking with automated reminders'],
            ['🏦', 'Fair loan distribution via transparent queue system'],
            ['📋', 'Third-party agreement signing and verification'],
            ['📊', 'Real-time repayment schedules and penalty tracking'],
            ['🔒', 'Secure JWT-based authentication with brute-force protection'],
          ].map(([icon, text], i) => (
            <div key={i} className="login-feat">
              <div className="login-feat-icon">{icon}</div>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="login-right">
        <div className="login-box">
          <div className="login-logo">
            <div className="brand-logo">W<span>A</span>ZEMA</div>
            <div className="brand-tagline">Saving and Credit Basic Cooperative</div>
          </div>

          {/* ── LOGIN ── */}
          {view === 'login' && (
            <>
              <div className="tab-switch">
                <button className={tab === 'member' ? 'active' : ''} onClick={() => { setTab('member'); setErr(''); }}>👤 Member</button>
                <button className={tab === 'admin'  ? 'active' : ''} onClick={() => { setTab('admin');  setErr(''); }}>🔐 Admin</button>
              </div>
              <div className="form-group">
                <label>{tab === 'member' ? 'Member ID or Phone' : 'Admin Username'}</label>
                <input value={id} onChange={e => setId(e.target.value)}
                  placeholder={tab === 'member' ? 'WZ-001 or 09XXXXXXXX' : 'admin'}
                  onKeyDown={e => e.key === 'Enter' && doLogin()} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                  placeholder="Enter your password"
                  onKeyDown={e => e.key === 'Enter' && doLogin()} />
              </div>
              {err && <div className="error-msg">{err}</div>}
              <button className="btn btn-primary btn-full btn-lg" onClick={doLogin} disabled={loading}>
                {loading ? 'Signing in...' : tab === 'admin' ? 'Admin Sign In' : 'Sign In'}
              </button>
              {/* Forgot password — members only (admins use Settings panel) */}
              {tab === 'member' && (
                <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                  <button onClick={goForgot}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.82rem' }}>
                    Forgot password?
                  </button>
                </p>
              )}
              {tab === 'admin' && (
                <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                  <button onClick={goAdminForgot}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.82rem' }}>
                    Forgot password?
                  </button>
                </p>
              )}
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === 'forgot' && (
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>Reset Password</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  {fpStep === 'request'
                    ? 'Enter your Member ID and registered phone number.'
                    : 'Enter the reset token and your new password.'}
                </div>
              </div>

              {fpStep === 'request' && (
                <>
                  <div className="form-group">
                    <label>Member ID *</label>
                    <input value={fpId} onChange={e => setFpId(e.target.value.toUpperCase())} placeholder="WZ-001" />
                  </div>
                  <div className="form-group">
                    <label>Registered Phone Number *</label>
                    <input value={fpPhone} onChange={e => setFpPhone(e.target.value)} placeholder="09XXXXXXXX" />
                  </div>
                  {err && <div className="error-msg">{err}</div>}
                  <button className="btn btn-primary btn-full" onClick={doForgot} disabled={loading}>
                    {loading ? 'Checking...' : 'Get Reset Token'}
                  </button>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>
                    Already have a token?{' '}
                    <button onClick={() => setFpStep('reset')}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.78rem' }}>
                      Enter it here
                    </button>
                  </div>
                </>
              )}

              {fpStep === 'reset' && (
                <>
                  {fpToken && (
                    <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                      <span>✅</span>
                      <div>
                        Your token: <strong style={{ fontFamily: 'monospace', letterSpacing: '2px', fontSize: '1rem' }}>{fpToken}</strong>
                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Valid for 30 minutes.</div>
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Reset Token *</label>
                    <input value={fpToken} onChange={e => setFpToken(e.target.value.toUpperCase())}
                      placeholder="XXXXXXXXXXXXXXXX"
                      style={{ fontFamily: 'monospace', letterSpacing: '2px' }} />
                  </div>
                  <div className="form-group">
                    <label>New Password * (min 8 characters)</label>
                    <input type="password" value={fpNewPw} onChange={e => setFpNewPw(e.target.value)} placeholder="New password" />
                  </div>
                  {err && <div className="error-msg">{err}</div>}
                  <button className="btn btn-success btn-full" onClick={doReset} disabled={loading}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>
                    Don't have a token?{' '}
                    <button onClick={() => setFpStep('request')}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.78rem' }}>
                      Request one
                    </button>
                  </div>
                </>
              )}

              <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.82rem' }}>
                <button onClick={goLogin}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.82rem' }}>
                  ← Back to login
                </button>
              </p>
            </>
          )}
          {/* ── ADMIN FORGOT PASSWORD ── */}
          {view === 'admin-forgot' && (
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>🔐 Admin Password Reset</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  {afStep === 'request'
                    ? 'Enter your admin username and the secret reset key.'
                    : 'Enter the reset token and your new password.'}
                </div>
              </div>

              {afStep === 'request' && (
                <>
                  <div className="form-group">
                    <label>Admin Username *</label>
                    <input value={afUsername} onChange={e => setAfUsername(e.target.value)} placeholder="admin" />
                  </div>
                  <div className="form-group">
                    <label>Secret Reset Key *</label>
                    <input type="password" value={afSecret} onChange={e => setAfSecret(e.target.value)}
                      placeholder="Enter your secret key"
                      onKeyDown={e => e.key === 'Enter' && doAdminForgot()} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                    The secret key is set in your server environment (ADMIN_RESET_SECRET).
                  </div>
                  {err && <div className="error-msg">{err}</div>}
                  <button className="btn btn-primary btn-full" onClick={doAdminForgot} disabled={loading}>
                    {loading ? 'Verifying...' : 'Get Reset Token'}
                  </button>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>
                    Already have a token?{' '}
                    <button onClick={() => setAfStep('reset')}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.78rem' }}>
                      Enter it here
                    </button>
                  </div>
                </>
              )}

              {afStep === 'reset' && (
                <>
                  {afToken && (
                    <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                      <span>✅</span>
                      <div>
                        Reset token ready.
                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Valid for 15 minutes.</div>
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Reset Token *</label>
                    <input value={afToken} onChange={e => setAfToken(e.target.value)}
                      placeholder="Paste token here"
                      style={{ fontFamily: 'monospace', fontSize: '0.78rem' }} />
                  </div>
                  <div className="form-group">
                    <label>New Password * (min 8 characters)</label>
                    <input type="password" value={afNewPw} onChange={e => setAfNewPw(e.target.value)}
                      placeholder="New admin password"
                      onKeyDown={e => e.key === 'Enter' && doAdminReset()} />
                  </div>
                  {err && <div className="error-msg">{err}</div>}
                  <button className="btn btn-success btn-full" onClick={doAdminReset} disabled={loading}>
                    {loading ? 'Resetting...' : 'Reset Admin Password'}
                  </button>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>
                    Don't have a token?{' '}
                    <button onClick={() => setAfStep('request')}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.78rem' }}>
                      Request one
                    </button>
                  </div>
                </>
              )}

              <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.82rem' }}>
                <button onClick={goLogin}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.82rem' }}>
                  ← Back to login
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <ToastProvider><LoginForm /></ToastProvider>;
}
