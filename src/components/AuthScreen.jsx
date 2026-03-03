import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

// ── Google Icon SVG ───────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

// ── Forgot Password View ──────────────────────────────────────────────────────
function ForgotPasswordView({ onBack }) {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async () => {
    if (!email.includes('@')) return
    setError('')
    setLoading(true)
    const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
    const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    if (!serviceId || !templateId || !publicKey) {
      setLoading(false)
      setError('Email service not configured. Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID and VITE_EMAILJS_PUBLIC_KEY to your .env.local file. Sign up free at emailjs.com.')
      return
    }
    try {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
      const resetLink = window.location.origin + '?reset=' + token + '&email=' + encodeURIComponent(email)
      await new Promise((res, rej) => {
        if (window.emailjs) { res(); return }
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'
        s.onload = () => { window.emailjs.init(publicKey); res() }
        s.onerror = () => rej(new Error('Failed to load EmailJS'))
        document.head.appendChild(s)
      })
      await window.emailjs.send(serviceId, templateId, {
        to_email: email, to_name: email.split('@')[0],
        reset_link: resetLink, app_name: 'WealthRadar',
      })
      setSent(true)
    } catch {
      setError('Failed to send email. Check your EmailJS credentials in .env.local.')
    } finally { setLoading(false) }
  }

  if (sent) return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
      <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: '#1a1d2e', marginBottom: 10 }}>Check your inbox</h3>
      <p style={{ fontSize: 14, color: '#6b7494', lineHeight: 1.6, marginBottom: 24 }}>
        If <strong style={{ color: '#1a1d2e' }}>{email}</strong> has an account,
        you'll receive a password reset link shortly.
      </p>
      <p style={{ fontSize: 12, color: '#a0a8c0', marginBottom: 20 }}>
        Didn't get it? Check spam or try again.
      </p>
      <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={onBack}>
        ← Back to Sign In
      </button>
    </div>
  )

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 13, marginBottom: 20, padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        ← Back to Sign In
      </button>
      <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: '#1a1d2e', marginBottom: 6 }}>Reset your password</h3>
      <p style={{ fontSize: 13, color: '#8892b0', marginBottom: 24, lineHeight: 1.5 }}>
        Enter your email address and we'll send you a link to reset your password.
      </p>
      <div style={{ marginBottom: 20 }}>
        <label className="label">Email Address</label>
        <input className="input" type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="you@example.com" autoFocus />
      </div>
      <button className="btn btn-gold"
        style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 14 }}
        onClick={handleSubmit} disabled={loading || !email.includes('@')}>
        {loading ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>↻</span> : '📧'}
        {loading ? '  Sending…' : '  Send Reset Link'}
      </button>
    </div>
  )
}

