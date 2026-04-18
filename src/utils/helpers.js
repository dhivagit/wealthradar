import { CURRENCIES, MONTHS } from './constants'

// ─── Currency Formatting ──────────────────────────────────────────────────────
export function formatCurrency(n, currencyCode = 'INR') {
  const c = CURRENCIES.find(x => x.code === currencyCode) || CURRENCIES[0]
  try {
    return new Intl.NumberFormat(c.locale, {
      style: 'currency',
      currency: c.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `${c.symbol}${Math.round(n).toLocaleString()}`
  }
}

/** USD amounts for US holdings table / forms (2–4 dp). */
export function formatUsdAmount(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const x = Number(n)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(x)
}

export function formatCompact(n, currencyCode = 'INR') {
  const c = CURRENCIES.find(x => x.code === currencyCode) || CURRENCIES[0]
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (currencyCode === 'INR') {
    if (abs >= 10_000_000) return `${sign}${c.symbol}${(abs / 10_000_000).toFixed(2)}Cr`
    if (abs >= 100_000)    return `${sign}${c.symbol}${(abs / 100_000).toFixed(2)}L`
    if (abs >= 1_000)      return `${sign}${c.symbol}${(abs / 1_000).toFixed(1)}K`
    return `${sign}${c.symbol}${abs.toFixed(0)}`
  }
  if (abs >= 1_000_000_000) return `${sign}${c.symbol}${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000)     return `${sign}${c.symbol}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)         return `${sign}${c.symbol}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${c.symbol}${abs.toFixed(0)}`
}

// ─── Group Array by Key ───────────────────────────────────────────────────────
export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const g = item[key] || 'Other'
    acc[g] = acc[g] || []
    acc[g].push(item)
    return acc
  }, {})
}

// ─── Generate unique id ───────────────────────────────────────────────────────
export const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

/** Best-effort created/ordering time from asset id (`${Date.now()}_…` or `manual_${ts}`). */
export function assetIdToTimestamp(id) {
  if (id == null || id === '') return null
  const s = String(id)
  const manual = s.match(/^manual_(\d+)$/)
  if (manual) return Number(manual[1])
  const head = s.split('_')[0]
  const t = parseInt(head, 10)
  return Number.isFinite(t) ? t : null
}

