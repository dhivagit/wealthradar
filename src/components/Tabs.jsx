import { useState, useCallback, useEffect } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

import { useFinance }  from '../context/FinanceContext'
import { useTotals }   from '../hooks/useTotals'
import { StatCard, ProgressBar, DataTable, DonutSVG, ChartTooltip, Notification } from './UI'
import EntryModal      from './EntryModal'
import ImportModal     from './ImportModal'
import { PALETTE, CAT_COLORS, MILESTONES } from '../utils/constants'
import { groupBy, formatCurrency, formatCompact } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'
import { CURRENCIES } from '../utils/constants'
import { ALL_CLASSES, CLASS_COLORS, ASSET_CLASS_MAP, mfClass, getAssetClass } from '../utils/assetClasses'

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export function Dashboard() {
  const { data, settings } = useFinance()
  const totals = useTotals()
  if (!data) return null

  const { totalAssets, totalLiabilities, netWorth, cashFlow, savingsRate, nwChange } = totals
  const cur = settings.currency
  const fmt  = v => formatCompact(v, cur)

  const assetGroups = groupBy(data.assets, 'category')
  // Dashboard allocation: group by 5 macro classes (+ Crypto shown separately)
  const dashGroups = {}
  ;(data?.assets||[]).forEach(a => {
    if (!a.value) return
    let cls = getAssetClass(a)
    // Crypto gets its own visual group but is excluded from the 5-class allocation
    if (a.category === 'Cryptocurrency') {
      cls = 'Cryptocurrency'
    }
    if (!cls) return  // excluded (Vehicles, Business Assets, Others)
    if (!dashGroups[cls]) dashGroups[cls] = { value:0, color: cls === 'Cryptocurrency' ? '#f43f5e' : CLASS_COLORS[cls] }
    dashGroups[cls].value += a.value
  })
  const assetPie = Object.entries(dashGroups)
    .map(([name, d]) => ({ name, value: d.value, color: d.color }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <StatCard label="Net Worth"        value={fmt(netWorth)}          sub={`${data.assets.length} assets · ${data.liabilities.length} liabilities`} color="#e8c060"  change={nwChange} icon="⬡" delay={0}   />
        <StatCard label="Total Assets"     value={fmt(totalAssets)}       sub={`${Object.keys(assetGroups).length} categories`}      color="#3ecf8e" icon="△" delay={60}  />
        <StatCard label="Total Liabilities"value={fmt(totalLiabilities)}  sub={`Debt ratio ${totals.debtRatio?.toFixed(1)}%`}        color="#f06a6a" icon="▽" delay={120} />
        <StatCard label="Monthly Cash Flow"value={fmt(cashFlow)}          sub={`${savingsRate?.toFixed(1)}% savings rate`}            color={cashFlow >= 0 ? '#3ecf8e' : '#f06a6a'} icon="⇄" delay={180} />
      </div>

      {/* Portfolio P&L summary — only shown if any asset has invested value */}
      {data.assets.some(a => a._investedValue > 0) && (() => {
        const invested  = data.assets.reduce((s, a) => s + (a._investedValue || 0), 0)
        const present   = data.assets.reduce((s, a) => s + (a._investedValue > 0 ? a.value : 0), 0)
        const pl        = present - invested
        const plPct     = invested > 0 ? (pl / invested) * 100 : 0
        const plColor   = pl >= 0 ? '#16a34a' : '#dc2626'
        const plBg      = pl >= 0 ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)'
        const plBorder  = pl >= 0 ? 'rgba(22,163,74,0.2)'  : 'rgba(220,38,38,0.2)'
        const byType = [
          { label: 'Stocks', items: data.assets.filter(a => !a._isMF && a._investedValue > 0) },
          { label: 'Mutual Funds', items: data.assets.filter(a => a._isMF  && a._investedValue > 0) },
        ].filter(t => t.items.length > 0).map(t => ({
          ...t,
          invested: t.items.reduce((s,a) => s + a._investedValue, 0),
          present:  t.items.reduce((s,a) => s + a.value, 0),
        })).map(t => ({ ...t, pl: t.present - t.invested, plPct: t.invested > 0 ? (t.present - t.invested) / t.invested * 100 : 0 }))

        return (
          <div style={{ background: plBg, border: `1px solid ${plBorder}`, borderRadius: 14, padding: '18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Portfolio Gain / Loss</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:plColor }}>
                  {pl >= 0 ? '+' : ''}{fmt(pl)}
                </span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:600, color:plColor,
                  background: pl >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', padding:'2px 10px', borderRadius:20 }}>
                  {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                </span>
              </div>
              <div style={{ fontSize:12, color:'#8892b0', marginTop:4 }}>Invested: {fmt(invested)} → Present: {fmt(present)}</div>
            </div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {byType.map(t => (
                <div key={t.label} style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#8892b0', marginBottom:4 }}>{t.label}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600,
                    color: t.plPct >= 0 ? '#16a34a' : '#dc2626' }}>
                    {t.plPct >= 0 ? '+' : ''}{t.plPct.toFixed(2)}%
                  </div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#8892b0' }}>
                    {t.pl >= 0 ? '+' : ''}{fmt(t.pl)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Net Worth Trend */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 className="section-heading">Net Worth Trend</h3>
          <div className="chip">12-Month</div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.history}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c8953a" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c8953a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3ecf8e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3ecf8e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f8" />
            <XAxis dataKey="month" tick={{ fill: '#9098b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9098b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
            <Tooltip content={<ChartTooltip currency={cur} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
            <Area type="monotone" dataKey="assets"   stroke="#3ecf8e" strokeWidth={1.5} fill="url(#assetGrad)" name="Assets"    dot={false} />
            <Area type="monotone" dataKey="netWorth" stroke="#c8953a" strokeWidth={2}   fill="url(#nwGrad)"    name="Net Worth" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Allocation + Cash Flow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 20 }}>Asset Allocation</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DonutSVG segments={assetPie.filter(s => s.value > 0)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {assetPie.map(s => (
                <div key={s.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#4a4f6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: '#1a1d2e' }}>
                      {totalAssets > 0 ? ((s.value / totalAssets) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <ProgressBar pct={totalAssets > 0 ? (s.value / totalAssets) * 100 : 0} color={s.color} height={3} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 20 }}>Income vs Expenses (6M)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.history.slice(-6)} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f8" />
              <XAxis dataKey="month" tick={{ fill: '#9098b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9098b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
              <Tooltip content={<ChartTooltip currency={cur} />} />
              <Bar dataKey="income"   fill="#3ecf8e" opacity={0.8} radius={[3,3,0,0]} name="Income" />
              <Bar dataKey="expenses" fill="#f06a6a" opacity={0.8} radius={[3,3,0,0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Snapshots */}
      {data.snapshots?.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 16 }}>Saved Snapshots</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
            {[...data.snapshots].reverse().slice(0, 6).map(snap => (
              <div key={snap.id} style={{ padding: '14px 16px', background: '#f5f6fa', borderRadius: 10, border: '1px solid #e8eaf0' }}>
                <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 6 }}>{snap.date}</div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: '#b8820e', marginBottom: 4 }}>
                  {formatCompact(snap.netWorth, snap.currency || 'INR')}
                </div>
                <div style={{ fontSize: 11, color: '#b0b8d0' }}>Net Worth</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSETS
// ═══════════════════════════════════════════════════════════════════════════════
export function Assets() {
  const { data, settings, deleteItem } = useFinance()
  const { totalAssets } = useTotals()
  const [modal,        setModal]        = useState(null)
  const [importModal,  setImportModal]  = useState(false)
  const [importToast,  setImportToast]  = useState(null)
  const cur    = settings.currency
  const fmt    = v => formatCurrency(v, cur)
  const groups = groupBy(data?.assets || [], 'category')

  const BROKER_ICONS = {
    'Zerodha':'🟡','Groww':'🟢','MF Central':'🔵','Kuvera':'🟣',
    'NSDL/CDSL':'🏛️','EPFO':'🏢','SBI':'🏦','HDFC Bank':'🏦',
    'ICICI Bank':'🏦','Axis Bank':'🏦',
    'ICICI Direct':'🔴','INDMoney':'🟠',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 className="section-heading">Assets</h2>
          <p style={{ color:'#8892b0', fontSize:13, marginTop:4 }}>
            Total: <span style={{ color:'#16a34a', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(totalAssets)}</span>
            <span style={{ color:'#b0b8d0', marginLeft:12 }}>{data?.assets?.length || 0} holdings</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button className="btn btn-outline"
            onClick={() => setImportModal(true)}
            style={{ color:'#c8953a', borderColor:'rgba(200,146,10,0.35)', gap:8 }}>
            📥 Import from Broker / Bank
          </button>
          <button className="btn btn-gold" onClick={() => setModal({ collection:'assets', item:null })}>
            + Add Asset
          </button>
        </div>
      </div>

      {/* Import callout — shown when no assets yet */}
      {(!data?.assets || data.assets.length === 0) && (
        <div style={{
          marginBottom:20, padding:'24px 28px',
          background:'linear-gradient(135deg,rgba(200,146,10,0.05),rgba(22,163,74,0.03))',
          border:'1px dashed rgba(200,146,10,0.3)', borderRadius:14,
          textAlign:'center',
        }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'#1a1d2e', marginBottom:8 }}>
            Import your existing portfolio
          </div>
          <div style={{ fontSize:13, color:'#8892b0', marginBottom:20, maxWidth:440, margin:'0 auto 20px' }}>
            Connect holdings from Zerodha, Groww, MF Central, CAMS, EPFO, your bank and more — in one click.
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap', marginBottom:20 }}>
            {['🟡 Zerodha','🟢 Groww','🔵 MF Central','🟣 Kuvera','🏛️ NSDL/CDSL','🏦 Banks'].map(b => (
              <div key={b} style={{ padding:'5px 12px', background:'#ffffff', border:'1px solid #e8eaf0', borderRadius:20, fontSize:12, color:'#4a4f6a' }}>
                {b}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:12 }}>
            <button className="btn btn-gold" onClick={() => setImportModal(true)}>📥 Import Holdings</button>
            <button className="btn btn-outline" onClick={() => setModal({ collection:'assets', item:null })}>+ Add Manually</button>
          </div>
        </div>
      )}

      {/* Quick-import chips per category */}
      {data?.assets?.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          <span style={{ fontSize:12, color:'#8892b0', alignSelf:'center', marginRight:4 }}>Quick import:</span>
          {[
            { label:'🟡 Zerodha',      broker:'zerodha' },
            { label:'🟢 Groww',        broker:'groww' },
            { label:'🔴 ICICI Direct', broker:'icicidirect' },
            { label:'🟠 INDMoney',     broker:'indmoney' },
            { label:'🔵 MF Central',   broker:'mfcentral' },
            { label:'🟣 Kuvera',       broker:'kuvera' },
            { label:'🏛️ NSDL/CDSL',    broker:'nsdl' },
            { label:'🏦 Bank',         broker:'bank' },
          ].map(q => (
            <button key={q.broker}
              onClick={() => setImportModal(true)}
              style={{
                background:'#ffffff', border:'1px solid #e8eaf0', borderRadius:20,
                padding:'4px 12px', fontSize:12, color:'#4a4f6a', cursor:'pointer',
                transition:'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#c8953a'; e.currentTarget.style.color='#e2e4ec' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#1a1f2e'; e.currentTarget.style.color='#a0aac0' }}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Asset groups — ordered: Fixed Instruments → Gold → Mutual Funds → Stocks → Others */}
      {(() => {
        const CAT_ORDER = [
          // Fixed Instruments first
          'PPF / EPF', 'SSA (Sukanya Samriddhi)', 'NPS', 'Fixed Deposits',
          'Bonds & Debentures', 'Cash & Equivalents',
          // Then Gold
          'Gold & Precious Metals',
          // Then Mutual Funds
          'Mutual Funds',
          // Then Equities
          'Stocks & Equities',
          // Then everything else
          'Real Estate', 'Cryptocurrency', 'Business Assets', 'Vehicles', 'Others',
        ]
        return Object.entries(groups).sort(([a], [b]) => {
          const ai = CAT_ORDER.indexOf(a), bi = CAT_ORDER.indexOf(b)
          if (ai === -1 && bi === -1) return a.localeCompare(b)
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        })
      })().map(([cat, items]) => {
        const catTotal = items.reduce((s, x) => s + x.value, 0)
        return (
          <div key={cat} className="card" style={{ marginBottom:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #eef0f8', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8f9fc', flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span className="tag tag-asset">{cat}</span>
                <span style={{ fontSize:12, color:'#8892b0' }}>{items.length} holding{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                {items.some(r => r._investedValue > 0) && (() => {
                  const catInvested = items.reduce((s,r) => s + (r._investedValue||0), 0)
                  const catPL       = catTotal - catInvested
                  const catPLPct    = catInvested > 0 ? (catPL / catInvested) * 100 : null
                  const plCol       = catPLPct >= 0 ? '#16a34a' : '#dc2626'
                  return (
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, color:'#8892b0', fontFamily:"'JetBrains Mono',monospace" }}>inv: {fmt(catInvested)}</span>
                      {catPLPct !== null && (
                        <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:plCol,
                          background: catPLPct >= 0 ? 'rgba(22,163,74,0.09)' : 'rgba(220,38,38,0.08)',
                          padding:'2px 9px', borderRadius:10 }}>
                          {catPLPct >= 0 ? '+' : ''}{catPLPct.toFixed(1)}%
                        </span>
                      )}
                    </span>
                  )
                })()}
                <span style={{ fontSize:12, color:'#8892b0' }}>{totalAssets > 0 ? ((catTotal/totalAssets)*100).toFixed(1) : 0}% of portfolio</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, color:'#c8920a', fontWeight:600 }}>{fmt(catTotal)}</span>
              </div>
            </div>
            <DataTable currency={cur}
              cols={[
                { key:'name',  label:'Name' },
                // Fixed instruments → "Fixed Instrument" badge
                // Mutual Funds → "Category" (shows MF sub-category like Large Cap, Hybrid etc.)
                // Equities/others → "Sector"
                ...((['PPF / EPF','SSA (Sukanya Samriddhi)','Fixed Deposits','Bonds & Debentures','Cash & Equivalents','Real Estate','Vehicles','Business Assets'].includes(cat))
                  ? [{ key:'category', label:'Category', render: () => (
                      <span style={{ fontSize:11, fontWeight:600, color:'#059669',
                        background:'rgba(5,150,105,0.08)', padding:'2px 10px', borderRadius:20 }}>
                        Fixed Instrument
                      </span>
                    )}]
                  : cat === 'Mutual Funds'
                  ? [{ key:'note', label:'Category', color:() => '#7c3aed' }]
                  : [{ key:'note', label:'Sector',   color:() => '#6b7494' }]),
                { key:'institution', label:'Source',
                  render: r => (
                    <span style={{ color:'#8892b0', fontSize:12 }}>
                      {r.institution || '—'}
                    </span>
                  )},
                ...(items.some(r => r._qty > 0) ? [{
                  key:'_qty', label: items.some(r => r._isMF) && items.some(r => !r._isMF) ? 'Qty/Units' : items.some(r => r._isMF) ? 'Units' : 'Qty',
                  right:true,
                  render: r => r._qty > 0
                    ? <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#4a4f6a' }}>{Number(r._qty).toLocaleString()}</span>
                    : <span style={{ color:'#d0d4e0' }}>—</span>
                }] : []),
                ...(items.some(r => r._investedValue > 0) ? [{
                  key:'_investedValue', label:'Invested', right:true,
                  render: (r,c) => r._investedValue > 0
                    ? <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#8892b0' }}>{formatCurrency(r._investedValue, c)}</span>
                    : <span style={{ color:'#d0d4e0' }}>—</span>
                }] : []),
                { key:'value', label:'Present Value', right:true, mono:true,
                  render:(r,c) => <span style={{ color:'#c8920a', fontWeight:500 }}>{formatCurrency(r.value, c)}</span> },
                ...(items.some(r => r._plPct !== undefined && r._plPct !== null) ? [{
                  key:'_plPct', label:'P&L %', right:true,
                  render: r => {
                    const pct = r._plPct
                    if (pct === undefined || pct === null) return <span style={{ color:'#d0d4e0' }}>—</span>
                    const col    = pct >= 0 ? '#16a34a' : '#dc2626'
                    const prefix = pct >= 0 ? '+' : ''
                    const plAbs  = (r._investedValue > 0) ? (r.value - r._investedValue) : null
                    return (
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:600,
                          color:col, background: pct >= 0 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)',
                          padding:'2px 8px', borderRadius:10, display:'inline-block' }}>
                          {prefix}{Number(pct).toFixed(2)}%
                        </div>
                        {plAbs !== null && (
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:col, marginTop:2, opacity:0.75 }}>
                            {prefix}{formatCurrency(Math.abs(plAbs), 'INR')}
                          </div>
                        )}
                      </div>
                    )
                  }
                }] : []),
                { key:'alloc', label:'Allocation', right:true,
                  render: r => (
                    <div style={{ minWidth:72 }}>
                      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:3 }}>
                        <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:'#8892b0' }}>
                          {totalAssets > 0 ? ((r.value/totalAssets)*100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <ProgressBar pct={totalAssets > 0 ? (r.value/totalAssets)*100 : 0} color="#c8953a" height={3} />
                    </div>
                  )},
              ]}
              rows={items}
              onEdit={item => setModal({ collection:'assets', item })}
              onDelete={id => deleteItem('assets', id)}
            />
          </div>
        )
      })}

      {/* Modals */}
      {modal && <EntryModal collection={modal.collection} item={modal.item} onClose={() => setModal(null)} />}
      {importModal && (
        <ImportModal
          onClose={() => setImportModal(false)}
          onImported={(total, added, updated) => {
            setImportModal(false)
            setImportToast({ total, added, updated })
            setTimeout(() => setImportToast(null), 4000)
          }}
        />
      )}
      {importToast && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:9999,
          background:'#ffffff', border:'1px solid #16a34a',
          borderRadius:10, padding:'14px 20px', fontSize:13, color:'#1a1d2e',
          display:'flex', alignItems:'center', gap:10,
          boxShadow:'0 20px 40px rgba(0,0,0,0.5)',
          animation:'notifSlide 0.3s ease',
        }}>
          <span style={{ color:'#16a34a', fontSize:18 }}>✓</span>
          {importToast?.updated > 0 && importToast?.added === 0
            ? <>Updated <strong style={{ color:'#2563eb' }}>{importToast.updated} holdings</strong> with latest prices</>
            : importToast?.updated > 0
            ? <><strong style={{ color:'#16a34a' }}>{importToast.added} added</strong>, <strong style={{ color:'#2563eb' }}>{importToast.updated} updated</strong></>
            : <>Imported <strong style={{ color:'#16a34a' }}>{importToast?.added || importToast?.total} new holdings</strong></>
          }
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIABILITIES
// ═══════════════════════════════════════════════════════════════════════════════
export function Liabilities() {
  const { data, settings, deleteItem } = useFinance()
  const { totalLiabilities } = useTotals()
  const [modal, setModal] = useState(null)
  const cur = settings.currency
  const fmt  = v => formatCurrency(v, cur)
  const groups = groupBy(data?.liabilities || [], 'category')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="section-heading">Liabilities</h2>
          <p style={{ color: '#8892b0', fontSize: 13, marginTop: 4 }}>
            Total: <span style={{ color: '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(totalLiabilities)}</span>
          </p>
        </div>
        <button className="btn btn-gold" onClick={() => setModal({ collection: 'liabilities', item: null })}>+ Add Liability</button>
      </div>

      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat} className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef0f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fc' }}>
            <span className="tag tag-liability">{cat}</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, color: '#dc2626' }}>
              {fmt(items.reduce((s, x) => s + x.value, 0))}
            </span>
          </div>
          <DataTable currency={cur}
            cols={[
              { key: 'name',        label: 'Name' },
              { key: 'institution', label: 'Lender', color: () => '#6b7494' },
              { key: 'rate',        label: 'Rate', right: true,
                render: r => r.rate
                  ? <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#dc2626', fontSize: 12 }}>{r.rate}% p.a.</span>
                  : <span style={{ color: '#b0b8d0' }}>—</span> },
              { key: 'value', label: 'Outstanding', right: true, mono: true,
                render: (r, c) => <span style={{ color: '#dc2626' }}>{formatCurrency(r.value, c)}</span> },
              { key: 'note', label: 'Note', color: () => '#6b7494' },
            ]}
            rows={items}
            onEdit={item => setModal({ collection: 'liabilities', item })}
            onDelete={id => deleteItem('liabilities', id)}
          />
        </div>
      ))}

      {modal && <EntryModal collection={modal.collection} item={modal.item} onClose={() => setModal(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASH FLOW
// ═══════════════════════════════════════════════════════════════════════════════
export function CashFlow() {
  const { data, settings, deleteItem } = useFinance()
  const { totalIncome, totalExpenses, cashFlow, savingsRate } = useTotals()
  const [modal, setModal] = useState(null)
  const cur = settings.currency
  const fmt  = v => formatCurrency(v, cur)
  const fmts = v => formatCompact(v, cur)

  const expenseGroups = groupBy(data?.expenses || [], 'category')
  const expensePie    = Object.entries(expenseGroups).map(([k, v], i) => ({
    name: k, value: v.reduce((s, x) => s + x.monthly, 0), color: PALETTE[i % PALETTE.length],
  }))

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        <StatCard label="Monthly Income"   value={fmt(totalIncome)}    sub={`${data?.income.length} streams`}     color="#3ecf8e" icon="↑" delay={0}   />
        <StatCard label="Monthly Expenses" value={fmt(totalExpenses)}  sub={`${data?.expenses.length} categories`} color="#f06a6a" icon="↓" delay={60}  />
        <StatCard label="Net Cash Flow"    value={fmt(cashFlow)}       sub="Income minus expenses"                color={cashFlow >= 0 ? '#3ecf8e' : '#f06a6a'} delay={120} />
        <StatCard label="Annual Savings"   value={fmts(cashFlow * 12)} sub={`${savingsRate?.toFixed(1)}% savings rate`} color="#5b8ff9" delay={180} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 20 }}>Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={expensePie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                {expensePie.map((e, i) => <Cell key={i} fill={e.color} opacity={0.85} />)}
              </Pie>
              <Tooltip content={<ChartTooltip currency={cur} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8892b0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 20 }}>Flow Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            {[
              { label: 'Income',   value: totalIncome,   pct: 100,                                    color: '#16a34a' },
              { label: 'Expenses', value: totalExpenses, pct: totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0, color: '#dc2626' },
              { label: 'Savings',  value: cashFlow,      pct: Math.max(savingsRate, 0),               color: '#2563eb' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#4a4f6a' }}>{row.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: row.color, fontSize: 14 }}>{fmt(row.value)}</span>
                </div>
                <ProgressBar pct={row.pct} color={row.color} height={8} />
              </div>
            ))}
            <div style={{ paddingTop: 8, borderTop: '1px solid #eef0f8', fontSize: 12, color: '#8892b0' }}>
              Savings Rate: <span style={{ color: savingsRate >= 20 ? '#3ecf8e' : '#f09b46', fontFamily: "'JetBrains Mono',monospace" }}>{savingsRate?.toFixed(1)}%</span>
              <span style={{ marginLeft: 8, color: '#b0b8d0' }}>(benchmark ≥ 20%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Income Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef0f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fc' }}>
          <span className="tag tag-income">Income Streams</span>
          <button className="btn btn-gold btn-sm" onClick={() => setModal({ collection: 'income', item: null })}>+ Add</button>
        </div>
        <DataTable currency={cur}
          cols={[
            { key: 'name',     label: 'Source' },
            { key: 'category', label: 'Category', color: () => '#6b7494' },
            { key: 'monthly',  label: 'Monthly', right: true,
              render: (r, c) => <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#16a34a' }}>{formatCurrency(r.monthly, c)}</span> },
            { key: 'annual', label: 'Annual', right: true,
              render: (r, c) => <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#8892b0' }}>{formatCurrency(r.monthly * 12, c)}</span> },
            { key: 'note', label: 'Note', color: () => '#6b7494' },
          ]}
          rows={data?.income || []}
          onEdit={item => setModal({ collection: 'income', item })}
          onDelete={id  => deleteItem('income', id)}
        />
        <div style={{ padding: '12px 16px', borderTop: '1px solid #eef0f8', textAlign: 'right', fontSize: 13 }}>
          <span style={{ color: '#8892b0' }}>Total: </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#16a34a', marginLeft: 8 }}>{fmt(totalIncome)}/mo</span>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef0f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fc' }}>
          <span className="tag tag-expense">Expense Categories</span>
          <button className="btn btn-gold btn-sm" onClick={() => setModal({ collection: 'expenses', item: null })}>+ Add</button>
        </div>
        <DataTable currency={cur}
          cols={[
            { key: 'name',     label: 'Expense' },
            { key: 'category', label: 'Category', color: () => '#6b7494' },
            { key: 'monthly',  label: 'Monthly', right: true,
              render: (r, c) => <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#d97706' }}>-{formatCurrency(r.monthly, c)}</span> },
            { key: 'annual', label: 'Annual', right: true,
              render: (r, c) => <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#8892b0' }}>-{formatCurrency(r.monthly * 12, c)}</span> },
            { key: 'pct', label: '% of Income', right: true,
              render: r => <span style={{ fontSize: 11, color: '#8892b0' }}>{totalIncome > 0 ? ((r.monthly / totalIncome) * 100).toFixed(1) : 0}%</span> },
            { key: 'note', label: 'Note', color: () => '#6b7494' },
          ]}
          rows={data?.expenses || []}
          onEdit={item => setModal({ collection: 'expenses', item })}
          onDelete={id  => deleteItem('expenses', id)}
        />
        <div style={{ padding: '12px 16px', borderTop: '1px solid #eef0f8', textAlign: 'right', fontSize: 13 }}>
          <span style={{ color: '#8892b0' }}>Total: </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#dc2626', marginLeft: 8 }}>-{fmt(totalExpenses)}/mo</span>
        </div>
      </div>

      {modal && <EntryModal collection={modal.collection} item={modal.item} onClose={() => setModal(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
export function Analytics() {
  const { data, settings } = useFinance()
  const totals = useTotals()
  const cur = settings.currency
  const fmts = v => formatCompact(v, cur)
  const fmt  = v => formatCurrency(v, cur)
  const [activeSector, setActiveSector] = useState(null)   // drill-down: selected sector name
  const [activeMcap,   setActiveMcap]   = useState(null)   // drill-down: selected market cap

  const { totalAssets, fiPct, fiNumber, monthlyInterest, avgNW, maxNW, savingsRate, debtRatio, emergencyMonths } = totals

  const assetPie = Object.entries(groupBy(data?.assets || [], 'category'))
    .map(([k, v]) => { const col = CAT_COLORS[k] || PALETTE[Object.keys(groupBy(data?.assets||[],'category')).indexOf(k) % PALETTE.length]; return { name: k, value: v.reduce((s, x) => s + x.value, 0), color: col, fill: col } })
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)

  const healthMetrics = [
    { label: 'Savings Rate',     value: `${savingsRate?.toFixed(1)}%`,     pct: Math.min(savingsRate, 100),  color: '#16a34a', good: savingsRate >= 20,    bench: '≥ 20%' },
    { label: 'Debt-to-Asset',    value: `${debtRatio?.toFixed(1)}%`,       pct: 100 - debtRatio,             color: '#dc2626', good: debtRatio < 50,       bench: '< 50%' },
    { label: 'FI Progress',      value: `${fiPct?.toFixed(1)}%`,           pct: fiPct,                       color: '#2563eb', good: fiPct >= 100,          bench: '100% = FI' },
    { label: 'Emergency Fund',   value: `${emergencyMonths?.toFixed(1)}mo`, pct: Math.min(emergencyMonths / 6 * 100, 100), color: '#b8820e', good: emergencyMonths >= 6, bench: '≥ 6 months' },
  ]

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        <StatCard label="12M Avg Net Worth"   value={fmts(avgNW)}          color="#e8c060" delay={0}   />
        <StatCard label="Peak Net Worth"      value={fmts(maxNW)}          color="#3ecf8e" delay={60}  />
        <StatCard label="Monthly Interest"    value={fmt(monthlyInterest)} sub="Total debt cost" color="#f06a6a" delay={120} />
        <StatCard label="FI Progress"         value={`${fiPct?.toFixed(1)}%`} sub={`Target: ${fmts(fiNumber)}`} color="#5b8ff9" delay={180} />
      </div>

      {/* Assets vs Liabilities trend */}
      <div className="card" style={{ padding: 24 }}>
        <h3 className="section-heading" style={{ marginBottom: 20 }}>Assets vs Liabilities (12M)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data?.history || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f8" />
            <XAxis dataKey="month" tick={{ fill: '#9098b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9098b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmts(v)} />
            <Tooltip content={<ChartTooltip currency={cur} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
            <Line type="monotone" dataKey="assets"      stroke="#3ecf8e" strokeWidth={2}   dot={false} name="Assets" />
            <Line type="monotone" dataKey="liabilities" stroke="#f06a6a" strokeWidth={2}   dot={false} name="Liabilities" />
            <Line type="monotone" dataKey="netWorth"    stroke="#c8953a" strokeWidth={2.5} dot={false} name="Net Worth" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Radial wealth */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 20 }}>Wealth Composition</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="25%" outerRadius="85%"
              data={assetPie}>
              <RadialBar dataKey="value" cornerRadius={4} />
              <Tooltip content={<ChartTooltip currency={cur} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8892b0' }} iconSize={8} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Health metrics */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 20 }}>Financial Health</h3>
          <div style={{ display: 'grid', gap: 18 }}>
            {healthMetrics.map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.good ? '#3ecf8e' : '#f06a6a', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#4a4f6a' }}>{m.label}</span>
                    <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: m.good ? '#3ecf8e' : '#f06a6a' }}>{m.value}</span>
                  </div>
                  <ProgressBar pct={m.pct} color={m.color} height={4} />
                  <span style={{ fontSize: 10, color: '#b0b8d0', marginTop: 2, display: 'block' }}>Benchmark: {m.bench}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top holdings + High interest debt */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Holdings P&L breakdown — only if imported data has P&L */}
        {(data?.assets||[]).some(a => a._plPct !== null && a._plPct !== undefined) && (() => {
          const richAssets = [...(data?.assets||[])].filter(a => a._plPct !== null && a._plPct !== undefined)
          const topGainers = [...richAssets].sort((a,b) => (b._plPct||0) - (a._plPct||0)).slice(0, 5)
          const topLosers  = [...richAssets].sort((a,b) => (a._plPct||0) - (b._plPct||0)).slice(0, 5)
          return (
            <div className="card" style={{ padding:24, gridColumn:'1 / -1' }}>
              <h3 className="section-heading" style={{ marginBottom:20 }}>Holdings P&L Breakdown</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                <div>
                  <div style={{ fontSize:12, color:'#16a34a', fontWeight:600, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ background:'rgba(22,163,74,0.1)', borderRadius:6, padding:'2px 8px' }}>▲ Top Gainers</span>
                  </div>
                  {topGainers.map((a,i) => (
                    <div key={a.id} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:12, color:'#1a1d2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{a.name}</span>
                        <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:'#16a34a', flexShrink:0 }}>
                          +{Number(a._plPct).toFixed(2)}%
                        </span>
                      </div>
                      <ProgressBar pct={Math.min(a._plPct, 200) / 2} color="#16a34a" height={4} />
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:12, color:'#dc2626', fontWeight:600, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ background:'rgba(220,38,38,0.08)', borderRadius:6, padding:'2px 8px' }}>▼ Biggest Losers</span>
                  </div>
                  {topLosers.map((a,i) => (
                    <div key={a.id} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:12, color:'#1a1d2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{a.name}</span>
                        <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:'#dc2626', flexShrink:0 }}>
                          {Number(a._plPct).toFixed(2)}%
                        </span>
                      </div>
                      <ProgressBar pct={Math.min(Math.abs(a._plPct), 100)} color="#dc2626" height={4} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Broker-wise Investment Summary ──────────────────────────── */}
        {(data?.assets||[]).some(a => a.institution && a._investedValue > 0) && (() => {
          // Fixed instrument categories — exclude from broker P&L chart (no meaningful P&L data)
          const FIXED_CATS = new Set(['PPF / EPF','SSA (Sukanya Samriddhi)','Fixed Deposits','Bonds & Debentures','Cash & Equivalents','Real Estate','Vehicles','Business Assets','Others'])
          // Group assets by broker/institution (equity + MF only)
          const brokerMap = {}
          ;(data?.assets||[])
            .filter(a => !FIXED_CATS.has(a.category))
            .forEach(a => {
            const key = a.institution || 'Manual'
            if (!brokerMap[key]) brokerMap[key] = { name:key, assets:[], invested:0, present:0 }
            brokerMap[key].assets.push(a)
            brokerMap[key].invested += (a._investedValue || 0)
            brokerMap[key].present  += (a.value || 0)
          })
          const brokers = Object.values(brokerMap)
            .map(b => ({ ...b, pl: b.present - b.invested, plPct: b.invested > 0 ? (b.present - b.invested) / b.invested * 100 : 0 }))
            .sort((a, b) => b.present - a.present)

          const totalInvested = brokers.reduce((s, b) => s + b.invested, 0)
          const totalPresent  = brokers.reduce((s, b) => s + b.present, 0)
          const totalPL       = totalPresent - totalInvested
          const totalPLPct    = totalInvested > 0 ? totalPL / totalInvested * 100 : 0

          const BROKER_COLORS = {
            'Zerodha':'#c8920a','ICICI Direct':'#dc2626','Groww':'#16a34a',
            'INDMoney':'#d97706','MF Central':'#2563eb','Kuvera':'#7c3aed',
            'NSDL/CDSL':'#0891b2','EPFO':'#059669','Manual':'#8892b0',
          }

          return (
            <div className="card" style={{ padding:24, gridColumn:'1 / -1' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
                <h3 className="section-heading">Broker-wise Summary</h3>
                {/* Portfolio totals */}
                <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                  {[
                    { label:'Total Invested', value:fmt(totalInvested), color:'#8892b0' },
                    { label:'Present Value',  value:fmt(totalPresent),  color:'#c8920a' },
                    { label:'Total P&L',      value:(totalPL>=0?'+':'')+fmt(totalPL), color:totalPL>=0?'#16a34a':'#dc2626' },
                    { label:'Overall Return', value:(totalPLPct>=0?'+':'')+totalPLPct.toFixed(2)+'%', color:totalPLPct>=0?'#16a34a':'#dc2626' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#8892b0', marginBottom:2 }}>{s.label}</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Broker cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14, marginBottom:24 }}>
                {brokers.map(b => {
                  const color   = BROKER_COLORS[b.name] || '#8892b0'
                  const plColor = b.plPct >= 0 ? '#16a34a' : '#dc2626'
                  const allocPct = totalPresent > 0 ? (b.present / totalPresent * 100) : 0
                  const stocks  = b.assets.filter(a => !a._isMF).length
                  const mfs     = b.assets.filter(a => a._isMF).length
                  return (
                    <div key={b.name} style={{ background:'#f8f9fc', border:'1px solid #eef0f8', borderRadius:12, padding:'16px 18px', borderLeft:`3px solid ${color}` }}>
                      {/* Header */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e' }}>{b.name}</div>
                          <div style={{ fontSize:11, color:'#8892b0', marginTop:2 }}>
                            {b.assets.length} holdings
                            {stocks > 0 && <span style={{ marginLeft:6 }}>· {stocks} stocks</span>}
                            {mfs   > 0 && <span style={{ marginLeft:6 }}>· {mfs} MFs</span>}
                          </div>
                        </div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:600,
                          color:plColor, background: b.plPct>=0?'rgba(22,163,74,0.08)':'rgba(220,38,38,0.08)',
                          padding:'3px 10px', borderRadius:20 }}>
                          {b.plPct>=0?'+':''}{b.plPct.toFixed(2)}%
                        </div>
                      </div>

                      {/* Invested vs Present */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                        <div style={{ background:'#fff', borderRadius:8, padding:'8px 10px', border:'1px solid #eef0f8' }}>
                          <div style={{ fontSize:10, color:'#8892b0', marginBottom:3 }}>INVESTED</div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#4a4f6a', fontWeight:500 }}>{fmt(b.invested)}</div>
                        </div>
                        <div style={{ background:'#fff', borderRadius:8, padding:'8px 10px', border:'1px solid #eef0f8' }}>
                          <div style={{ fontSize:10, color:'#8892b0', marginBottom:3 }}>PRESENT</div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#c8920a', fontWeight:500 }}>{fmt(b.present)}</div>
                        </div>
                      </div>

                      {/* P&L amount + allocation bar */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <span style={{ fontSize:11, color:plColor, fontFamily:"'JetBrains Mono',monospace" }}>
                          P&L: {b.pl>=0?'+':''}{fmt(b.pl)}
                        </span>
                        <span style={{ fontSize:11, color:'#8892b0' }}>{allocPct.toFixed(1)}% of portfolio</span>
                      </div>
                      {/* Allocation progress bar */}
                      <div style={{ height:4, background:'#eef0f8', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${allocPct}%`, background:color, borderRadius:2, transition:'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Comparison bar chart — Invested vs Present per broker */}
              <div>
                <div style={{ fontSize:12, color:'#8892b0', marginBottom:12, fontWeight:500 }}>Invested vs Present Value by Broker</div>
                {brokers.filter(b => b.invested > 0).map(b => {
                  const color   = BROKER_COLORS[b.name] || '#8892b0'
                  const maxVal  = Math.max(...brokers.map(x => x.present))
                  const invPct  = maxVal > 0 ? (b.invested / maxVal * 100) : 0
                  const prePct  = maxVal > 0 ? (b.present  / maxVal * 100) : 0
                  const plColor = b.plPct >= 0 ? '#16a34a' : '#dc2626'
                  return (
                    <div key={b.name} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, color:'#1a1d2e', fontWeight:500 }}>{b.name}</span>
                        <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:plColor, fontWeight:600 }}>
                          {b.plPct>=0?'+':''}{b.plPct.toFixed(2)}%  ({b.pl>=0?'+':''}{fmt(b.pl)})
                        </span>
                      </div>
                      {/* Invested bar (grey) */}
                      <div style={{ position:'relative', height:6, background:'#f0f1f8', borderRadius:3, marginBottom:3, overflow:'hidden' }}>
                        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${invPct}%`, background:'#d0d3e0', borderRadius:3 }} />
                        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${prePct}%`, background:color, borderRadius:3, opacity:0.8 }} />
                      </div>
                      <div style={{ display:'flex', gap:16, fontSize:10, color:'#9098b8' }}>
                        <span>Inv: {fmt(b.invested)}</span>
                        <span style={{ color:'#c8920a' }}>Now: {fmt(b.present)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 4 }}>Asset Category Breakdown</h3>
          <p style={{ fontSize: 12, color: '#8892b0', marginBottom: 16 }}>
            Portfolio grouped by asset class — NPS treated as Equity Hybrid, PPF/EPF/SSA as Fixed Instruments
          </p>
          {(() => {
            // Map each WealthRadar category → display group
            // Use unified 5-class system (same as Allocation tab and Dashboard)
            const groups = {}
            ;(data?.assets || []).forEach(a => {
              if (!a.value) return
              let cls = getAssetClass(a)
              // Crypto is shown separately (excluded from 5 main classes but still visible)
              if (a.category === 'Cryptocurrency') {
                cls = 'Cryptocurrency'
              }
              if (!cls) return  // excluded (Vehicles, Business Assets, Others)
              if (!groups[cls]) groups[cls] = { value:0, count:0, categories: new Set() }
              groups[cls].value += (a.value||0)
              groups[cls].count += 1
              groups[cls].categories.add(a.category)
            })
            const total = Object.values(groups).reduce((s,g) => s+g.value, 0)
            const GROUP_COLORS = {
              ...CLASS_COLORS,
              'Cryptocurrency': '#f43f5e',
            }
            const sorted = Object.entries(groups).sort((a,b) => b[1].value - a[1].value)
            return sorted.map(([grp, g], i) => {
              const pct = total > 0 ? (g.value/total*100) : 0
              const col = GROUP_COLORS[grp] || PALETTE[i % PALETTE.length]
              return (
                <div key={grp} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                  <div style={{ width:28, height:28, borderRadius:6, background:col+'22',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:col }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <div>
                        <span style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>{grp}</span>
                        <span style={{ fontSize:11, color:'#8892b0', marginLeft:6 }}>
                          ({g.count} holding{g.count>1?'s':''})
                        </span>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                        <span style={{ fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:'#b8820e' }}>
                          {fmts(g.value)}
                        </span>
                        <span style={{ fontSize:11, color:'#8892b0', marginLeft:6 }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <ProgressBar pct={pct} color={col} height={4} />
                  </div>
                </div>
              )
            })
          })()}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 16 }}>High-Interest Debts ⚠</h3>
          {[...(data?.liabilities || [])].filter(l => l.rate).sort((a, b) => (b.rate || 0) - (a.rate || 0)).map(l => (
            <div key={l.id} style={{ padding: '12px 14px', background: '#f5f6fa', borderRadius: 8, marginBottom: 10, border: `1px solid ${l.rate > 24 ? 'rgba(220,38,38,0.25)' : '#e8eaf0'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#1a1d2e' }}>{l.name}</span>
                <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: l.rate > 24 ? '#f06a6a' : '#f09b46' }}>{l.rate}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#8892b0' }}>Monthly interest: {fmt((l.value * l.rate / 100) / 12)}</span>
                <span style={{ fontSize: 11, color: '#8892b0' }}>Balance: {fmts(l.value)}</span>
              </div>
            </div>
          ))}
          {!(data?.liabilities || []).some(l => l.rate) && (
            <div style={{ color: '#b0b8d0', fontSize: 13, textAlign: 'center', padding: 20 }}>No interest-bearing debts 🎉</div>
          )}
        </div>
      </div>

      {/* ── Sector-wise Allocation + Market Cap Charts ─────────────────────── */}
      {(data?.assets||[]).some(a => (a._sector || a.note) && !a._isMF && a.category === 'Stocks & Equities') && (() => {

        // Separate equity holdings from MF holdings
        // Only true equity holdings — excludes MFs and all fixed/non-market categories
        const EQUITY_ONLY_CATS = new Set(['Stocks & Equities','Gold & Precious Metals','Cryptocurrency','NPS'])  // SSA/PPF/FD excluded
        const equityAssets = (data?.assets||[]).filter(a =>
          !a._isMF && EQUITY_ONLY_CATS.has(a.category)
        )
        const mfAssets = (data?.assets||[]).filter(a => a._isMF)

        // ── 1. Sector allocation (equity only) ─────────────────────────────
        const sectorMap = {}
        equityAssets.forEach(a => {
          const raw = (a._sector || a.note || '').trim()
          if (!raw) return
          const key = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
          if (!sectorMap[key]) sectorMap[key] = { value: 0, invested: 0, count: 0 }
          sectorMap[key].value    += (a.value || 0)
          sectorMap[key].invested += (a._investedValue || 0)
          sectorMap[key].count    += 1
        })
        const totalSectorVal = Object.values(sectorMap).reduce((s, v) => s + v.value, 0)
        const sectorData = Object.entries(sectorMap)
          .map(([name, d], i) => ({
            name, value: d.value, invested: d.invested, count: d.count,
            pct: totalSectorVal > 0 ? (d.value / totalSectorVal * 100) : 0,
            color: PALETTE[i % PALETTE.length],
          }))
          .sort((a, b) => b.value - a.value)

        // ── 2. Market cap classification ────────────────────────────────────
        // Heuristic based on company name keywords — well-known large/mid/small caps
        // ── Market Cap classification ────────────────────────────────────────
        // Source: AMFI official list — 6 months ended 31 December 2025 (latest)
        // https://www.amfiindia.com/Themes/Theme1/downloads/AverageMarketCapitalization31Dec2025.pdf
        // SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2017/114
        // Large Cap = Ranks 1-100 | Mid Cap = 101-250 | Small Cap = 251+
        // Lookup priority: ISIN → NSE symbol → company name keywords

        // ── LARGE CAP: Ranks 1-100 (AMFI Dec 2025) ───────────────────────
        const LARGE_CAP_ISINS = new Set([
          'INE002A01018', // 1   Reliance Industries
          'INE040A01034', // 2   HDFC Bank
          'INE397D01024', // 3   Bharti Airtel
          'INE467B01029', // 4   TCS
          'INE090A01021', // 5   ICICI Bank
          'INE062A01020', // 6   SBI
          'INE009A01021', // 7   Infosys
          'INE296A01032', // 8   Bajaj Finance
          'INE0J1Y01017', // 9   LIC
          'INE030A01027', // 10  Hindustan Unilever
          'INE018A01030', // 11  L&T
          'INE154A01025', // 12  ITC
          'INE585B01010', // 13  Maruti Suzuki
          'INE101A01026', // 14  M&M
          'INE860A01027', // 15  HCL Technologies
          'INE237A01028', // 16  Kotak Mahindra Bank
          'INE044A01036', // 17  Sun Pharma
          'INE238A01034', // 18  Axis Bank
          'INE481G01011', // 19  UltraTech Cement
          'INE918I01026', // 20  Bajaj Finserv
          'INE280A01028', // 21  Titan
          'INE733E01010', // 22  NTPC
          'INE066F01020', // 23  HAL
          'INE742F01042', // 24  Adani Ports
          'INE213A01029', // 25  ONGC
          'INE758T01015', // 26  Eternal (Zomato)
          'INE263A01024', // 27  Bharat Electronics (BEL)
          'INE423A01024', // 28  Adani Enterprises
          'INE192R01011', // 29  Avenue Supermarts (DMart)
          'INE019A01038', // 30  JSW Steel
          'INE814H01029', // 31  Adani Power (new ISIN Dec 2025)
          'INE814H01011', // 31  Adani Power (old ISIN)
          'INE075A01022', // 32  Wipro
          'INE752E01010', // 33  Power Grid
          'INE021A01026', // 34  Asian Paints
          'INE917I01010', // 35  Bajaj Auto
          'INE522F01014', // 36  Coal India
          'INE239A01024', // 37  Nestle India
          'INE646L01027', // 38  IndiGo
          'INE242A01010', // 39  Indian Oil Corporation
          'INE081A01020', // 40  Tata Steel
          'INE267A01025', // 41  Hindustan Zinc
          'INE758E01017', // 42  Jio Financial
          'INE0V6F01027', // 43  Hyundai Motor India
          'INE047A01021', // 44  Grasim
          'INE123W01016', // 45  SBI Life
          'INE205A01025', // 46  Vedanta
          'INE271C01023', // 47  DLF
          'INE066A01021', // 48  Eicher Motors
          'INE849A01020', // 49  Trent
          'INE038A01020', // 50  Hindalco
          'INE361B01024', // 51  Divi's Labs
          'INE795G01014', // 52  HDFC Life Insurance
          'INE214T01019', // 53  LTIMindtree
          'INE053F01010', // 54  IRFC
          'INE364U01010', // 55  Adani Green Energy
          'INE200M01039', // 56  Varun Beverages
          'INE494B01023', // 57  TVS Motor
          'INE318A01026', // 58  Pidilite
          'INE029A01011', // 59  BPCL
          'INE669C01036', // 60  Tech Mahindra
          'INE118A01012', // 61  Bajaj Holdings
          'INE216A01030', // 62  Britannia
          'INE079A01024', // 63  Ambuja Cements
          'INE976I01016', // 64  Tata Capital (new entrant Dec 2025)
          'INE155A01022', // 65  Tata Motors PV (TMPV)
          'INE028A01039', // 66  Bank of Baroda
          'INE121A01024', // 67  Cholamandalam
          'INE721A01047', // 68  Shriram Finance
          'INE721A01013', // 68  Shriram Finance (alt ISIN)
          'INE1TAE01010', // 69  Tata Motors Ltd (TMCV) - NEW ISIN Dec 2025
          'INE160A01022', // 70  Punjab National Bank
          'INE346A01027', // 71  ICICI AMC (new entrant Dec 2025)
          'INE134E01011', // 72  Power Finance Corp (PFC)
          'INE343H01029', // 73  Solar Industries
          'INE414G01012', // 74  Muthoot Finance (upgraded from Mid Cap!)
          'INE245A01021', // 75  Tata Power
          'INE059A01026', // 76  Cipla
          'INE685A01028', // 77  Torrent Pharma
          'INE102D01028', // 78  Godrej Consumer
          'INE670K01029', // 79  Lodha (Macrotech)
          'INE127D01025', // 80  HDFC AMC
          'INE129A01019', // 81  GAIL
          'INE476A01022', // 82  Canara Bank
          'INE027H01010', // 83  Max Healthcare
          'INE1NPP01017', // 84  Siemens Energy India
          'INE003A01024', // 85  Siemens
          'INE249Z01020', // 86  Mazagon Dock
          'INE323A01026', // 87  Bosch
          'INE117A01022', // 88  ABB India
          'INE775A01035', // 89  Motherson
          'INE298A01020', // 90  Cummins India
          'INE192A01025', // 91  Tata Consumer Products
          'INE067A01029', // 92  CG Power
          'INE324D01010', // 93  LG Electronics India (new entrant)
          'INE455K01017', // 94  Polycab
          'INE692A01016', // 95  Union Bank of India
          'INE931S01010', // 96  Adani Energy Solutions
          'INE437A01024', // 97  Apollo Hospitals
          'INE053A01029', // 98  Indian Hotels (Taj)
          'INE158A01026', // 99  Hero MotoCorp
          'INE089A01031', // 100 Dr. Reddy's
        ])

        // ── MID CAP: Ranks 101-250 (AMFI Dec 2025) ───────────────────────
        const MID_CAP_ISINS = new Set([
          'INE070A01015', // 101 Shree Cement
          'INE749A01030', // 102 Jindal Steel & Power
          'INE008A01015', // 103 IDBI Bank
          'INE00H001014', // 104 Swiggy
          'INE118H01025', // 105 BSE Ltd
          'INE634S01028', // 106 Mankind Pharma
          'INE562A01011', // 107 Indian Bank
          'INE121J01017', // 108 Indus Towers
          'INE854D01024', // 109 United Spirits
          'INE776C01039', // 110 GMR Airports
          'INE020B01018', // 111 REC Limited
          'INE010B01027', // 112 Zydus Lifesciences
          'INE765G01017', // 113 ICICI Lombard
          'INE0HOQ01053', // 114 Groww (Billionbrains)
          'INE935N01020', // 115 Dixon Technologies
          'INE669E01016', // 116 Vodafone Idea
          'INE176B01034', // 117 Havells
          'INE196A01026', // 118 Marico
          'INE094A01015', // 119 HPCL
          'INE377N01017', // 120 Waaree Energies
          'INE377Y01014', // 121 Bajaj Housing Finance
          'INE016A01026', // 122 Dabur
          'INE326A01037', // 123 Lupin
          'INE121E01018', // 124 JSW Energy
          'INE726G01019', // 125 ICICI Prudential Life
          'INE262H01021', // 126 Persistent Systems
          'INE343G01021', // 127 Bharti Hexacom
          'INE663F01032', // 128 Info Edge (Naukri)
          'INE663F01024', // 128 Info Edge (alt ISIN)
          'INE647A01010', // 129 SRF
          'INE257A01026', // 130 BHEL
          'INE07Y701011', // 131 Hitachi Energy India
          'INE0VDM01015', // 132 Meesho (new entrant)
          'INE0ONG01011', // 133 NTPC Green Energy
          'INE848E01016', // 134 NHPC
          'INE417T01026', // 135 PB Fintech (PolicyBazaar)
          'INE018E01016', // 136 SBI Cards
          'INE208A01029', // 137 Ashok Leyland
          'INE040H01021', // 138 Suzlon Energy
          'INE674K01013', // 139 Aditya Birla Capital
          'INE982J01020', // 140 Paytm
          'INE565A01014', // 141 Indian Overseas Bank
          'INE881D01027', // 142 Oracle Financial (OFSS)
          'INE956O01016', // 143 Lenskart (new entrant)
          'INE200A01026', // 144 GE Vernova T&D
          'INE415G01027', // 145 RVNL
          'INE811K01011', // 146 Prestige Estates
          'INE281B01032', // 147 Lloyds Metals
          'INE405E01023', // 148 UNO Minda
          'INE061F01013', // 149 Fortis Healthcare
          'INE388Y01029', // 150 Nykaa
          'INE274J01014', // 151 Oil India
          'INE399L01023', // 152 Adani Total Gas
          'INE169A01031', // 153 Coromandel International
          'INE481Y01014', // 154 GIC Re
          'INE528G01035', // 155 Yes Bank
          'INE01EA01019', // 156 Vishal Mega Mart
          'INE358A01014', // 157 Abbott India
          'INE813H01021', // 158 Torrent Power
          'INE406A01037', // 159 Aurobindo Pharma
          'INE584A01023', // 160 NMDC
          'INE540L01014', // 161 Alkem Labs
          'INE463A01038', // 162 Berger Paints
          'INE883A01011', // 163 MRF
          'INE619A01035', // 164 Patanjali Foods
          'INE484J01027', // 165 Godrej Properties
          'INE756I01012', // 166 HDB Financial Services (NEW in Dec 2025!)
          'INE498L01015', // 167 L&T Finance
          'INE880J01026', // 168 JSW Infrastructure
          'INE513A01022', // 169 Schaeffler India
          'INE095A01012', // 170 IndusInd Bank
          'INE220G01021', // 171 Jindal Stainless
          'INE949L01017', // 172 AU Small Finance Bank
          'INE259A01022', // 173 Colgate
          'INE093I01010', // 174 Oberoi Realty
          'INE465A01025', // 175 Bharat Forge
          'INE188A01015', // 176 FACT
          'INE591G01025', // 177 Coforge
          'INE591G01017', // 177 Coforge (alt ISIN)
          'INE628A01036', // 178 UPL
          'INE211B01039', // 179 Phoenix Mills
          'INE084A01016', // 180 Bank of India
          'INE974X01010', // 181 Tube Investments
          'INE335Y01020', // 182 IRCTC
          'INE171Z01026', // 183 Bharat Dynamics
          'INE092T01019', // 184 IDFC First Bank
          'INE603J01030', // 185 PI Industries
          'INE338I01027', // 186 Motilal Oswal
          'INE935A01035', // 187 Glenmark Pharma
          'INE180A01020', // 188 Max Financial Services
          'INE114A01011', // 189 SAIL
          'INE171A01029', // 190 Federal Bank
          'INE298J01013', // 191 Nippon Life India AMC
          'INE356A01018', // 192 Mphasis
          'INE303R01014', // 193 Kalyan Jewellers
          'INE473A01011', // 194 Linde India
          'INE660A01013', // 195 Sundaram Finance
          'INE195A01028', // 196 Supreme Industries
          'INE376G01013', // 197 Biocon
          'INE151A01013', // 198 Tata Communications
          'INE947Q01028', // 199 Laurus Labs
          'INE206F01022', // 200 Authum Investment
          'INE260B01028', // 201 Godfrey Phillips
          'INE823G01014', // 202 JK Cement
          'INE686F01025', // 203 United Breweries
          'INE702C01027', // 204 APL Apollo
          'INE761H01022', // 205 Page Industries
          'INE159A01016', // 206 GSK Pharma
          'INE787D01026', // 207 Balkrishna Industries
          'INE379A01028', // 208 ITC Hotels (Mid Cap in Dec 2025)
          'INE704P01025', // 209 Cochin Shipyard
          'INE0BS701011', // 210 Premier Energies
          'INE093A01041', // 211 Hexaware Technologies
          'INE010V01017', // 212 L&T Technology Services (LTTS)
          'INE226A01021', // 213 Voltas
          'INE745G01035', // 214 MCX
          'INE031A01017', // 215 HUDCO
          'INE466L01038', // 216 360 ONE
          'INE457A01014', // 217 Bank of Maharashtra
          'INE179A01014', // 218 P&G Hygiene
          'INE347G01014', // 219 Petronet LNG
          'INE202E01016', // 220 IREDA
          'INE0CZ201020', // 221 Anthem Biosciences
          'INE111A01025', // 222 CONCOR
          'INE774D01024', // 223 M&M Financial
          'INE139A01034', // 224 National Aluminium
          'INE00R701025', // 225 Dalmia Bharat
          'INE797F01020', // 226 Jubilant Foodworks
          'INE918Z01012', // 227 Kaynes Technology
          'INE042A01014', // 228 Escorts Kubota
          'INE944F01028', // 229 Radico Khaitan
          'INE09N301011', // 230 Gujarat Fluorochemicals
          'INE913H01037', // 231 Endurance Technologies
          'INE878B01027', // 232 KEI Industries
          'INE006I01046', // 233 Astral
          'INE152A01029', // 234 Thermax
          'INE0LP301011', // 235 PhysicsWallah
          'INE691A01018', // 236 UCO Bank
          'INE472A01039', // 237 Blue Star
          'INE410P01011', // 238 Narayana Hrudayalaya
          'INE672A01026', // 239 Tata Investment Corp
          'INE233A01035', // 240 Godrej Industries
          'INE511C01022', // 241 Poonawalla Fincorp
          'INE007A01025', // 242 CRISIL
          'INE930H01031', // 243 KPR Mill
          'INE149A01033', // 244 Cholamandalam Financial Holdings
          'INE470A01017', // 245 3M India
          'INE571A01038', // 246 IPCA Labs
          'INE202B01038', // 247 Piramal Finance
          'INE372A01015', // 248 Apar Industries
          'INE002L01015', // 249 SJVN
          'INE474Q01031', // 250 Global Health (Medanta)
        ])

        // ── NSE symbol fallback (for imports without stored ISIN) ─────────
        const LARGE_CAP_SYMS = new Set([
          'RELIANCE','HDFCBANK','BHARTIARTL','TCS','ICICIBANK','SBIN','INFY',
          'BAJFINANCE','LICI','HINDUNILVR','LT','ITC','MARUTI','MM','HCLTECH',
          'KOTAKBANK','SUNPHARMA','AXISBANK','ULTRACEMCO','BAJAJFINSV','TITAN',
          'NTPC','HAL','ADANIPORTS','ONGC','ETERNAL','ZOMATO','BEL','ADANIENT',
          'DMART','JSWSTEEL','ADANIPOWER','WIPRO','POWERGRID','ASIANPAINT',
          'BAJAJ-AUTO','COALINDIA','NESTLEIND','INDIGO','IOC','TATASTEEL',
          'HINDZINC','JIOFIN','HYUNDAI','GRASIM','SBILIFE','VEDL','DLF',
          'EICHERMOT','TRENT','HINDALCO','DIVISLAB','HDFCLIFE','LTIM','IRFC',
          'ADANIGREEN','VBL','TVSMOTOR','PIDILITIND','BPCL','TECHM','BAJAJHLDNG',
          'BRITANNIA','AMBUJACEM','TATACAP','TMPV','BANKBARODA','CHOLAFIN',
          'SHRIRAMFIN','TMCV','PNB','ICICIAMC','PFC','SOLARINDS','MUTHOOTFIN',
          'TATAPOWER','CIPLA','TORNTPHARM','GODREJCP','LODHA','HDFCAMC','GAIL',
          'CANBK','MAXHEALTH','ENRIN','SIEMENS','MAZDOCK','BOSCHLTD','ABB',
          'MOTHERSON','CUMMINSIND','TATACONSUM','CGPOWER','LGEINDIA','POLYCAB',
          'UNIONBANK','ADANIENSOL','APOLLOHOSP','INDHOTEL','HEROMOTOCO','DRREDDY',
          // Broker abbreviations
          'HDFBAN','INDOIL','COALIN','LARTOU','HDFSTA','CADHEA','MAHMAH',
        ])

        const MID_CAP_SYMS = new Set([
          'SHREECEM','JINDALSTEL','IDBI','SWIGGY','BSE','MANKIND','INDIANB',
          'INDUSTOWER','UNITDSPR','GMRAIRPORT','RECLTD','ZYDUSLIFE','ICICIGI',
          'GROWW','DIXON','IDEA','HAVELLS','MARICO','HINDPETRO','WAAREEENER',
          'BAJAJHFL','DABUR','LUPIN','JSWENERGY','ICICIPRULI','PERSISTENT',
          'BHARTIHEXA','NAUKRI','SRF','BHEL','POWERINDIA','MEESHO','NTPCGREEN',
          'NHPC','POLICYBZR','SBICARD','ASHOKLEY','SUZLON','ABCAPITAL','PAYTM',
          'IOB','OFSS','RVNL','PRESTIGE','LLOYDSME','UNOMINDA','FORTIS','NYKAA',
          'OIL','ATGL','COROMANDEL','GICRE','YESBANK','VMM','ABBOTINDIA',
          'TORNTPOWER','AUROPHARMA','NMDC','ALKEM','BERGEPAINT','MRF','PATANJALI',
          'GODREJPROP','HDBFS','LTF','JSWINFRA','SCHAEFFLER','INDUSINDBK','JSL',
          'AUBANK','COLPAL','OBEROIRLTY','BHARATFORG','FACT','COFORGE','UPL',
          'PHOENIXLTD','BANKINDIA','TIINDIA','IRCTC','BDL','IDFCFIRSTB','PIIND',
          'MOTILALOFS','GLENMARK','MFSL','SAIL','FEDERALBNK','NAM-INDIA','MPHASIS',
          'KALYANKJIL','LINDEINDIA','SUNDARMFIN','SUPREMEIND','BIOCON','TATACOMM',
          'LAURUSLABS','GODFRYPHLP','JKCEMENT','UBL','APLAPOLLO','PAGEIND',
          'GLAXO','BALKRISIND','ITCHOTELS','COCHINSHIP','PREMIERENE','HEXT',
          'LTTS','VOLTAS','MCX','HUDCO','360ONE','MAHABANK','PGHH','PETRONET',
          'IREDA','CONCOR','M&MFIN','NATIONALUM','DALBHARAT','JUBLFOOD','KAYNES',
          'ESCORTS','RADICO','FLUOROCHEM','ENDURANCE','KEI','ASTRAL','THERMAX',
          'UCOBANK','BLUESTARCO','NH','TATAINVEST','GODREJIND','POONAWALLA',
          'CRISIL','KPRMILL','CHOLAHLDNG','3MINDIA','IPCALAB','PIRAMALFIN',
          'APARINDS','SJVN','MEDANTA',
          // Broker abbreviations
          'ASHLEY','INDBA','TTKHEA','MANAFI','NATCOPHARM','FINCABLES',
          'TTKPRESTIG','JYOTHYLAB','TMB','TANLA','POWER','HDB','ASHOKA',
        ])

        const classifyMarketCap = (name, isin) => {
          // Step 0: ETF / Gold / Commodity detection by name
          const nu = (name || '').toUpperCase()
          if (/\bETF\b|GOLDBEES|INDEX FUND/.test(nu) ||
              /NIFTY\s*(50|NEXT|100|200|500|BANK|IT|PHARMA|AUTO|MIDCAP|SMALLCAP)/i.test(nu) ||
              /SENSEX|NASDAQ/.test(nu)) return 'Index / ETF'
          if (/GOLD.*(ETF|EXCHANGE|BEES|FOF)|SILVER.*(ETF|FOF)/.test(nu)) return 'Commodity ETF'

          // Step 1: ISIN lookup — exact match from AMFI Dec 2025 official PDF
          if (isin && LARGE_CAP_ISINS.has(isin)) return 'Large Cap'
          if (isin && MID_CAP_ISINS.has(isin))   return 'Mid Cap'
          if (isin && isin.startsWith('INF'))      return 'Index / ETF'

          // Step 2: NSE symbol extraction + lookup
          const words = nu.replace(/\.?LTD\.?$|LIMITED$|\bLTD\b/,'').trim().split(/[\s&]+/)
          const syms  = [nu.replace(/[^A-Z0-9-]/g,'').slice(0,12),
                         ...words.filter(w => /^[A-Z0-9-]{2,12}$/.test(w))]
          for (const s of syms) {
            if (LARGE_CAP_SYMS.has(s)) return 'Large Cap'
            if (MID_CAP_SYMS.has(s))   return 'Mid Cap'
          }

          // Step 3: Full company name keyword fallback
          const n = nu.toLowerCase()
          const lkw = [
            'reliance industries','hdfc bank','bharti airtel','tata consultancy',
            'icici bank','state bank of india','infosys','bajaj finance','lic',
            'hindustan unilever','larsen & toubro','larsen and toubro','itc ltd',
            'maruti suzuki','mahindra & mahindra','hcl technologies','kotak mahindra',
            'sun pharmaceutical','axis bank','ultratech cement','bajaj finserv','titan',
            'ntpc limited','hindustan aeronautics','adani ports','ongc','bharat electronics',
            'adani enterprises','avenue supermarts','jsw steel','wipro','power grid',
            'asian paints','bajaj auto','coal india','nestle india','tata steel',
            'hdfc life','ltimindtree','irfc','adani green','varun beverages','tvs motor',
            'pidilite','bpcl','tech mahindra','britannia','ambuja cements','tata capital',
            'tata motors passenger','bank of baroda','cholamandalam','shriram finance',
            'punjab national bank','power finance corp','solar industries','muthoot finance',
            'tata power','cipla','torrent pharma','godrej consumer','macrotech','lodha',
            'hdfc amc','gail','canara bank','max healthcare','siemens','mazagon dock',
            'bosch','abb india','motherson','cummins india','tata consumer','cg power',
            'lg electronics','polycab','union bank','apollo hospitals','indian hotels',
            'hero motocorp','dr. reddy','dr reddy',
          ]
          const mkw = [
            'shree cement','jindal steel','idbi bank','mankind pharma','indian bank',
            'indus towers','gmr airports','rec limited','zydus','icici lombard',
            'havells','marico','hindustan petroleum','bajaj housing','dabur','lupin',
            'jsw energy','icici prudential life','persistent systems','srf limited',
            'bhel','nhpc','policybazaar','sbi cards','ashok leyland','suzlon',
            'godrej properties','hdb financial','l&t finance','jsw infra','schaeffler',
            'indusind bank','federal bank','coforge','mphasis','sundaram finance',
            'supreme industries','biocon','laurus labs','jk cement','united breweries',
            'itc hotels','cochin shipyard','l&t technology','voltas','blue star',
            'pi industries','motilal','glenmark','sail','berger paints','nmdc',
            'alkem','aurobindo','torrent power','yes bank','fortis','oberoi realty',
            'bharat forge','phoenix mills','irctc','tube investments','bharat dynamics',
            'idfc first bank','radico','ipca','endurance','astral','thermax',
            'kalyan jewellers','linde india','coromandel','nmdc','narayana',
            'prestige estate','nykaa','oil india','abbott india',
          ]
          for (const k of lkw) { if (n.includes(k)) return 'Large Cap' }
          for (const k of mkw) { if (n.includes(k)) return 'Mid Cap'   }

          return 'Small Cap'
        }
        const mcapMap = {}
        equityAssets.forEach(a => {
          if (!a.value) return
          // Only classify stocks — skip Gold ETFs, Crypto etc. from market cap buckets
          if (a.category !== 'Stocks & Equities') return
          const cap = classifyMarketCap(a.name, a._isin || '')
          if (!mcapMap[cap]) mcapMap[cap] = { value: 0, count: 0 }
          mcapMap[cap].value += a.value
          mcapMap[cap].count += 1
        })
        const totalMcap = Object.values(mcapMap).reduce((s, v) => s + v.value, 0)
        const MCAP_COLORS = {
          'Large Cap':'#2563eb', 'Mid Cap':'#c8920a', 'Small Cap':'#16a34a',
          'Index / ETF':'#8b5cf6', 'Commodity ETF':'#d97706',
        }
        const mcapData = Object.entries(mcapMap)
          .map(([name, d]) => ({
            name, value: d.value, count: d.count,
            pct: totalMcap > 0 ? (d.value / totalMcap * 100) : 0,
            color: MCAP_COLORS[name] || '#8892b0',
          }))
          .sort((a, b) => b.value - a.value)

        const IDEAL_ALLOC = { 'Large Cap': 60, 'Mid Cap': 25, 'Small Cap': 15 }

        return (
          <>
            {/* ── Sector-wise Allocation ──────────────────────────────────── */}
            <div className="card" style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:8 }}>
                <h3 className="section-heading">Equity — Sector-wise Allocation</h3>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {activeSector && (
                    <button onClick={() => setActiveSector(null)}
                      style={{ fontSize:11, color:'#c8920a', background:'rgba(200,146,10,0.08)', border:'1px solid rgba(200,146,10,0.25)', borderRadius:20, padding:'3px 10px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                      ✕ Clear filter
                    </button>
                  )}
                  <span style={{ fontSize:12, color:'#8892b0' }}>{sectorData.length} sectors · {equityAssets.filter(a=>a._sector||a.note).length} stocks</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:28, alignItems:'start' }}>
                {/* Donut chart */}
                <div style={{ position:'relative', width:160, height:160, flexShrink:0 }}>
                  <svg viewBox="0 0 160 160" width="160" height="160">
                    {(() => {
                      let cumPct = 0
                      const r = 60, cx = 80, cy = 80
                      const circ = 2 * Math.PI * r
                      return sectorData.map((s, i) => {
                        const dash    = (s.pct / 100) * circ
                        const offset  = circ - (cumPct / 100) * circ
                        cumPct += s.pct
                        const isActive = activeSector === s.name
                        return (
                          <circle key={s.name} cx={cx} cy={cy} r={r}
                            fill="none" stroke={s.color}
                            strokeWidth={isActive ? 32 : 26}
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={offset}
                            opacity={activeSector && !isActive ? 0.3 : 1}
                            style={{ transform:'rotate(-90deg)', transformOrigin:'center', cursor:'pointer', transition:'all 0.2s' }}
                            onClick={() => setActiveSector(isActive ? null : s.name)}
                          />
                        )
                      })
                    })()}
                    {activeSector
                      ? <text x="80" y="86" textAnchor="middle" style={{ fontSize:9, fill:'#c8920a', fontFamily:"'Outfit',sans-serif" }}>{activeSector}</text>
                      : <text x="80" y="76" textAnchor="middle" style={{ fontSize:11, fill:'#8892b0', fontFamily:"'Outfit',sans-serif" }}>Sectors</text>
                    }
                    <text x="80" y="99" textAnchor="middle" style={{ fontSize:activeSector?14:18, fontWeight:700, fill:'#1a1d2e', fontFamily:"'Cormorant Garamond',serif" }}>
                      {activeSector ? sectorData.find(s=>s.name===activeSector)?.count + ' stocks' : sectorData.length}
                    </text>
                  </svg>
                </div>
                {/* Bar list — clickable rows */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {sectorData.map((s, i) => {
                    const isActive = activeSector === s.name
                    return (
                    <div key={s.name} onClick={() => setActiveSector(isActive ? null : s.name)}
                      style={{ cursor:'pointer', padding:'6px 8px', borderRadius:8, border:`1px solid ${isActive ? s.color+'66' : 'transparent'}`,
                        background: isActive ? s.color+'0d' : 'transparent', opacity: activeSector && !isActive ? 0.45 : 1, transition:'all 0.15s' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ width:9, height:9, borderRadius:2, background:s.color, flexShrink:0 }} />
                          <span style={{ fontSize:12, color:'#1a1d2e', fontWeight: isActive ? 600 : 500 }}>{s.name}</span>
                          <span style={{ fontSize:11, color: isActive ? s.color : '#b0b8d0', fontWeight: isActive ? 600 : 400 }}>({s.count})</span>
                        </div>
                        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                          <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:'#8892b0' }}>{fmt(s.value)}</span>
                          <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:s.color, minWidth:42, textAlign:'right' }}>{s.pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div style={{ height:4, background:'#eef0f8', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${s.pct}%`, background:s.color, borderRadius:2, transition:'width 0.5s cubic-bezier(0.16,1,0.3,1)' }} />
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>

              {/* Drill-down: holdings in selected sector */}
              {activeSector && (() => {
                const secAssets = equityAssets
                  .filter(a => {
                    const s = (a._sector || a.note || '').toLowerCase().trim()
                    return s === activeSector.toLowerCase()
                  })
                  .sort((a, b) => b.value - a.value)
                const secColor = sectorData.find(s => s.name === activeSector)?.color || '#c8920a'
                const secInvested = secAssets.reduce((s,a) => s + (a._investedValue||0), 0)
                const secPresent  = secAssets.reduce((s,a) => s + (a.value||0), 0)
                const secPL       = secInvested > 0 ? secPresent - secInvested : null
                const secPLPct    = secInvested > 0 ? (secPL / secInvested) * 100 : null
                return (
                  <div style={{ marginTop:20, borderTop:`2px solid ${secColor}22`, paddingTop:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:2, background:secColor }} />
                        <span style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>{activeSector}</span>
                        <span style={{ fontSize:12, color:'#8892b0' }}>— {secAssets.length} holdings</span>
                      </div>
                      {secPLPct !== null && (
                        <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                          color: secPLPct >= 0 ? '#16a34a' : '#dc2626',
                          background: secPLPct >= 0 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)',
                          padding:'3px 10px', borderRadius:20 }}>
                          {secPLPct >= 0 ? '+' : ''}{secPLPct.toFixed(2)}%  ({secPLPct >= 0 ? '+' : ''}{fmt(secPL)})
                        </span>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {secAssets.map(a => {
                        const plPct = a._plPct
                        const plCol = plPct >= 0 ? '#16a34a' : '#dc2626'
                        return (
                          <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                            padding:'8px 12px', background:'#f8f9fc', borderRadius:8, border:'1px solid #eef0f8', gap:8 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:500, color:'#1a1d2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                              <div style={{ fontSize:10, color:'#b0b8d0', marginTop:1 }}>{a.institution}{a._qty > 0 ? ` · Qty: ${a._qty}` : ''}</div>
                            </div>
                            <div style={{ textAlign:'right', flexShrink:0 }}>
                              <div style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:'#c8920a', fontWeight:500 }}>{fmt(a.value)}</div>
                              {plPct !== null && plPct !== undefined && (
                                <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:plCol, marginTop:1 }}>
                                  {plPct >= 0 ? '+' : ''}{Number(plPct).toFixed(2)}%
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* ── Market Cap Allocation ────────────────────────────────────── */}
            <div className="card" style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:8 }}>
                <h3 className="section-heading">Equity — Market Cap Allocation</h3>
                <span style={{ fontSize:11, color:'#8892b0', background:'#f0f2f8', padding:'3px 10px', borderRadius:20 }}>
                  AMFI Dec 2025 · SEBI categorisation
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
                {/* Left — donut + labels */}
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {/* Donut */}
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <div style={{ position:'relative', width:180, height:180 }}>
                      <svg viewBox="0 0 180 180" width="180" height="180">
                        {(() => {
                          let cum = 0
                          const r = 68, cx = 90, cy = 90, circ = 2 * Math.PI * r
                          return mcapData.map((m) => {
                            const dash   = (m.pct / 100) * circ
                            const offset = circ - (cum / 100) * circ
                            cum += m.pct
                            return (
                              <circle key={m.name} cx={cx} cy={cy} r={r}
                                fill="none" stroke={m.color} strokeWidth={30}
                                strokeDasharray={`${dash} ${circ - dash}`}
                                strokeDashoffset={offset}
                                style={{ transform:'rotate(-90deg)', transformOrigin:'center' }}
                              />
                            )
                          })
                        })()}
                        <text x="90" y="86" textAnchor="middle" style={{ fontSize:11, fill:'#8892b0', fontFamily:"'Outfit',sans-serif" }}>Total</text>
                        <text x="90" y="104" textAnchor="middle" style={{ fontSize:15, fontWeight:700, fill:'#1a1d2e', fontFamily:"'Cormorant Garamond',serif" }}>{fmts(totalMcap)}</text>
                      </svg>
                    </div>
                  </div>
                  {/* Legend — clickable */}
                  {mcapData.map(m => {
                    const isActive = activeMcap === m.name
                    return (
                    <div key={m.name} onClick={() => setActiveMcap(isActive ? null : m.name)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                        cursor:'pointer', padding:'5px 8px', borderRadius:8,
                        border:`1px solid ${isActive ? m.color+'66' : 'transparent'}`,
                        background: isActive ? m.color+'0d' : 'transparent',
                        opacity: activeMcap && !isActive ? 0.45 : 1, transition:'all 0.15s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:m.color }} />
                        <span style={{ fontSize:12, color:'#1a1d2e', fontWeight: isActive ? 600 : 400 }}>{m.name}</span>
                        <span style={{ fontSize:11, color: isActive ? m.color : '#b0b8d0', fontWeight: isActive ? 600 : 400 }}>({m.count})</span>
                      </div>
                      <div style={{ display:'flex', gap:10 }}>
                        <span style={{ fontSize:11, color:'#8892b0', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(m.value)}</span>
                        <span style={{ fontSize:12, fontWeight:600, color:m.color, fontFamily:"'JetBrains Mono',monospace", minWidth:42, textAlign:'right' }}>{m.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    )
                  })}
                </div>

                {/* Right — vs ideal allocation + risk note */}
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ fontSize:12, color:'#8892b0', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
                    Your mix vs Ideal (aggressive)
                  </div>
                  {['Large Cap','Mid Cap','Small Cap'].map(cap => {
                    const actual  = mcapData.find(m => m.name === cap)?.pct || 0
                    const ideal   = IDEAL_ALLOC[cap]
                    const diff    = actual - ideal
                    const color   = MCAP_COLORS[cap]
                    return (
                      <div key={cap}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                          <span style={{ fontSize:12, color:'#1a1d2e', fontWeight:500 }}>{cap}</span>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <span style={{ fontSize:11, color:'#8892b0' }}>Ideal: {ideal}%</span>
                            <span style={{ fontSize:12, fontWeight:600, fontFamily:"'JetBrains Mono',monospace",
                              color: Math.abs(diff) < 5 ? '#16a34a' : '#d97706' }}>
                              {actual.toFixed(1)}%
                              <span style={{ fontSize:10, fontWeight:400, marginLeft:4, color: diff > 0 ? '#c8920a' : '#8892b0' }}>
                                {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                              </span>
                            </span>
                          </div>
                        </div>
                        {/* Stacked: actual vs ideal */}
                        <div style={{ position:'relative', height:6, background:'#eef0f8', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${ideal}%`, background:'#e2e5f0', borderRadius:3 }} />
                          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${Math.min(actual, 100)}%`, background:color, borderRadius:3, opacity:0.85 }} />
                        </div>
                      </div>
                    )
                  })}

                  {/* Risk indicator */}
                  {(() => {
                    const largePct = mcapData.find(m => m.name==='Large Cap')?.pct || 0
                    const smallPct = (mcapData.find(m => m.name==='Small Cap')?.pct || 0) + (mcapData.find(m => m.name==='Mid Cap')?.pct || 0)
                    const risk = smallPct > 60 ? 'High' : smallPct > 35 ? 'Moderate' : 'Conservative'
                    const riskColor = { High:'#dc2626', Moderate:'#d97706', Conservative:'#16a34a' }[risk]
                    return (
                      <div style={{ marginTop:8, padding:'12px 14px', background:'#f8f9fc', borderRadius:10, border:'1px solid #eef0f8' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span style={{ fontSize:12, color:'#4a4f6a', fontWeight:500 }}>Portfolio Risk Profile</span>
                          <span style={{ fontSize:12, fontWeight:700, color:riskColor,
                            background: riskColor + '14', padding:'2px 10px', borderRadius:20 }}>
                            {risk}
                          </span>
                        </div>
                        <div style={{ fontSize:11, color:'#8892b0', lineHeight:1.5 }}>
                          {risk === 'High' && 'Heavy small/mid cap tilt. Higher return potential but higher volatility.'}
                          {risk === 'Moderate' && 'Balanced mix. Good growth potential with manageable risk.'}
                          {risk === 'Conservative' && 'Large cap heavy. Stable returns with lower volatility.'}
                        </div>
                      </div>
                    )
                  })()}

                  <div style={{ fontSize:11, color:'#b0b8d0', lineHeight:1.5, fontStyle:'italic' }}>
                    * SEBI/AMFI classification (Dec 2025 official list). Top 100 = Large Cap, 101-250 = Mid Cap, 251+ = Small Cap. Ideal: 60% Large / 25% Mid / 15% Small.
                  </div>
                </div>
              </div>

              {/* Drill-down: holdings in selected market cap bucket */}
              {activeMcap && (() => {
                const capAssets = equityAssets
                  .filter(a => a.category === 'Stocks & Equities' && classifyMarketCap(a.name, a._isin||'') === activeMcap)
                  .sort((a, b) => b.value - a.value)
                const capColor   = MCAP_COLORS[activeMcap] || '#8892b0'
                const capInvested = capAssets.reduce((s,a) => s + (a._investedValue||0), 0)
                const capPresent  = capAssets.reduce((s,a) => s + (a.value||0), 0)
                const capPL       = capInvested > 0 ? capPresent - capInvested : null
                const capPLPct    = capInvested > 0 ? (capPL / capInvested) * 100 : null
                return (
                  <div style={{ marginTop:20, borderTop:`2px solid ${capColor}22`, paddingTop:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:capColor }} />
                        <span style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>{activeMcap}</span>
                        <span style={{ fontSize:12, color:'#8892b0' }}>— {capAssets.length} holdings</span>
                        <button onClick={() => setActiveMcap(null)}
                          style={{ fontSize:11, color:capColor, background:capColor+'14', border:`1px solid ${capColor}44`, borderRadius:20, padding:'2px 8px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                          ✕ Clear
                        </button>
                      </div>
                      {capPLPct !== null && (
                        <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                          color: capPLPct >= 0 ? '#16a34a' : '#dc2626',
                          background: capPLPct >= 0 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)',
                          padding:'3px 10px', borderRadius:20 }}>
                          {capPLPct >= 0 ? '+' : ''}{capPLPct.toFixed(2)}%  ({capPLPct >= 0 ? '+' : ''}{fmt(capPL)})
                        </span>
                      )}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:8 }}>
                      {capAssets.map(a => {
                        const plPct = a._plPct
                        const plCol = plPct !== null && plPct !== undefined ? (plPct >= 0 ? '#16a34a' : '#dc2626') : '#8892b0'
                        const sector = (a._sector || a.note || '').trim()
                        return (
                          <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                            padding:'8px 12px', background:'#f8f9fc', borderRadius:8, border:'1px solid #eef0f8', gap:8 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:500, color:'#1a1d2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                              <div style={{ fontSize:10, color:'#b0b8d0', marginTop:1 }}>
                                {[sector, a.institution, a._qty > 0 ? `Qty: ${a._qty}` : ''].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                            <div style={{ textAlign:'right', flexShrink:0 }}>
                              <div style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:'#c8920a', fontWeight:500 }}>{fmt(a.value)}</div>
                              {plPct !== null && plPct !== undefined && (
                                <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:plCol, marginTop:1 }}>
                                  {plPct >= 0 ? '+' : ''}{Number(plPct).toFixed(2)}%
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </>
        )
      })()}

      {/* ── Mutual Fund Analytics ────────────────────────────────────────── */}
      {(data?.assets||[]).some(a => a._isMF) && (() => {
        const mfAssets = (data?.assets||[]).filter(a => a._isMF)

        // Parse MF category from _sector / note field
        // e.g. "Equity - Small Cap", "Hybrid - Arbitrage", "Others - Fund of Funds"
        const parseMFCategory = (sector) => {
          const s = (sector || '').toLowerCase()
          if (s.includes('small cap'))            return 'Small Cap'
          if (s.includes('mid cap'))              return 'Mid Cap'
          if (s.includes('large cap'))            return 'Large Cap'
          if (s.includes('multi cap') || s.includes('flexi cap') || s.includes('large & mid')) return 'Flexi / Multi Cap'
          if (s.includes('elss') || s.includes('tax sav'))  return 'ELSS (Tax Saving)'
          if (s.includes('arbitrage'))            return 'Arbitrage'
          if (s.includes('hybrid') || s.includes('balanced') || s.includes('equity savings')) return 'Hybrid'
          if (s.includes('debt') || s.includes('liquid') || s.includes('money market') || s.includes('overnight') || s.includes('ultra short') || s.includes('short dur') || s.includes('credit risk')) return 'Debt'
          if (s.includes('gold') || s.includes('silver') || s.includes('commodity')) return 'Gold / Commodity'
          if (s.includes('fund of fund') || s.includes('fof') || s.includes('overseas') || s.includes('international')) return 'Fund of Funds'
          if (s.includes('index') || s.includes('nifty') || s.includes('sensex') || s.includes('etf')) return 'Index / ETF'
          if (s.includes('equity'))               return 'Equity'
          return 'Other'
        }

        const MF_CAT_COLORS = {
          'Large Cap':        '#2563eb',
          'Mid Cap':          '#c8920a',
          'Small Cap':        '#16a34a',
          'Flexi / Multi Cap':'#7c3aed',
          'ELSS (Tax Saving)':'#0891b2',
          'Hybrid':           '#d97706',
          'Arbitrage':        '#8b5cf6',
          'Debt':             '#6b7494',
          'Gold / Commodity': '#b8820e',
          'Fund of Funds':    '#059669',
          'Index / ETF':      '#dc2626',
          'Equity':           '#3b82f6',
          'Other':            '#9ca3af',
        }

        // Group MFs by category
        const catMap = {}
        mfAssets.forEach(a => {
          const cat = parseMFCategory(a._sector || a.note || '')
          if (!catMap[cat]) catMap[cat] = { funds: [], value: 0, invested: 0 }
          catMap[cat].funds.push(a)
          catMap[cat].value    += (a.value || 0)
          catMap[cat].invested += (a._investedValue || 0)
        })
        const totalMFVal = mfAssets.reduce((s, a) => s + (a.value || 0), 0)
        const totalMFInv = mfAssets.reduce((s, a) => s + (a._investedValue || 0), 0)
        const totalMFPL  = totalMFVal - totalMFInv
        const totalMFPLPct = totalMFInv > 0 ? (totalMFPL / totalMFInv) * 100 : 0
        const mfCatData = Object.entries(catMap)
          .map(([cat, d]) => ({
            cat, funds: d.funds, value: d.value, invested: d.invested,
            pl: d.value - d.invested,
            plPct: d.invested > 0 ? ((d.value - d.invested) / d.invested * 100) : null,
            pct: totalMFVal > 0 ? (d.value / totalMFVal * 100) : 0,
            color: MF_CAT_COLORS[cat] || '#9ca3af',
          }))
          .sort((a, b) => b.value - a.value)

        return (
          <div className="card" style={{ padding: 24 }}>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
              <div>
                <h3 className="section-heading">Mutual Fund Analytics</h3>
                <div style={{ fontSize:12, color:'#8892b0', marginTop:4 }}>
                  {mfAssets.length} funds · {mfCatData.length} categories
                </div>
              </div>
              {/* MF Portfolio summary */}
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {[
                  { label:'Invested',     value: fmt(totalMFInv),  color:'#8892b0' },
                  { label:'Present',      value: fmt(totalMFVal),  color:'#c8920a' },
                  { label:'P&L',          value: (totalMFPL>=0?'+':'')+fmt(totalMFPL), color: totalMFPL>=0?'#16a34a':'#dc2626' },
                  { label:'Return',       value: (totalMFPLPct>=0?'+':'')+totalMFPLPct.toFixed(2)+'%', color: totalMFPLPct>=0?'#16a34a':'#dc2626' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11, color:'#8892b0', marginBottom:2 }}>{s.label}</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
              {/* Left: Category donut + list */}
              <div>
                <div style={{ fontSize:11, color:'#8892b0', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Category Allocation</div>
                {/* Mini donut */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
                  <svg viewBox="0 0 160 160" width="140" height="140">
                    {(() => {
                      let cum = 0
                      const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r
                      return mfCatData.map(d => {
                        const dash = (d.pct / 100) * circ
                        const offset = circ - (cum / 100) * circ
                        cum += d.pct
                        return (
                          <circle key={d.cat} cx={cx} cy={cy} r={r}
                            fill="none" stroke={d.color} strokeWidth={26}
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={offset}
                            style={{ transform:'rotate(-90deg)', transformOrigin:'center' }}
                          />
                        )
                      })
                    })()}
                    <text x="80" y="76" textAnchor="middle" style={{ fontSize:11, fill:'#8892b0', fontFamily:"'Outfit',sans-serif" }}>MF Portfolio</text>
                    <text x="80" y="92" textAnchor="middle" style={{ fontSize:14, fontWeight:700, fill:'#1a1d2e', fontFamily:"'Cormorant Garamond',serif" }}>{fmts(totalMFVal)}</text>
                  </svg>
                </div>
                {/* Category bars */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {mfCatData.map(d => (
                    <div key={d.cat}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:d.color, flexShrink:0 }} />
                          <span style={{ fontSize:12, color:'#1a1d2e', fontWeight:500 }}>{d.cat}</span>
                          <span style={{ fontSize:10, color:'#b0b8d0' }}>({d.funds.length})</span>
                        </div>
                        <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:d.color }}>{d.pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height:4, background:'#eef0f8', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${d.pct}%`, background:d.color, borderRadius:2, transition:'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Fund-wise P&L */}
              <div>
                <div style={{ fontSize:11, color:'#8892b0', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Fund-wise Performance</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:400, overflowY:'auto' }}>
                  {mfCatData.map(d => (
                    <div key={d.cat}>
                      {/* Category header */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'5px 8px', background:d.color+'12', borderRadius:6, marginBottom:4,
                        borderLeft:`3px solid ${d.color}` }}>
                        <span style={{ fontSize:11, fontWeight:600, color:d.color }}>{d.cat}</span>
                        {d.plPct !== null && (
                          <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                            color: d.plPct >= 0 ? '#16a34a' : '#dc2626' }}>
                            {d.plPct >= 0 ? '+' : ''}{d.plPct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      {/* Individual funds */}
                      {d.funds.sort((a,b) => b.value - a.value).map(f => {
                        const plPct = f._plPct
                        const plCol = plPct !== null && plPct !== undefined ? (plPct >= 0 ? '#16a34a' : '#dc2626') : '#8892b0'
                        return (
                          <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                            padding:'6px 8px 6px 14px', marginBottom:3,
                            background:'#f8f9fc', borderRadius:6, border:'1px solid #f0f1f8' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:11, fontWeight:500, color:'#1a1d2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                              {f._qty > 0 && (
                                <div style={{ fontSize:10, color:'#b0b8d0', marginTop:1 }}>{f._qty.toLocaleString()} units{f._avgPrice > 0 ? ` · NAV ₹${f._avgPrice.toFixed(2)}` : ''}</div>
                              )}
                            </div>
                            <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                              <div style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:'#c8920a', fontWeight:500 }}>{fmt(f.value)}</div>
                              {plPct !== null && plPct !== undefined && (
                                <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:plCol, marginTop:1 }}>
                                  {plPct >= 0 ? '+' : ''}{Number(plPct).toFixed(2)}%
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NET WORTH
// ═══════════════════════════════════════════════════════════════════════════════
export function NetWorth() {
  const { data, settings } = useFinance()
  const totals = useTotals()
  const cur = settings.currency
  const fmt  = v => formatCurrency(v, cur)
  const fmts = v => formatCompact(v, cur)
  const { totalAssets, totalLiabilities, netWorth, cashFlow, debtRatio, fiNumber, fiPct, avgNW } = totals

  const nextM = MILESTONES.find(m => m > netWorth) || MILESTONES[MILESTONES.length - 1] * 2
  const prevM = [...MILESTONES].reverse().find(m => m <= netWorth) || 0
  const mPct  = nextM > prevM ? ((netWorth - prevM) / (nextM - prevM)) * 100 : 0

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Hero */}
      <div className="card" style={{ padding: '40px 32px', textAlign: 'center', background: 'linear-gradient(135deg,#f8f9fd,#eef1f8)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(200,146,10,0.06) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, color: '#8892b0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Current Net Worth</div>
          <div className="gold-gradient" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 60, fontWeight: 700, lineHeight: 1, marginBottom: 16 }}>
            {fmt(netWorth)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Assets',       value: fmt(totalAssets),      color: '#16a34a' },
              { label: 'Liabilities',  value: `-${fmt(totalLiabilities)}`, color: '#dc2626' },
              { label: 'Debt Ratio',   value: `${debtRatio?.toFixed(1)}%`, color: debtRatio > 50 ? '#f06a6a' : '#e8c060' },
              { label: 'Annual Flow',  value: fmt(cashFlow * 12),    color: cashFlow >= 0 ? '#5b8ff9' : '#f06a6a' },
            ].map(i => (
              <div key={i.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{i.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, color: i.color }}>{i.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Milestone */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 20 }}>Wealth Milestone</h3>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#4a4f6a' }}>Progress to {fmts(nextM)}</span>
              <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: '#b8820e' }}>{Math.max(mPct, 0).toFixed(1)}%</span>
            </div>
            <ProgressBar pct={Math.max(mPct, 0)} color="#c8953a" height={10} />
          </div>
          <div style={{ padding: '12px 14px', background: '#f5f6fa', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 4 }}>Remaining</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: '#b8820e' }}>{fmts(Math.max(nextM - netWorth, 0))}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MILESTONES.slice(0, 6).map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: netWorth >= m ? '#16a34a' : '#e8eaf0', border: `1px solid ${netWorth >= m ? '#3ecf8e' : '#d0d3e0'}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: netWorth >= m ? '#3ecf8e' : '#6b7494', fontFamily: "'JetBrains Mono',monospace" }}>{fmts(m)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FI Calculator */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 20 }}>Financial Independence</h3>
          <div style={{ padding: '14px', background: '#f5f6fa', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 4 }}>FI Number (25× annual expenses)</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: '#2563eb' }}>{fmts(fiNumber)}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#4a4f6a' }}>FI Progress</span>
              <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: '#2563eb' }}>{fiPct?.toFixed(1)}%</span>
            </div>
            <ProgressBar pct={fiPct} color="#5b8ff9" height={10} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '12px', background: '#f5f6fa', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 4 }}>Still Needed</div>
              <div style={{ fontSize: 14, fontFamily: "'JetBrains Mono',monospace", color: '#d97706' }}>{fmts(Math.max(fiNumber - netWorth, 0))}</div>
            </div>
            <div style={{ padding: '12px', background: '#f5f6fa', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 4 }}>Passive Income (4%)</div>
              <div style={{ fontSize: 14, fontFamily: "'JetBrains Mono',monospace", color: '#16a34a' }}>{fmts(netWorth * 0.04 / 12)}/mo</div>
            </div>
          </div>
        </div>
      </div>

      {/* History chart */}
      <div className="card" style={{ padding: 24 }}>
        <h3 className="section-heading" style={{ marginBottom: 20 }}>Net Worth History</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data?.history || []}>
            <defs>
              <linearGradient id="nwHistGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#c8953a" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#c8953a" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f8" />
            <XAxis dataKey="month" tick={{ fill: '#9098b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9098b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmts(v)} />
            <Tooltip content={<ChartTooltip currency={cur} />} />
            <ReferenceLine y={avgNW} stroke="#3d4460" strokeDasharray="4 4"
              label={{ value: 'Avg', position: 'right', fill: '#c8ccd8', fontSize: 11 }} />
            <Area type="monotone" dataKey="netWorth" stroke="#c8953a" strokeWidth={2.5}
              fill="url(#nwHistGrad)" name="Net Worth"
              dot={{ fill: '#c8920a', r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
export function Settings({ onToast }) {
  const { session, signOut } = useAuth()
  const { data, settings, persistSettings, exportJSON, exportCSV, takeSnapshot, importJSON, resetToSample, batchUpdateCollection } = useFinance()
  const totals = useTotals()
  const [localCur, setLocalCur] = useState(settings.currency || 'INR')
  const fileRef = useState(null)

  const savePrefs = () => {
    persistSettings({ ...settings, currency: localCur })
    onToast('Preferences saved!', 'success')
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      await importJSON(file)
      onToast('Data imported successfully!', 'success')
    } catch {
      onToast('Invalid backup file', 'error')
    }
    e.target.value = ''
  }

  const handleSnapshot = () => {
    takeSnapshot({ netWorth: totals.netWorth, totalAssets: totals.totalAssets, totalLiabilities: totals.totalLiabilities, cashFlow: totals.cashFlow })
    onToast('Snapshot saved!', 'success')
  }

  const handleReset = () => {
    if (confirm('Reset all data to sample? This cannot be undone.')) {
      resetToSample()
      onToast('Data reset to sample', 'warning')
    }
  }

  // Fix sector/note casing — converts ALL CAPS or irregular casing to Title Case
  const fixSectorCasing = () => {
    if (!data?.assets?.length) { onToast('No assets to fix', 'info'); return }
    const toTitleCase = str => {
      if (!str) return ''
      return str
        .toLowerCase()
        .split(/([\s&\-\/]+)/)
        .map(word => word.match(/^[a-z]/) ? word.charAt(0).toUpperCase() + word.slice(1) : word)
        .join('')
    }
    const fixed = data.assets.map(a => ({
      ...a,
      note:    toTitleCase(a.note    || ''),
      _sector: toTitleCase(a._sector || ''),
    }))
    const changed = fixed.filter((a, i) => a.note !== data.assets[i].note || a._sector !== data.assets[i]._sector).length
    batchUpdateCollection('assets', fixed)
    onToast(changed > 0 ? `Fixed casing on ${changed} holdings` : 'All sector names already correct', 'success')
  }

  // Fix stock name casing — converts "Tata Consultancy Services Ltd" → "TATA CONSULTANCY SERVICES LTD"
  const fixNameCasing = () => {
    if (!data?.assets?.length) { onToast('No assets to fix', 'info'); return }
    const fixed = data.assets.map(a => ({
      ...a,
      name: (a.name || '').toUpperCase(),
    }))
    const changed = fixed.filter((a, i) => a.name !== data.assets[i].name).length
    batchUpdateCollection('assets', fixed)
    onToast(changed > 0 ? `Fixed name casing on ${changed} holdings` : 'All names already uppercase', 'success')
  }

  // ── Smart category re-detection for existing assets ────────────────────────
  const smartCategoryDetect = (name) => {
    const n = (name || '').toLowerCase().trim()
    if (!n) return null

    // Special overrides
    if (n === 'metaietf' || /mirae.?asset.?etf.?nifty.?metal/.test(n)) return 'Stocks & Equities'

    // 1. Fund of Fund (FoF) — not direct equity; wraps other funds
    const isFoF = /fund of fund/.test(n) || / fof/.test(n) || n.endsWith('fof') || /-fof/.test(n)
    if (isFoF) {
      if (/gold|silver|precious|commodity/.test(n)) return 'Gold & Precious Metals'
      return 'Mutual Funds'
    }

    // 2. Gold/Silver ETFs & instruments — underlying IS the commodity
    if (/gold|silver/.test(n)) {
      if (/etf|bees|exchange traded|goldbees|silverbees/.test(n)) return 'Gold & Precious Metals'
      if (/savings fund|gold fund|silver fund/.test(n))          return 'Gold & Precious Metals'
      if (/sgb|sovereign gold bond|digital gold/.test(n))        return 'Gold & Precious Metals'
      if (!/fund|etf/.test(n))                                   return 'Gold & Precious Metals'
    }
    if (/jewel|jewelry|jewellery|ornament|platinum/.test(n) && !/fund|etf/.test(n)) return 'Gold & Precious Metals'

    // 3. Equity ETFs — trade on exchange, track company baskets → Stocks & Equities
    //    (pharma ETF, bank ETF, smallcap ETF, nifty ETF — all track companies, not commodities)
    if (/ etf/.test(n) || n.endsWith('etf') || /exchange traded/.test(n)) return 'Stocks & Equities'

    // 4. Regular Mutual Funds (non-ETF) → Mutual Funds
    if (/fund/.test(n)) return 'Mutual Funds'
    if (/scheme|folio|sip|elss|nfo|direct plan|regular plan|growth plan|dividend plan|idcw/.test(n)) return 'Mutual Funds'
    if (/large.?cap|mid.?cap|small.?cap|flexi.?cap|multi.?cap|balanced advantage|hybrid|debt|liquid|overnight|arbitrage|index|nifty|sensex|contra|thematic|momentum|consumption|international|global|overseas/.test(n)) return 'Mutual Funds'
    if (/mirae|nippon|edelweiss|whiteoak|pgim|invesco|baroda.?bnp|taurus|jm.?financial/.test(n)) return 'Mutual Funds'

    // 5. Stocks & Equities (only after MF/Gold/ETF ruled out)
    if (/share|stock|nse|bse|zerodha|groww|demat|ipo|smallcase/.test(n)) return 'Stocks & Equities'
    if (/infy|tcs|reliance|wipro|hcl|ongc|tatamotors|bajaj|tatasteel|infosys/.test(n)) return 'Stocks & Equities'
    if (/equity/.test(n) && !/fund|plan/.test(n)) return 'Stocks & Equities'

    // 6. Other asset classes
    if (/ppf|public provident|epf|employee provident|provident fund|epfo|gratuity|superannuation/.test(n)) return 'PPF / EPF'
    if (/ssa|sukanya|sukanya samriddhi|samriddhi yojana|girl child savings|beti bachao/.test(n)) return 'SSA (Sukanya Samriddhi)'
    if (/nps|national pension|atal pension|\bapy\b|pran/.test(n)) return 'NPS'
    if (/ncd|non.?convertible debenture|\bbonds?\b|debenture|g.?sec|government securities|t.?bill|treasury bill|rbi bond|54ec|bharat bond|corporate bond|zero coupon|gilt/.test(n)) return 'Bonds & Debentures'
    if (/\bfd\b|fixed deposit|recurring deposit|\brd\b|term deposit|scss|senior citizen savings|\bkvp\b|\bnsc\b|national savings|monthly income scheme|post office/.test(n)) return 'Fixed Deposits'
    if (/savings account|current account|bank account|\bcash\b|wallet|emergency fund|salary account/.test(n)) return 'Cash & Equivalents'
    if (/flat|apartment|house|villa|plot|\bland\b|property|real estate|\bhome\b|office|shop|warehouse|commercial|residential|bungalow|\bsite\b|\bbhk\b/.test(n)) return 'Real Estate'
    if (/bitcoin|btc|ethereum|\beth\b|crypto|usdt|\bbnb\b|solana|\bxrp\b|polygon|matic|dogecoin|usdc|web3|defi|\bnft\b|wazirx|coinswitch|coindcx|zebpay/.test(n)) return 'Cryptocurrency'
    if (/\bcar\b|bike|motorcycle|scooter|vehicle|suv|sedan|hatchback|truck|two.?wheeler|four.?wheeler|\bev\b|activa|swift|creta|nexon|tiago/.test(n)) return 'Vehicles'
    if (/business|startup|company equity|unlisted|angel invest|pre.?ipo|venture|esop|employee stock/.test(n)) return 'Business Assets'
    return null
  }

  const [catFixModal, setCatFixModal] = useState(false)
  const [catFixItems, setCatFixItems] = useState([])   // [{asset, suggested, selected, override}]

  const scanCategories = () => {
    if (!data?.assets?.length) { onToast('No assets found', 'info'); return }
    const ASSET_CATS_ALL = ['Cash & Equivalents','Fixed Deposits','Bonds & Debentures','Mutual Funds',
      'Stocks & Equities','PPF / EPF','NPS','Real Estate','Gold & Precious Metals',
      'Cryptocurrency','Vehicles','Business Assets','Others']
    const items = data.assets
      .map(a => {
        const suggested = smartCategoryDetect(a.name)
        const changed = suggested && suggested !== a.category
        return { asset: a, suggested, changed, selected: changed, override: suggested || a.category }
      })
      .filter(x => x.changed)  // only show assets where suggestion differs from current
    if (items.length === 0) {
      onToast('All categories look correct — nothing to fix!', 'success')
      return
    }
    setCatFixItems(items)
    setCatFixModal(true)
  }

  const applyCategoryFixes = () => {
    const toFix = catFixItems.filter(x => x.selected)
    if (!toFix.length) { setCatFixModal(false); return }
    const fixMap = {}
    toFix.forEach(x => { fixMap[x.asset.id] = x.override })
    const fixed = data.assets.map(a => fixMap[a.id] ? { ...a, category: fixMap[a.id] } : a)
    batchUpdateCollection('assets', fixed)
    setCatFixModal(false)
    onToast(`Updated category for ${toFix.length} asset${toFix.length > 1 ? 's' : ''}`, 'success')
  }

  // Fix missing sectors — runs sector detection on all assets that have no sector/note set
  const fixMissingSectors = () => {
    if (!data?.assets?.length) { onToast('No assets to fix', 'info'); return }
    const detectSec = (name) => {
      const n = (name || '').toLowerCase()
      const rules = [
        [['bank','banking','indusind','federal bank','yes bank','bandhan','au small','dcb bank','karur','city union','tmb','south indian','hdb financial','rbl bank','csb bank','hdfc bank','icici bank','axis bank','kotak mah','sbi bank'], 'Banking'],
        [['insurance','life ins','general ins','bajaj allianz','icici pru','hdfc life','sbi life','star health','niva bupa','go digit'], 'Insurance'],
        [['power finance','pfc','rec limited','lic housing','manappuram','muthoot','sphoorty','bajaj fin','cholaman','shriram','mahindra fin','pnb housing','can fin','aptus','home first','aditya birla cap','iifl','abcapital'], 'Financial Services'],
        [['finance','financial'], 'Financial Services'],
        [['tata consultancy','tcs','infosys','wipro','hcl tech','tech mahindra','ltimindtree','mphasis','persistent','coforge','hexaware','zensar','mastek','kpit','happiest','birlasoft','saksoft','tanla','tata elxsi','cyient','sasken','sonata','intellect design','nucleus software','rategain'], 'Software & IT'],
        [['mahindra','maruti','tata motors','ashok leyland','hero moto','bajaj auto','tvs motor','eicher','bosch','mrf','apollo tyre','ceat','motherson','endurance','sona bl','uno minda','rane','samvardhana'], 'Automobiles'],
        [['healthcare','ttk health','apollo hosp','fortis','max health','narayana','aster','global health','rainbow','kims','yatharth','metropolis','dr lal','thyrocare','vijaya diag'], 'Healthcare'],
        [['pharma','cipla','sun pharma','drreddy','dr. reddy','biocon','divis','lupin','zydus','cadila','abbott','pfizer','natco','alkem','torrent pharma','ipca','laurus','granules','glenmark','mankind','ajanta','eris','suven'], 'Pharmaceuticals'],
        [['oil','petroleum','ongc','bpcl','hpcl','ioc','indian oil','gail','castrol','gujarat gas','indraprastha','mahanagar gas','petronet','aegis logistics'], 'Oil & Gas'],
        [['coal india','ntpc','adani power','tata power','torrent power','cesc','jsw energy','power grid','sjvn','nhpc','ireda','waaree','premier energies'], 'Energy & Power'],
        [['steel','tata steel','jsw steel','sail','jspl','jindal','hindalco','vedanta','nalco','moil','nmdc','hindustan zinc'], 'Metals & Mining'],
        [['hindustan unilever','hul','itc','dabur','godrej consumer','marico','nestle','britannia','colgate','emami','jyothy','varun bev','radico','united spirits','tilaknagar','globus spirits'], 'FMCG'],
        [['larsen','l&t','siemens','abb','bhel','cummins','thermax','bharat forge','grindwell','timken','schaeffler','skf','elgi','kirloskar','honeywell','voltas','blue star','kec international','kalpataru','ncc'], 'Capital Goods'],
        [['prakash pipes','supreme industries','astral','finolex','prince pipes','apollo pipes'], 'Industrials'],
        [['pipes','fittings','valves'], 'Industrials'],
        [['airtel','jio','vodafone','bharti','tata comm','sterlite tech','hfcl','route mobile'], 'Telecom'],
        [['dlf','godrej prop','oberoi','prestige','brigade','sobha','macrotech','lodha','kolte patil','phoenix','puravankara'], 'Real Estate'],
        [['ultratech','shree cement','acc','ambuja','dalmia','jk cement','ramco','birla corp','heidelberg'], 'Cement'],
        [['pidilite','asian paint','berger','kansai','nerolac','deepak nitrite','aarti ind','navin fluorine','srf','clean science','galaxy surf','fine organics','vinati organics'], 'Chemicals'],
        [['avenue supermarts','dmart','trent','v-mart','metro brands','bata','relaxo','titan','kalyan','vedant','manyavar'], 'Retail & Consumer'],
        [['adani port','concor','blue dart','gati','allcargo','delhivery','mahindra logistics'], 'Logistics'],
        [['nse','bse','cdsl','nsdl','cams','computer age','kfin tech','crisil','care ratings','icra','angel one','motilal','iifl sec','5paisa','geojit'], 'Capital Markets'],
        [['textile','fabric','yarn','raymond','arvind','vardhman','welspun','trident'], 'Textiles'],
        [['fertiliser','fertilizer','agri','coromandel','chambal','deepak fert','pi industries','dhanuka','rallis'], 'Agriculture'],
        [['media','entertainment','zee','sony','network18','sun tv','pvr','inox','saregama'], 'Media & Entertainment'],
        [['defence','defense','aerospace','hal','bharat electronics','bharat dynamics','mazagon','cochin shipyard','garden reach'], 'Defence'],
      ]
      for (const [keywords, sector] of rules) {
        if (keywords.some(k => n.includes(k))) return sector
      }
      return ''
    }

    const EQUITY_CATS = new Set(['Stocks & Equities','Mutual Funds','Gold & Precious Metals','Cryptocurrency'])
    let changed = 0
    const fixed = data.assets.map(a => {
      // Only process equity assets that are missing sector
      if (!EQUITY_CATS.has(a.category)) return a
      const existing = (a.note || a._sector || '').trim()
      if (existing) return a   // already has sector — skip
      const detected = detectSec(a.name)
      if (!detected) return a  // couldn't detect — skip
      changed++
      return { ...a, note: detected, _sector: detected }
    })

    if (changed === 0) {
      onToast('All equity holdings already have sector names', 'success')
      return
    }
    batchUpdateCollection('assets', fixed)
    onToast(`Sector detected and filled for ${changed} holding${changed > 1 ? 's' : ''}`, 'success')
  }

  // Fix Inflation — apply inflation to goals that were created without it
  const fixInflation = () => {
    if (!session?.userId) return
    try {
      const stored = localStorage.getItem(`wr_profile_${session.userId}`)
      if (!stored) { onToast('No profile found', 'info'); return }
      const profile = JSON.parse(stored)
      const goals = profile.goals || []
      if (!goals.length) { onToast('No goals to fix', 'info'); return }

      const INFLATION_RATES = {
        emergency:0, home:0.08, car:0.06, education:0.10, wedding:0.06,
        travel:0.06, retirement:0.06, business:0.07, gadget:0.04, custom:0.06,
      }
      const RETURN_RATES_LOCAL = {
        emergency:0.07, home:0.10, car:0.08, education:0.12, wedding:0.09,
        travel:0.08, retirement:0.12, business:0.11, gadget:0.07, custom:0.10,
      }
      let changed = 0
      const updated = goals.map(g => {
        const returnRate = g.returnRate || RETURN_RATES_LOCAL[g.type] || 0.10
        if (g.inflationAdjusted && g.returnRate) return g  // already fully set
        const rate = INFLATION_RATES[g.type] || INFLATION_RATES.custom
        if (rate === 0) return { ...g, inflationRate: 0, inflationAdjusted: false, returnRate }
        const years = (parseInt(g.targetYear)||0) - new Date().getFullYear()
        if (years <= 0) return { ...g, returnRate }
        const rawTarget = parseInt(g.todayValue || g.targetAmount) || 0
        const inflated  = Math.round(rawTarget * Math.pow(1 + rate, years))
        changed++
        return { ...g, inflationRate: rate, returnRate, inflationAdjusted: true, todayValue: rawTarget, targetAmount: inflated }
      })
      localStorage.setItem(`wr_profile_${session.userId}`, JSON.stringify({ ...profile, goals: updated }))
      onToast(changed > 0 ? `Inflation applied to ${changed} goal${changed>1?'s':''}. Reload My Goals to see updates.` : 'All goals already have inflation applied', 'success')
    } catch (e) {
      onToast('Error: ' + e.message, 'error')
    }
  }

  const printReport = () => {
    const c = CURRENCIES.find(x => x.code === settings.currency) || CURRENCIES[0]
    const fmt = (n) => `${c.symbol}${Math.round(n).toLocaleString()}`
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>WealthRadar Report</title>
    <style>body{font-family:'Segoe UI',sans-serif;max-width:900px;margin:0 auto;padding:32px;color:#111;}
    h1{font-size:26px;margin-bottom:4px;}h2{font-size:16px;font-weight:600;margin:24px 0 10px;border-bottom:2px solid #f0f0f0;padding-bottom:6px;}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
    .kpi{background:#f8f8f8;padding:16px;border-radius:8px;}.kpi .v{font-size:22px;font-weight:700;margin:4px 0;}.kpi .l{font-size:11px;color:#666;text-transform:uppercase;}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;}th{background:#f0f0f0;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;}
    td{padding:8px 12px;border-bottom:1px solid #f0f0f0;}.pos{color:#16a34a;}.neg{color:#dc2626;}
    .footer{margin-top:32px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px;}</style>
    </head><body>
    <h1>WealthRadar Financial Report</h1>
    <p style="color:#666;font-size:13px">Generated ${new Date().toLocaleString()} · ${c.name}</p>
    <div class="grid">
      <div class="kpi"><div class="l">Net Worth</div><div class="v">${fmt(totals.netWorth)}</div></div>
      <div class="kpi"><div class="l">Total Assets</div><div class="v pos">${fmt(totals.totalAssets)}</div></div>
      <div class="kpi"><div class="l">Total Liabilities</div><div class="v neg">${fmt(totals.totalLiabilities)}</div></div>
      <div class="kpi"><div class="l">Monthly Cash Flow</div><div class="v ${totals.cashFlow >= 0 ? 'pos' : 'neg'}">${fmt(totals.cashFlow)}</div></div>
    </div>
    <h2>Assets</h2>
    <table><tr><th>Name</th><th>Category</th><th>Institution</th><th>Value</th></tr>
    ${(data?.assets || []).map(a => `<tr><td>${a.name}</td><td>${a.category}</td><td>${a.institution || '—'}</td><td class="pos">${fmt(a.value)}</td></tr>`).join('')}
    <tr><td colspan="3"><strong>Total</strong></td><td class="pos"><strong>${fmt(totals.totalAssets)}</strong></td></tr></table>
    <h2>Liabilities</h2>
    <table><tr><th>Name</th><th>Category</th><th>Rate</th><th>Balance</th></tr>
    ${(data?.liabilities || []).map(l => `<tr><td>${l.name}</td><td>${l.category}</td><td>${l.rate ? l.rate + '%' : '—'}</td><td class="neg">${fmt(l.value)}</td></tr>`).join('')}
    <tr><td colspan="3"><strong>Total</strong></td><td class="neg"><strong>${fmt(totals.totalLiabilities)}</strong></td></tr></table>
    <h2>Cash Flow</h2>
    <table><tr><th>Name</th><th>Category</th><th>Type</th><th>Monthly</th></tr>
    ${(data?.income || []).map(i => `<tr><td>${i.name}</td><td>${i.category}</td><td class="pos">Income</td><td class="pos">${fmt(i.monthly)}</td></tr>`).join('')}
    ${(data?.expenses || []).map(e => `<tr><td>${e.name}</td><td>${e.category}</td><td class="neg">Expense</td><td class="neg">-${fmt(e.monthly)}</td></tr>`).join('')}
    </table>
    <div class="footer">WealthRadar · Personal Finance Tracker · Data stored locally.</div>
    </body></html>`)
    w.document.close(); w.print()
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 740 }}>
      {/* Profile */}
      <div className="card" style={{ padding: 28 }}>
        <h3 className="section-heading" style={{ marginBottom: 20 }}>Account</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {session?.picture
            ? <img src={session.picture} alt="" style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #eef0f8' }} />
            : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#c8920a,#e8a820)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600, color: '#ffffff' }}>
                {session?.name?.[0]?.toUpperCase()}
              </div>
          }
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{session?.name}</div>
            <div style={{ fontSize: 13, color: '#8892b0', marginTop: 2 }}>{session?.email}</div>
            <div className="chip" style={{ marginTop: 6 }}>
              {session?.provider === 'google' ? '🔵 Google Account' : '🔑 Email Account'}
            </div>
          </div>
        </div>
        <button className="btn btn-outline" onClick={signOut} style={{ color: '#dc2626', borderColor: 'rgba(240,106,106,0.3)' }}>
          Sign Out
        </button>
      </div>

      {/* Currency preference */}
      <div className="card" style={{ padding: 28 }}>
        <h3 className="section-heading" style={{ marginBottom: 20 }}>Preferences</h3>
        <div style={{ marginBottom: 20 }}>
          <label className="label">Default Currency</label>
          <select className="input" value={localCur} onChange={e => setLocalCur(e.target.value)} style={{ maxWidth: 320 }}>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.symbol} — {c.name} ({c.code})</option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: '#8892b0', marginTop: 8 }}>Default is INR (₹) for Indian users</div>
        </div>
        <button className="btn btn-gold" onClick={savePrefs}>Save Preferences</button>
      </div>

      {/* Export / Import */}
      <div className="card" style={{ padding: 28 }}>
        <h3 className="section-heading" style={{ marginBottom: 8 }}>Data Management</h3>
        <p style={{ fontSize: 13, color: '#8892b0', marginBottom: 20 }}>Export, backup, snapshot, or restore your financial data.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { icon: '📥', label: 'Export JSON',   sub: 'Full data backup',      action: exportJSON,    color: '#16a34a' },
            { icon: '📊', label: 'Export CSV',    sub: 'Spreadsheet format',    action: exportCSV,     color: '#2563eb' },
            { icon: '🖨',  label: 'Print Report', sub: 'PDF-ready report',      action: printReport,   color: '#b8820e' },
            { icon: '📸', label: 'Save Snapshot', sub: 'Record current state',  action: handleSnapshot, color: '#9b8ff9' },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ padding: '16px', textAlign: 'left', cursor: 'pointer', borderRadius: 10, border: '1px solid #e8eaf0', background: '#f5f6fa', transition: 'all 0.2s', width: '100%' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#d0d3e0'; e.currentTarget.style.background = '#0d1117' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1f2e'; e.currentTarget.style.background = '#06070a' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: item.color, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#8892b0' }}>{item.sub}</div>
            </button>
          ))}
        </div>
        <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          📂 Import JSON Backup
          <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Snapshot history */}
      {data?.snapshots?.length > 0 && (
        <div className="card" style={{ padding: 28 }}>
          <h3 className="section-heading" style={{ marginBottom: 16 }}>Snapshot History</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Date</th><th>Net Worth</th><th>Assets</th><th>Liabilities</th><th>Cash Flow</th></tr></thead>
              <tbody>
                {[...data.snapshots].reverse().map(s => (
                  <tr key={s.id}>
                    <td style={{ color: '#8892b0', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{s.date}</td>
                    <td style={{ color: '#b8820e', fontFamily: "'JetBrains Mono',monospace" }}>{formatCompact(s.netWorth, s.currency || 'INR')}</td>
                    <td style={{ color: '#16a34a', fontFamily: "'JetBrains Mono',monospace" }}>{formatCompact(s.totalAssets, s.currency || 'INR')}</td>
                    <td style={{ color: '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>{formatCompact(s.totalLiabilities, s.currency || 'INR')}</td>
                    <td style={{ color: s.cashFlow >= 0 ? '#3ecf8e' : '#f06a6a', fontFamily: "'JetBrains Mono',monospace" }}>
                      {s.cashFlow >= 0 ? '+' : ''}{formatCompact(s.cashFlow, s.currency || 'INR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Maintenance */}
      <div className="card" style={{ padding: 28 }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: '#1a1d2e', marginBottom: 8 }}>Data Maintenance</h3>
        <p style={{ fontSize: 13, color: '#8892b0', marginBottom: 20 }}>
          Fix formatting issues in your existing holdings data.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Fix Stock Name Casing */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f8f9fc', borderRadius: 10, border: '1px solid #eef0f8' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1d2e', marginBottom: 3 }}>Fix Stock Name Casing</div>
              <div style={{ fontSize: 12, color: '#8892b0' }}>
                Converts stock names like "Tata Consultancy Services Ltd" → "TATA CONSULTANCY SERVICES LTD". Keeps all holdings consistent across brokers.
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ flexShrink: 0, marginLeft: 16 }}
              onClick={fixNameCasing}>
              Fix Now
            </button>
          </div>

          {/* Fix Goal Inflation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f8f9fc', borderRadius: 10, border: '1px solid rgba(200,146,10,0.3)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1d2e', marginBottom: 3 }}>
                Apply Inflation to Goals
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: '#c8920a', background: 'rgba(200,146,10,0.1)', padding: '2px 7px', borderRadius: 20 }}>NEW</span>
              </div>
              <div style={{ fontSize: 12, color: '#8892b0' }}>
                Recalculates target amounts for existing goals using inflation (Education 10%, Home 8%, Car 6%, etc.). Skips goals already adjusted.
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ flexShrink: 0, marginLeft: 16, borderColor: '#c8920a', color: '#c8920a' }}
              onClick={fixInflation}>
              Fix Now
            </button>
          </div>

          {/* Auto-fill Missing Sectors — NEW */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f8f9fc', borderRadius: 10, border: '1px solid rgba(91,143,249,0.3)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1d2e', marginBottom: 3 }}>
                Auto-fill Missing Sectors
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: '#5b8ff9', background: 'rgba(91,143,249,0.1)', padding: '2px 7px', borderRadius: 20 }}>NEW</span>
              </div>
              <div style={{ fontSize: 12, color: '#8892b0' }}>
                Scans all equity holdings with no sector set and auto-detects the sector from the stock name (e.g. INFY → Software &amp; IT, DRREDDY → Pharmaceuticals).
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ flexShrink: 0, marginLeft: 16, borderColor: '#5b8ff9', color: '#5b8ff9' }}
              onClick={fixMissingSectors}>
              Fix Now
            </button>
          </div>

          {/* Fix Sector Casing */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f8f9fc', borderRadius: 10, border: '1px solid #eef0f8' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1d2e', marginBottom: 3 }}>Fix Sector Name Casing</div>
              <div style={{ fontSize: 12, color: '#8892b0' }}>
                Converts ALL CAPS sector names (e.g. AUTO ANCILLARY) to Title Case (Auto Ancillary) across all holdings.
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ flexShrink: 0, marginLeft: 16 }}
              onClick={fixSectorCasing}>
              Fix Now
            </button>
          </div>

          {/* Fix Asset Categories */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f8f9fc', borderRadius: 10, border: '1px solid #eef0f8' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1d2e', marginBottom: 3 }}>Fix Asset Categories</div>
              <div style={{ fontSize: 12, color: '#8892b0' }}>
                Scans all existing assets and intelligently suggests correct categories (Stocks, MF, FD, Bonds, Gold, etc.) based on the asset name. Review and apply individually.
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ flexShrink: 0, marginLeft: 16 }}
              onClick={scanCategories}>
              Scan & Fix
            </button>
          </div>
        </div>
      </div>

      {/* Category Fix Review Modal */}
      {catFixModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #eef0f8' }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'#1a1d2e', fontWeight:700, marginBottom:4 }}>
                ✨ Fix Asset Categories
              </div>
              <div style={{ fontSize:13, color:'#8892b0' }}>
                {catFixItems.length} asset{catFixItems.length !== 1 ? 's' : ''} found with potentially incorrect categories.
                Review each suggestion and select which ones to apply.
              </div>
            </div>

            {/* Asset list */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:10 }}>
              {catFixItems.map((item, idx) => (
                <div key={item.asset.id}
                  style={{ padding:'14px 16px', borderRadius:10, border:`1px solid ${item.selected ? 'rgba(200,146,10,0.3)' : '#eef0f8'}`,
                    background: item.selected ? 'rgba(200,146,10,0.04)' : '#f8f9fc', transition:'all 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    {/* Checkbox */}
                    <div onClick={() => setCatFixItems(prev => prev.map((x,i) => i===idx ? {...x, selected:!x.selected} : x))}
                      style={{ width:18, height:18, borderRadius:4, border:`2px solid ${item.selected?'#c8920a':'#d0d4e0'}`,
                        background: item.selected ? '#c8920a' : 'transparent', flexShrink:0, cursor:'pointer', marginTop:2,
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {item.selected && <span style={{ color:'#fff', fontSize:11 }}>✓</span>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Asset name */}
                      <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {item.asset.name}
                      </div>
                      {/* Category change */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, fontWeight:500, color:'#f06a6a', background:'rgba(240,106,106,0.08)',
                          padding:'3px 10px', borderRadius:20, textDecoration:'line-through' }}>
                          {item.asset.category}
                        </span>
                        <span style={{ fontSize:14, color:'#8892b0' }}>→</span>
                        {/* Override dropdown */}
                        <select
                          value={item.override}
                          onChange={e => setCatFixItems(prev => prev.map((x,i) => i===idx ? {...x, override:e.target.value} : x))}
                          style={{ fontSize:12, fontWeight:600, color:'#16a34a', background:'rgba(22,163,74,0.08)',
                            border:'1px solid rgba(22,163,74,0.25)', borderRadius:20, padding:'3px 10px', cursor:'pointer' }}>
                          {['Cash & Equivalents','Fixed Deposits','Bonds & Debentures','Mutual Funds',
                            'Stocks & Equities','PPF / EPF','NPS','Real Estate','Gold & Precious Metals',
                            'Cryptocurrency','Vehicles','Business Assets','Others'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        {item.suggested === item.override && (
                          <span style={{ fontSize:10, color:'#8892b0', fontStyle:'italic' }}>auto-detected</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding:'16px 24px', borderTop:'1px solid #eef0f8', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:12, color:'#8892b0' }}>
                {catFixItems.filter(x => x.selected).length} of {catFixItems.length} selected
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-outline" onClick={() => setCatFixModal(false)}>Cancel</button>
                <button className="btn btn-gold" onClick={applyCategoryFixes}
                  disabled={catFixItems.filter(x => x.selected).length === 0}>
                  Apply {catFixItems.filter(x => x.selected).length > 0 ? catFixItems.filter(x => x.selected).length : ''} Fix{catFixItems.filter(x => x.selected).length !== 1 ? 'es' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="card" style={{ padding: 28, borderColor: 'rgba(240,106,106,0.2)' }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: '#dc2626', marginBottom: 8 }}>Danger Zone</h3>
        <p style={{ fontSize: 13, color: '#8892b0', marginBottom: 16 }}>Reset all data back to sample. This cannot be undone.</p>
        <button className="btn btn-danger" style={{ border: '1px solid rgba(240,106,106,0.3)', padding: '9px 18px' }} onClick={handleReset}>
          Reset to Sample Data
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET ALLOCATION TAB
// Shows: current allocation by asset class, age-based target, rebalance recs
// ─────────────────────────────────────────────────────────────────────────────

// Shared asset classification — imported from assetClasses.js
// ASSET_CLASS_MAP, mfClass, ALL_CLASSES, CLASS_COLORS, getAssetClass all imported at top

// Age-based target allocation (standard Indian financial planning guidelines)
const getTargetAllocation = (age) => {
  const a = parseInt(age)||35
  // Rule: 100-age in equity (with floors/ceilings), rest in debt + others
  if (a < 30) return { Equity:70, Debt:20, 'Gold & Silver':5, Cash:3, 'Real Estate':2 }
  if (a < 35) return { Equity:65, Debt:25, 'Gold & Silver':5, Cash:3, 'Real Estate':2 }
  if (a < 40) return { Equity:60, Debt:28, 'Gold & Silver':7, Cash:3, 'Real Estate':2 }
  if (a < 45) return { Equity:55, Debt:30, 'Gold & Silver':8, Cash:4, 'Real Estate':3 }
  if (a < 50) return { Equity:50, Debt:32, 'Gold & Silver':8, Cash:5, 'Real Estate':5 }
  if (a < 55) return { Equity:45, Debt:35, 'Gold & Silver':8, Cash:7, 'Real Estate':5 }
  if (a < 60) return { Equity:40, Debt:38, 'Gold & Silver':7, Cash:8, 'Real Estate':7 }
  return        { Equity:30, Debt:42, 'Gold & Silver':8, Cash:10,'Real Estate':10 }
}

// Colors imported from assetClasses.js; add icons
const CLASS_ICONS = {
  Equity: '📈', Debt: '🏦', 'Gold & Silver': '🥇', Cash: '💵', 'Real Estate': '🏠',
}

export function AssetAllocation() {
  const { data, settings } = useFinance()
  const { session } = useAuth()

  // ── State ──────────────────────────────────────────────────────────────────
  const [showRebalance, setShowRebalance] = useState(false)
  const [age,           setAge]           = useState(35)
  const [editTarget,    setEditTarget]    = useState(false)   // edit mode toggle
  const [customTarget,  setCustomTarget]  = useState(null)    // null = use age-based
  const [draftTarget,   setDraftTarget]   = useState({})      // live edits before save

  // ── Load profile age + saved custom target ─────────────────────────────────
  useEffect(() => {
    if (!session?.userId) return
    try {
      const p = JSON.parse(localStorage.getItem(`wr_profile_${session.userId}`) || '{}')
      if (p.age) setAge(parseInt(p.age)||35)
      if (p._customAllocation) setCustomTarget(p._customAllocation)
    } catch {}
  }, [session?.userId])

  // ── Persist custom target ──────────────────────────────────────────────────
  const saveCustomTarget = (alloc) => {
    if (!session?.userId) return
    try {
      const p = JSON.parse(localStorage.getItem(`wr_profile_${session.userId}`) || '{}')
      localStorage.setItem(`wr_profile_${session.userId}`, JSON.stringify({ ...p, _customAllocation: alloc }))
    } catch {}
  }

  const resetToAgeBased = () => {
    setCustomTarget(null)
    setEditTarget(false)
    if (!session?.userId) return
    try {
      const p = JSON.parse(localStorage.getItem(`wr_profile_${session.userId}`) || '{}')
      delete p._customAllocation
      localStorage.setItem(`wr_profile_${session.userId}`, JSON.stringify(p))
    } catch {}
  }

  // ── Asset classification ───────────────────────────────────────────────────
  const assets = data?.assets || []
  const classTotals = {}
  const classAssets = {}
  ALL_CLASSES.forEach(cl => { classTotals[cl] = 0; classAssets[cl] = [] })

  assets.forEach(a => {
    if (!a.value) return
    const cl = getAssetClass(a)
    if (!cl) return
    classTotals[cl] = (classTotals[cl]||0) + (a.value||0)
    classAssets[cl].push(a)
  })

  const investedTotal = ALL_CLASSES.reduce((s,cl) => s + (classTotals[cl]||0), 0)

  const current = {}
  ALL_CLASSES.forEach(cl => {
    current[cl] = investedTotal > 0 ? Math.round((classTotals[cl]||0) / investedTotal * 100) : 0
  })

  // Active target = custom (if set) or age-based
  const ageBased  = getTargetAllocation(age)
  const target    = customTarget || ageBased
  const isCustom  = Boolean(customTarget)

  // Draft sum for validation
  const draftSum  = ALL_CLASSES.reduce((s,cl) => s + (parseInt(draftTarget[cl]??target[cl])||0), 0)
  const draftValid= draftSum === 100

  const rebalance = {}
  let rebalTotal = 0
  ALL_CLASSES.forEach(cl => {
    const diff = (target[cl]||0) - (current[cl]||0)
    rebalance[cl] = { diff, amount: Math.round(investedTotal * diff / 100) }
    if (diff > 0) rebalTotal += Math.abs(rebalance[cl].amount)
  })

  const fmt = v => {
    const abs = Math.abs(v)
    if (abs >= 1e7) return `₹${(abs/1e7).toFixed(2)}Cr`
    if (abs >= 1e5) return `₹${(abs/1e5).toFixed(1)}L`
    if (abs >= 1e3) return `₹${(abs/1e3).toFixed(0)}K`
    return `₹${abs.toLocaleString('en-IN')}`
  }

  if (assets.length === 0) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'#8892b0' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>🥧</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'#1a1d2e', marginBottom:8 }}>No assets yet</div>
      <div style={{ fontSize:13 }}>Add assets to see your allocation breakdown and rebalancing recommendations.</div>
    </div>
  )

  return (
    <div style={{ display:'grid', gap:20, maxWidth:1100, margin:'0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background:'linear-gradient(135deg,#1a1d2e,#252945)', borderRadius:16, padding:'24px 28px', color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:-30, top:-30, width:180, height:180, background:'rgba(200,146,10,0.07)', borderRadius:'50%' }}/>
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:11, letterSpacing:'0.1em', color:'#c8920a', fontWeight:600, marginBottom:4, textTransform:'uppercase' }}>Asset Allocation</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:700, marginBottom:14 }}>
            Portfolio Allocation & Rebalancing
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[
              { l:'Total Portfolio', v: fmt(investedTotal) },
              { l:'Age', v: `${age} years` },
              { l:'Equity', v:`${current.Equity||0}%`, c: Math.abs((current.Equity||0)-(target.Equity||0)) > 10 ? '#f09b46' : '#3ecf8e' },
              { l:'Debt',   v:`${current.Debt||0}%`,   c: Math.abs((current.Debt||0)-(target.Debt||0)) > 10 ? '#f09b46' : '#3ecf8e' },
              { l:'Target Mode', v: isCustom ? '✏️ Custom' : '🤖 Age-based', c: isCustom ? '#c8920a' : '#3ecf8e' },
            ].map(x => (
              <div key={x.l} style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'9px 14px' }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginBottom:2 }}>{x.l}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:700, color: x.c||'rgba(255,255,255,0.9)' }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two column: Current vs Target ─────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Current Allocation */}
        <div className="card" style={{ padding:24 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:'#1a1d2e', marginBottom:16 }}>
            📊 Current Allocation
          </div>
          <div style={{ display:'grid', gap:12 }}>
            {ALL_CLASSES.map(cl => {
              const pct = current[cl]||0
              const val = classTotals[cl]||0
              const col = CLASS_COLORS[cl]
              if (val === 0) return null
              return (
                <div key={cl}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#1a1d2e' }}>{CLASS_ICONS[cl]} {cl}</span>
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'#8892b0' }}>{fmt(val)}</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:700, color:col }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height:8, background:'#eef0f8', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:col, borderRadius:4, transition:'width 0.6s' }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Target Allocation — editable */}
        <div className="card" style={{ padding:24, border: editTarget ? '1.5px solid #c8920a' : undefined }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:'#1a1d2e' }}>
              🎯 Target Allocation
            </div>
            {!editTarget ? (
              <div style={{ display:'flex', gap:6 }}>
                {isCustom && (
                  <button className="btn btn-outline btn-sm" style={{ fontSize:10, color:'#8892b0' }}
                    onClick={resetToAgeBased} title="Reset to age-based recommendation">
                    ↺ Age-based
                  </button>
                )}
                <button className="btn btn-outline btn-sm" style={{ fontSize:11, borderColor:'#c8920a', color:'#c8920a' }}
                  onClick={() => { setDraftTarget({}); setEditTarget(true) }}>
                  ✏️ Edit
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditTarget(false)}>Cancel</button>
                <button className="btn btn-gold btn-sm"
                  disabled={!draftValid}
                  title={!draftValid ? `Total must be 100% (currently ${draftSum}%)` : ''}
                  onClick={() => {
                    const saved = {}
                    ALL_CLASSES.forEach(cl => { saved[cl] = parseInt(draftTarget[cl]??target[cl])||0 })
                    setCustomTarget(saved)
                    saveCustomTarget(saved)
                    setEditTarget(false)
                  }}>
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Mode badge */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            {isCustom ? (
              <span style={{ fontSize:11, fontWeight:600, color:'#c8920a', background:'rgba(200,146,10,0.08)', border:'1px solid rgba(200,146,10,0.2)', padding:'2px 10px', borderRadius:12 }}>
                ✏️ Custom target
              </span>
            ) : (
              <span style={{ fontSize:11, color:'#8892b0', background:'#f0f2f8', border:'1px solid #e0e4f0', padding:'2px 10px', borderRadius:12 }}>
                🤖 Age-based for {age} years — <em>recommended</em>
              </span>
            )}
            {editTarget && (
              <span style={{ fontSize:11, fontWeight:600, color: draftValid ? '#16a34a' : '#dc2626' }}>
                Total: {draftSum}% {draftValid ? '✓' : `(need 100%)`}
              </span>
            )}
          </div>

          {/* Age-based preset buttons (shown when editing) */}
          {editTarget && (
            <div style={{ marginBottom:14, padding:'10px 12px', background:'rgba(91,143,249,0.04)', border:'1px solid rgba(91,143,249,0.15)', borderRadius:10 }}>
              <div style={{ fontSize:11, color:'#5b8ff9', fontWeight:600, marginBottom:8 }}>💡 Load age-based preset:</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[25,30,35,40,45,50,55,60].map(a => (
                  <button key={a} className="btn btn-outline btn-sm" style={{ fontSize:10, padding:'3px 8px' }}
                    onClick={() => {
                      const preset = getTargetAllocation(a)
                      setDraftTarget(preset)
                    }}>
                    Age {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:'grid', gap:12 }}>
            {ALL_CLASSES.map(cl => {
              const tgt  = editTarget ? (parseInt(draftTarget[cl]??target[cl])||0) : (target[cl]||0)
              const cur_ = current[cl]||0
              const diff = tgt - cur_
              const col  = CLASS_COLORS[cl]
              return (
                <div key={cl}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#1a1d2e' }}>{CLASS_ICONS[cl]} {cl}</span>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {!editTarget && diff !== 0 && (
                        <span style={{ fontSize:11, fontWeight:600,
                          color: diff > 0 ? '#16a34a' : '#dc2626',
                          background: diff > 0 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                          padding:'1px 7px', borderRadius:10 }}>
                          {diff > 0 ? '▲' : '▼'}{Math.abs(diff)}%
                        </span>
                      )}
                      {!editTarget && diff === 0 && <span style={{ fontSize:11, color:'#16a34a' }}>✓</span>}

                      {editTarget ? (
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <button style={{ width:22, height:22, borderRadius:'50%', border:'1px solid #e0e4f0', background:'#f8f9fc', cursor:'pointer', fontSize:14, lineHeight:1, color:'#6b7494' }}
                            onClick={() => setDraftTarget(p => ({ ...p, [cl]: Math.max(0, (parseInt(p[cl]??target[cl])||0) - 1) }))}>−</button>
                          <input type="number" min="0" max="100"
                            value={draftTarget[cl] !== undefined ? draftTarget[cl] : target[cl]}
                            onChange={e => setDraftTarget(p => ({ ...p, [cl]: e.target.value }))}
                            style={{ width:46, textAlign:'center', fontFamily:"'JetBrains Mono',monospace", fontSize:14,
                              fontWeight:700, color:col, border:'1px solid #e0e4f0', borderRadius:6, padding:'2px 4px' }} />
                          <span style={{ fontSize:12, color:'#8892b0' }}>%</span>
                          <button style={{ width:22, height:22, borderRadius:'50%', border:'1px solid #e0e4f0', background:'#f8f9fc', cursor:'pointer', fontSize:14, lineHeight:1, color:'#6b7494' }}
                            onClick={() => setDraftTarget(p => ({ ...p, [cl]: Math.min(100, (parseInt(p[cl]??target[cl])||0) + 1) }))}>+</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:700, color:col }}>{tgt}%</span>
                      )}
                    </div>
                  </div>
                  <div style={{ height:8, background:'#eef0f8', borderRadius:4, overflow:'hidden', position:'relative' }}>
                    <div style={{ position:'absolute', height:'100%', width:`${cur_}%`, background:col, opacity:0.35, borderRadius:4 }}/>
                    <div style={{ position:'absolute', height:'100%', width:`${tgt}%`, border:`2px solid ${col}`, borderRadius:4, boxSizing:'border-box' }}/>
                  </div>
                  <div style={{ display:'flex', gap:12, marginTop:3, fontSize:10, color:'#b0b8d0' }}>
                    <span>Current: {cur_}%</span>
                    <span>Target: {tgt}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Rebalancing Recommendations ────────────────────────────────────── */}
      <div className="card" style={{ padding:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:'#1a1d2e', marginBottom:2 }}>
              ⚖️ Rebalancing Recommendations
            </div>
            <div style={{ fontSize:12, color:'#8892b0' }}>
              Based on {isCustom ? 'your custom' : `age-${age}`} target allocation
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setShowRebalance(p=>!p)}>
            {showRebalance ? 'Hide Holdings' : 'Show Holdings'}
          </button>
        </div>

        <div style={{ display:'grid', gap:10 }}>
          {ALL_CLASSES.map(cl => {
            const { diff, amount } = rebalance[cl]
            const tgt  = target[cl]||0
            const cur_ = current[cl]||0
            const col  = CLASS_COLORS[cl]
            const isOnTarget = Math.abs(diff) <= 2
            const action = diff > 5 ? 'Increase' : diff < -5 ? 'Reduce' : 'Balanced'

            return (
              <div key={cl} style={{ padding:'14px 16px', borderRadius:10, border:'1px solid #eef0f8',
                background: isOnTarget ? 'rgba(22,163,74,0.03)' : diff > 5 ? 'rgba(91,143,249,0.03)' : 'rgba(220,38,38,0.03)',
                borderLeft:`3px solid ${isOnTarget ? '#16a34a' : col}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18 }}>{CLASS_ICONS[cl]}</span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e' }}>{cl}</div>
                      <div style={{ fontSize:11, color:'#8892b0', marginTop:2 }}>
                        Current {cur_}% → Target {tgt}%
                        {!isOnTarget && <span style={{ marginLeft:8, color: diff>0?'#5b8ff9':'#f06a6a' }}>({diff>0?'+':''}{diff}%)</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {isOnTarget ? (
                      <span style={{ fontSize:12, fontWeight:600, color:'#16a34a', background:'rgba(22,163,74,0.08)', padding:'4px 12px', borderRadius:20 }}>✓ On Target</span>
                    ) : (
                      <div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:15, fontWeight:700, color: diff>0?'#16a34a':'#dc2626' }}>
                          {diff>0?'+':''}{fmt(amount)}
                        </div>
                        <div style={{ fontSize:11, color:'#8892b0', marginTop:2 }}>
                          {action === 'Increase' ? '↑ Invest more' : '↓ Reduce / hold'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {showRebalance && classAssets[cl]?.length > 0 && (() => {
                  // For Equity class: split into direct stocks vs everything else (MFs, NPS, Crypto)
                  const directStocks = cl === 'Equity' ? classAssets[cl].filter(a => a.category === 'Stocks & Equities') : []
                  const otherEquity  = cl === 'Equity' ? classAssets[cl].filter(a => a.category !== 'Stocks & Equities') : classAssets[cl]
                  const stockTotal   = directStocks.reduce((s,a) => s+(a.value||0), 0)

                  return (
                    <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid #eef0f8' }}>
                      <div style={{ fontSize:10, fontWeight:600, color:'#8892b0', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Holdings</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>

                        {/* Direct stocks — show as single summary row */}
                        {directStocks.length > 0 && (
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'6px 10px', background:'rgba(91,143,249,0.05)', borderRadius:7, border:'1px solid rgba(91,143,249,0.12)' }}>
                            <span style={{ color:'#5b8ff9', fontWeight:600 }}>
                              📈 Direct Stocks ({directStocks.length} holdings)
                            </span>
                            <span style={{ fontFamily:"'JetBrains Mono',monospace", color:'#1a1d2e', fontWeight:600 }}>
                              {fmt(stockTotal)} <span style={{ color:'#b0b8d0' }}>({investedTotal>0?Math.round(stockTotal/investedTotal*100):0}%)</span>
                            </span>
                          </div>
                        )}

                        {/* All other assets (MFs, NPS, Crypto, Gold, Debt, etc.) — show full list */}
                        {otherEquity.map((a,i) => (
                          <div key={a.id||i} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                            <span style={{ color:'#6b7494', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }}>{a.name}</span>
                            <span style={{ fontFamily:"'JetBrains Mono',monospace", color:'#1a1d2e', fontWeight:500 }}>
                              {fmt(a.value)} <span style={{ color:'#b0b8d0' }}>({investedTotal>0?Math.round(a.value/investedTotal*100):0}%)</span>
                            </span>
                          </div>
                        ))}

                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>

        {rebalTotal > 0 && (
          <div style={{ marginTop:16, padding:'14px 18px', background:'rgba(200,146,10,0.06)', border:'1px solid rgba(200,146,10,0.2)', borderRadius:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e', marginBottom:6 }}>📋 Action Plan</div>
            <div style={{ fontSize:12, color:'#6b7494', lineHeight:1.9 }}>
              {ALL_CLASSES.filter(cl => rebalance[cl].diff > 5).map(cl => (
                <div key={cl}>• <strong>Increase {cl}</strong> by ~{fmt(rebalance[cl].amount)} — invest in {
                  cl==='Equity'?'index funds, direct stocks' :
                  cl==='Debt'?'PPF, FDs, debt mutual funds' :
                  cl==='Gold & Silver'?'gold ETF, SGB, silver ETF' :
                  cl==='Cash'?'liquid fund, savings account' :
                  'real estate or REITs'
                }</div>
              ))}
              {ALL_CLASSES.filter(cl => rebalance[cl].diff < -5).map(cl => (
                <div key={cl}>• <strong>Reduce {cl}</strong> by ~{fmt(Math.abs(rebalance[cl].amount))} — pause new investments, redirect to underweight classes</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Classification Legend ───────────────────────────────────────────── */}
      <div className="card" style={{ padding:20 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e', marginBottom:12 }}>📖 How assets are classified</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8, fontSize:12, color:'#6b7494' }}>
          {[
            { cl:'Equity',        items:'Direct Stocks, Equity MFs, NPS, Crypto' },
            { cl:'Debt',          items:'FD, PPF, EPF, SSA, Bonds, Debt MFs' },
            { cl:'Gold & Silver', items:'Gold ETF, SGB, Silver ETF, Physical' },
            { cl:'Cash',          items:'Savings account, Liquid fund, Cash' },
            { cl:'Real Estate',   items:'Property, Land, REITs' },
          ].map(x => (
            <div key={x.cl} style={{ padding:'8px 12px', background:'#f8f9fc', borderRadius:8, borderLeft:`3px solid ${CLASS_COLORS[x.cl]}` }}>
              <div style={{ fontWeight:600, color:'#1a1d2e', marginBottom:2 }}>{CLASS_ICONS[x.cl]} {x.cl}</div>
              <div style={{ fontSize:11 }}>{x.items}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, fontSize:11, color:'#b0b8d0' }}>
          * Mutual Funds classified as Equity or Debt based on fund category in the sector field.
        </div>
      </div>

    </div>
  )
}
