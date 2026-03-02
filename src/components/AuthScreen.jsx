import { useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const hasGoogle = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE')

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, signInDemo } = useAuth()
  const [mode,    setMode]    = useState('login')
  const [form,    setForm]    = useState({ name: '', email: '', password: '', confirm: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // ── Google OAuth flow ─────────────────────────────────────────────────────
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true)
        // Fetch the user profile from Google
        const res     = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const profile = await res.json()
        // profile = { sub, name, email, picture, ... }
        const result  = signInWithGoogle(profile)
        if (result?.error) setError(result.error)
      } catch (e) {
        setError('Google sign-in failed. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Google sign-in was cancelled or failed.'),
  })

  // ── Local auth submit ─────────────────────────────────────────────────────
  const submit = async () => {
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 400)) // UX micro-delay

    let result
    if (mode === 'signup') {
      if (!form.name.trim())          return finish('Full name is required.')
      if (!form.email.includes('@'))  return finish('Please enter a valid email.')
      if (form.password.length < 6)   return finish('Password must be 6+ characters.')
      if (form.password !== form.confirm) return finish('Passwords do not match.')
      result = signUp({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password })
    } else {
      if (!form.email || !form.password) return finish('Please fill in all fields.')
      result = signIn({ email: form.email.trim().toLowerCase(), password: form.password })
    }

    if (result?.error) finish(result.error)
    else setLoading(false)
  }

  const finish = (err) => { setError(err); setLoading(false) }

  return (
    <div className="auth-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-grid" />

      <div style={{ position: 'relative', width: 420, maxWidth: '94vw' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 54, height: 54, background: 'linear-gradient(135deg,#c8953a,#e8c060)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px', boxShadow: '0 12px 32px rgba(200,149,58,0.3)' }}>⬡</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 700, letterSpacing: '0.02em' }}>
            Wealth<span className="gold-gradient">Radar</span>
          </h1>
          <p style={{ color: '#6b7494', fontSize: 12, marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Personal Finance Command Centre
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {/* Mode tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1f2e', marginBottom: 28 }}>
            {[['login', 'Sign In'], ['signup', 'Create Account']].map(([m, label]) => (
              <button key={m} className={`tab-btn ${mode === m ? 'active' : ''}`}
                onClick={() => { setMode(m); setError('') }}>{label}</button>
            ))}
          </div>

          {/* Google SSO */}
          {hasGoogle ? (
            <>
              <button
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', padding: 12, marginBottom: 20, gap: 10 }}
                onClick={() => googleLogin()}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: '#1a1f2e' }} />
                <span style={{ fontSize: 12, color: '#3d4460' }}>or continue with email</span>
                <div style={{ flex: 1, height: 1, background: '#1a1f2e' }} />
              </div>
            </>
          ) : (
            <div style={{ padding: '10px 14px', background: 'rgba(91,143,249,0.06)', border: '1px solid rgba(91,143,249,0.15)', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#8892b0' }}>
              ℹ Google Sign-In is not configured yet. Set <code style={{ color: '#5b8ff9', fontFamily: "'JetBrains Mono',monospace" }}>VITE_GOOGLE_CLIENT_ID</code> in your <code style={{ color: '#5b8ff9', fontFamily: "'JetBrains Mono',monospace" }}>.env.local</code> to enable it.
            </div>
          )}

          {/* Local auth form */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Arjun Sharma" />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="you@example.com" />
          </div>
          <div style={{ marginBottom: mode === 'signup' ? 16 : 24 }}>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password}
              onChange={e => f('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} placeholder="••••••••" />
          </div>
          {mode === 'signup' && (
            <div style={{ marginBottom: 24 }}>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" value={form.confirm}
                onChange={e => f('confirm', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()} placeholder="••••••••" />
            </div>
          )}

          {error && (
            <div style={{ color: '#f06a6a', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: 'rgba(240,106,106,0.08)', borderRadius: 7, border: '1px solid rgba(240,106,106,0.2)' }}>
              ⚠ {error}
            </div>
          )}

          <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={submit} disabled={loading}>
            {loading
              ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>↻</span>
              : null}
            {loading ? ' Processing…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#1a1f2e' }} />
            <span style={{ fontSize: 12, color: '#3d4460' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#1a1f2e' }} />
          </div>

          <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={signInDemo}>
            🎯 Try Demo Account
          </button>
        </div>

        <p style={{ textAlign: 'center', color: '#3d4460', fontSize: 12, marginTop: 20 }}>
          All data is stored locally in your browser — no servers, no tracking.
        </p>
      </div>
    </div>
  )
}
