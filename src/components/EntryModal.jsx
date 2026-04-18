import { useState, useEffect, useMemo } from 'react'
import { Modal, Field } from './UI'
import { ASSET_CATS, LIABILITY_CATS, INCOME_CATS, EXPENSE_CATS } from '../utils/constants'
import { CURRENCIES } from '../utils/constants'
import { uid, assetIdToTimestamp } from '../utils/helpers'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { detectMFCategory } from '../utils/detection'

const CATS = {
  assets:      ASSET_CATS,
  liabilities: LIABILITY_CATS,
  income:      INCOME_CATS,
  expenses:    EXPENSE_CATS,
}

// Categories that show equity-specific fields (Qty, Avg Price, Invested, Present Value, Source)
const EQUITY_CATS = new Set(['Stocks & Equities', 'Mutual Funds', 'Gold & Precious Metals', 'Cryptocurrency'])

// ── Smart auto-categorization ─────────────────────────────────────────────────
function smartCategory(name, collection) {
  if (collection !== 'assets') return null
  const n = (name || '').toLowerCase().trim()
  if (!n) return null

  if (n === 'metaietf' || /mirae.?asset.?etf.?nifty.?metal/.test(n)) return 'Stocks & Equities'

  const isFoF = /fund of fund/.test(n) || / fof/.test(n) || n.endsWith('fof') || /-fof/.test(n)
  if (isFoF) {
    if (/gold|silver|precious|commodity/.test(n)) return 'Gold & Precious Metals'
    return 'Mutual Funds'
  }

  if (/gold|silver/.test(n)) {
    if (/etf|bees|exchange traded|goldbees|silverbees/.test(n)) return 'Gold & Precious Metals'
    if (/savings fund|gold fund|silver fund/.test(n))          return 'Gold & Precious Metals'
    if (/sgb|sovereign gold bond|digital gold/.test(n))        return 'Gold & Precious Metals'
    if (!/fund|etf/.test(n))                                   return 'Gold & Precious Metals'
  }
  if (/jewel|jewelry|jewellery|ornament|platinum/.test(n) && !/fund|etf/.test(n)) return 'Gold & Precious Metals'

  if (/ etf/.test(n) || n.endsWith('etf') || /exchange traded/.test(n)) return 'Stocks & Equities'

  if (/fund/.test(n)) return 'Mutual Funds'
  if (/scheme|folio|sip|elss|nfo|direct plan|regular plan|growth plan|dividend plan|idcw/.test(n)) return 'Mutual Funds'
  if (/large.?cap|mid.?cap|small.?cap|flexi.?cap|multi.?cap|balanced advantage|hybrid|debt|liquid|overnight|arbitrage|index|nifty|sensex|contra|thematic|momentum|consumption|international|global|overseas/.test(n)) return 'Mutual Funds'
  if (/mirae|nippon|edelweiss|whiteoak|pgim|invesco|baroda.?bnp|taurus|jm.?financial/.test(n)) return 'Mutual Funds'

  if (/share|stock|nse|bse|zerodha|groww|demat|ipo|smallcase/.test(n)) return 'Stocks & Equities'
  if (/infy|tcs|reliance|wipro|hcl|ongc|tatamotors|bajaj|tatasteel|infosys/.test(n)) return 'Stocks & Equities'
  if (/equity/.test(n) && !/fund|plan/.test(n)) return 'Stocks & Equities'

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

// ── Sector auto-detection from stock name ────────────────────────────────────
function detectSector(name) {
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

const PLACEHOLDER_NAME = {
  assets:      'e.g. INFY, HDFC BANK, Axis Midcap Fund',
  liabilities: 'e.g. SBI Home Loan',
  income:      'e.g. Monthly Salary',
  expenses:    'e.g. Rent / EMI',
}

const BROKERS = ['Zerodha','Groww','ICICI Direct','INDMoney','Aionion Capital','MF Central','Kuvera','HDFC Securities','Kotak Securities','Angel One','5Paisa','Upstox','NSDL/CDSL','EPFO','Post Office','SBI','HDFC Bank','Other']

export default function EntryModal({ collection, item, onClose, onSaved }) {
  const { addItem, updateItem, settings } = useFinance()
  const { session } = useAuth()
  const isEdit     = Boolean(item?.id)
  const cats       = CATS[collection]
  const isCF       = collection === 'income' || collection === 'expenses'
  const isLiab     = collection === 'liabilities'
  const currSymbol = CURRENCIES.find(c => c.code === settings.currency)?.symbol || '₹'
  const isAsset    = collection === 'assets'

  // ── Goals mapping (stored in wr_profile_<userId> as _goalMap) ───────────────
  const { goalOptions, initialGoalName } = useMemo(() => {
    if (!isAsset || !session?.userId) return { goalOptions: [], initialGoalName: '' }
    try {
      const p = JSON.parse(localStorage.getItem(`wr_profile_${session.userId}`) || '{}')
      const goals = Array.isArray(p?.goals) ? p.goals : []
      const opts = goals.map(g => (g?.label || '')).filter(Boolean)
      const goalMap = p?._goalMap || {}
      const assetId = item?.id
      let initial = ''
      if (assetId && goalMap && typeof goalMap === 'object') {
        for (const [goalName, ids] of Object.entries(goalMap)) {
          if (Array.isArray(ids) && ids.includes(assetId)) { initial = goalName; break }
        }
      }
      return { goalOptions: opts, initialGoalName: initial }
    } catch {
      return { goalOptions: [], initialGoalName: '' }
    }
  }, [isAsset, session?.userId, item?.id])

  const [form, setForm] = useState({
    name:          item?.name          || '',
    category:      item?.category      || cats[0],
    value:         item?.value         || '',
    monthly:       item?.monthly       || '',
    institution:   item?.institution   || '',
    rate:          item?.rate          || '',
    dueDate:       item?.dueDate       || '',
    note:          item?.note          || item?._sector || '',
    // Equity-specific fields
    qty:           item?._qty          || '',
    avgPrice:      item?._avgPrice     || '',
    investedValue: item?._investedValue|| '',
  })
  const [goalName, setGoalName] = useState(initialGoalName || '')
  const [saving, setSaving]           = useState(false)
  const [autoSuggested, setAutoSuggested] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Keep goal selection in sync when switching between rows (edit -> edit)
  useEffect(() => {
    setGoalName(initialGoalName || '')
  }, [initialGoalName])

  // Derived: is this an equity-type asset?
  const isEquityCat = EQUITY_CATS.has(form.category)
  const isMF        = form.category === 'Mutual Funds'
  const isNpsCat    = !isCF && !isLiab && form.category === 'NPS'
  const isRealEstateCat = !isCF && !isLiab && form.category === 'Real Estate'

  // Auto-calc invested value when qty × avgPrice changes (stocks/ETF-like only)
  useEffect(() => {
    if (!EQUITY_CATS.has(form.category) || isMF) return
    const q = parseFloat(form.qty)
    const a = parseFloat(form.avgPrice)
    if (q > 0 && a > 0) {
      f('investedValue', String(Math.round(q * a * 100) / 100))
    }
  }, [form.category, form.qty, form.avgPrice, isMF])

  // Auto-calc P&L %
  const invested = parseFloat(form.investedValue) || 0
  const present  = parseFloat(form.value) || 0
  const plPct    = invested > 0 && present > 0 ? ((present - invested) / invested * 100) : null
  const plAbs    = invested > 0 && present > 0 ? present - invested : null

  // Auto-categorize + auto-detect sector on name change
  const handleNameChange = (v) => {
    f('name', v)
    if (isEdit) return
    const suggested = smartCategory(v, collection)
    if (suggested && cats.includes(suggested)) {
      setForm(p => ({
        ...p,
        name:     v,
        category: suggested,
      }))
      setAutoSuggested(true)
    } else {
      setForm(p => ({ ...p, name: v }))
      setAutoSuggested(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 200))

    const qty      = parseFloat(form.qty)      || 0
    const avgPrice = parseFloat(form.avgPrice) || 0
    const invVal   = parseFloat(form.investedValue) || (qty > 0 && avgPrice > 0 ? qty * avgPrice : 0)
    const presVal  = parseFloat(form.value) || 0
    const plPctFin = invVal > 0 && presVal > 0 ? ((presVal - invVal) / invVal * 100) : null
    const newPresentValue = presVal || invVal
    const oldPresentValue = Number(item?.value) || 0
    const presentValueChanged =
      !isEdit ||
      Math.round(newPresentValue * 100) !== Math.round(oldPresentValue * 100)

    const entryId = item?.id || uid()
    const entry = {
      id:          entryId,
      name:        form.name.trim().toUpperCase(),
      category:    form.category,
      institution: form.institution.trim(),
      note:        form.note.trim(),
      ...(isCF
        ? { monthly: parseFloat(form.monthly) || 0 }
        : { value:   newPresentValue }),       // fallback to invested if no present value
      ...(isLiab && form.rate ? { rate: parseFloat(form.rate) } : {}),
      ...(isLiab ? { dueDate: form.category === 'Credit Card Debt' ? (form.dueDate || '') : '' } : {}),
      // Equity-specific metadata (only saved for equity/MF categories)
      ...(isEquityCat && {
        _qty:           qty,
        _avgPrice:      avgPrice,
        _investedValue: invVal,
        _ltp:           qty > 0 && presVal > 0 ? Math.round(presVal / qty * 100) / 100 : 0,
        _plPct:         plPctFin,
        _isMF:          isMF,
        _sector:        isMF ? detectMFCategory(form.name.trim()) : detectSector(form.name.trim()),
      }),
      ...(isRealEstateCat && {
        _investedValue: invVal,
        _plPct:         plPctFin,
      }),
      ...(isNpsCat && {
        _investedValue: invVal,
        _plPct:         plPctFin,
      }),
      // Present-value change timestamp only (remarks / other fields do not bump this)
      ...(collection === 'assets' && {
        _updatedDate: presentValueChanged
          ? Date.now()
          : (item?._updatedDate ?? assetIdToTimestamp(item?.id) ?? Date.now()),
      }),
    }

    if (isEdit) updateItem(collection, entry)
    else        addItem(collection, entry)

    // Sync goal mapping to My Goals (stored in profile _goalMap)
    if (isAsset && session?.userId) {
      try {
        const key = `wr_profile_${session.userId}`
        const p = JSON.parse(localStorage.getItem(key) || '{}')
        const current = (p?._goalMap && typeof p._goalMap === 'object') ? p._goalMap : {}
        const cleaned = {}
        // Remove this asset id from every goal first
        for (const [g, ids] of Object.entries(current)) {
          if (!Array.isArray(ids)) continue
          const next = ids.filter(x => x !== entryId)
          if (next.length > 0) cleaned[g] = next
        }
        // Add to selected goal (if any)
        const selected = (goalName || '').trim()
        if (selected) {
          cleaned[selected] = Array.isArray(cleaned[selected]) ? cleaned[selected] : []
          if (!cleaned[selected].includes(entryId)) cleaned[selected].push(entryId)
        }
        localStorage.setItem(key, JSON.stringify({ ...p, _goalMap: cleaned }))
      } catch {}
    }

    setSaving(false)
    onSaved?.()
    onClose()
  }

  const title = `${isEdit ? 'Edit' : 'Add'} ${collection.charAt(0).toUpperCase() + collection.slice(1, -1)}`

  return (
    <Modal title={title} onClose={onClose} wide={isLiab}>
      <div>

        {/* Name */}
        <Field label="Name / Description">
          <input className="input" value={form.name} onChange={e => handleNameChange(e.target.value)}
            placeholder={PLACEHOLDER_NAME[collection]} autoFocus />
        </Field>

        {/* Category */}
        <Field label="Category">
          {autoSuggested && (
            <div style={{ fontSize:11, color:'#059669', background:'rgba(5,150,105,0.08)',
              border:'1px solid rgba(5,150,105,0.2)', borderRadius:6, padding:'4px 10px',
              marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
              <span>✨</span><span>Auto-detected — change below if needed</span>
            </div>
          )}
          <select className="input" value={form.category}
            onChange={e => { f('category', e.target.value); setAutoSuggested(false) }}>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        {/* ── Equity / MF specific fields ─────────────────────────── */}
        {!isCF && !isLiab && isEquityCat && (
          <>
            <div style={{ background:'rgba(91,143,249,0.04)', border:'1px solid rgba(91,143,249,0.15)',
              borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#5b8ff9', letterSpacing:'0.05em',
                textTransform:'uppercase', marginBottom:12 }}>
                {isMF ? '📊 Fund Details' : '📈 Stock / ETF Details'}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {/* Qty / Units */}
                <Field label={isMF ? 'Units' : 'Qty / Shares'}>
                  <div style={{ position:'relative' }}>
                    <input className="input" type="number" min="0" step="any"
                      value={form.qty} onChange={e => f('qty', e.target.value)}
                      placeholder={isMF ? 'e.g. 152.345' : 'e.g. 25'}
                      style={{ width:'100%', boxSizing:'border-box' }} />
                  </div>
                </Field>

                {/* Avg Buy Price (stocks/ETF only) */}
                {!isMF && (
                  <Field label="Avg Buy Price (₹)"
                    hint={form.qty && form.avgPrice ? `Invested: ${currSymbol}${Math.round(parseFloat(form.qty)*parseFloat(form.avgPrice)).toLocaleString('en-IN')}` : ''}>
                    <input className="input" type="number" min="0" step="any"
                      value={form.avgPrice} onChange={e => f('avgPrice', e.target.value)}
                      placeholder="e.g. 1450.50"
                      style={{ width:'100%', boxSizing:'border-box' }} />
                  </Field>
                )}

                {/* Invested Value — auto-filled or manual */}
                <Field label="Invested Value (₹)" hint={isMF ? 'Enter total invested amount' : 'Auto-calculated from Qty × Avg Price'}>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                      color:'#8892b0', fontSize:13, pointerEvents:'none' }}>₹</span>
                    <input className="input" type="number" min="0" step="any"
                      value={form.investedValue} onChange={e => f('investedValue', e.target.value)}
                      placeholder="0"
                      style={{ paddingLeft:22, width:'100%', boxSizing:'border-box',
                        background: (!isMF && form.qty && form.avgPrice) ? 'rgba(22,163,74,0.04)' : undefined }} />
                  </div>
                </Field>

                {/* Present / Current Value */}
                <Field label="Present Value (₹)" hint={plPct !== null ? `P&L: ${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}% (${plPct >= 0 ? '+' : ''}${currSymbol}${Math.round(Math.abs(plAbs)).toLocaleString('en-IN')})` : 'Current market value'}>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                      color:'#8892b0', fontSize:13, pointerEvents:'none' }}>₹</span>
                    <input className="input" type="number" min="0" step="any"
                      value={form.value} onChange={e => f('value', e.target.value)}
                      placeholder="0"
                      style={{ paddingLeft:22, width:'100%', boxSizing:'border-box',
                        borderColor: plPct !== null ? (plPct >= 0 ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)') : undefined }} />
                  </div>
                </Field>
              </div>

              {/* Live P&L preview */}
              {plPct !== null && (
                <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8,
                  background: plPct >= 0 ? 'rgba(22,163,74,0.07)' : 'rgba(220,38,38,0.07)',
                  border: `1px solid ${plPct >= 0 ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
                  display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#6b7494' }}>Unrealised P&L</span>
                  <div style={{ display:'flex', gap:14 }}>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700,
                      color: plPct >= 0 ? '#16a34a' : '#dc2626' }}>
                      {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                    </span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600,
                      color: plPct >= 0 ? '#16a34a' : '#dc2626' }}>
                      {plPct >= 0 ? '+' : '-'}{currSymbol}{Math.round(Math.abs(plAbs)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Source / Broker */}
            <Field label="Source / Broker">
              <input
                className="input"
                value={form.institution}
                onChange={e => f('institution', e.target.value)}
                placeholder="Select or type broker…"
                list="broker-options"
                style={{ width:'100%', boxSizing:'border-box' }}
              />
              <datalist id="broker-options">
                {BROKERS.map(b => <option key={b} value={b} />)}
              </datalist>
            </Field>

            {/* Remarks field */}
            <Field label="Remarks (optional)"
              hint={isMF ? 'e.g. Fund category - Large Cap, Mid Cap, ELSS, Hybrid' : form.category === 'Gold & Precious Metals' ? 'e.g. Gold, Silver, Platinum' : 'e.g. Sector - Banking, Software & IT, Pharmaceuticals'}>
              <input className="input" value={form.note} onChange={e => f('note', e.target.value)}
                placeholder={isMF ? 'e.g. Mid Cap Fund' : form.category === 'Gold & Precious Metals' ? 'e.g. Gold Coins' : 'e.g. IT Sector Stock'}
                onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </Field>

            {/* Goal mapping */}
            {isAsset && goalOptions.length > 0 && (
              <Field label="Goal (optional)">
                <select className="input" value={goalName} onChange={e => setGoalName(e.target.value)}>
                  <option value="">— Not linked —</option>
                  {goalOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
            )}
          </>
        )}

        {/* ── Real Estate: invested (cost) + present value + P&L ─── */}
        {!isCF && !isLiab && isRealEstateCat && (
          <>
            <div style={{ background:'rgba(240,155,70,0.06)', border:'1px solid rgba(240,155,70,0.2)',
              borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#c2410c', letterSpacing:'0.05em',
                textTransform:'uppercase', marginBottom:12 }}>
                🏠 Property valuation
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Field label={`Invested / cost basis (${currSymbol})`} hint="Purchase, registration, major improvements…">
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                      color:'#8892b0', fontSize:13, pointerEvents:'none' }}>₹</span>
                    <input className="input" type="number" min="0" step="any"
                      value={form.investedValue} onChange={e => f('investedValue', e.target.value)}
                      placeholder="0"
                      style={{ paddingLeft:22, width:'100%', boxSizing:'border-box' }} />
                  </div>
                </Field>
                <Field label={`Present / market value (${currSymbol})`} hint={plPct !== null ? `P&L: ${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}% (${plPct >= 0 ? '+' : ''}${currSymbol}${Math.round(Math.abs(plAbs)).toLocaleString('en-IN')})` : 'Current estimated value'}>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                      color:'#8892b0', fontSize:13, pointerEvents:'none' }}>₹</span>
                    <input className="input" type="number" min="0" step="any"
                      value={form.value} onChange={e => f('value', e.target.value)}
                      placeholder="0"
                      style={{ paddingLeft:22, width:'100%', boxSizing:'border-box',
                        borderColor: plPct !== null ? (plPct >= 0 ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)') : undefined }} />
                  </div>
                </Field>
              </div>
              {plPct !== null && (
                <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8,
                  background: plPct >= 0 ? 'rgba(22,163,74,0.07)' : 'rgba(220,38,38,0.07)',
                  border: `1px solid ${plPct >= 0 ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
                  display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#6b7494' }}>Unrealised P&L</span>
                  <div style={{ display:'flex', gap:14 }}>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700,
                      color: plPct >= 0 ? '#16a34a' : '#dc2626' }}>
                      {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                    </span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600,
                      color: plPct >= 0 ? '#16a34a' : '#dc2626' }}>
                      {plPct >= 0 ? '+' : '-'}{currSymbol}{Math.round(Math.abs(plAbs)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <Field label="Institution / Provider">
              <input className="input" value={form.institution}
                onChange={e => f('institution', e.target.value)}
                placeholder="e.g. Builder, society, self-assessed…" />
            </Field>
            <Field label="Remarks (optional)">
              <input className="input" value={form.note} onChange={e => f('note', e.target.value)}
                placeholder="e.g. Location, rental yield notes…"
                onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </Field>

            {/* Goal mapping */}
            {isAsset && goalOptions.length > 0 && (
              <Field label="Goal (optional)">
                <select className="input" value={goalName} onChange={e => setGoalName(e.target.value)}>
                  <option value="">— Not linked —</option>
                  {goalOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
            )}
          </>
        )}

        {/* ── NPS: invested + present value + P&L ────────────────────── */}
        {!isCF && !isLiab && isNpsCat && (
          <>
            <div style={{ background:'rgba(37,99,235,0.05)', border:'1px solid rgba(37,99,235,0.18)',
              borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#1d4ed8', letterSpacing:'0.05em',
                textTransform:'uppercase', marginBottom:12 }}>
                🛡️ NPS valuation
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Field label={`Invested Value (${currSymbol})`} hint="Total contribution amount">
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                      color:'#8892b0', fontSize:13, pointerEvents:'none' }}>₹</span>
                    <input className="input" type="number" min="0" step="any"
                      value={form.investedValue} onChange={e => f('investedValue', e.target.value)}
                      placeholder="0" style={{ paddingLeft:22, width:'100%', boxSizing:'border-box' }} />
                  </div>
                </Field>
                <Field label={`Present Value (${currSymbol})`} hint={plPct !== null ? `P&L: ${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}% (${plPct >= 0 ? '+' : ''}${currSymbol}${Math.round(Math.abs(plAbs)).toLocaleString('en-IN')})` : 'Current corpus value'}>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                      color:'#8892b0', fontSize:13, pointerEvents:'none' }}>₹</span>
                    <input className="input" type="number" min="0" step="any"
                      value={form.value} onChange={e => f('value', e.target.value)}
                      placeholder="0" style={{ paddingLeft:22, width:'100%', boxSizing:'border-box' }} />
                  </div>
                </Field>
              </div>
            </div>
            <Field label="Institution / Provider">
              <input className="input" value={form.institution}
                onChange={e => f('institution', e.target.value)}
                placeholder="e.g. Protean, KFintech…" />
            </Field>
            <Field label="Remarks (optional)">
              <input className="input" value={form.note} onChange={e => f('note', e.target.value)}
                placeholder="e.g. Active choice, equity 75%…"
                onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </Field>

            {/* Goal mapping */}
            {isAsset && goalOptions.length > 0 && (
              <Field label="Goal (optional)">
                <select className="input" value={goalName} onChange={e => setGoalName(e.target.value)}>
                  <option value="">— Not linked —</option>
                  {goalOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
            )}
          </>
        )}

        {/* ── Standard fields for non-equity (excl. Real Estate / NPS) ───── */}
        {!isCF && !isLiab && !isEquityCat && !isRealEstateCat && !isNpsCat && (
          <>
            <Field label={`Current Value (${currSymbol})`}>
              <input className="input" type="number" min="0" value={form.value}
                onChange={e => f('value', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Institution / Provider">
              <input className="input" value={form.institution}
                onChange={e => f('institution', e.target.value)}
                placeholder="e.g. SBI, HDFC, Post Office…" />
            </Field>
            <Field label="Remarks (optional)">
              <input className="input" value={form.note} onChange={e => f('note', e.target.value)}
                placeholder="Any relevant remarks…"
                onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </Field>

            {/* Goal mapping */}
            {isAsset && goalOptions.length > 0 && (
              <Field label="Goal (optional)">
                <select className="input" value={goalName} onChange={e => setGoalName(e.target.value)}>
                  <option value="">— Not linked —</option>
                  {goalOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
            )}
          </>
        )}

        {/* Cash flow fields */}
        {isCF && (
          <Field label={`Monthly Amount (${currSymbol})`}>
            <input className="input" type="number" min="0" value={form.monthly}
              onChange={e => f('monthly', e.target.value)} placeholder="0" />
          </Field>
        )}

        {/* Liability fields */}
        {isLiab && (
          <>
            <Field label={`Outstanding Balance (${currSymbol})`}>
              <input className="input" type="number" min="0" value={form.value}
                onChange={e => f('value', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Institution / Provider">
              <input className="input" value={form.institution}
                onChange={e => f('institution', e.target.value)}
                placeholder="e.g. SBI, HDFC…" />
            </Field>
            <Field label="Interest Rate (% p.a.)">
              <input className="input" type="number" min="0" max="100" step="0.1"
                value={form.rate} onChange={e => f('rate', e.target.value)}
                placeholder="e.g. 8.5" />
            </Field>
            {form.category === 'Credit Card Debt' && (
              <Field label="Due Date">
                <input className="input" type="date"
                  value={form.dueDate} onChange={e => f('dueDate', e.target.value)} />
              </Field>
            )}
            <Field label="Remarks (optional)">
              <input className="input" value={form.note} onChange={e => f('note', e.target.value)}
                placeholder="Any relevant remarks…"
                onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </Field>
          </>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave}
            disabled={saving || !form.name.trim()}>
            {saving && <span style={{ animation:'spin 0.8s linear infinite', display:'inline-block' }}>↻</span>}
            {isEdit ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>

      </div>
    </Modal>
  )
}