// ─── Simple password hash (for local auth) ────────────────────────────────────
export function hashPassword(pw) {
  let h = 0
  for (let i = 0; i < pw.length; i++) {
    h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

// ─── Local Storage DB ─────────────────────────────────────────────────────────
export const DB = {
  getUsers:      ()      => { try { return JSON.parse(localStorage.getItem('wr_users') || '{}') } catch { return {} } },
  saveUsers:     (u)     => { try { localStorage.setItem('wr_users', JSON.stringify(u)) } catch {} },
  getData:       (uid)   => { try { const d = localStorage.getItem(`wr_data_${uid}`); return d ? JSON.parse(d) : null } catch { return null } },
  saveData:      (uid,d) => { try { localStorage.setItem(`wr_data_${uid}`, JSON.stringify(d)) } catch {} },
  getSettings:   (uid)   => { try { return JSON.parse(localStorage.getItem(`wr_settings_${uid}`) || 'null') } catch { return null } },
  saveSettings:  (uid,s) => { try { localStorage.setItem(`wr_settings_${uid}`, JSON.stringify(s)) } catch {} },
  getSession:    ()      => { try { return JSON.parse(sessionStorage.getItem('wr_session') || 'null') } catch { return null } },
  saveSession:   (s)     => { try { sessionStorage.setItem('wr_session', JSON.stringify(s)) } catch {} },
  clearSession:  ()      => { try { sessionStorage.removeItem('wr_session') } catch {} },
}

// ─── Sample Data Factory ──────────────────────────────────────────────────────
export function createSampleData() {
  const history = Array.from({ length: 12 }, (_, i) => {
    const base = 3_500_000 + i * 95_000 + Math.sin(i) * 40_000
    return {
      month:        MONTHS[i],
      assets:       base + 2_800_000,
      liabilities:  base - 350_000,
      netWorth:     base + 200_000 + i * 22_000,
      income:       128_500 + Math.random() * 8_000,
      expenses:     72_000  + Math.random() * 5_000,
    }
  })

  return {
    assets: [
      { id: uid(), name: 'HDFC Savings Account',   category: 'Cash & Equivalents',   value: 180_000, institution: 'HDFC Bank',    note: 'Primary account' },
      { id: uid(), name: 'SBI Fixed Deposit',       category: 'Fixed Deposits',        value: 500_000, institution: 'SBI',          note: '5yr @ 7.2% p.a.' },
      { id: uid(), name: 'Zerodha Equity Portfolio',category: 'Stocks & Equities',     value: 750_000, institution: 'Zerodha',      note: '' },
      { id: uid(), name: 'Mirae Asset ELSS Fund',   category: 'Mutual Funds',          value: 320_000, institution: 'Mirae AMC',    note: '80C eligible' },
      { id: uid(), name: 'EPF Balance',             category: 'PPF / EPF',             value: 480_000, institution: 'EPFO',         note: '' },
      { id: uid(), name: 'Apartment – Chennai',     category: 'Real Estate',           value: 6_500_000, institution: '',           note: '2BHK, purchased 2020' },
      { id: uid(), name: 'Sovereign Gold Bond',     category: 'Gold & Precious Metals',value: 220_000, institution: 'RBI',          note: '2.5% interest p.a.' },
      { id: uid(), name: 'Honda City 2022',         category: 'Vehicles',              value: 650_000, institution: '',             note: '' },
    ],
    liabilities: [
      { id: uid(), name: 'SBI Home Loan',           category: 'Home Loan',     value: 3_800_000, institution: 'SBI',       rate: 8.5,  note: 'EMI ₹36,000/mo' },
      { id: uid(), name: 'HDFC Car Loan',           category: 'Vehicle Loan',  value: 280_000,   institution: 'HDFC Bank', rate: 9.2,  note: 'EMI ₹8,500/mo' },
      { id: uid(), name: 'ICICI Credit Card',       category: 'Credit Card Debt', value: 42_000, institution: 'ICICI Bank',rate: 36,   note: 'Clear ASAP!' },
    ],
    income: [
      { id: uid(), name: 'Monthly Salary (Net)', category: 'Salary',        monthly: 95_000, note: 'Post TDS' },
      { id: uid(), name: 'Rental Income',        category: 'Rental Income', monthly: 18_000, note: '2nd property' },
      { id: uid(), name: 'Freelance Projects',   category: 'Freelance',     monthly: 12_000, note: 'Variable avg' },
      { id: uid(), name: 'Dividend Income',      category: 'Dividends',     monthly: 3_500,  note: 'Equity portfolio' },
    ],
    expenses: [
      { id: uid(), name: 'Home Loan EMI',        category: 'EMIs',              monthly: 36_000, note: '' },
      { id: uid(), name: 'Car Loan EMI',          category: 'EMIs',              monthly: 8_500,  note: '' },
      { id: uid(), name: 'Groceries & Food',      category: 'Food & Groceries',  monthly: 12_000, note: '' },
      { id: uid(), name: 'Utilities & Internet',  category: 'Utilities',         monthly: 4_500,  note: '' },
      { id: uid(), name: 'Family Health Insurance', category: 'Insurance',       monthly: 3_200,  note: 'Floater policy' },
      { id: uid(), name: 'Entertainment & OTT',   category: 'Entertainment',     monthly: 2_800,  note: '' },
      { id: uid(), name: 'Fuel & Transport',       category: 'Transport',         monthly: 6_000,  note: '' },
      { id: uid(), name: 'Household Shopping',     category: 'Shopping',          monthly: 5_000,  note: '' },
    ],
    history,
    snapshots: [],
    createdAt: Date.now(),
  }
}

// ─── Export helpers ───────────────────────────────────────────────────────────
export function dataToCSV(data, currency) {
  const c = CURRENCIES.find(x => x.code === currency) || CURRENCIES[0]
  const rows = [
    ['Type', 'Name', 'Category', 'Value / Monthly', 'Institution', 'Rate %', 'Note'],
    ...data.assets.map(a      => ['Asset',     a.name, a.category, a.value,   a.institution || '', '',           a.note || '']),
    ...data.liabilities.map(l => ['Liability', l.name, l.category, l.value,   l.institution || '', l.rate || '', l.note || '']),
    ...data.income.map(i      => ['Income',    i.name, i.category, i.monthly, '',                  '',           i.note || '']),
    ...data.expenses.map(e    => ['Expense',   e.name, e.category, e.monthly, '',                  '',           e.note || '']),
  ]
  return rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n')
}

export function downloadBlob(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
