import { useState, useRef } from 'react'
import { Modal } from './UI'
import { uid } from '../utils/helpers'
import { ASSET_CATS } from '../utils/constants'
import { useFinance } from '../context/FinanceContext'

// ─── Per-broker CSV templates & column mappings ───────────────────────────────
const BROKERS = {
  zerodha: {
    label: 'Zerodha',
    logo: '🟡',
    category: 'Stocks & Equities',
    institution: 'Zerodha',
    downloadUrl: 'https://console.zerodha.com/portfolio/holdings',
    instructions: 'Console → Portfolio → Holdings → Download ⬇',
    columns: { name: ['instrument','stock name','tradingsymbol','symbol'], value: ['cur. val','current value','ltp','last price','close price'] },
    sampleRows: [
      ['Instrument', 'Qty', 'Avg. cost', 'LTP', 'Cur. val', 'P&L'],
      ['RELIANCE', '10', '2450.00', '2610.00', '26100.00', '1600.00'],
      ['TCS', '5', '3200.00', '3580.00', '17900.00', '1900.00'],
      ['INFY', '15', '1420.00', '1510.00', '22650.00', '1350.00'],
    ],
  },
  groww: {
    label: 'Groww',
    logo: '🟢',
    category: 'Stocks & Equities',
    institution: 'Groww',
    downloadUrl: 'https://groww.in/stocks/portfolio',
    instructions: 'Stocks → Portfolio → Download ⬇ (CSV)',
    columns: { name: ['stock','name','scrip'], value: ['current value','market value','ltp'] },
    sampleRows: [
      ['Stock', 'Qty', 'Avg Buy Price', 'LTP', 'Current Value', 'P&L'],
      ['HDFC Bank', '20', '1580.00', '1650.00', '33000.00', '1400.00'],
      ['Wipro', '30', '420.00', '445.00', '13350.00', '750.00'],
    ],
  },
  mfcentral: {
    label: 'MF Central / CAMS',
    logo: '🔵',
    category: 'Mutual Funds',
    institution: 'MF Central',
    downloadUrl: 'https://www.mfcentral.com',
    instructions: 'Log in → My Portfolio → Download Statement (Excel/CSV)',
    columns: { name: ['scheme name','fund name','scheme'], value: ['current value','market value','nav value','valuation'] },
    sampleRows: [
      ['Scheme Name', 'Units', 'NAV', 'Current Value'],
      ['Mirae Asset Large Cap Fund', '250.50', '98.45', '24673.73'],
      ['Axis Bluechip Fund', '180.20', '52.30', '9428.46'],
      ['SBI Small Cap Fund', '320.75', '125.60', '40286.20'],
    ],
  },
  kuvera: {
    label: 'Kuvera',
    logo: '🟣',
    category: 'Mutual Funds',
    institution: 'Kuvera',
    downloadUrl: 'https://kuvera.in/reports',
    instructions: 'Reports → Portfolio Valuation → Export CSV',
    columns: { name: ['fund name','scheme name','name'], value: ['current value','valuation','market value'] },
    sampleRows: [
      ['Fund Name', 'Units', 'NAV', 'Current Value', 'Gain/Loss'],
      ['Parag Parikh Flexi Cap', '150.00', '68.20', '10230.00', '1230.00'],
      ['HDFC Mid-Cap Opportunities', '200.00', '115.40', '23080.00', '3080.00'],
    ],
  },
  nsdl: {
    label: 'NSDL / CDSL (Demat)',
    logo: '🏛️',
    category: 'Stocks & Equities',
    institution: 'NSDL/CDSL',
    downloadUrl: 'https://eservices.nsdl.com',
    instructions: 'e-Services → Holdings → Download Statement',
    columns: { name: ['company name','security name','issuer name'], value: ['market value','current value','valuation'] },
    sampleRows: [
      ['ISIN', 'Company Name', 'Quantity', 'Market Value'],
      ['INE002A01018', 'Reliance Industries Ltd', '10', '26100.00'],
      ['INE467B01029', 'TCS Ltd', '5', '17900.00'],
    ],
  },
  epfo: {
    label: 'EPFO / UAN Portal',
    logo: '🏢',
    category: 'PPF / EPF',
    institution: 'EPFO',
    downloadUrl: 'https://passbook.epfindia.gov.in',
    instructions: 'UAN Portal → Passbook → Download PDF → use manual entry below',
    columns: { name: ['description','particulars'], value: ['balance','closing balance','amount'] },
    sampleRows: [
      ['Month', 'Employee Share', 'Employer Share', 'Closing Balance'],
      ['Mar 2024', '2400', '1843', '485000'],
    ],
    manualOnly: true,
  },
  bank: {
    label: 'Bank (Savings / FD)',
    logo: '🏦',
    category: 'Cash & Equivalents',
    institution: '',
    downloadUrl: '',
    instructions: 'Net Banking → Accounts → Download Statement (CSV)',
    columns: { name: ['description','narration','particulars'], value: ['balance','closing balance','available balance'] },
    sampleRows: [
      ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
      ['01/04/2024', 'Opening Balance', '', '', '180000.00'],
      ['15/04/2024', 'Salary Credit', '', '95000', '275000.00'],
    ],
  },
  generic: {
    label: 'Generic CSV / Excel',
    logo: '📄',
    category: '',
    institution: '',
    downloadUrl: '',
    instructions: 'Any CSV with at least a Name column and Value column',
    columns: { name: ['name','asset','stock','fund','description'], value: ['value','amount','current value','market value','balance'] },
    sampleRows: [
      ['Name', 'Category', 'Value', 'Institution', 'Note'],
      ['Gold ETF', 'Gold & Precious Metals', '85000', 'Zerodha', ''],
      ['PPF Account', 'PPF / EPF', '320000', 'SBI', 'FY2024'],
    ],
  },
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  return lines.map(line => {
    const cells = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    cells.push(cur.trim())
    return cells
  })
}

