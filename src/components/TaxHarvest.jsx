import { useState, useMemo } from 'react'
import { useFinance } from '../context/FinanceContext'

const FY_END = new Date('2026-03-31')
const DAYS_LEFT = Math.max(0, Math.ceil((FY_END - new Date()) / (1000 * 60 * 60 * 24)))

// Tax rates India FY2025-26
const STCG_RATE = 0.20   // Short-term capital gains (< 12 months)
const LTCG_RATE = 0.125  // Long-term capital gains (> 12 months)
const LTCG_EXEMPT = 125000 // ₹1.25L LTCG exemption

function fmt(n) {
  if (!n || isNaN(n)) return '—'
  const v = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (v >= 1e7) return `${sign}₹${(v/1e7).toFixed(2)}Cr`
  if (v >= 1e5) return `${sign}₹${(v/1e5).toFixed(1)}L`
  return `${sign}₹${Math.round(v).toLocaleString('en-IN')}`
}

function fmtPlain(n) {
  if (!n || isNaN(n)) return '—'
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`
}

export function TaxHarvest() {
  const { data } = useFinance()
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [taxType, setTaxType] = useState('stcg')   // stcg | ltcg
  const [showAll, setShowAll] = useState(false)
  const [sortBy, setSortBy] = useState('lossAbs')

  // Only equity/stock assets with invested value and a loss
  const allAssets = useMemo(() => (data?.assets || []).filter(a => !a._isMF), [data?.assets])

  const losers = useMemo(() => {
    return allAssets
      .filter(a => {
        const invested = a._investedValue || 0
        const present  = a.value || 0
        return invested > 0 && present > 0 && present < invested
      })
      .map(a => {
        const loss    = a.value - (a._investedValue || 0)
        const lossP   = ((a.value - a._investedValue) / a._investedValue) * 100
        const taxSave = Math.abs(loss) * (taxType === 'stcg' ? STCG_RATE : LTCG_RATE)
        return { ...a, loss, lossP, taxSave }
      })
      .sort((a, b) => {
        if (sortBy === 'lossAbs')  return a.loss - b.loss
        if (sortBy === 'lossPct')  return a.lossP - b.lossP
        if (sortBy === 'taxSave')  return b.taxSave - a.taxSave
        return a.loss - b.loss
      })
  }, [allAssets, taxType, sortBy])

  const gainers = useMemo(() => allAssets.filter(a => {
    const inv = a._investedValue || 0
    return inv > 0 && a.value > inv
  }), [allAssets])

  const totalLoss   = useMemo(() => losers.reduce((s, a) => s + a.loss, 0), [losers])
  const totalGain   = useMemo(() => gainers.reduce((s, a) => s + (a.value - (a._investedValue||0)), 0), [gainers])
  const totalTaxSave= useMemo(() => losers.reduce((s, a) => s + a.taxSave, 0), [losers])

  const selectedLoss    = useMemo(() => losers.filter(a => selectedIds.has(a.id)).reduce((s,a) => s+a.loss, 0), [losers, selectedIds])
  const selectedTaxSave = useMemo(() => losers.filter(a => selectedIds.has(a.id)).reduce((s,a) => s+a.taxSave, 0), [losers, selectedIds])

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const selectAll  = () => setSelectedIds(new Set(losers.map(a => a.id)))
  const clearAll   = () => setSelectedIds(new Set())

  const priorityLabel = (lossP) => {
    if (lossP < -40) return { label: 'P1 — Exit now',     color: '#dc2626', bg: 'rgba(220,38,38,0.08)' }
    if (lossP < -20) return { label: 'P2 — Harvest',      color: '#d97706', bg: 'rgba(217,119,6,0.08)' }
    if (lossP < -10) return { label: 'P3 — Consider',     color: '#c8920a', bg: 'rgba(200,146,10,0.08)' }
    return               { label: 'P4 — Minor loss',       color: '#8892b0', bg: 'rgba(136,146,176,0.08)' }
  }

  const rebuyAdvice = (name) => {
    const n = name.toUpperCase()
    if (n.includes('ITCHOTELS'))  return 'No — weak fundamentals post-demerger'
    if (n.includes('SPANDHAN') || n.includes('SPHOOR')) return 'No — MFI sector under stress'
    if (n.includes('ASHOKA'))     return 'Optional — infra theme, wait 30 days'
    if (n.includes('TCS') || n.includes('CONSULTANCY')) return 'Yes — quality stock, rebuy after 30 days'
    if (n.includes('ITC') && !n.includes('HOTEL')) return 'Yes — rebuy after 30 days'
    if (n.includes('TMPV') || n.includes('TATA MOTORS')) return 'Yes — after 30 days if bullish'
    if (n.includes('WIPRO'))      return 'Optional — IT sector recovery unclear'
    if (n.includes('INFY') || n.includes('INFOSYS')) return 'Yes — quality stock, rebuy after 30 days'
    if (n.includes('RECLTD') || n.includes('REC ')) return 'Optional — switch to PFC instead'
    if (n.includes('PGINVIT'))    return 'Optional — wait for rate cycle clarity'
    return 'Optional — wait 30 days before rebuying'
  }

  const visible = showAll ? losers : losers.slice(0, 12)

  return (
    <div style={{ display:'grid', gap:20, maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1a1d2e,#252945)', borderRadius:16, padding:'28px 32px', color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:-20, top:-20, width:180, height:180, background:'rgba(200,146,10,0.07)', borderRadius:'50%' }}/>
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:11, letterSpacing:'0.1em', color:'#c8920a', fontWeight:600, marginBottom:6, textTransform:'uppercase' }}>FY 2025–26</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, marginBottom:6 }}>Tax Loss Harvesting</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginBottom:20 }}>
            Sell loss-making holdings before 31 March 2026 to offset gains and reduce your tax liability.
          </div>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
            {[
              { l:'Days to 31 Mar', v: DAYS_LEFT, c: DAYS_LEFT < 15 ? '#f06a6a' : DAYS_LEFT < 30 ? '#f09b46' : '#3ecf8e' },
              { l:'Total Unrealised Loss', v: fmt(totalLoss), c:'#f06a6a' },
              { l:'Total Unrealised Gain', v: fmt(totalGain), c:'#3ecf8e' },
              { l:'Max Tax Saving', v: fmt(-totalTaxSave), c:'#c8920a' },
            ].map(x => (
              <div key={x.l} style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 16px' }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginBottom:2 }}>{x.l}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, fontWeight:700, color:x.c }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tax rule info */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {[
          { label:'Short-Term Capital Gains (STCG)', sub:'Held < 12 months', rate:'20%', color:'#dc2626', note:'Higher rate — most urgent to harvest' },
          { label:'Long-Term Capital Gains (LTCG)',  sub:'Held > 12 months', rate:'12.5%', color:'#d97706', note:'₹1.25L exemption per year' },
        ].map(x => (
          <div key={x.label} style={{ background:'#f8f9fc', borderRadius:12, padding:'14px 18px', border:'1px solid #eef0f8' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>{x.label}</div>
                <div style={{ fontSize:11, color:'#8892b0' }}>{x.sub}</div>
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:20, fontWeight:700, color:x.color }}>{x.rate}</div>
            </div>
            <div style={{ fontSize:11, color:'#8892b0', marginTop:4 }}>{x.note}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="card" style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'#6b7494', fontWeight:500 }}>Tax type:</span>
          {[{v:'stcg',l:'STCG (20%)'},{v:'ltcg',l:'LTCG (12.5%)'}].map(o => (
            <button key={o.v} onClick={() => setTaxType(o.v)}
              style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer',
                background: taxType===o.v ? '#c8920a' : '#f0f2f8',
                color:      taxType===o.v ? '#fff'    : '#6b7494',
                border:     taxType===o.v ? 'none'    : '1px solid #e0e4f0' }}>
              {o.l}
            </button>
          ))}
          <span style={{ fontSize:12, color:'#6b7494', fontWeight:500, marginLeft:8 }}>Sort:</span>
          <select style={{ padding:'5px 10px', borderRadius:8, fontSize:12, border:'1px solid #e0e4f0', color:'#4a4f6a', background:'#f8f9fc' }}
            value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="lossAbs">Biggest loss (₹)</option>
            <option value="lossPct">Biggest loss (%)</option>
            <option value="taxSave">Most tax saved</option>
          </select>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={selectAll} style={{ padding:'5px 12px', borderRadius:8, fontSize:12, cursor:'pointer', background:'rgba(200,146,10,0.08)', color:'#c8920a', border:'1px solid rgba(200,146,10,0.25)', fontFamily:"'Outfit',sans-serif" }}>
            Select All
          </button>
          <button onClick={clearAll} style={{ padding:'5px 12px', borderRadius:8, fontSize:12, cursor:'pointer', background:'#f0f2f8', color:'#6b7494', border:'1px solid #e0e4f0', fontFamily:"'Outfit',sans-serif" }}>
            Clear
          </button>
        </div>
      </div>

      {/* Selected summary bar */}
      {selectedIds.size > 0 && (
        <div style={{ background:'rgba(200,146,10,0.07)', border:'1.5px solid rgba(200,146,10,0.3)', borderRadius:12, padding:'14px 20px',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', gap:20 }}>
            <div>
              <div style={{ fontSize:11, color:'#8892b0' }}>Selected holdings</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, fontWeight:700, color:'#1a1d2e' }}>{selectedIds.size}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#8892b0' }}>Total loss to harvest</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, fontWeight:700, color:'#f06a6a' }}>{fmt(selectedLoss)}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#8892b0' }}>Estimated tax saving</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, fontWeight:700, color:'#c8920a' }}>~{fmt(-selectedTaxSave)}</div>
            </div>
          </div>
          <div style={{ fontSize:12, color:'#92700a', fontStyle:'italic' }}>
            Ensure trades settle before 31 Mar 2026. Wait 30 days before rebuying.
          </div>
        </div>
      )}

      {/* Loss-making holdings table */}
      {losers.length === 0 ? (
        <div className="card" style={{ padding:40, textAlign:'center', color:'#b0b8d0' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🎉</div>
          <div style={{ fontSize:16, fontWeight:600, color:'#1a1d2e' }}>No loss-making holdings found</div>
          <div style={{ fontSize:13, marginTop:6 }}>All your holdings are currently in profit. Import your holdings to see analysis.</div>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #eef0f8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'#1a1d2e', fontWeight:700 }}>
              Loss-making Holdings — {losers.length} stocks
            </div>
            <span style={{ fontSize:12, color:'#8892b0' }}>Click rows to select for harvest</span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8f9fc', borderBottom:'1px solid #eef0f8' }}>
                  {['','NAME','BROKER','QTY','LOSS ₹','LOSS %','TAX SAVED','PRIORITY','REBUY?'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign: h===''||h==='QTY'||h==='LOSS ₹'||h==='LOSS %'||h==='TAX SAVED' ? 'right' : 'left',
                      fontSize:11, fontWeight:600, color:'#8892b0', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(a => {
                  const prio    = priorityLabel(a.lossP)
                  const checked = selectedIds.has(a.id)
                  return (
                    <tr key={a.id} onClick={() => toggleSelect(a.id)}
                      style={{ borderBottom:'1px solid #f4f5fb', cursor:'pointer', transition:'background 0.1s',
                        background: checked ? 'rgba(200,146,10,0.05)' : 'transparent' }}>
                      <td style={{ padding:'12px 14px', textAlign:'center' }}>
                        <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${checked?'#c8920a':'#d0d4e0'}`,
                          background: checked ? '#c8920a' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {checked && <span style={{ color:'#fff', fontSize:10, lineHeight:1 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ fontWeight:600, color:'#1a1d2e', fontSize:13 }}>{a.name}</div>
                        {a._sector||a.note ? <div style={{ fontSize:11, color:'#8892b0', marginTop:1 }}>{a._sector||a.note}</div> : null}
                      </td>
                      <td style={{ padding:'12px 14px', color:'#6b7494', fontSize:12 }}>{a.institution||'—'}</td>
                      <td style={{ padding:'12px 14px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", color:'#4a4f6a' }}>{a._qty>0?a._qty:a.qty||'—'}</td>
                      <td style={{ padding:'12px 14px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", color:'#f06a6a', fontWeight:600 }}>{fmt(a.loss)}</td>
                      <td style={{ padding:'12px 14px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace' " }}>
                        <span style={{ color:'#f06a6a', fontWeight:600 }}>{a.lossP.toFixed(2)}%</span>
                      </td>
                      <td style={{ padding:'12px 14px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", color:'#c8920a', fontWeight:600 }}>
                        ~{fmt(-a.taxSave)}
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <span style={{ fontSize:11, fontWeight:600, color:prio.color, background:prio.bg, padding:'3px 8px', borderRadius:20, whiteSpace:'nowrap' }}>
                          {prio.label}
                        </span>
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:11, color:'#6b7494', maxWidth:160 }}>
                        {rebuyAdvice(a.name)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:'#f8f9fc', borderTop:'2px solid #eef0f8' }}>
                  <td colSpan={4} style={{ padding:'12px 14px', fontWeight:600, color:'#1a1d2e', fontSize:13 }}>
                    Total ({losers.length} holdings)
                  </td>
                  <td style={{ padding:'12px 14px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", color:'#f06a6a', fontWeight:700, fontSize:14 }}>
                    {fmt(totalLoss)}
                  </td>
                  <td/>
                  <td style={{ padding:'12px 14px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", color:'#c8920a', fontWeight:700, fontSize:14 }}>
                    ~{fmt(-totalTaxSave)}
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
          {losers.length > 12 && (
            <div style={{ padding:'12px 20px', borderTop:'1px solid #eef0f8', textAlign:'center' }}>
              <button onClick={() => setShowAll(v => !v)}
                style={{ fontSize:12, color:'#c8920a', background:'none', border:'none', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                {showAll ? '▲ Show less' : `▼ Show all ${losers.length} holdings`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Gain-making holdings (to understand offset context) */}
      {gainers.length > 0 && (
        <div className="card" style={{ padding:24 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'#1a1d2e', fontWeight:700, marginBottom:4 }}>
            Gain-making Holdings — {gainers.length} stocks
          </div>
          <div style={{ fontSize:12, color:'#8892b0', marginBottom:16 }}>
            Harvested losses will offset these gains, reducing your taxable capital gains.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
            {gainers.sort((a,b) => (b.value-(b._investedValue||0)) - (a.value-(a._investedValue||0))).map(a => {
              const gain  = a.value - (a._investedValue||0)
              const gainP = ((a.value - a._investedValue) / a._investedValue) * 100
              const tax   = gain * (taxType==='stcg' ? STCG_RATE : LTCG_RATE)
              return (
                <div key={a.id} style={{ background:'#f8f9fc', borderRadius:10, padding:'12px 14px', border:'1px solid #eef0f8',
                  borderLeft:'3px solid rgba(22,163,74,0.5)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>{a.name}</div>
                    <span style={{ fontSize:12, fontWeight:700, color:'#16a34a', fontFamily:"'JetBrains Mono',monospace" }}>+{gainP.toFixed(1)}%</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6b7494' }}>
                    <span>Gain: <strong style={{color:'#16a34a'}}>{fmt(gain)}</strong></span>
                    <span>Tax: <strong style={{color:'#d97706'}}>~{fmt(-tax)}</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop:16, padding:'12px 16px', background:'rgba(22,163,74,0.05)', borderRadius:10, border:'1px solid rgba(22,163,74,0.15)', fontSize:12, color:'#166534', lineHeight:1.7 }}>
            <strong>💡 Offset calculation:</strong> If you harvest <strong>{fmt(Math.abs(selectedLoss) || Math.abs(totalLoss))}</strong> in losses,
            it will offset that amount from your <strong>{fmt(totalGain)}</strong> in gains,
            saving approximately <strong>~{fmt(selectedIds.size > 0 ? selectedTaxSave : totalTaxSave)}</strong> in {taxType.toUpperCase()} taxes.
            {totalGain + totalLoss > LTCG_EXEMPT && taxType === 'ltcg' && (
              <span> Note: First ₹1.25L of LTCG is exempt — you've exceeded this threshold.</span>
            )}
          </div>
        </div>
      )}

      {/* Important notes */}
      <div className="card" style={{ padding:24 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'#1a1d2e', fontWeight:700, marginBottom:16 }}>
          📋 Important Rules & Disclaimers
        </div>
        <div style={{ display:'grid', gap:10 }}>
          {[
            { icon:'📅', title:'Settlement deadline', body:'T+1 settlement in India. Place sell orders by 28 March 2026 to ensure settlement by 31 March 2026.' },
            { icon:'🔄', title:'30-day waiting period', body:'India has no formal wash-sale rule, but it\'s advisable to wait 30 days before rebuying the same stock to avoid SEBI scrutiny and truly realise the loss.' },
            { icon:'⚖️', title:'Loss carry-forward', body:'Harvested losses can be carried forward for 8 years and set off against future capital gains if not fully offset this year.' },
            { icon:'📊', title:'STCG vs LTCG', body:'Check your holding period per stock in your broker app. STCG (< 12 months) is taxed at 20%, LTCG (> 12 months) at 12.5% with ₹1.25L exemption.' },
            { icon:'🏦', title:'Different brokers', body:'Losses and gains across all brokers (Zerodha, ICICI Direct, INDMoney) can be offset against each other in your ITR filing.' },
            { icon:'⚠️', title:'Disclaimer', body:'This is for informational purposes only. Consult a SEBI-registered tax advisor or CA before making investment decisions. Tax laws may change.' },
          ].map((n, i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'12px 14px', background:'#f8f9fc', borderRadius:10, border:'1px solid #eef0f8' }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{n.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e', marginBottom:2 }}>{n.title}</div>
                <div style={{ fontSize:12, color:'#6b7494', lineHeight:1.6 }}>{n.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
