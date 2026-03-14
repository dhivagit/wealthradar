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
    // Zerodha Coin/Equity XLSX: Symbol(B), Qty Available(E), Avg Price(J), Prev Close(K)
    // Current value is computed as Qty × Prev Closing Price (no direct current value column)
    columns: {
      name:     ['symbol','instrument','stock name','tradingsymbol','scrip','security','stock'],
      qty:      ['quantity available','qty','quantity','shares'],
      avgPrice: ['average price','avg. cost','avg cost','avg price','purchase price'],
      ltp:      ['previous closing price','ltp','last price','close price','current price','closing price'],
      value:    ['current value','cur. val','market value','present value','value','amount'],
    },
    sampleRows: [
      ['Symbol', 'ISIN', 'Sector', 'Qty Available', 'Avg Price', 'Prev Closing Price', 'Unrealized P&L'],
      ['RELIANCE', 'INE002A01018', 'OIL & GAS', '10', '2450.00', '2610.00', '1600.00'],
      ['TCS', 'INE467B01029', 'SOFTWARE', '5', '3200.00', '3580.00', '1900.00'],
    ],
  },
  groww: {
    label: 'Groww',
    logo: '🟢',
    category: 'Stocks & Equities',
    institution: 'Groww',
    downloadUrl: 'https://groww.in/stocks/portfolio',
    instructions: 'Stocks → Portfolio → Download ⬇ (CSV)',
    columns: { name: ['stock','name','scrip','symbol','instrument','fund'], value: ['current value','market value','ltp','value','amount'] },
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
    columns: { name: ['scheme name','fund name','scheme','plan name','folio'], value: ['current value','market value','nav value','valuation','value','amount','corpus'] },
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
    columns: { name: ['name','asset','stock','fund','description','instrument','scheme','security','scrip','symbol','particulars'], value: ['value','amount','current value','market value','balance','valuation','net value','corpus','cur. val'] },
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

// Scan all rows to find the actual header row (skips disclaimer/junk rows at top)
// Scores each row: prefers rows that match the NAME column candidates (highest priority)
// Returns { headerRowIdx, headers } or null
function detectHeaderRow(rows, candidates) {
  const nameCandidates  = (candidates.name  || []).concat(candidates.qty || [])
  const valueCandidates = (candidates.value || []).concat(candidates.ltp || [], candidates.avgPrice || [])
  const allCandidates   = [].concat(...Object.values(candidates)).filter(Boolean)

  let bestRow = null, bestScore = 0

  for (let i = 0; i < Math.min(rows.length, 35); i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue
    const nonEmpty = row.filter(x => x !== null && x !== undefined && x.toString().trim() !== '')
    if (nonEmpty.length < 2) continue

    const h = row.map(x => (x || '').toString().toLowerCase().trim())

    // Score: name match = 3pts, value/qty match = 2pts, any match = 1pt
    // Penalise rows with fewer than 3 non-empty cells (likely summary rows)
    const nameScore  = nameCandidates.filter(c  => h.some(cell => cell.length > 0 && cell.length < 80 && cell.includes(c))).length * 3
    const valueScore = valueCandidates.filter(c => h.some(cell => cell.length > 0 && cell.length < 80 && cell.includes(c))).length * 2
    const anyScore   = allCandidates.filter(c   => h.some(cell => cell.length > 0 && cell.length < 80 && cell.includes(c))).length
    const widthBonus = nonEmpty.length >= 4 ? 5 : 0  // real header rows usually have many columns

    const score = nameScore + valueScore + anyScore + widthBonus
    if (score > bestScore) {
      bestScore = score
      bestRow   = { headerRowIdx: i, headers: row.map(x => (x || '').toString().trim()) }
    }
  }

  // Only return if we have a confident match (name column likely present)
  return bestScore >= 4 ? bestRow : null
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

  // Load SheetJS from CDN on demand (handles .xlsx, .xls, .csv)
  const loadSheetJS = () => new Promise((res, rej) => {
    if (window.XLSX) { res(window.XLSX); return }
    const s   = document.createElement('script')
    s.src     = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload  = () => res(window.XLSX)
    s.onerror = () => rej(new Error('Failed to load SheetJS'))
    document.head.appendChild(s)
  })

  // Parse rows from any file format into [ [col1, col2, ...], ... ]
  const parseFileToRows = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()

    // Plain CSV / TXT — parse directly without SheetJS
    if (ext === 'csv' || ext === 'txt') {
      return new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = e => {
          try { res(parseCSV(e.target.result)) }
          catch (err) { rej(err) }
        }
        reader.onerror = () => rej(new Error('Failed to read file'))
        reader.readAsText(file)
      })
    }

    // Excel (.xlsx, .xls) — use SheetJS
    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await loadSheetJS()
      return new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = e => {
          try {
            const wb      = XLSX.read(e.target.result, { type: 'array' })
            const ws      = wb.Sheets[wb.SheetNames[0]]          // first sheet
            // Keep ALL rows (including empty ones) so row indices are preserved
            // Map to strings for uniform handling, but keep empty rows as empty arrays
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
              .map(row => row.map(cell => (cell === null || cell === undefined) ? '' : String(cell).trim()))
            res(rows)
          } catch (err) { rej(err) }
        }
        reader.onerror = () => rej(new Error('Failed to read Excel file'))
        reader.readAsArrayBuffer(file)
      })
    }

    throw new Error('Unsupported file type. Please upload a .csv, .xls, or .xlsx file.')
  }

  const processFile = async (file) => {
    setError('')
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'txt', 'xls', 'xlsx'].includes(ext)) {
      setError('Unsupported file type. Please upload a .csv, .xls, or .xlsx file.')
      return
    }

    try {
      const rows = await parseFileToRows(file)
      if (rows.length < 1) { setError('File appears to be empty.'); return }

      const cfg = BROKERS[broker]

      // ── Strategy 1: Standard table (header row + data rows) ──────────────
      const detected = detectHeaderRow(rows, cfg.columns)
      if (detected) {
        const { headerRowIdx, headers } = detected
        const nameIdx    = findCol(headers, cfg.columns.name)
        const valIdx     = cfg.columns.value    ? findCol(headers, cfg.columns.value)    : -1
        const qtyIdx     = cfg.columns.qty      ? findCol(headers, cfg.columns.qty)      : -1
        const ltpIdx     = cfg.columns.ltp      ? findCol(headers, cfg.columns.ltp)      : -1
        const avgPriceIdx= cfg.columns.avgPrice ? findCol(headers, cfg.columns.avgPrice) : -1
        const sectorIdx  = findCol(headers, ['sector','industry','category','asset class'])

        // Sector → WealthRadar category mapping for Zerodha
        const sectorToCategory = (sector) => {
          if (!sector) return cfg.category || ASSET_CATS[0]
          const s = sector.toLowerCase()
          if (s.includes('etf'))                                          return 'Gold & Precious Metals'
          if (s.includes('gold'))                                         return 'Gold & Precious Metals'
          if (s.includes('financial') || s.includes('bank'))             return 'Stocks & Equities'
          if (s.includes('software') || s.includes('tech'))              return 'Stocks & Equities'
          if (s.includes('healthcare') || s.includes('pharma'))          return 'Stocks & Equities'
          if (s.includes('metal'))                                        return 'Stocks & Equities'
          if (s.includes('fmcg') || s.includes('consumer'))              return 'Stocks & Equities'
          if (s.includes('auto'))                                         return 'Stocks & Equities'
          return cfg.category || ASSET_CATS[0]
        }

        if (nameIdx !== -1) {
          const items = rows.slice(headerRowIdx + 1)
            .map((row, i) => {
              const name   = (row[nameIdx] || '').toString().trim()
              const qty    = qtyIdx     !== -1 ? parseValue((row[qtyIdx]      || '').toString()) : 1
              const ltp    = ltpIdx     !== -1 ? parseValue((row[ltpIdx]      || '').toString()) : 0
              const avg    = avgPriceIdx !== -1 ? parseValue((row[avgPriceIdx] || '').toString()) : 0

              // Value priority: direct value col → qty×ltp → qty×avgPrice → 0
              let value = 0
              if (valIdx !== -1 && parseValue((row[valIdx] || '').toString()) > 0) {
                value = parseValue((row[valIdx] || '').toString())
              } else if (qty > 0 && ltp > 0) {
                value = Math.round(qty * ltp * 100) / 100   // qty × current/closing price
              } else if (qty > 0 && avg > 0) {
                value = Math.round(qty * avg * 100) / 100   // fallback: qty × avg price
              }

              const sector   = sectorIdx !== -1 ? (row[sectorIdx] || '').toString().trim() : ''
              const category = sectorToCategory(sector)

              const investedVal = qty > 0 && avg > 0 ? Math.round(qty * avg * 100) / 100 : 0
              const plPct       = avgPriceIdx !== -1 && avg > 0 && ltp > 0
                                    ? Math.round(((ltp - avg) / avg) * 10000) / 100
                                    : null

              return {
                id:          'import_' + Date.now() + '_' + i,
                name,
                value,
                category,
                institution: cfg.institution || '',
                note:        sector
                  ? sector.charAt(0) + sector.slice(1).toLowerCase() + ' · Imported from ' + cfg.label
                  : 'Imported from ' + cfg.label,
                // Extra fields for rich preview (not stored in main asset model)
                _sector:        sector,
                _qty:           qty,
                _avgPrice:      avg,
                _ltp:           ltp,
                _investedValue: investedVal,
                _plPct:         plPct,
              }
            })
            .filter(r => r.name.length > 1 && !/^[\d.,₹$%\s\-]+$/.test(r.name))

          if (items.length > 0) {
            const sel = {}
            items.forEach(item => { sel[item.id] = true })
            setParsed(items); setSelected(sel); setStep('preview')
            return
          }
        }
      }

      // ── Strategy 2: Key-Value layout (col A = label, col B = number) ────
      // e.g. "Invested Value | 1291878.43"  each row is one metric
      const isKeyValue = rows.slice(0, 10).filter(r => r.length >= 2).every(r => {
        const second = (r[1] || '').toString().trim()
        return second === '' || /^[\d.,₹$%\s\-]+$/.test(second)
      })

      if (isKeyValue && rows.length >= 2) {
        const items = rows
          .filter(r => r.length >= 2)
          .map((row, i) => ({
            id:          'import_' + Date.now() + '_' + i,
            name:        (row[0] || '').toString().trim(),
            value:       parseValue((row[1] || '').toString()),
            category:    cfg.category || ASSET_CATS[0],
            institution: cfg.institution || '',
            note:        'Imported from ' + cfg.label,
          }))
          .filter(r => r.name.length > 1 && !/^[\d.,₹$%\s\-]+$/.test(r.name) && r.value > 0)

        if (items.length > 0) {
          const sel = {}
          items.forEach(item => { sel[item.id] = true })
          setParsed(items); setSelected(sel); setStep('preview')
          return
        }
      }

      // ── Strategy 3: Single-column (just names, no values) ────────────────
      const nameOnlyCandidates = [...cfg.columns.name, 'name', 'fund', 'stock', 'instrument', 'scheme']
      const detectedNameOnly = detectHeaderRow(rows, { name: nameOnlyCandidates, value: [] })
      if (detectedNameOnly) {
        const nameIdx = findCol(detectedNameOnly.headers, nameOnlyCandidates)
        if (nameIdx !== -1) {
          const items = rows.slice(detectedNameOnly.headerRowIdx + 1)
            .map((row, i) => ({
              id:          'import_' + Date.now() + '_' + i,
              name:        (row[nameIdx] || '').toString().trim() || ('Item ' + (i + 1)),
              value:       0,
              category:    cfg.category || ASSET_CATS[0],
              institution: cfg.institution || '',
              note:        'Imported from ' + cfg.label + ' (value not detected — please set manually)',
            }))
            .filter(r => r.name.length > 1)

          if (items.length > 0) {
            const sel = {}
            items.forEach(item => { sel[item.id] = true })
            setParsed(items); setSelected(sel); setStep('preview')
            return
          }
        }
      }

      // ── Nothing worked — show a helpful error with file preview ──────────
      const preview = rows.slice(0, 4)
        .map(r => r.slice(0, 5).map(c => (c || '').toString().trim()).join(' | '))
        .filter(Boolean)
        .join('\n')

      setError(
        'Could not parse this file automatically.\n\n' +
        'File preview (first 4 rows):\n' + preview + '\n\n' +
        '💡 What to try:\n' +
        '• Select "Generic CSV/Excel" as the source\n' +
        '• For Zerodha: download from Console → Portfolio → Holdings (not Tax P&L)\n' +
        '• For MF: download from MF Central → My Portfolio → Export\n' +
        '• Or use "Add Manually" below to enter values one by one'
      )
    } catch (err) {
      setError('Could not parse file: ' + (err.message || 'Unknown error'))
    }
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
              background: broker === key ? 'rgba(200,146,10,0.08)' : '#f8f9fc',
              border: `1.5px solid ${broker === key ? '#c8920a' : '#e4e7f0'}`,
              borderRadius: 12, padding: '16px', cursor: 'pointer',
              textAlign: 'left', transition: 'all 0.18s',
              boxShadow: broker === key ? '0 2px 12px rgba(200,146,10,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8920a'; e.currentTarget.style.background = 'rgba(200,146,10,0.06)' }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = broker === key ? '#c8920a' : '#e4e7f0'
              e.currentTarget.style.background  = broker === key ? 'rgba(200,146,10,0.08)' : '#f8f9fc'
            }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>{b.logo}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1d2e', marginBottom: 3 }}>{b.label}</div>
            <div style={{ fontSize: 11, color: '#8892b0' }}>{b.category || 'Any category'}</div>
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
          <div style={{ fontSize:11, color:'#8892b0', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.07em' }}>Expected file format (first sheet / CSV)</div>
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
          <div style={{ fontSize: 14, color: '#1a1d2e', marginBottom: 6 }}>Drop your file here</div>
          <div style={{ fontSize: 12, color: '#6b7494', marginBottom: 4 }}>or click to browse</div>
          <div style={{ fontSize: 11, color: '#b0b8d0', marginBottom: 16, display:'flex', justifyContent:'center', gap:8 }}>
            <span style={{ background:'#f0f1f8', border:'1px solid #e2e4ef', borderRadius:4, padding:'2px 8px' }}>CSV</span>
            <span style={{ background:'#f0f1f8', border:'1px solid #e2e4ef', borderRadius:4, padding:'2px 8px' }}>XLS</span>
            <span style={{ background:'#f0f1f8', border:'1px solid #e2e4ef', borderRadius:4, padding:'2px 8px' }}>XLSX</span>
          </div>
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
  if (step === 'preview') {
    // Detect if any row has rich broker data (sector, qty, invested value, P&L)
    const hasRichData = parsed.some(item => item._qty > 0 || item._sector)

    return (
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

      <div style={{ overflowX:'auto', maxHeight:420, marginBottom:20, borderRadius:10, border:'1px solid #eef0f8' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth: hasRichData ? 820 : 480 }}>
          <thead style={{ position:'sticky', top:0, zIndex:2 }}>
            <tr style={{ background:'#fafbfe' }}>
              <th style={{ padding:'10px 12px', textAlign:'left',  fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', width:32, whiteSpace:'nowrap' }}></th>
              <th style={{ padding:'10px 12px', textAlign:'left',  fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>SYMBOL</th>
              {hasRichData && <th style={{ padding:'10px 12px', textAlign:'left',  fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>SECTOR</th>}
              {hasRichData && <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>QTY</th>}
              <th style={{ padding:'10px 12px', textAlign:'left',  fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>CATEGORY</th>
              {hasRichData && <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>INVESTED (₹)</th>}
              <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>PRESENT (₹)</th>
              {hasRichData && <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>P&L %</th>}
            </tr>
          </thead>
          <tbody>
            {parsed.map(item => {
              const plPct    = item._plPct
              const plColor  = plPct === null ? '#8892b0' : plPct >= 0 ? '#16a34a' : '#dc2626'
              const plPrefix = plPct !== null && plPct >= 0 ? '+' : ''
              return (
              <tr key={item.id} style={{ opacity: selected[item.id] ? 1 : 0.45, transition:'opacity 0.15s', background: selected[item.id] ? 'transparent' : '#fafbfe' }}>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb' }}>
                  <input type="checkbox" checked={!!selected[item.id]}
                    onChange={e => setSelected(s => ({ ...s, [item.id]: e.target.checked }))}
                    style={{ accentColor:'#c8953a', width:14, height:14, cursor:'pointer' }} />
                </td>

                {/* Symbol + institution */}
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', fontSize:13, color:'#1a1d2e', whiteSpace:'nowrap' }}>
                  <div style={{ fontWeight:500 }}>{item.name}</div>
                  {item.institution && <div style={{ fontSize:10, color:'#b0b8d0', marginTop:1 }}>{item.institution}</div>}
                </td>

                {/* Sector */}
                {hasRichData && (
                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', fontSize:11, color:'#6b7494', whiteSpace:'nowrap', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis' }}>
                    {item._sector
                      ? item._sector.charAt(0) + item._sector.slice(1).toLowerCase()
                      : <span style={{ color:'#d0d4e0' }}>—</span>}
                  </td>
                )}

                {/* Qty */}
                {hasRichData && (
                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#4a4f6a', whiteSpace:'nowrap' }}>
                    {item._qty > 0 ? item._qty.toLocaleString() : <span style={{ color:'#d0d4e0' }}>—</span>}
                  </td>
                )}

                {/* Category dropdown */}
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', whiteSpace:'nowrap' }}>
                  <select
                    value={overridesCat[item.id] || item.category}
                    onChange={e => setOverridesCat(s => ({ ...s, [item.id]: e.target.value }))}
                    style={{ background:'#f5f6fa', border:'1px solid #e8eaf0', borderRadius:6, color:'#4a4f6a', fontSize:11, padding:'4px 8px', fontFamily:"'Outfit',sans-serif", cursor:'pointer', maxWidth:160 }}>
                    {ASSET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>

                {/* Invested value */}
                {hasRichData && (
                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#8892b0', whiteSpace:'nowrap' }}>
                    {item._investedValue > 0
                      ? '₹' + item._investedValue.toLocaleString('en-IN', { maximumFractionDigits:0 })
                      : <span style={{ color:'#d0d4e0' }}>—</span>}
                  </td>
                )}

                {/* Present value */}
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontSize:13, whiteSpace:'nowrap' }}>
                  {item.value > 0
                    ? <span style={{ color:'#16a34a', fontWeight:500 }}>₹{item.value.toLocaleString('en-IN', { maximumFractionDigits:0 })}</span>
                    : (
                      <input
                        type="number" placeholder="Enter value"
                        style={{ background:'#f5f6fa', border:'1px solid #c8953a', borderRadius:6, color:'#1a1d2e', fontSize:12, padding:'3px 8px', width:90, fontFamily:"'JetBrains Mono',monospace", textAlign:'right' }}
                        onChange={e => setParsed(prev => prev.map(p => p.id === item.id ? { ...p, value: parseFloat(e.target.value) || 0 } : p))}
                      />
                    )}
                </td>

                {/* P&L % */}
                {hasRichData && (
                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontSize:12, whiteSpace:'nowrap' }}>
                    {plPct !== null
                      ? (
                        <span style={{ color:plColor, background: plPct >= 0 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)', padding:'2px 8px', borderRadius:12, fontWeight:500 }}>
                          {plPrefix}{plPct.toFixed(2)}%
                        </span>
                      )
                      : <span style={{ color:'#d0d4e0' }}>—</span>}
                  </td>
                )}
              </tr>
              )
            })}
          </tbody>

          {/* Totals footer */}
          {hasRichData && (() => {
            const selItems      = parsed.filter(i => selected[i.id])
            const totalInvested = selItems.reduce((s,i) => s + (i._investedValue||0), 0)
            const totalPresent  = selItems.reduce((s,i) => s + (i.value||0), 0)
            const totalQty      = selItems.reduce((s,i) => s + (i._qty||0), 0)
            const totalPL       = totalInvested > 0 ? totalPresent - totalInvested : null
            const totalPLPct    = totalInvested > 0 ? ((totalPresent - totalInvested) / totalInvested) * 100 : null
            const plColor       = totalPLPct === null ? '#8892b0' : totalPLPct >= 0 ? '#16a34a' : '#dc2626'
            const plPrefix      = totalPLPct !== null && totalPLPct >= 0 ? '+' : ''
            return (
            <tfoot>
              <tr style={{ background:'#f0f2f9', borderTop:'2px solid #dde0ee' }}>
                <td colSpan={2} style={{ padding:'11px 12px', fontSize:12, fontWeight:700, color:'#1a1d2e' }}>
                  TOTAL ({selectedCount} stocks)
                </td>
                {/* Sector col — blank */}
                <td style={{ padding:'11px 12px' }} />
                {/* Qty total */}
                <td style={{ padding:'11px 12px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#4a4f6a', fontWeight:600 }}>
                  {totalQty.toLocaleString()}
                </td>
                {/* Category col — blank */}
                <td style={{ padding:'11px 12px' }} />
                {/* Invested total */}
                <td style={{ padding:'11px 12px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#4a4f6a', fontWeight:600 }}>
                  ₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits:0 })}
                </td>
                {/* Present value total */}
                <td style={{ padding:'11px 12px', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:'#16a34a', fontWeight:700 }}>
                  ₹{totalPresent.toLocaleString('en-IN', { maximumFractionDigits:0 })}
                </td>
                {/* Overall P&L % */}
                <td style={{ padding:'11px 12px', textAlign:'right', whiteSpace:'nowrap' }}>
                  {totalPLPct !== null ? (
                    <div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:plColor, fontWeight:700 }}>
                        {plPrefix}{totalPLPct.toFixed(2)}%
                      </div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:plColor, marginTop:2, opacity:0.8 }}>
                        {plPrefix}₹{Math.abs(totalPL).toLocaleString('en-IN', { maximumFractionDigits:0 })}
                      </div>
                    </div>
                  ) : <span style={{ color:'#d0d4e0' }}>—</span>}
                </td>
              </tr>
            </tfoot>
            )
          })()}
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
  }

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
