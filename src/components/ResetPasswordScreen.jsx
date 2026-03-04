import { useState } from 'react'
import { updatePassword } from '../context/AuthContext'

export default function ResetPasswordScreen({ email, token, onDone }) {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [showPass,  setShowPass]  = useState(false)

  // Validate token expiry from localStorage
  const tokenKey    = 'wr_reset_' + token
  const storedRaw   = localStorage.getItem(tokenKey)
  const tokenValid  = (() => {
    if (!storedRaw) return true  // No stored token = old link pre-expiry feature; allow it
    try {
      const { expiry } = JSON.parse(storedRaw)
      return Date.now() < expiry
    } catch { return false }
  })()

  const strength = password.length === 0 ? null
    : password.length < 6  ? 'weak'
    : password.length < 10 ? 'fair'
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 'strong'
    : 'good'

  const strengthColor = { weak:'#dc2626', fair:'#d97706', good:'#2563eb', strong:'#16a34a' }
  const strengthWidth = { weak:'25%', fair:'55%', good:'78%', strong:'100%' }

  const handleReset = async () => {
    setError('')
    if (password.length < 6)       return setError('Password must be at least 6 characters.')
    if (password !== confirm)       return setError('Passwords do not match.')
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    const result = updatePassword(email, password)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(result.created ? 'created' : 'updated')
      // Clean up the used token and URL
      localStorage.removeItem(tokenKey)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  // ── Expired link screen ───────────────────────────────────────────────────
  if (!tokenValid) return (
    <PageWrapper>
      <div style={{ textAlign:'center', padding:'8px 0' }}>
        <div style={{ fontSize:52, marginBottom:16 }}>⏰</div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, color:'#1a1d2e', marginBottom:10 }}>
          Link expired
        </h2>
        <p style={{ fontSize:14, color:'#6b7494', lineHeight:1.65, marginBottom:28 }}>
          This reset link is more than 1 hour old and has expired.<br/>
          Please request a new one.
        </p>
        <button className="btn btn-gold"
          style={{ width:'100%', justifyContent:'center', padding:'13px 20px', fontSize:15, marginBottom:12 }}
          onClick={onDone}>
          Request New Link
        </button>
      </div>
    </PageWrapper>
  )

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) return (
    <PageWrapper>
      <div style={{ textAlign:'center', padding:'8px 0' }}>
        <div style={{ fontSize:56, marginBottom:18 }}>✅</div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:'#1a1d2e', marginBottom:10 }}>
          {success === 'created' ? 'Account ready!' : 'Password updated!'}
        </h2>
        <p style={{ fontSize:14, color:'#6b7494', lineHeight:1.65, marginBottom:8 }}>
          {success === 'created'
            ? 'Your account has been created and your password is set.'
            : 'Your password has been changed successfully.'}
        </p>
        <p style={{ fontSize:13, color:'#9098b8', marginBottom:28 }}>
          Sign in with <strong style={{ color:'#1a1d2e' }}>{email}</strong> and your new password.
        </p>
        <button
          className="btn btn-gold"
          style={{ width:'100%', justifyContent:'center', padding:'13px 20px', fontSize:15 }}
          onClick={onDone}>
          Go to Sign In →
        </button>
      </div>
    </PageWrapper>
  )

  // ── Reset form ─────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔑</div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:'#1a1d2e', marginBottom:6 }}>
          Set new password
        </h2>
        <p style={{ fontSize:13, color:'#8892b0' }}>
          Resetting password for <strong style={{ color:'#1a1d2e' }}>{email}</strong>
        </p>
      </div>

      {/* New password */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <label className="label" style={{ margin:0 }}>New Password</label>
          {strength && (
            <span style={{ fontSize:11, fontWeight:600, color: strengthColor[strength], textTransform:'uppercase', letterSpacing:'0.04em' }}>
              {strength}
            </span>
          )}
        </div>
        <div style={{ position:'relative' }}>
          <input
            className="input"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoFocus
            style={{ paddingRight:44 }}
          />
          <button
            onClick={() => setShowPass(s => !s)}
            style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#9098b8', padding:0 }}>
            {showPass ? '🙈' : '👁️'}
          </button>
        </div>
        {/* Strength bar */}
        {strength && (
          <div style={{ marginTop:7, height:3, background:'#eef0f8', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width: strengthWidth[strength], background: strengthColor[strength], borderRadius:2, transition:'width 0.3s, background 0.3s' }} />
          </div>
        )}
      </div>

      {/* Confirm password */}
      <div style={{ marginBottom:20 }}>
        <label className="label">Confirm New Password</label>
        <div style={{ position:'relative' }}>
          <input
            className="input"
            type={showPass ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReset()}
            placeholder="••••••••"
            style={{ paddingRight:44 }}
          />
          {/* Match indicator */}
          {confirm.length > 0 && (
            <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>
              {confirm === password ? '✅' : '❌'}
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color:'#dc2626', fontSize:13, marginBottom:16, padding:'10px 14px', background:'rgba(220,38,38,0.06)', borderRadius:8, border:'1px solid rgba(220,38,38,0.18)' }}>
          ⚠ {error}
        </div>
      )}

      {/* Submit */}
      <button
        className="btn btn-gold"
        style={{ width:'100%', justifyContent:'center', padding:'13px 20px', fontSize:15 }}
        onClick={handleReset}
        disabled={loading || !password || !confirm}>
        {loading
          ? <><span style={{ animation:'spin 0.8s linear infinite', display:'inline-block' }}>↻</span> Updating…</>
          : '🔒 Update Password'}
      </button>

      {/* Password tips */}
      <div style={{ marginTop:18, padding:'12px 14px', background:'#f8f9fc', border:'1px solid #eef0f8', borderRadius:9 }}>
        <div style={{ fontSize:11, color:'#9098b8', fontWeight:500, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Tips for a strong password</div>
        {[
          ['At least 8 characters',           password.length >= 8],
          ['Contains a number',               /[0-9]/.test(password)],
          ['Contains an uppercase letter',    /[A-Z]/.test(password)],
        ].map(([tip, met]) => (
          <div key={tip} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <span style={{ fontSize:12, color: met ? '#16a34a' : '#d0d4e0' }}>{met ? '✓' : '○'}</span>
            <span style={{ fontSize:12, color: met ? '#16a34a' : '#9098b8' }}>{tip}</span>
          </div>
        ))}
      </div>

      <button onClick={onDone}
        style={{ background:'none', border:'none', color:'#9098b8', cursor:'pointer', fontSize:12, width:'100%', marginTop:14, textAlign:'center', fontFamily:"'Outfit',sans-serif" }}>
        Cancel — back to Sign In
      </button>
    </PageWrapper>
  )
}