// ── Sign Up View ──────────────────────────────────────────────────────────────
function SignUpView({ onBack, onGoogleSignUp }) {
  const { signUp } = useAuth()
  const [form,    setForm]    = useState({ name: '', email: '', password: '', confirm: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    setError(''); setLoading(true)
    await new Promise(r => setTimeout(r, 350))
    if (!form.name.trim())              return finish('Full name is required.')
    if (!form.email.includes('@'))      return finish('Please enter a valid email address.')
    if (form.password.length < 6)       return finish('Password must be at least 6 characters.')
    if (form.password !== form.confirm) return finish('Passwords do not match.')
    const result = signUp({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password })
    if (result?.error) finish(result.error)
    else setLoading(false)
  }
  const finish = (err) => { setError(err); setLoading(false) }

  return (
    <div>
      <button onClick={onBack} style={{ background:'none', border:'none', color:'#8892b0', cursor:'pointer', fontSize:13, marginBottom:20, padding:0, display:'flex', alignItems:'center', gap:5 }}>
        ← Back to Sign In
      </button>
      <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, color:'#1a1d2e', marginBottom:6 }}>Create your account</h3>
      <p style={{ fontSize:13, color:'#8892b0', marginBottom:24 }}>Get started — it's free forever.</p>

      {/* Google sign up */}
      <button className="btn-google" onClick={onGoogleSignUp} style={{ marginBottom:16 }}>
        <GoogleIcon /> Continue with Google
      </button>

      <div style={{ display:'flex', alignItems:'center', gap:12, margin:'18px 0' }}>
        <div style={{ flex:1, height:1, background:'#eef0f8' }} />
        <span style={{ fontSize:12, color:'#b0b4c8' }}>or sign up with email</span>
        <div style={{ flex:1, height:1, background:'#eef0f8' }} />
      </div>

      <div style={{ marginBottom:14 }}>
        <label className="label">Full Name</label>
        <input className="input" value={form.name} onChange={e => f('name',e.target.value)} placeholder="Your full name" autoFocus />
      </div>
      <div style={{ marginBottom:14 }}>
        <label className="label">Email Address</label>
        <input className="input" type="email" value={form.email} onChange={e => f('email',e.target.value)} placeholder="you@example.com" />
      </div>
      <div style={{ marginBottom:14 }}>
        <label className="label">Password</label>
        <input className="input" type="password" value={form.password} onChange={e => f('password',e.target.value)} placeholder="At least 6 characters" />
      </div>
      <div style={{ marginBottom:20 }}>
        <label className="label">Confirm Password</label>
        <input className="input" type="password" value={form.confirm} onChange={e => f('confirm',e.target.value)}
          onKeyDown={e => e.key==='Enter' && submit()} placeholder="••••••••" />
      </div>

      {error && (
        <div style={{ color:'#dc2626', fontSize:13, marginBottom:16, padding:'10px 14px', background:'rgba(220,38,38,0.06)', borderRadius:8, border:'1px solid rgba(220,38,38,0.18)' }}>
          ⚠ {error}
        </div>
      )}

      <button className="btn btn-gold" style={{ width:'100%', justifyContent:'center', padding:'13px 20px', fontSize:14 }}
        onClick={submit} disabled={loading}>
        {loading && <span style={{ animation:'spin 0.8s linear infinite', display:'inline-block' }}>↻</span>}
        {loading ? ' Creating…' : 'Create Account'}
      </button>

      <p style={{ fontSize:12, color:'#b0b4c8', textAlign:'center', marginTop:16, lineHeight:1.5 }}>
        By creating an account you agree that all your data stays private and local on your device.
      </p>
    </div>
  )
}

