import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const IS = {
  width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #DDD9D0',
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: '#f5fbfc', transition: 'border-color 0.15s',
};

export default function Login() {
  const { login, completeNewPassword, mfaUser } = useAuth();
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await login(email, password);
      if (result.needsNewPassword) setError('');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPassword(e) {
    e.preventDefault();
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    if (newPassword.length < 8)  { setError('Password must be at least 8 characters'); return; }
    setError(''); setLoading(true);
    try {
      await completeNewPassword(newPassword);
    } catch (err) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e5f5fa 0%, #f0f8fa 60%, #fffdf0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins', sans-serif", padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,156,189,0.12)', border: '1px solid #e5f5fa' }}>

        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#009cbd', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(0,156,189,0.3)' }}>
            <span style={{ fontSize: 26, filter: 'brightness(0) invert(1)' }}>🌟</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111111' }}>Illuminate</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888', fontWeight: 500 }}>PTO Manager</p>
        </div>

        {mfaUser ? (
          /* New password required (first login) */
          <form onSubmit={handleNewPassword}>
            <div style={{ padding: '12px 16px', background: '#e5f5fa', borderRadius: 10, marginBottom: 20, fontSize: 13, color: '#006d82' }}>
              Welcome! Please set a new password for your account.
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" style={IS} required />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" style={IS} required />
            </div>
            {error && <div style={{ padding: '10px 13px', background: '#FEECEC', borderRadius: 9, color: '#C0392B', fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: loading ? '#b8dde5' : 'linear-gradient(135deg, #009cbd, #007a9a)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Setting password…' : 'Set Password & Sign In'}
            </button>
          </form>
        ) : (
          /* Standard login */
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Work Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@illuminate.net" style={IS} required autoComplete="username" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={IS} required autoComplete="current-password" />
            </div>
            {error && <div style={{ padding: '10px 13px', background: '#FEECEC', borderRadius: 9, color: '#C0392B', fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: loading ? '#b8dde5' : 'linear-gradient(135deg, #009cbd, #007a9a)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(0,156,189,0.3)' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#bbb' }}>
          Contact your admin to reset your password
        </p>
      </div>
    </div>
  );
}