// ── Wrapper with brand header ──────────────────────────────────────────────────
function PageWrapper({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      background: 'radial-gradient(ellipse at 15% 50%, rgba(200,146,10,0.07) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(37,99,235,0.05) 0%, transparent 50%), linear-gradient(160deg,#f8f9fd,#eef0f8)',
    }}>
      {/* Dot grid */}
      <div style={{ position:'fixed', inset:0, backgroundImage:'radial-gradient(circle at 1px 1px, rgba(100,110,180,0.07) 1px, transparent 0)', backgroundSize:'32px 32px', pointerEvents:'none' }} />

      <div style={{ position:'relative', width:420, maxWidth:'100%' }}>
        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:50, height:50, background:'linear-gradient(135deg,#c8920a,#e8a820)', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 12px', boxShadow:'0 12px 32px rgba(200,146,10,0.28)' }}>📡</div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30, fontWeight:700, color:'#1a1d2e' }}>
            Wealth<span style={{ background:'linear-gradient(135deg,#b8820e,#e8a820)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Radar</span>
          </h1>
        </div>

        {/* Card */}
        <div style={{ background:'#fff', border:'1px solid #e4e7f0', borderRadius:18, padding:'32px 28px', boxShadow:'0 8px 40px rgba(0,0,0,0.08)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