// ── Main AuthScreen ───────────────────────────────────────────────────────────
export default function AuthScreen({ onBack }) {
  const { signIn, signInDemo, signInWithGoogle } = useAuth()
  const [view,    setView]    = useState('login')   // 'login' | 'signup' | 'forgot'
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSignIn = async () => {
    setError(''); setLoading(true)
    await new Promise(r => setTimeout(r, 300))
    if (!form.email || !form.password) return finish('Please fill in all fields.')
    const result = signIn({ email: form.email.trim().toLowerCase(), password: form.password })
    if (result?.error) finish(result.error)
    else setLoading(false)
  }
  const finish = (err) => { setError(err); setLoading(false) }

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    try {
      // Opens Google OAuth popup
      const result = await signInWithGoogle()
      if (result?.error) setError(result.error)
    } catch {
      setError('Google sign-in failed. Please try again or use email.')
    } finally {
      setGoogleLoading(false)
    }
  }

  // ── FORGOT PASSWORD ────────────────────────────────────────────────────────
  if (view === 'forgot') return (
    <AuthLayout onBack={onBack}>
      <ForgotPasswordView onBack={() => setView('login')} />
    </AuthLayout>
  )

  // ── SIGN UP ────────────────────────────────────────────────────────────────
  if (view === 'signup') return (
    <AuthLayout onBack={onBack}>
      <SignUpView onBack={() => setView('login')} onGoogleSignUp={handleGoogleAuth} />
    </AuthLayout>
  )

  // ── SIGN IN ────────────────────────────────────────────────────────────────
  return (
    <AuthLayout onBack={onBack}>
      <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, color:'#1a1d2e', marginBottom:4 }}>
        Welcome back
      </h3>
      <p style={{ fontSize:13, color:'#8892b0', marginBottom:26 }}>Sign in to your WealthRadar account</p>

      {/* Google sign in */}
      <button className="btn-google" onClick={handleGoogleAuth} disabled={googleLoading} style={{ marginBottom:18 }}>
        {googleLoading
          ? <span style={{ animation:'spin 0.8s linear infinite', display:'inline-block', fontSize:16 }}>↻</span>
          : <GoogleIcon />}
        {googleLoading ? ' Signing in…' : 'Continue with Google'}
      </button>

      <div style={{ display:'flex', alignItems:'center', gap:12, margin:'0 0 20px' }}>
        <div style={{ flex:1, height:1, background:'#eef0f8' }} />
        <span style={{ fontSize:12, color:'#b0b4c8' }}>or continue with email</span>
        <div style={{ flex:1, height:1, background:'#eef0f8' }} />
      </div>

      <div style={{ marginBottom:14 }}>
        <label className="label">Email Address</label>
        <input className="input" type="email" value={form.email}
          onChange={e => f('email',e.target.value)} placeholder="you@example.com" autoFocus />
      </div>

      <div style={{ marginBottom:8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <label className="label" style={{ margin:0 }}>Password</label>
          <button onClick={() => setView('forgot')}
            style={{ background:'none', border:'none', color:'#c8920a', fontSize:12, cursor:'pointer', padding:0, fontFamily:"'Outfit',sans-serif", fontWeight:500 }}>
            Forgot password?
          </button>
        </div>
        <input className="input" type="password" value={form.password}
          onChange={e => f('password',e.target.value)}
          onKeyDown={e => e.key==='Enter' && handleSignIn()}
          placeholder="••••••••" />
      </div>

      {error && (
        <div style={{ color:'#dc2626', fontSize:13, margin:'14px 0', padding:'10px 14px', background:'rgba(220,38,38,0.06)', borderRadius:8, border:'1px solid rgba(220,38,38,0.18)' }}>
          ⚠ {error}
        </div>
      )}

      <button className="btn btn-gold"
        style={{ width:'100%', justifyContent:'center', padding:'13px 20px', fontSize:14, marginTop:16 }}
        onClick={handleSignIn} disabled={loading}>
        {loading && <span style={{ animation:'spin 0.8s linear infinite', display:'inline-block' }}>↻</span>}
        {loading ? ' Signing in…' : 'Sign In'}
      </button>

      {/* Demo */}
      <div style={{ display:'flex', alignItems:'center', gap:12, margin:'18px 0' }}>
        <div style={{ flex:1, height:1, background:'#eef0f8' }} />
        <span style={{ fontSize:12, color:'#b0b4c8' }}>or</span>
        <div style={{ flex:1, height:1, background:'#eef0f8' }} />
      </div>

      <button className="btn btn-outline"
        style={{ width:'100%', justifyContent:'center', padding:'11px 20px' }}
        onClick={signInDemo}>
        🎯 Try Demo — no account needed
      </button>

      {/* Sign up link */}
      <p style={{ textAlign:'center', fontSize:13, color:'#8892b0', marginTop:24 }}>
        Don't have an account?{' '}
        <button onClick={() => { setView('signup'); setError('') }}
          style={{ background:'none', border:'none', color:'#c8920a', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:"'Outfit',sans-serif" }}>
          Sign up free
        </button>
      </p>
    </AuthLayout>
  )
}

// ── Auth page wrapper ─────────────────────────────────────────────────────────
function AuthLayout({ children, onBack }) {
  // "Back to home" link shown when coming from landing page
  return (
    <div className="auth-bg" style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div className="auth-grid" />
      <div style={{ position:'relative', width:440, maxWidth:'100%' }}>

        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            width:56, height:56,
            background:'linear-gradient(135deg,#c8920a,#e8a820)',
            borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:26, margin:'0 auto 16px',
            boxShadow:'0 12px 32px rgba(200,146,10,0.28)',
          }}>📡</div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:700, color:'#1a1d2e', letterSpacing:'0.01em' }}>
            Wealth<span className="gold-gradient">Radar</span>
          </h1>
          <p style={{ color:'#9098b8', fontSize:12, marginTop:6, letterSpacing:'0.08em', textTransform:'uppercase' }}>
            Personal Finance Command Centre
          </p>
        </div>

        {/* Card */}
        <div style={{
          background:'#fff',
          border:'1px solid #e4e7f0',
          borderRadius:18,
          padding:36,
          boxShadow:'0 8px 40px rgba(0,0,0,0.08)',
        }}>
          {children}
        </div>

        <p style={{ textAlign:'center', color:'#b0b4c8', fontSize:12, marginTop:18 }}>
          🔒 All data stored locally in your browser — no servers, no tracking.
        </p>
      </div>
    </div>
  )
}
