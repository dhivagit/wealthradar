import { useState, useCallback } from 'react'
import { AuthProvider, useAuth }       from './context/AuthContext'
import { FinanceProvider, useFinance } from './context/FinanceContext'
import { useTotals }                   from './hooks/useTotals'
import { Notification }                from './components/UI'
import AuthScreen                      from './components/AuthScreen'
import LandingPage                     from './components/LandingPage'
import ResetPasswordScreen             from './components/ResetPasswordScreen'
import { Dashboard, Assets, Liabilities, CashFlow, Analytics, NetWorth, Settings } from './components/Tabs'
import { TABS }                        from './utils/constants'
import { formatCompact, formatCurrency } from './utils/helpers'

// ── Read reset params from URL once on load ───────────────────────────────────
function getResetParams() {
  const p     = new URLSearchParams(window.location.search)
  const token = p.get('reset')
  const email = p.get('email')
  return token && email ? { token, email: decodeURIComponent(email) } : null
}

// ── App shell ────────────────────────────────────────────────────────────────
function Shell() {
  const { session }                            = useAuth()
  const { settings, takeSnapshot, exportCSV }  = useFinance()
  const totals                                 = useTotals()
  const [activeTab,   setActiveTab]            = useState('dashboard')
  const [sidebarOpen, setSidebarOpen]          = useState(true)
  const [notif,       setNotif]                = useState(null)

  const toast = useCallback((msg, type = 'success') => setNotif({ msg, type }), [])

  const cur  = settings?.currency || 'INR'
  const fmts = (v) => formatCompact(v, cur)
  const fmt  = (v) => formatCurrency(v, cur)

  const CURRENCY_SYMBOLS = { INR:'₹', USD:'$', EUR:'€', GBP:'£', JPY:'¥', CAD:'CA$', AUD:'A$', SGD:'S$', AED:'AED' }
  const currSymbol = CURRENCY_SYMBOLS[cur] || '₹'

  const TAB_COMPONENTS = {
    dashboard:   <Dashboard />,
    assets:      <Assets />,
    liabilities: <Liabilities />,
    cashflow:    <CashFlow />,
    analytics:   <Analytics />,
    networth:    <NetWorth />,
    settings:    <Settings onToast={toast} />,
  }

  const handleSnapshot = () => {
    if (!totals) return
    takeSnapshot({ netWorth:totals.netWorth||0, totalAssets:totals.totalAssets||0, totalLiabilities:totals.totalLiabilities||0, cashFlow:totals.cashFlow||0 })
    toast('Snapshot saved!', 'success')
  }

  const activeTabObj = TABS.find(t => t.id === activeTab)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f5f6fa' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarOpen ? 230 : 0,
        minWidth: sidebarOpen ? 230 : 0,
        background: '#ffffff',
        borderRight: '1px solid #e8eaf0',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
        position: 'sticky', top: 0, height: '100vh',
        flexShrink: 0,
        boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
      }}>
        {/* Logo */}
        <div style={{ padding:'22px 18px 18px', borderBottom:'1px solid #eef0f8' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:36, height:36,
              background:'linear-gradient(135deg,#c8920a,#e8a820)',
              borderRadius:10, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:18, flexShrink:0,
              boxShadow:'0 4px 12px rgba(200,146,10,0.3)',
            }}>📡</div>
            <div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'#1a1d2e', lineHeight:1.2 }}>
                Wealth<span className="gold-gradient">Radar</span>
              </div>
              <div style={{ fontSize:9, color:'#b0b8d0', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:2 }}>Finance Pro</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex:1, padding:'14px 10px', overflowY:'auto' }}>
          {TABS.map(t => (
            <div key={t.id}
              className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              <span style={{ fontSize:15 }}>{t.icon}</span>
              <span style={{ fontSize:13 }}>{t.label}</span>
            </div>
          ))}
        </nav>

        {/* Net worth widget */}
        <div style={{ padding:'16px 18px', borderTop:'1px solid #eef0f8', background:'#fafbfe' }}>
          <div style={{ fontSize:10, color:'#b0b8d0', marginBottom:5, letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:500 }}>Net Worth</div>
          <div className="gold-gradient" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, lineHeight:1.2 }}>
            {totals?.netWorth !== undefined ? fmts(totals.netWorth) : '—'}
          </div>
          {totals?.cashFlow !== undefined && (
            <div style={{ fontSize:11, marginTop:5, color:totals.cashFlow >= 0 ? '#16a34a' : '#dc2626', fontWeight:500 }}>
              {totals.cashFlow >= 0 ? '▲' : '▼'} {fmt(Math.abs(totals.cashFlow))}/mo cash flow
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>

        {/* Topbar */}
        <header style={{
          height:60, borderBottom:'1px solid #eef0f8',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 28px', position:'sticky', top:0,
          background:'rgba(255,255,255,0.97)',
          backdropFilter:'blur(16px)',
          zIndex:100, flexShrink:0,
          boxShadow:'0 1px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <button className="btn btn-ghost btn-icon" style={{ fontSize:18, color:'#6b7494' }}
              onClick={() => setSidebarOpen(s => !s)}>☰</button>
            <div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'#1a1d2e', lineHeight:1.2 }}>
                {activeTabObj?.label}
              </h2>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div className="chip">{currSymbol} {cur}</div>
            <button className="btn btn-gold btn-sm" onClick={handleSnapshot}>📸 Snapshot</button>
            <button className="btn btn-outline btn-sm" onClick={() => { exportCSV(); toast('CSV exported','info') }}>⬇ CSV</button>
            <div style={{ width:1, height:22, background:'#eef0f8' }} />
            {/* Avatar */}
            <div onClick={() => setActiveTab('settings')} style={{ cursor:'pointer' }}>
              {session?.picture
                ? <img src={session.picture} alt=""
                    style={{ width:34, height:34, borderRadius:'50%', border:'2px solid #eef0f8', display:'block', objectFit:'cover' }} />
                : <div style={{
                    width:34, height:34, borderRadius:'50%',
                    background:'linear-gradient(135deg,#c8920a,#e8a820)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:14, fontWeight:700, color:'#fff',
                    boxShadow:'0 2px 8px rgba(200,146,10,0.3)',
                  }}>
                    {session?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
              }
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex:1, padding:'28px 32px', overflowY:'auto', background:'#f5f6fa' }}>
          <div key={activeTab} className="fade-up">
            {TAB_COMPONENTS[activeTab]}
          </div>
        </main>
      </div>

      {notif && <Notification msg={notif.msg} type={notif.type} onDone={() => setNotif(null)} />}
    </div>
  )
}

function AuthGate() {
  const { session } = useAuth()
  const [page, setPage] = useState('landing')  // 'landing' | 'auth'

  // Check for password reset link in URL (?reset=TOKEN&email=...)
  const [resetParams, setResetParams] = useState(() => getResetParams())

  // Reset link takes highest priority
  if (resetParams) {
    return (
      <ResetPasswordScreen
        email={resetParams.email}
        token={resetParams.token}
        onDone={() => { setResetParams(null); setPage('auth') }}
      />
    )
  }

  // Logged-in users go straight to the app
  if (session) return <FinanceProvider><Shell /></FinanceProvider>

  // Show auth screen when user clicks Sign In / Get Started
  if (page === 'auth') {
    return <AuthScreen onBack={() => setPage('landing')} />
  }

  // Default: show landing page
  return (
    <LandingPage
      onGetStarted={() => setPage('auth')}
      onSignIn={() => setPage('auth')}
    />
  )
}

export default function App() {
  return <AuthProvider><AuthGate /></AuthProvider>
}
