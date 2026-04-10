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
  icicidirect: {
    label: 'ICICI Direct',
    logo: '🔴',
    category: 'Stocks & Equities',
    institution: 'ICICI Direct',
    downloadUrl: 'https://www.icicidirect.com/portfolio',
    instructions: 'My Account → Portfolio → Holdings → Download (PortFolioEqtSummary CSV)',
    columns: {
      name:     ['company name','stock symbol','symbol','scrip','stock','security name'],
      qty:      ['qty','quantity','shares','net qty'],
      avgPrice: ['average cost price','avg cost price','avg cost','average price','purchase price'],
      ltp:      ['current market price','current price','ltp','last price','market price','closing price'],
      value:    ['value at market price','current value','market value','present value','mkt value'],
      invested: ['value at cost','invested value','cost value','purchase value','investment value'],
      plpct:    ['unrealized profit/loss %','unrealized p&l %','p&l%','gain/loss %'],
    },
    sampleRows: [
      ['Stock Symbol', 'Company Name', 'ISIN Code', 'Qty', 'Average Cost Price', 'Current Market Price', 'Value At Cost', 'Value At Market Price', 'Unrealized Profit/Loss %'],
      ['ASHLEY', 'ASHOK LEYLAND LTD', 'INE208A01029', '50', '126.35', '178.48', '6317.50', '8924.00', '41.26'],
      ['TCS', 'TATA CONSULTANCY SERVICES LTD', 'INE467B01029', '36', '3328.17', '2460.00', '119814.12', '88560.00', '(26.09)'],
      ['GOLDEX', 'NIPPON INDIA ETF GOLD BEES', 'INF204KB17I5', '1136', '63.38', '127.43', '71999.68', '144760.48', '101.06'],
    ],
  },
  indmoney: {
    label: 'INDMoney',
    logo: '🟠',
    category: 'Stocks & Equities',
    institution: 'INDMoney',
    downloadUrl: 'https://app.indmoney.com/stocks/portfolio',
    instructions: 'Stocks → Portfolio → Download Holdings Report (XLSX)',
    columns: {
      name:     ['stock name','company name','name','symbol','scrip'],
      qty:      ['quantity','qty','shares','no. of shares'],
      avgPrice: ['average buy price','avg buy price','average price','avg price','purchase price'],
      ltp:      ['current price','ltp','market price','last price','closing price','current market price'],
      value:    ['current value','market value','present value','portfolio value'],
      invested: ['buy value','invested value','investment value','cost value','total invested'],
      plpct:    ['gain/loss %','unrealized p&l %','p&l%','profit/loss %','return %'],
    },
    sampleRows: [
      ['Stock Name', 'ISIN', 'Quantity', 'Average buy price', 'Buy Value'],
      ['Prakash Pipes Ltd', 'INE050001010', '14', '491.07', '6874.98'],
      ['Cipla Ltd', 'INE059A01026', '15', '1441.40', '21621.00'],
      ['Tata Gold Exchange Traded Fund', 'INF277KA1976', '253', '10.91', '2760.23'],
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
  if (!str && str !== 0) return 0
  const s = str.toString().trim()
  // ICICIDirect uses (1234.56) for negative values
  if (s.startsWith('(') && s.endsWith(')')) {
    const n = parseFloat(s.slice(1, -1).replace(/[₹$,\s+]/g, ''))
    return isNaN(n) ? 0 : -n
  }
  const n = parseFloat(s.replace(/[₹$,\s+]/g, ''))
  return isNaN(n) ? 0 : n
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ImportModal({ onClose, onImported }) {
  const { addItem, updateItem, data: financeData } = useFinance()
  const [step,         setStep]         = useState('broker')   // broker | preview | done
  const [importCounts, setImportCounts]  = useState({ added:0, updated:0 })
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
          try { res({ _csv: parseCSV(e.target.result) }) }
          catch (err) { rej(err) }
        }
        reader.onerror = () => rej(new Error('Failed to read file'))
        reader.readAsText(file)
      })
    }

    // Excel (.xlsx, .xls) — use SheetJS, return ALL sheets as { sheetName: rows }
    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await loadSheetJS()
      return new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = e => {
          try {
            const wb     = XLSX.read(e.target.result, { type: 'array' })
            const sheets = {}
            wb.SheetNames.forEach(name => {
              sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
                .map(row => row.map(cell => (cell === null || cell === undefined) ? '' : String(cell).trim()))
            })
            res(sheets)   // returns { 'Equity': rows[], 'Mutual Funds': rows[], ... }
          } catch (err) { rej(err) }
        }
        reader.onerror = () => rej(new Error('Failed to read Excel file'))
        reader.readAsArrayBuffer(file)
      })
    }

    throw new Error('Unsupported file type. Please upload a .csv, .xls, or .xlsx file.')
  }

  // ── Keyword-based sector detection for brokers with no sector column ────────
  // (ICICIDirect, INDMoney — detect from company name or symbol)
  const detectSectorFromName = (name) => {
    const n = (name || '').toLowerCase()
    // ETF / Index funds — already handled separately, skip here
    const rules = [
      // Banking
      [['bank','banking','kotak mah','hdfc bank','icici bank','axis bank','sbi bank','indusind','federal bank','yes bank','bandhan bank','au small','dcb bank','karur','city union','tmb','south indian','hdb financial','rbl bank','csb bank'], 'Banking'],
      // Insurance
      [['insurance','life ins','general ins','bajaj allianz','icici pru','hdfc life','sbi life','star health','niva bupa','go digit'], 'Insurance'],
      // Financial Services (NBFC, broking, fintech — check before broader finance keywords)
      [['power finance','pfc','rec limited','lic housing','gruh finance','repco','manappuram','muthoot','sphoorty','bajaj fin','cholaman','shriram','mahindra fin','l&t fin','pnb housing','can fin','aptus','home first','aditya birla cap','iifl','microfinance','nbfc'], 'Financial Services'],
      [['finance','financial'], 'Financial Services'],
      // Software & IT (check specific names before generic 'tech')
      [['tata consultancy','tcs','infosys','wipro','hcl tech','tech mahindra','ltimindtree','mphasis','persistent','coforge','oracle fin','hexaware','zensar','niit tech','mastek','kpit','happiest','birlasoft','saksoft','tanla','tanla platforms','newgen','tata elxsi','cyient','sasken','sonata','intellect design','nucleus software','rategain','latent view','nuvei','indiamart'], 'Software & IT'],
      // Automobiles & Auto Ancillaries
      [['mahindra','maruti','tata motors','ashok leyland','hero moto','bajaj auto','tvs motor','eicher','bosch','mrf','apollo tyre','ceat','motherson','endurance','sona bly','uno minda','rane','samvardhana','suprajit','precision camshaft','gabriel','fiem'], 'Automobiles'],
      // Healthcare (hospitals — before pharma)
      [['healthcare','health care','ttk health','apollo hosp','fortis','max health','narayana','aster','global health','rainbow','kims','yatharth','metropolis','dr lal','thyrocare','vijaya diag'], 'Healthcare'],
      // Pharmaceuticals
      [['pharma','cipla','sun pharma','drreddy','dr. reddy','biocon','divis','lupin','zydus','cadila','abbott','pfizer','natco','alkem','torrent pharma','ipca','laurus','granules','strides','glenmark','mankind','ajanta','eris','suven','sequent','solara','windlas','lincoln pharma','marksans'], 'Pharmaceuticals'],
      // Oil & Gas
      [['oil','petroleum','reliance ind','ongc','bpcl','hpcl','ioc','indian oil','gail','castrol','gujarat gas','indraprastha','mahanagar gas','petronet','aegis logistics','gulf oil'], 'Oil & Gas'],
      // Energy & Power
      [['coal india','ntpc','adani power','tata power','torrent power','cesc','jsw energy','renewable','green energy','avaada','acme','greenko','power grid','sjvn','nhpc','neepco','ireda','waaree','premier energies'], 'Energy & Power'],
      // Metals & Mining
      [['steel','tata steel','jsw steel','sail','jspl','jindal','hindalco','vedanta','nalco','moil','nmdc','national aluminium','vedl','hindustan zinc','national mineral','sandur','mishra dhatu'], 'Metals & Mining'],
      // FMCG & Beverages (include liquor companies)
      [['hindustan unilever','hul','itc','dabur','godrej consumer','marico','nestle','britannia','colgate','emami','jyothy','varun bev','radico','united spirits','united breweries','tilaknagar','globus spirits','som distilleries','mcdowell','mil industries','heritage foods'], 'FMCG'],
      // Capital Goods & Engineering
      [['larsen','l&t','siemens','abb','bhel','cummins','thermax','bharat forge','grindwell','timken','schaeffler','skf','elgi','kirloskar','honeywell','voltas','blue star','prakash industries','ncc','kalpataru','kec international','patel engineering','irb infra','ashoka buildcon','hem holdings'], 'Capital Goods'],
      // Pipes, Fittings & Industrials (specific match before generic)
      [['prakash pipes','supreme industries','astral','finolex','prince pipes','apollo pipes','nile','jain irrigation','kiri industries'], 'Industrials'],
      [['pipes','fittings','valves','industrial'], 'Industrials'],
      // Telecom
      [['airtel','jio','vodafone','bharti','tata comm','sterlite tech','hfcl','route mobile','videocon'], 'Telecom'],
      // Real Estate
      [['dlf','godrej prop','oberoi','prestige','brigade','sobha','macrotech','lodha','kolte patil','phoenix','puravankara','mahindra lifespace','sunteck','nirlon'], 'Real Estate'],
      // Cement
      [['ultratech','shree cement','acc','ambuja','dalmia','jk cement','ramco','birla corp','heidelberg','india cements','prism johnson'], 'Cement'],
      // Chemicals & Specialty
      [['pidilite','asian paint','berger','kansai','nerolac','deepak nitrite','aarti ind','navin fluorine','srf','clean science','galaxy surf','fine organics','vinati organics','sudarshan chem','bodal chem','chemcrux','anupam rasayan'], 'Chemicals'],
      // Retail & Consumer
      [['avenue supermarts','dmart','trent','v-mart','metro brands','bata','relaxo','titan','kalyan','rajesh exports','vedant','manyavar','go fashion','aditya birla fashion','shoppers stop'], 'Retail & Consumer'],
      // Logistics & Transport
      [['adani port','concor','gateway dist','blue dart','gati','allcargo','transport corp','mahindra logistics','tvs supply','delhivery','xpressbees','safexpress'], 'Logistics'],
      // Capital Markets & Exchanges
      [['nse','bse','cdsl','nsdl','cams','computer age','kfin tech','crisil','care ratings','icra','angel one','motilal','iifl sec','5paisa','geojit','hdfc sec'], 'Capital Markets'],
      // Textiles & Apparel
      [['textile','fabric','yarn','fibre','raymond','arvind','vardhman','welspun','trident','ktm','siyaram','nitin spinners','indo count'], 'Textiles'],
      // Agri & Fertilisers
      [['fertiliser','fertilizer','agri','coromandel','chambal','deepak fert','gnfc','national fertilizers','rashtriya chemicals','bayer crop','pi industries','dhanuka','rallis'], 'Agriculture'],
      // Media & Entertainment
      [['media','entertainment','zee','sony','network18','sun tv','tv18','dish tv','pvr','inox','balaji telefilms','tips music','saregama'], 'Media & Entertainment'],
      // Defence & Aerospace
      [['defence','defense','aerospace','hal','bharat electronics','bel','bharat dynamics','mazagon','cochin shipyard','garden reach','paras defence','data patterns'], 'Defence'],
    ]
    for (const [keywords, sector] of rules) {
      if (keywords.some(k => n.includes(k))) return sector
    }
    return ''   // Unknown — leave blank rather than guess wrong
  }

  // ── Parse a single sheet's rows into asset items ─────────────────────────
  const parseSheetRows = (rows, sheetCfg) => {
    const { institution, category, isMF } = sheetCfg

    const nameCands     = ['stock name','company name','stock symbol','symbol','instrument','fund name','scheme name','tradingsymbol','scrip','security','stock','name']
    const valueCands    = ['value at market price','current value','cur. val','market value','present value','portfolio value','mkt value','value','amount']
    const ltpCands      = ['current market price','previous closing price','current price','market price','ltp','last price','close price','closing price']
    const qtyCands      = ['quantity available','net qty','qty','quantity','shares','units','no. of shares']
    const avgCands      = ['average cost price','average buy price','avg buy price','avg cost price','avg cost','average price','avg. cost','avg price','purchase price','cost price','avg purchase price','nav']
    const investedCands = ['value at cost','buy value','invested value','investment value','total invested','cost value','purchase value','buy amount']
    const plpctCands    = ['unrealized profit/loss %','unrealized p&l %','gain/loss %','p&l%','profit/loss %','return %']
    const sectorCands   = ['sector','industry','instrument type']
    const isinCands     = ['isin','isin code']

    const allCands = [...nameCands,...valueCands,...ltpCands,...qtyCands,...avgCands,...sectorCands]

    // Score-based header detection (same logic as detectHeaderRow)
    let bestRow = null, bestScore = 0
    for (let i = 0; i < Math.min(rows.length, 35); i++) {
      const row = rows[i]
      if (!row || row.length < 2) continue
      const nonEmpty = row.filter(x => x && x.trim())
      if (nonEmpty.length < 2) continue
      const h = row.map(x => (x||'').toLowerCase().trim())
      const nameScore  = nameCands.filter(c  => h.some(cell => cell.includes(c))).length * 3
      const valueScore = [...valueCands,...ltpCands].filter(c => h.some(cell => cell.includes(c))).length * 2
      const anyScore   = allCands.filter(c   => h.some(cell => cell.includes(c))).length
      const widthBonus = nonEmpty.length >= 4 ? 5 : 0
      const score = nameScore + valueScore + anyScore + widthBonus
      if (score > bestScore) { bestScore = score; bestRow = { idx: i, headers: row.map(x => (x||'').trim()) } }
    }
    if (!bestRow || bestScore < 4) return []

    const { idx: headerIdx, headers } = bestRow
    const h = headers.map(x => x.toLowerCase())

    const colIdx = (cands) => {
      for (const c of cands) {
        const i = h.findIndex(x => x.includes(c))
        if (i !== -1) return i
      }
      return -1
    }

    const nameIdx     = colIdx(nameCands)
    const ltpIdx      = colIdx(ltpCands)
    const qtyIdx      = colIdx(qtyCands)
    const avgIdx      = colIdx(avgCands)
    const sectorIdx   = colIdx(sectorCands)
    const valIdx      = colIdx(valueCands)
    const investedIdx = colIdx(investedCands)
    const plpctIdx    = colIdx(plpctCands)
    const isinIdx     = colIdx(isinCands)

    if (nameIdx === -1) return []

    // Parse sector/instrument type — clean up MF instrument type like "{Equity - Small Cap true}"
    const parseSector = (raw) => {
      if (!raw) return ''
      // MF instrument type format: "{Equity - Small Cap true}" → "Equity - Small Cap"
      const cleaned = raw.replace(/^\{/, '').replace(/\s+true\}$/, '').replace(/\}$/, '').trim()
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
    }

    // Map MF instrument type to WealthRadar category
    const mfCategory = (instrType) => {
      const t = (instrType||'').toLowerCase()
      if (t.includes('gold') || t.includes('silver') || t.includes('commodity')) return 'Gold & Precious Metals'
      if (t.includes('debt') || t.includes('liquid') || t.includes('money market')) return 'Mutual Funds'
      if (t.includes('hybrid')) return 'Mutual Funds'
      if (t.includes('equity') || t.includes('elss')) return 'Mutual Funds'
      if (t.includes('fund of fund') || t.includes('fof')) return 'Mutual Funds'
      return 'Mutual Funds'
    }

    const equityCategory = (sector) => {
      const s = (sector||'').toLowerCase()
      if (s === 'etf') return 'Gold & Precious Metals'
      return 'Stocks & Equities'
    }

    return rows.slice(headerIdx + 1)
      .map((row, i) => {
        const name   = (row[nameIdx]||'').trim().toUpperCase()
        const qty    = qtyIdx !== -1  ? parseFloat(row[qtyIdx]||0)  : 0
        const ltp    = ltpIdx !== -1  ? parseFloat(row[ltpIdx]||0)  : 0
        const avg    = avgIdx !== -1  ? parseFloat(row[avgIdx]||0)  : 0
        const sector = sectorIdx !== -1 ? parseSector(row[sectorIdx]||'') : ''

        let value = 0
        if (valIdx !== -1 && parseFloat(row[valIdx]||0) > 0) {
          value = Math.round(parseFloat(row[valIdx]) * 100) / 100
        } else if (qty > 0 && ltp > 0) {
          value = Math.round(qty * ltp * 100) / 100
        } else if (qty > 0 && avg > 0) {
          value = Math.round(qty * avg * 100) / 100
        }

        // Invested value: use direct column if present, else compute qty × avg
        const directInvested = investedIdx !== -1 ? parseValue(row[investedIdx]||'') : 0
        const investedVal    = directInvested > 0
          ? Math.round(directInvested * 100) / 100
          : (qty > 0 && avg > 0 ? Math.round(qty * avg * 100) / 100 : 0)

        // P&L%: priority → direct plpct col → compute from value/invested → compute from ltp/avg
        let plPct = null
        if (plpctIdx !== -1 && row[plpctIdx] && row[plpctIdx].toString().trim() !== '') {
          plPct = parseValue(row[plpctIdx])   // handles (26.09) → -26.09
        } else if (investedVal > 0 && value > 0) {
          plPct = Math.round(((value - investedVal) / investedVal) * 10000) / 100
        } else if (avg > 0 && ltp > 0) {
          plPct = Math.round(((ltp - avg) / avg) * 10000) / 100
        }

        // ISIN-based sector/category detection for ETFs
        // ETF ISINs from ICICIDirect: INF prefix = MF/ETF, INE prefix = equity
        const isin = isinIdx !== -1 ? (row[isinIdx]||'').trim() : ''
        const isEtf = isin.startsWith('INF') || name.toUpperCase().includes('ETF') ||
                      name.toUpperCase().includes('BEES') || name.toUpperCase().includes('INDEX') ||
                      name.toUpperCase().includes('NIFTY') || name.toUpperCase().includes('FUND OF FUND')
        const isGoldEtf = isEtf && (name.toUpperCase().includes('GOLD') || name.toUpperCase().includes('SILVER') || name.toUpperCase().includes('GOLDBEES'))

        // Category: use ISIN-based ETF detection first, then sector text
        let itemCat
        if (isMF) {
          itemCat = mfCategory(sector)
        } else if (isGoldEtf) {
          itemCat = 'Gold & Precious Metals'
        } else if (isEtf) {
          // Non-gold ETF (Pharma ETF, Nifty ETF, Smallcap ETF etc.) → Stocks & Equities
          itemCat = 'Stocks & Equities'
        } else {
          itemCat = equityCategory(sector)
        }

        // Sector: use file's sector col if present, else detect from company name/ISIN
        const detectedSector = !sector && !isEtf ? detectSectorFromName(name) : ''
        const autoSector = sector
          ? sector.charAt(0).toUpperCase() + sector.slice(1).toLowerCase()
          : isGoldEtf ? 'Gold ETF'
          : isEtf ? 'Index / ETF'
          : detectedSector

        return {
          id:             'import_' + Date.now() + '_' + i,
          name,
          value,
          category:       itemCat,
          institution,
          note:           autoSector,
          _sector:        autoSector,
          _qty:           qty,
          _avgPrice:      avg,
          _ltp:           ltp,
          _investedValue: investedVal,
          _plPct:         plPct,
          _isMF:          isMF,
        }
      })
      .filter(r => r.name.length > 1 && !/^[\d.,₹$%\s\-]+$/.test(r.name))
  }

  const processFile = async (file) => {
    setError('')
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv','txt','xls','xlsx'].includes(ext)) {
      setError('Unsupported file type. Please upload a .csv, .xls, or .xlsx file.')
      return
    }

    try {
      const sheets = await parseFileToRows(file)
      const cfg    = BROKERS[broker]
      let   allItems = []

      // ── Process each sheet ──────────────────────────────────────────────
      const sheetNames = Object.keys(sheets)

      for (const sheetName of sheetNames) {
        const rows    = sheets[sheetName]
        const nameLow = sheetName.toLowerCase()

        // Detect sheet type from sheet name
        const isMF       = nameLow.includes('mutual') || nameLow.includes('fund')
        const isEquity   = nameLow.includes('equity') || nameLow.includes('stock')
        const isCombined = nameLow.includes('combined')
        const isCSV      = nameLow === '_csv'   // single-sheet CSV files
        // Generic holdings sheet names used by various brokers
        const isHoldings = nameLow.includes('holding') || nameLow.includes('portfolio') ||
                           nameLow.includes('report') || nameLow.includes('position')

        // Skip combined sheet if individual equity/MF sheets already exist
        if (isCombined && sheetNames.some(n => n.toLowerCase().includes('equity'))) continue

        // For single-sheet files (CSV, or xlsx with a generic sheet name like "Holdings report")
        // use broker config to determine MF vs equity
        const brokerIsMF = cfg.category === 'Mutual Funds'
        const effectiveIsMF = isMF || (isCSV && brokerIsMF) ||
                              (isHoldings && !isEquity && brokerIsMF) ||
                              (!isEquity && !isMF && !isCombined && !isCSV && !isHoldings && brokerIsMF)

        // Skip sheets that are clearly NOT holdings data
        // Accept: equity, stock, mutual, fund, combined, holdings, portfolio, report, position, csv
        if (!isMF && !isEquity && !isCombined && !isCSV && !isHoldings) continue

        const sheetCfg = {
          institution: cfg.institution || broker,
          category:    effectiveIsMF ? 'Mutual Funds' : 'Stocks & Equities',
          isMF:        effectiveIsMF,
        }

        const items = parseSheetRows(rows, sheetCfg)
        allItems = [...allItems, ...items]
      }

      if (allItems.length === 0) {
        setError(
          'Could not find any holdings in this file.\n\n' +
          '💡 Tips:\n' +
          '• For Zerodha: download from Console → Portfolio → Holdings\n' +
          '• Try "Generic CSV/Excel" if your broker isn\'t listed'
        )
        return
      }

      const sel = {}
      allItems.forEach(item => { sel[item.id] = true })
      setParsed(allItems)
      setSelected(sel)
      setStep('preview')

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
    const existing = financeData?.assets || []

    let added = 0, updated = 0

    parsed
      .filter(item => selected[item.id])
      .forEach(item => {
        const clean = {
          ...item,
          category: overridesCat[item.id] || item.category,
        }

        // Match by name + institution (case-insensitive) to detect duplicates
        const nameLower = (clean.name || '').toLowerCase().trim()
        const instLower = (clean.institution || '').toLowerCase().trim()
        const duplicate = existing.find(e =>
          (e.name  || '').toLowerCase().trim() === nameLower &&
          (e.institution || '').toLowerCase().trim() === instLower
        )

        if (duplicate) {
          // Update existing record — preserve the original id
          updateItem('assets', { ...clean, id: duplicate.id })
          updated++
        } else {
          // New holding — assign fresh id
          addItem('assets', { ...clean, id: uid() })
          added++
        }
      })

    setImportCounts({ added, updated })
    onImported(added + updated, added, updated)
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
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ fontSize:13, color:'#8892b0' }}>
            <span style={{ color:'#16a34a', fontWeight:500 }}>{selectedCount}</span> of {parsed.length} selected
          </div>
          {/* Sheet breakdown badges */}
          {parsed.some(p => !p._isMF) && (
            <span style={{ fontSize:11, background:'rgba(37,99,235,0.08)', border:'1px solid rgba(37,99,235,0.2)', color:'#2563eb', padding:'2px 10px', borderRadius:20, fontWeight:500 }}>
              📈 {parsed.filter(p => !p._isMF).length} Stocks
            </span>
          )}
          {parsed.some(p => p._isMF) && (
            <span style={{ fontSize:11, background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', color:'#7c3aed', padding:'2px 10px', borderRadius:20, fontWeight:500 }}>
              🏦 {parsed.filter(p => p._isMF).length} Mutual Funds
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleAll(true)}>Select All</button>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleAll(false)}>Deselect All</button>
        </div>
      </div>

      {/* Info banner when some holdings are missing present value */}
      {parsed.some(p => p.value <= 0) && (
        <div style={{ marginBottom:12, padding:'10px 14px', background:'rgba(200,146,10,0.07)', border:'1px solid rgba(200,146,10,0.25)', borderRadius:9, display:'flex', alignItems:'flex-start', gap:10 }}>
          <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
          <div style={{ fontSize:12, color:'#92700a', lineHeight:1.6 }}>
            <strong>{parsed.filter(p => p.value <= 0).length} holding{parsed.filter(p=>p.value<=0).length>1?'s':''}</strong> {parsed.filter(p=>p.value<=0).length>1?'are':'is'} missing the current market value.
            Enter the present value manually in the <strong>PRESENT (₹)</strong> column — P&L% will update automatically.
          </div>
        </div>
      )}

      <div style={{ overflowX:'auto', maxHeight:420, marginBottom:20, borderRadius:10, border:'1px solid #eef0f8' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth: hasRichData ? 820 : 480 }}>
          <thead style={{ position:'sticky', top:0, zIndex:2 }}>
            <tr style={{ background:'#fafbfe' }}>
              <th style={{ padding:'10px 12px', textAlign:'left',  fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', width:32, whiteSpace:'nowrap' }}></th>
              <th style={{ padding:'10px 12px', textAlign:'left',  fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>TYPE</th>
              <th style={{ padding:'10px 12px', textAlign:'left',  fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>NAME</th>
              {hasRichData && <th style={{ padding:'10px 12px', textAlign:'left',  fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>SECTOR</th>}
              {hasRichData && <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, color:'#8892b0', borderBottom:'1px solid #eef0f8', whiteSpace:'nowrap' }}>
                {parsed.some(p => p._isMF) && parsed.some(p => !p._isMF) ? 'QTY / UNITS' : parsed.some(p => p._isMF) ? 'UNITS' : 'QTY'}
              </th>}
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

                {/* Type badge */}
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', whiteSpace:'nowrap' }}>
                  {item._isMF
                    ? <span style={{ fontSize:10, background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', color:'#7c3aed', padding:'2px 8px', borderRadius:10, fontWeight:500 }}>MF</span>
                    : <span style={{ fontSize:10, background:'rgba(37,99,235,0.08)', border:'1px solid rgba(37,99,235,0.2)', color:'#2563eb', padding:'2px 8px', borderRadius:10, fontWeight:500 }}>EQ</span>
                  }
                </td>
                {/* Name + institution */}
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', fontSize:13, color:'#1a1d2e' }}>
                  <div style={{ fontWeight:500 }}>{item.name}</div>
                  {item.institution && <div style={{ fontSize:10, color:'#b0b8d0', marginTop:1 }}>{item.institution}</div>}
                </td>

                {/* Sector */}
                {hasRichData && (
                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #f4f5fb', fontSize:11, color:'#6b7494', whiteSpace:'nowrap', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis' }}>
                    {item._sector
                      ? item._sector.charAt(0).toUpperCase() + item._sector.slice(1).toLowerCase()
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

                {/* Present value — always editable inline */}
                <td style={{ padding:'6px 12px', borderBottom:'1px solid #f4f5fb', textAlign:'right', whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
                    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                      <span style={{ position:'absolute', left:8, fontSize:11, color: item.value > 0 ? '#16a34a' : '#c8920a', pointerEvents:'none', fontFamily:"'JetBrains Mono',monospace" }}>₹</span>
                      <input
                        type="number"
                        value={item.value > 0 ? item.value : ''}
                        placeholder="Enter present value"
                        style={{
                          background: item.value > 0 ? 'rgba(22,163,74,0.05)' : 'rgba(200,146,10,0.06)',
                          border: `1px solid ${item.value > 0 ? 'rgba(22,163,74,0.25)' : '#c8920a'}`,
                          borderRadius: 6, color:'#1a1d2e', fontSize:12,
                          padding:'4px 8px 4px 20px', width:110,
                          fontFamily:"'JetBrains Mono',monospace", textAlign:'right',
                          outline:'none', transition:'border-color 0.15s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#c8920a'}
                        onBlur={e => e.target.style.borderColor = item.value > 0 ? 'rgba(22,163,74,0.25)' : '#c8920a'}
                        onChange={e => {
                          const newVal = parseFloat(e.target.value) || 0
                          setParsed(prev => prev.map(p => {
                            if (p.id !== item.id) return p
                            // Recalculate P&L% live when present value is edited
                            const inv    = p._investedValue || 0
                            const newPct = inv > 0 && newVal > 0
                              ? Math.round(((newVal - inv) / inv) * 10000) / 100
                              : null
                            return { ...p, value: newVal, _plPct: newPct }
                          }))
                        }}
                      />
                    </div>
                    {item.value <= 0 && (
                      <span style={{ fontSize:9, color:'#c8920a', letterSpacing:'0.04em' }}>REQUIRED</span>
                    )}
                  </div>
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
                <td colSpan={3} style={{ padding:'11px 12px', fontSize:12, fontWeight:700, color:'#1a1d2e' }}>
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
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
            {(() => {
              const missingVal = parsed.filter(p => selected[p.id] && p.value <= 0).length
              return missingVal > 0 ? (
                <span style={{ fontSize:11, color:'#c8920a' }}>
                  ⚠ {missingVal} holding{missingVal>1?'s':''} still missing present value
                </span>
              ) : null
            })()}
            <button className="btn btn-gold" onClick={confirmImport} disabled={selectedCount === 0}>
              Import {selectedCount} {selectedCount === 1 ? 'Asset' : 'Assets'} →
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
  }

  // ── STEP: done ───────────────────────────────────────────────────────────
  return (
    <Modal title="Import Complete! 🎉" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'20px 0' }}>
        <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:'#1a1d2e', marginBottom:16 }}>
          Holdings Updated
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:16, marginBottom:24, flexWrap:'wrap' }}>
          {importCounts.added > 0 && (
            <div style={{ padding:'12px 24px', background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:12 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:28, fontWeight:700, color:'#16a34a' }}>{importCounts.added}</div>
              <div style={{ fontSize:12, color:'#16a34a', marginTop:4 }}>New holdings added</div>
            </div>
          )}
          {importCounts.updated > 0 && (
            <div style={{ padding:'12px 24px', background:'rgba(37,99,235,0.07)', border:'1px solid rgba(37,99,235,0.18)', borderRadius:12 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:28, fontWeight:700, color:'#2563eb' }}>{importCounts.updated}</div>
              <div style={{ fontSize:12, color:'#2563eb', marginTop:4 }}>Existing holdings updated</div>
            </div>
          )}
        </div>
        <div style={{ fontSize:13, color:'#8892b0', marginBottom:24, lineHeight:1.6 }}>
          {importCounts.updated > 0 && importCounts.added === 0
            ? 'All holdings were already in your portfolio — values refreshed with latest prices.'
            : 'Your holdings are now visible in the Assets tab.'}
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
