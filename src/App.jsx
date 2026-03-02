import { useState, useCallback } from 'react'
import { AuthProvider, useAuth }       from './context/AuthContext'
import { FinanceProvider, useFinance } from './context/FinanceContext'
import { useTotals }                   from './hooks/useTotals'
import { Notification }                from './components/UI'
import AuthScreen                      from './components/AuthScreen'
import { Dashboard, Assets, Liabilities, CashFlow, Analytics, NetWorth, Settings } from './components/Tabs'
import { TABS }                        from './utils/constants'
import { formatCompact, formatCurrency } from './utils/helpers'

// ── App shell (shown after login) ─────────────────────────────────────────────
function Shell() {
  const { session }                          = useAuth()
  const { settings, takeSnapshot, exportCSV } = useFinance()
  const totals                               = useTotals()
  const [activeTab, setActiveTab]            = useState('dashboard')
  const [sidebarOpen, setSidebarOpen]        = useState(true)
  const [notif, setNotif]                    = useState(null)

  const toast = useCallback((msg, type = 'success') => setNotif({ msg, type }), [])

  const cur  = settings?.currency || 'INR'
  const fmts = (v) => formatCompact(v, cur)
  const fmt  = (v) => formatCurrency(v, cur)

  const CURRENCY_SYMBOLS = {
    INR:'₹', USD:'$', EUR:'€', GBP:'£',
    JPY:'¥', CAD:'CA$', AUD:'A$', SGD:'S$', AED:'AED'
  }
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
    takeSnapshot({
      netWorth:         totals.netWorth         || 0,
      totalAssets:      totals.totalAssets      || 0,
      totalLiabilities: totals.totalLiabilities || 0,
      cashFlow:         totals.cashFlow         || 0,
    })
    toast('Snapshot saved!', 'success')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#06070a' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarOpen ? 220 : 0,
        minWidth: sidebarOpen ? 220 : 0,
        borderRight: '1px solid #1a1f2e',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
        position: 'sticky', top: 0, height: '100vh',
        flexShrink: 0, background: '#06070a',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1a1f2e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg,#c8953a,#e8c060)',
              borderRadius: 8, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 18, flexShrink: 0,
            }}>📡</div>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: '#e2e4ec' }}>
                Wealth<span className="gold-gradient">Radar</span>
              </div>
              <div style={{ fontSize: 9, color: '#6b7494', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pro</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {TABS.map(t => (
            <div key={t.id}
              className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              <span style={{ fontSize: 14, opacity: 0.7 }}>{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </nav>

        {/* Net worth widget */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid #1a1f2e' }}>
          <div style={{ fontSize: 10, color: '#6b7494', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Net Worth</div>
          <div className="gold-gradient" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600 }}>
            {totals?.netWorth !== undefined ? fmts(totals.netWorth) : '—'}
          </div>
          {totals?.cashFlow !== undefined && (
            <div style={{ fontSize: 11, marginTop: 4, color: totals.cashFlow >= 0 ? '#3ecf8e' : '#f06a6a' }}>
              {totals.cashFlow >= 0 ? '▲' : '▼'} {fmt(Math.abs(totals.cashFlow))}/mo
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <header style={{
          height: 58, borderBottom: '1px solid #1a1f2e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', position: 'sticky', top: 0,
          background: 'rgba(6,7,10,0.95)', backdropFilter: 'blur(16px)',
          zIndex: 100, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-icon"
              style={{ fontSize: 18 }}
              onClick={() => setSidebarOpen(s => !s)}>☰</button>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, color: '#e2e4ec' }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="chip">{currSymbol} {cur}</div>
            <button className="btn btn-gold btn-sm" onClick={handleSnapshot}>📸 Snapshot</button>
            <button className="btn btn-outline btn-sm" onClick={() => { exportCSV(); toast('CSV exported', 'info') }}>⬇ CSV</button>
            <div style={{ width: 1, height: 20, background: '#1a1f2e' }} />
            <div onClick={() => setActiveTab('settings')} style={{ cursor: 'pointer' }}>
              {session?.picture
                ? <img src={session.picture} alt=""
                    style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #1a1f2e', display: 'block' }} />
                : <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#c8953a,#e8c060)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600, color: '#06070a',
                  }}>
                    {session?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
              }
            </div>
          </div>
        </header>

        {/* Page */}
        <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
          <div key={activeTab} className="fade-up">
            {TAB_COMPONENTS[activeTab]}
          </div>
        </main>
      </div>

      {notif && <Notification msg={notif.msg} type={notif.type} onDone={() => setNotif(null)} />}
    </div>
  )
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate() {
  const { session } = useAuth()
  if (!session) return <AuthScreen />
  return (
    <FinanceProvider>
      <Shell />
    </FinanceProvider>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}
