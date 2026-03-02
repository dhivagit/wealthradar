import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthScreen() {
  const { signIn, signUp, signInDemo } = useAuth()
  const [mode,    setMode]    = useState('login')
  const [form,    setForm]    = useState({ name: '', email: '', password: '', confirm: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 350))
    let result
    if (mode === 'signup') {
      if (!form.name.trim())              return finish('Full name is required.')
      if (!form.email.includes('@'))      return finish('Please enter a valid email.')
      if (form.password.length < 6)       return finish('Password must be at least 6 characters.')
      if (form.password !== form.confirm) return finish('Passwords do not match.')
      result = signUp({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
    } else {
      if (!form.email || !form.password) return finish('Please fill in all fields.')
      result = signIn({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
    }
    if (result?.error) finish(result.error)
    else setLoading(false)
  }

  const finish = (err) => { setError(err); setLoading(false) }

  return (
    <div className="auth-bg" style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="auth-grid" />

      <div style={{ position: 'relative', width: 420, maxWidth: '100%' }}>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60,
            background: 'linear-gradient(135deg,#c8953a,#e8c060)',
            borderRadius: 16, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 30,
            margin: '0 auto 18px',
            boxShadow: '0 16px 40px rgba(200,149,58,0.35)',
          }}>📡</div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 38, fontWeight: 700, letterSpacing: '0.02em', color: '#e2e4ec',
          }}>
            Wealth<span className="gold-gradient">Radar</span>
          </h1>
          <p style={{
            color: '#6b7494', fontSize: 12, marginTop: 8,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Personal Finance Command Centre
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>

          {/* Sign In / Create Account tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1f2e', marginBottom: 28 }}>
            {[['login', 'Sign In'], ['signup', 'Create Account']].map(([m, label]) => (
              <button key={m}
                className={`tab-btn ${mode === m ? 'active' : ''}`}
                onClick={() => { setMode(m); setError('') }}>
                {label}
              </button>
            ))}
          </div>

          {/* Form fields */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label className="label">Full Name</label>
              <input
                className="input"
                value={form.name}
                onChange={e => f('name', e.target.value)}
                placeholder="Your full name"
                autoFocus
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="label">Email Address</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={e => f('email', e.target.value)}
              placeholder="you@example.com"
              autoFocus={mode === 'login'}
            />
          </div>

          <div style={{ marginBottom: mode === 'signup' ? 16 : 24 }}>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={e => f('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••"
            />
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: 24 }}>
              <label className="label">Confirm Password</label>
              <input
                className="input"
                type="password"
                value={form.confirm}
                onChange={e => f('confirm', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="••••••••"
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              color: '#f06a6a', fontSize: 13, marginBottom: 16,
              padding: '10px 14px',
              background: 'rgba(240,106,106,0.08)',
              borderRadius: 8,
              border: '1px solid rgba(240,106,106,0.25)',
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Primary action */}
          <button
            className="btn btn-gold"
            style={{ width: '100%', justifyContent: 'center', padding: '13px 20px', fontSize: 14 }}
            onClick={submit}
            disabled={loading}
          >
            {loading && (
              <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: 6 }}>↻</span>
            )}
            {loading ? 'Processing…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#1a1f2e' }} />
            <span style={{ fontSize: 12, color: '#3d4460' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#1a1f2e' }} />
          </div>

          {/* Demo account */}
          <button
            className="btn btn-outline"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}
            onClick={signInDemo}
          >
            🎯 Try Demo Account
          </button>

          {/* Google SSO note */}
          <div style={{
            marginTop: 20, padding: '10px 14px',
            background: 'rgba(91,143,249,0.05)',
            border: '1px solid rgba(91,143,249,0.15)',
            borderRadius: 8, fontSize: 12, color: '#6b7494', lineHeight: 1.6,
          }}>
            💡 <strong style={{ color: '#5b8ff9' }}>Google Sign-In</strong> coming soon.
            Set your <code style={{
              color: '#5b8ff9', fontFamily: "'JetBrains Mono',monospace",
              background: 'rgba(91,143,249,0.1)', padding: '1px 5px', borderRadius: 3,
            }}>VITE_GOOGLE_CLIENT_ID</code> to enable it.
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#3d4460', fontSize: 12, marginTop: 20 }}>
          🔒 All data stored locally in your browser — no servers, no tracking.
        </p>
      </div>
    </div>
  )
}
