import { useState, useCallback } from 'react'
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
import { PALETTE, MILESTONES } from '../utils/constants'
import { groupBy, formatCurrency, formatCompact } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'
import { CURRENCIES } from '../utils/constants'

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
  const assetPie    = Object.entries(assetGroups).map(([k, v], i) => ({
    name: k, value: v.reduce((s, x) => s + x.value, 0), color: PALETTE[i % PALETTE.length],
  }))

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <StatCard label="Net Worth"        value={fmt(netWorth)}          sub={`${data.assets.length} assets · ${data.liabilities.length} liabilities`} color="#e8c060"  change={nwChange} icon="⬡" delay={0}   />
        <StatCard label="Total Assets"     value={fmt(totalAssets)}       sub={`${Object.keys(assetGroups).length} categories`}      color="#3ecf8e" icon="△" delay={60}  />
        <StatCard label="Total Liabilities"value={fmt(totalLiabilities)}  sub={`Debt ratio ${totals.debtRatio?.toFixed(1)}%`}        color="#f06a6a" icon="▽" delay={120} />
        <StatCard label="Monthly Cash Flow"value={fmt(cashFlow)}          sub={`${savingsRate?.toFixed(1)}% savings rate`}            color={cashFlow >= 0 ? '#3ecf8e' : '#f06a6a'} icon="⇄" delay={180} />
      </div>

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
              {assetPie.filter(s => s.value > 0).slice(0, 6).map(s => (
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
            { label:'🟡 Zerodha',    broker:'zerodha' },
            { label:'🟢 Groww',      broker:'groww' },
            { label:'🔵 MF Central', broker:'mfcentral' },
            { label:'🟣 Kuvera',     broker:'kuvera' },
            { label:'🏛️ NSDL/CDSL',  broker:'nsdl' },
            { label:'🏦 Bank',       broker:'bank' },
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

      {/* Asset groups */}
      {Object.entries(groups).map(([cat, items]) => {
        const catTotal = items.reduce((s, x) => s + x.value, 0)
        return (
          <div key={cat} className="card" style={{ marginBottom:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #eef0f8', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8f9fc' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span className="tag tag-asset">{cat}</span>
                <span style={{ fontSize:12, color:'#8892b0' }}>{items.length} holding{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <span style={{ fontSize:12, color:'#8892b0' }}>{totalAssets > 0 ? ((catTotal/totalAssets)*100).toFixed(1) : 0}%</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, color:'#16a34a' }}>{fmt(catTotal)}</span>
              </div>
            </div>
            <DataTable currency={cur}
              cols={[
                { key:'name', label:'Name' },
                { key:'institution', label:'Source',
                  render: r => (
                    <span style={{ color:'#8892b0', fontSize:12 }}>
                      {r.institution ? `${BROKER_ICONS[r.institution] || ''}  ${r.institution}` : '—'}
                    </span>
                  )},
                { key:'value', label:'Value', right:true, mono:true,
                  render:(r,c) => <span style={{ color:'#e8c060' }}>{formatCurrency(r.value, c)}</span> },
                { key:'alloc', label:'Allocation', right:true,
                  render: r => (
                    <div style={{ minWidth:80 }}>
                      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:3 }}>
                        <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:'#8892b0' }}>
                          {totalAssets > 0 ? ((r.value/totalAssets)*100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <ProgressBar pct={totalAssets > 0 ? (r.value/totalAssets)*100 : 0} color="#c8953a" height={3} />
                    </div>
                  )},
                { key:'note', label:'Note', color:() => '#6b7494' },
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
          onImported={(count) => {
            setImportModal(false)
            setImportToast(count)
            setTimeout(() => setImportToast(null), 3500)
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
          Successfully imported <strong style={{ color:'#16a34a' }}>{importToast} assets</strong>
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

  const { totalAssets, fiPct, fiNumber, monthlyInterest, avgNW, maxNW, savingsRate, debtRatio, emergencyMonths } = totals

  const assetPie = Object.entries(groupBy(data?.assets || [], 'category')).map(([k, v], i) => ({
    name: k, value: v.reduce((s, x) => s + x.value, 0), color: PALETTE[i % PALETTE.length], fill: PALETTE[i % PALETTE.length],
  }))

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
              data={assetPie.filter(s => s.value > 0).slice(0, 6)}>
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
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-heading" style={{ marginBottom: 16 }}>Top Asset Holdings</h3>
          {[...( data?.assets || [])].sort((a, b) => b.value - a.value).slice(0, 6).map((a, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: '#b0b8d0', width: 22 }}>#{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#4a4f6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{a.name}</span>
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: '#b8820e', flexShrink: 0, marginLeft: 8 }}>{fmts(a.value)}</span>
                </div>
                <ProgressBar pct={totalAssets > 0 ? (a.value / totalAssets) * 100 : 0} color={PALETTE[i]} height={3} />
              </div>
            </div>
          ))}
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
  const { data, settings, persistSettings, exportJSON, exportCSV, takeSnapshot, importJSON, resetToSample } = useFinance()
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