function findCol(headers, candidates) {
  const h = headers.map(x => (x || '').toLowerCase().trim())
  for (const c of candidates) {
    const idx = h.findIndex(x => x.includes(c.toLowerCase()))
    if (idx !== -1) return idx
  }
  return -1
}

function parseValue(str) {
  if (!str) return 0
  const n = parseFloat(str.toString().replace(/[₹$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ImportModal({ onClose, onImported }) {
  const { addItem } = useFinance()
  const [step,         setStep]         = useState('broker')   // broker | preview | done
  const [broker,       setBroker]       = useState(null)
  const [parsed,       setParsed]       = useState([])         // [{name,value,category,institution,note}]
  const [selected,     setSelected]     = useState({})
  const [overridesCat, setOverridesCat] = useState({})
  const [dragOver,     setDragOver]     = useState(false)
  const [error,        setError]        = useState('')
  const [manualRow,    setManualRow]    = useState({ name:'', value:'', category:'', institution:'', note:'' })
  const fileRef = useRef(null)

  // ── File processing ──────────────────────────────────────────────────────
  const processFile = (file) => {
    setError('')
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'txt', 'xls', 'xlsx'].includes(ext)) {
      setError('Please upload a CSV or Excel file (.csv, .xls, .xlsx)')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const rows = parseCSV(text)
        if (rows.length < 2) { setError('File appears empty or has only headers.'); return }

        const headers = rows[0]
        const cfg     = BROKERS[broker]
        const nameIdx = findCol(headers, cfg.columns.name)
        const valIdx  = findCol(headers, cfg.columns.value)

        if (nameIdx === -1) {
          setError(`Could not find a name column. Headers found: ${headers.join(', ')}`)
          return
        }

        const items = rows.slice(1)
          .map((row, i) => ({
            id:          `import_${Date.now()}_${i}`,
            name:        row[nameIdx]?.trim() || `Item ${i + 1}`,
            value:       valIdx !== -1 ? parseValue(row[valIdx]) : 0,
            category:    cfg.category || ASSET_CATS[0],
            institution: cfg.institution || '',
            note:        'Imported from ' + cfg.label,
          }))
          .filter(item => item.name && item.name.length > 1)

        if (items.length === 0) { setError('No valid rows found in file.'); return }

        const sel = {}
        items.forEach(item => { sel[item.id] = true })
        setParsed(items)
        setSelected(sel)
        setStep('preview')
      } catch (err) {
        setError('Could not parse file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  // ── Add manual row ───────────────────────────────────────────────────────
  const addManualRow = () => {
    if (!manualRow.name.trim()) return
    const item = {
      id:          `manual_${Date.now()}`,
      name:        manualRow.name.trim(),
      value:       parseValue(manualRow.value),
      category:    manualRow.category || BROKERS[broker]?.category || ASSET_CATS[0],
      institution: manualRow.institution.trim() || BROKERS[broker]?.institution || '',
      note:        manualRow.note.trim() || 'Manually entered',
    }
    setParsed(p => [...p, item])
    setSelected(s => ({ ...s, [item.id]: true }))
    setManualRow({ name:'', value:'', category:'', institution:'', note:'' })
    if (step !== 'preview') setStep('preview')
  }

  // ── Confirm import ───────────────────────────────────────────────────────
  const confirmImport = () => {
    const toImport = parsed
      .filter(item => selected[item.id])
      .map(item => ({
        ...item,
        id:       uid(),
        category: overridesCat[item.id] || item.category,
      }))
    toImport.forEach(item => addItem('assets', item))
    onImported(toImport.length)
    setStep('done')
  }

  const toggleAll = (val) => {
    const s = {}
    parsed.forEach(p => { s[p.id] = val })
    setSelected(s)
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  // ── STEP: broker selection ───────────────────────────────────────────────
  if (step === 'broker') return (
    <Modal title="Import Assets" onClose={onClose} wide>
      <p style={{ color: '#6b7494', fontSize: 13, marginBottom: 24 }}>
        Select your broker or bank to import holdings. WealthRadar reads your exported CSV file — nothing is shared online.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginBottom: 20 }}>
        {Object.entries(BROKERS).map(([key, b]) => (
          <button key={key}
            onClick={() => { setBroker(key); setStep(b.manualOnly ? 'manual' : 'upload') }}
            style={{
              background: broker === key ? 'rgba(200,146,10,0.1)' : '#06070a',
              border: `1px solid ${broker === key ? '#c8953a' : '#1a1f2e'}`,
              borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
              textAlign: 'left', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#252d42'; e.currentTarget.style.background = '#0d1117' }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = broker === key ? '#c8953a' : '#1a1f2e'
              e.currentTarget.style.background  = broker === key ? 'rgba(200,146,10,0.1)' : '#06070a'
            }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{b.logo}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1d2e', marginBottom: 4 }}>{b.label}</div>
            <div style={{ fontSize: 11, color: '#6b7494' }}>{b.category || 'Any category'}</div>
          </button>
        ))}
      </div>

      <div style={{
        padding: '12px 16px', background: 'rgba(91,143,249,0.06)',
        border: '1px solid rgba(91,143,249,0.15)', borderRadius: 8,
        fontSize: 12, color: '#8892b0',
      }}>
        🔒 Your file is read locally in your browser. No data is uploaded to any server.
      </div>
    </Modal>
  )

  // ── STEP: upload ─────────────────────────────────────────────────────────
  if (step === 'upload') {
    const cfg = BROKERS[broker]
    return (
      <Modal title={`Import from ${cfg.label}`} onClose={onClose} wide>
        <button onClick={() => setStep('broker')} style={{ background:'none', border:'none', color:'#8892b0', cursor:'pointer', fontSize:13, marginBottom:20, padding:0 }}>← Back</button>

        {/* Instructions */}
        <div style={{ background:'#f5f6fa', border:'1px solid #e8eaf0', borderRadius:10, padding:'16px 18px', marginBottom:20 }}>
          <div style={{ fontSize:12, color:'#8892b0', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.07em' }}>How to export from {cfg.label}</div>
          <div style={{ fontSize:13, color:'#1a1d2e', marginBottom: cfg.downloadUrl ? 12 : 0 }}>{cfg.logo} {cfg.instructions}</div>
          {cfg.downloadUrl && (
            <a href={cfg.downloadUrl} target="_blank" rel="noreferrer"
              style={{ fontSize:12, color:'#c8953a', display:'inline-flex', alignItems:'center', gap:4 }}>
              Open {cfg.label} ↗
            </a>
          )}
        </div>

        {/* Expected format */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:'#8892b0', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.07em' }}>Expected CSV format</div>
          <div style={{ overflowX:'auto', background:'#f5f6fa', borderRadius:8, border:'1px solid #e8eaf0', padding:'12px' }}>
            <table style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", width:'100%', borderCollapse:'collapse' }}>
              <tbody>
                {cfg.sampleRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding:'4px 12px', borderBottom: i === 0 ? '1px solid #e8eaf0' : 'none', color: i === 0 ? '#8892b0' : '#4a4f6a', whiteSpace:'nowrap' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#c8953a' : '#1a1f2e'}`,
            borderRadius: 12, padding: '36px 20px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16,
            background: dragOver ? 'rgba(200,146,10,0.05)' : 'transparent',
          }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, color: '#1a1d2e', marginBottom: 6 }}>Drop your CSV file here</div>
          <div style={{ fontSize: 12, color: '#6b7494', marginBottom: 16 }}>or click to browse</div>
          <div className="btn btn-gold btn-sm" style={{ display:'inline-flex' }}>Choose File</div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xls,.xlsx" style={{ display:'none' }} onChange={handleFileChange} />
        </div>

        {error && (
          <div style={{ color:'#dc2626', fontSize:13, padding:'10px 14px', background:'rgba(220,38,38,0.06)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, marginBottom:16 }}>
            ⚠ {error}
          </div>
        )}

        {/* Manual entry fallback */}
        <div style={{ borderTop:'1px solid #eef0f8', paddingTop:16 }}>
          <div style={{ fontSize:12, color:'#8892b0', marginBottom:10 }}>Or add entries manually:</div>
          <ManualEntryRow
            row={manualRow}
            onChange={setManualRow}
            defaultCategory={cfg.category}
            defaultInstitution={cfg.institution}
            onAdd={addManualRow}
          />
        </div>
      </Modal>
    )
  }

  // ── STEP: manual only (EPFO etc) ─────────────────────────────────────────
  if (step === 'manual') {
    const cfg = BROKERS[broker]
    return (
      <Modal title={`Add ${cfg.label} Holdings`} onClose={onClose} wide>
        <button onClick={() => setStep('broker')} style={{ background:'none', border:'none', color:'#8892b0', cursor:'pointer', fontSize:13, marginBottom:20, padding:0 }}>← Back</button>

        <div style={{ background:'rgba(91,143,249,0.06)', border:'1px solid rgba(91,143,249,0.15)', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#8892b0' }}>
          ℹ {cfg.instructions}
        </div>

        <ManualEntryRow
          row={manualRow}
          onChange={setManualRow}
          defaultCategory={cfg.category}
          defaultInstitution={cfg.institution}
          onAdd={addManualRow}
        />

        {parsed.length > 0 && (
          <div style={{ marginTop:20 }}>
            <div style={{ fontSize:12, color:'#8892b0', marginBottom:10 }}>{parsed.length} entries added:</div>
            {parsed.map(item => (
              <div key={item.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'#f5f6fa', borderRadius:8, marginBottom:6, fontSize:13 }}>
                <span style={{ color:'#1a1d2e' }}>{item.name}</span>
                <span style={{ color:'#16a34a', fontFamily:"'JetBrains Mono',monospace" }}>₹{item.value.toLocaleString()}</span>
              </div>
            ))}
            <button className="btn btn-gold" style={{ marginTop:12, width:'100%', justifyContent:'center' }} onClick={confirmImport}>
              Import {parsed.length} {parsed.length === 1 ? 'Entry' : 'Entries'}
            </button>
          </div>
        )}
      </Modal>
    )
  }

  // ── STEP: preview & select ───────────────────────────────────────────────
  if (step === 'preview') return (
    <Modal title="Review & Import" onClose={onClose} wide>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontSize:13, color:'#8892b0' }}>
          <span style={{ color:'#16a34a', fontWeight:500 }}>{selectedCount}</span> of {parsed.length} rows selected
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleAll(true)}>Select All</button>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleAll(false)}>Deselect All</button>
        </div>
      </div>

      <div style={{ maxHeight:360, overflowY:'auto', marginBottom:20 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', width:32 }}></th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8' }}>Name</th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8' }}>Category</th>
              <th style={{ padding:'8px 12px', textAlign:'right', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8' }}>Value (₹)</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map(item => (
              <tr key={item.id} style={{ opacity: selected[item.id] ? 1 : 0.4, transition:'opacity 0.15s' }}>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f0f1f8' }}>
                  <input type="checkbox" checked={!!selected[item.id]}
                    onChange={e => setSelected(s => ({ ...s, [item.id]: e.target.checked }))}
                    style={{ accentColor:'#c8953a', width:14, height:14, cursor:'pointer' }} />
                </td>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f0f1f8', fontSize:13, color:'#1a1d2e' }}>
                  {item.name}
                  {item.institution && <span style={{ fontSize:11, color:'#8892b0', marginLeft:8 }}>{item.institution}</span>}
                </td>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f0f1f8' }}>
                  <select
                    value={overridesCat[item.id] || item.category}
                    onChange={e => setOverridesCat(s => ({ ...s, [item.id]: e.target.value }))}
                    style={{ background:'#f5f6fa', border:'1px solid #e8eaf0', borderRadius:6, color:'#4a4f6a', fontSize:11, padding:'3px 8px', fontFamily:"'Outfit',sans-serif", cursor:'pointer' }}>
                    {ASSET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f0f1f8', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontSize:13, color: item.value > 0 ? '#16a34a' : '#dc2626' }}>
                  {item.value > 0 ? item.value.toLocaleString() : (
                    <input
                      type="number" placeholder="Enter value"
                      style={{ background:'#f5f6fa', border:'1px solid #c8953a', borderRadius:6, color:'#1a1d2e', fontSize:12, padding:'3px 8px', width:100, fontFamily:"'JetBrains Mono',monospace", textAlign:'right' }}
                      onChange={e => setParsed(prev => prev.map(p => p.id === item.id ? { ...p, value: parseFloat(e.target.value) || 0 } : p))}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add more manually */}
      <div style={{ borderTop:'1px solid #eef0f8', paddingTop:16, marginBottom:20 }}>
        <div style={{ fontSize:12, color:'#8892b0', marginBottom:10 }}>Add more rows manually:</div>
        <ManualEntryRow
          row={manualRow}
          onChange={setManualRow}
          defaultCategory={BROKERS[broker]?.category || ''}
          defaultInstitution={BROKERS[broker]?.institution || ''}
          onAdd={addManualRow}
        />
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:13, color:'#8892b0' }}>
          Total value: <span style={{ color:'#e8c060', fontFamily:"'JetBrains Mono',monospace" }}>
            ₹{parsed.filter(p => selected[p.id]).reduce((s, p) => s + (p.value||0), 0).toLocaleString()}
          </span>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-outline" onClick={() => setStep('upload')}>← Re-upload</button>
          <button className="btn btn-gold" onClick={confirmImport} disabled={selectedCount === 0}>
            Import {selectedCount} {selectedCount === 1 ? 'Asset' : 'Assets'} →
          </button>
        </div>
      </div>
    </Modal>
  )

  // ── STEP: done ───────────────────────────────────────────────────────────
  return (
    <Modal title="Import Complete! 🎉" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'20px 0' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:'#16a34a', marginBottom:8 }}>
          Assets Imported Successfully
        </div>
        <div style={{ fontSize:13, color:'#8892b0', marginBottom:28 }}>
          Your holdings are now visible in the Assets tab.
        </div>
        <button className="btn btn-gold" style={{ width:'100%', justifyContent:'center', padding:12 }} onClick={onClose}>
          View My Assets
        </button>
      </div>
    </Modal>
  )
}

// ─── Reusable manual entry row ────────────────────────────────────────────────
function ManualEntryRow({ row, onChange, defaultCategory, defaultInstitution, onAdd }) {
  const f = (k, v) => onChange(p => ({ ...p, [k]: v }))
  return (
    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1.5fr auto', gap:8, alignItems:'end' }}>
      <div>
        <label className="label">Name</label>
        <input className="input" value={row.name} onChange={e => f('name', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder="e.g. HDFC Savings, SGB" />
      </div>
      <div>
        <label className="label">Value (₹)</label>
        <input className="input" type="number" value={row.value} onChange={e => f('value', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder="0" />
      </div>
      <div>
        <label className="label">Category</label>
        <select className="input" value={row.category || defaultCategory} onChange={e => f('category', e.target.value)}>
          {ASSET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button className="btn btn-gold" onClick={onAdd} disabled={!row.name.trim()}
        style={{ height:40, paddingLeft:16, paddingRight:16, marginBottom:0 }}>
        + Add
      </button>
    </div>
  )
}
