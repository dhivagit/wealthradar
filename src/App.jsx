import { useState, useCallback, useEffect } from 'react'
import { AuthProvider, useAuth }       from './context/AuthContext'
import { FinanceProvider, useFinance } from './context/FinanceContext'
import { useTotals }                   from './hooks/useTotals'
import { Notification }                from './components/UI'
import AuthScreen                      from './components/AuthScreen'
import LandingPage                     from './components/LandingPage'
import { Dashboard, Assets, Liabilities, CashFlow, Analytics, NetWorth, Settings } from './components/Tabs'
import { TABS }                        from './utils/constants'
import { formatCompact, formatCurrency } from './utils/helpers'

function Shell() {
  const { session }                           = useAuth()
  const { settings, takeSnapshot, exportCSV } = useFinance()
  const totals                                = useTotals()
  const [activeTab,   setActiveTab]           = useState('dashboard')
  const [sidebarOpen, setSidebarOpen]         = useState(false)
  const [notif,       setNotif]               = useState(null)

  const toast = useCallback((msg, type = 'success') => setNotif({ msg, type }), [])

  const cur        = settings?.currency || 'INR'
  const fmts       = v => formatCompact(v, cur)
  const fmt        = v => formatCurrency(v, cur)
  const currSymbol = { INR:'₹',USD:'$',EUR:'€',GBP:'£',JPY:'¥',CAD:'CA$',AUD:'A$',SGD:'S$',AED:'AED' }[cur] || '₹'

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

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
    toast('Snapshot saved!')
  }

  // Navigate and always close sidebar (important on mobile)
  const navTo = tabId => {
    setActiveTab(tabId)
    setSidebarOpen(false)
  }

  const activeTabObj = TABS.find(t => t.id === activeTab)

  // Bottom nav tabs (5 most important)
  const BOTTOM_TABS = TABS.filter(t =>
    ['dashboard','assets','cashflow','networth','settings'].includes(t.id)
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', minHeight:'100dvh', background:'#f5f6fa' }}>

      {/* ── Mobile overlay — click to close sidebar ───────────────────────── */}
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar (desktop: sticky column / mobile: slide-in drawer) ────── */}
      <aside className={`app-sidebar${sidebarOpen ? ' is-open' : ''}`}
        style={{
          width: 230,
          background: '#ffffff',
          borderRight: '1px solid #e8eaf0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 16px rgba(0,0,0,0.04)',
        }}>

        {/* Logo + close button */}
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid #eef0f8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:34, height:34, background:'linear-gradient(135deg,#c8920a,#e8a820)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, boxShadow:'0 4px 12px rgba(200,146,10,0.28)' }}>📡</div>
            <div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, color:'#1a1d2e', lineHeight:1.2 }}>
                Wealth<span className="gold-gradient">Radar</span>
              </div>
              <div style={{ fontSize:9, color:'#b0b8d0', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:1 }}>Finance Pro</div>
            </div>
          </div>
          {/* Only visible on mobile */}
          <button className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9098b8', padding:'4px 6px', borderRadius:6, lineHeight:1 }}>
            ✕
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto' }}>
          {TABS.map(t => (
            <div key={t.id}
              className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => navTo(t.id)}>
              <span style={{ fontSize:16 }}>{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </nav>

        {/* Net worth mini widget */}
        <div style={{ padding:'14px 18px', borderTop:'1px solid #eef0f8', background:'#fafbfe' }}>
          <div style={{ fontSize:10, color:'#b0b8d0', marginBottom:4, letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:500 }}>Net Worth</div>
          <div className="gold-gradient" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, lineHeight:1.2 }}>
            {totals?.netWorth !== undefined ? fmts(totals.netWorth) : '—'}
          </div>
          {totals?.cashFlow !== undefined && (
            <div style={{ fontSize:11, marginTop:4, color:totals.cashFlow >= 0 ? '#16a34a' : '#dc2626', fontWeight:500 }}>
              {totals.cashFlow >= 0 ? '▲' : '▼'} {fmt(Math.abs(totals.cashFlow))}/mo
            </div>
          )}
        </div>
      </aside>

      {/* ── Right side: topbar + content ─────────────────────────────────── */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>

        {/* Topbar */}
        <header style={{
          height: 58,
          borderBottom: '1px solid #eef0f8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          zIndex: 100,
          flexShrink: 0,
          boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {/* Hamburger */}
            <button onClick={() => setSidebarOpen(s => !s)}
              style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#6b7494', padding:'6px 8px', borderRadius:8, lineHeight:1, flexShrink:0 }}>
              ☰
            </button>
            {/* Mobile: logo in topbar */}
            <div className="topbar-logo" style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:27, height:27, background:'linear-gradient(135deg,#c8920a,#e8a820)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>📡</div>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, color:'#1a1d2e' }}>
                Wealth<span className="gold-gradient">Radar</span>
              </span>
            </div>
            {/* Desktop: page title */}
            <h2 className="topbar-title" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:19, color:'#1a1d2e', fontWeight:600 }}>
              {activeTabObj?.label}
            </h2>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className="chip hide-mobile">{currSymbol} {cur}</div>
            <button className="btn btn-gold btn-sm hide-mobile" onClick={handleSnapshot}>📸 Snapshot</button>
            <button className="btn btn-outline btn-sm hide-mobile" onClick={() => { exportCSV(); toast('CSV exported','info') }}>⬇ CSV</button>
            <div style={{ width:1, height:22, background:'#eef0f8' }} className="hide-mobile" />
            {/* Avatar */}
            <div onClick={() => navTo('settings')} style={{ cursor:'pointer', flexShrink:0 }}>
              {session?.picture
                ? <img src={session.picture} alt="" style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #eef0f8', display:'block', objectFit:'cover' }} />
                : <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#c8920a,#e8a820)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', boxShadow:'0 2px 8px rgba(200,146,10,0.25)' }}>
                    {session?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
              }
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="main-content" style={{ flex:1, overflowY:'auto', background:'#f5f6fa' }}>
          <div key={activeTab} className="fade-up">
            {TAB_COMPONENTS[activeTab]}
          </div>
        </main>

        {/* ── Mobile bottom navigation ──────────────────────────────────── */}
        <nav className="mobile-bottom-nav">
          {BOTTOM_TABS.map(t => (
            <button key={t.id} onClick={() => navTo(t.id)}
              style={{
                flex: 1, display:'flex', flexDirection:'column',
                alignItems:'center', gap:3,
                background:'none', border:'none', cursor:'pointer',
                padding:'6px 0',
                color: activeTab === t.id ? '#c8920a' : '#9098b8',
                transition: 'color 0.15s',
              }}>
              <span style={{ fontSize:19, lineHeight:1 }}>{t.icon}</span>
              <span style={{ fontSize:9, fontWeight: activeTab===t.id ? 600 : 400, fontFamily:"'Outfit',sans-serif", letterSpacing:'0.02em' }}>
                {t.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {notif && <Notification msg={notif.msg} type={notif.type} onDone={() => setNotif(null)} />}
    </div>
  )
}

function AuthGate() {
  const { session } = useAuth()
  if (!session) return <AuthScreen />
  return <FinanceProvider><Shell /></FinanceProvider>
}

// Root: landing → auth → app
export default function App() {
  const [page, setPage] = useState('landing')
  return (
    <AuthProvider>
      <AppRouter page={page} setPage={setPage} />
    </AuthProvider>
  )
}

function AppRouter({ page, setPage }) {
  const { session } = useAuth()
  if (session) return <FinanceProvider><Shell /></FinanceProvider>
  if (page === 'auth') return <AuthScreen onBack={() => setPage('landing')} />
  return <LandingPage onGetStarted={() => setPage('auth')} onSignIn={() => setPage('auth')} />
}
