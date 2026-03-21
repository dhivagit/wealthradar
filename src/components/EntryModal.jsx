import { useState } from 'react'
import { Modal, Field } from './UI'
import { ASSET_CATS, LIABILITY_CATS, INCOME_CATS, EXPENSE_CATS } from '../utils/constants'
import { CURRENCIES } from '../utils/constants'
import { uid } from '../utils/helpers'
import { useFinance } from '../context/FinanceContext'

const CATS = {
  assets:      ASSET_CATS,
  liabilities: LIABILITY_CATS,
  income:      INCOME_CATS,
  expenses:    EXPENSE_CATS,
}

// ── Smart auto-categorization rules ──────────────────────────────────────────
// Matches keywords in the asset name and returns the best category
function smartCategory(name, collection) {
  if (collection !== 'assets') return null
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

const PLACEHOLDER_NAME = {
  assets:      'e.g. HDFC Savings Account',
  liabilities: 'e.g. SBI Home Loan',
  income:      'e.g. Monthly Salary',
  expenses:    'e.g. Rent / EMI',
}

export default function EntryModal({ collection, item, onClose, onSaved }) {
  const { addItem, updateItem, settings } = useFinance()
  const isEdit    = Boolean(item?.id)
  const cats      = CATS[collection]
  const isCF      = collection === 'income' || collection === 'expenses'
  const isLiab    = collection === 'liabilities'
  const currSymbol = CURRENCIES.find(c => c.code === settings.currency)?.symbol || '₹'

  const [form, setForm] = useState({
    name:        item?.name        || '',
    category:    item?.category    || cats[0],
    value:       item?.value       || '',
    monthly:     item?.monthly     || '',
    institution: item?.institution || '',
    rate:        item?.rate        || '',
    note:        item?.note        || '',
  })
  const [saving, setSaving] = useState(false)
  const [autoSuggested, setAutoSuggested] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Auto-categorize when name changes (only for new entries, not edits)
  const handleNameChange = (v) => {
    f('name', v)
    if (isEdit) return
    const suggested = smartCategory(v, collection)
    if (suggested && cats.includes(suggested)) {
      setForm(p => ({ ...p, name: v, category: suggested }))
      setAutoSuggested(true)
    } else {
      setAutoSuggested(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 200))

    const entry = {
      id:          item?.id || uid(),
      name:        form.name.trim(),
      category:    form.category,
      institution: form.institution.trim(),
      note:        form.note.trim(),
      ...(isCF
        ? { monthly: parseFloat(form.monthly) || 0 }
        : { value:   parseFloat(form.value)   || 0 }),
      ...(isLiab && form.rate ? { rate: parseFloat(form.rate) } : {}),
    }

    if (isEdit) updateItem(collection, entry)
    else        addItem(collection, entry)

    setSaving(false)
    onSaved?.()
    onClose()
  }

  const title = `${isEdit ? 'Edit' : 'Add'} ${collection.charAt(0).toUpperCase() + collection.slice(1, -1)}`

  return (
    <Modal title={title} onClose={onClose}>
      <div>
        <Field label="Name / Description">
          <input className="input" value={form.name} onChange={e => handleNameChange(e.target.value)}
            placeholder={PLACEHOLDER_NAME[collection]} autoFocus />
        </Field>

        <Field label="Category">
          {autoSuggested && (
            <div style={{ fontSize:11, color:'#059669', background:'rgba(5,150,105,0.08)',
              border:'1px solid rgba(5,150,105,0.2)', borderRadius:6, padding:'4px 10px',
              marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
              <span>✨</span>
              <span>Auto-detected from name — change below if needed</span>
            </div>
          )}
          <select className="input" value={form.category}
            onChange={e => { f('category', e.target.value); setAutoSuggested(false) }}>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        {isCF ? (
          <Field label={`Monthly Amount (${currSymbol})`}>
            <input className="input" type="number" min="0" value={form.monthly}
              onChange={e => f('monthly', e.target.value)} placeholder="0" />
          </Field>
        ) : (
          <Field label={`${isLiab ? 'Outstanding Balance' : 'Current Value'} (${currSymbol})`}>
            <input className="input" type="number" min="0" value={form.value}
              onChange={e => f('value', e.target.value)} placeholder="0" />
          </Field>
        )}

        {!isCF && (
          <Field label="Institution / Provider">
            <input className="input" value={form.institution}
              onChange={e => f('institution', e.target.value)}
              placeholder="e.g. SBI, HDFC, Zerodha…" />
          </Field>
        )}

        {isLiab && (
          <Field label="Interest Rate (% p.a.)">
            <input className="input" type="number" min="0" max="100" step="0.1"
              value={form.rate} onChange={e => f('rate', e.target.value)}
              placeholder="e.g. 8.5" />
          </Field>
        )}

        <Field label="Note (optional)">
          <input className="input" value={form.note}
            onChange={e => f('note', e.target.value)}
            placeholder="Any relevant notes…"
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving
              ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>↻</span>
              : null}
            {isEdit ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
