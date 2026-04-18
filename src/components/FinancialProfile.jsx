import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFinance } from '../context/FinanceContext'
import { DB } from '../utils/helpers'
import { getAssetClass } from '../utils/assetClasses'

// ─── Persist profile separately from main data ────────────────────────────────
export const ProfileDB = {
  get: (uid)    => { try { const d = localStorage.getItem(`wr_profile_${uid}`); return d ? JSON.parse(d) : null } catch { return null } },
  save: (uid,p) => { try { localStorage.setItem(`wr_profile_${uid}`, JSON.stringify(p)) } catch {} },
}

const EMPTY_PROFILE = {
  // Step 1 – Personal
  name: '', age: '', dependents: '0', city: '', employmentType: 'salaried',
  // Step 2 – Income & Expenses
  monthlyIncome: '', otherIncome: '', monthlyExpenses: '', emi: '0',
  // Step 3 – Protection
  termInsurance: 'no', termCover: '', healthInsurance: 'no', healthCover: '',
  emergencyFund: '', emergencyMonths: '0',
  // Step 4 – Goals
  goals: [],
  // Step 5 – Risk & Existing
  riskProfile: 'moderate', investmentExperience: 'beginner',
  existingMF: '', existingEquity: '', existingPPF: '', existingEPF: '',
  existingFD: '', retirementAge: '60',
}

// Inflation rates by goal type (annual %)
const INFLATION_RATES = {
  emergency:  0,     // liquid fund
  home:       0.08,  // property prices ~8% p.a.
  car:        0.06,
  education:  0.10,  // education fee inflation ~10% p.a.
  wedding:    0.06,
  travel:     0.06,
  retirement: 0.06,
  business:   0.07,
  gadget:     0.04,
  custom:     0.06,
}

// Instrument recommendations by years left + horizon
function getGoalRecommendation(yearsLeft, horizon, goalType) {
  // Short-term (<= 2 years): capital preservation
  if (yearsLeft <= 2) {
    return 'Liquid Fund, Short-term FD'
  }
  // Short-medium (3-4 years)
  if (yearsLeft <= 4) {
    if (goalType === 'emergency') return 'Liquid Fund, FD, Overnight Fund'
    return 'Debt MF (Short Duration), FD, Conservative Hybrid MF'
  }
  // Medium (5-7 years)
  if (yearsLeft <= 7) {
    if (goalType === 'education') return 'Equity MF 50%, Debt MF 50%'
    if (goalType === 'home')      return 'Balanced Advantage Fund, Debt MF'
    if (goalType === 'car')       return 'Hybrid MF, Debt MF, FD'
    if (goalType === 'retirement') return 'Equity MF 60%, NPS, PPF'
    return 'Balanced Advantage Fund, Hybrid MF'
  }
  // Long-term (8-14 years)
  if (yearsLeft <= 14) {
    if (goalType === 'education') return 'Equity MF 70%, ELSS, SSA'
    if (goalType === 'retirement') return 'Equity MF 70%, NPS, PPF'
    if (goalType === 'home')      return 'Equity MF 60%, Debt MF 40%'
    return 'Equity MF 65%, Debt MF 35%'
  }
  // Very long-term (15+ years)
  if (goalType === 'education') return 'Equity MF 80%, ELSS, SSA'
  if (goalType === 'retirement') return 'Equity MF 75%, NPS (Tier 1), PPF'
  if (goalType === 'home')      return 'Equity MF 70%, Debt MF 30%'
  return 'Equity MF 75%, Debt MF 25%'
}

// Expected return rates by goal type (equity for long-term, debt for short-term)
const RETURN_RATES = {
  emergency:  0.07,  // liquid/FD — 7%
  home:       0.10,  // balanced equity+debt — 10%
  car:        0.08,  // short-medium, debt-heavy — 8%
  education:  0.12,  // long horizon, equity — 12%
  wedding:    0.09,  // medium, balanced — 9%
  travel:     0.08,  // short, balanced — 8%
  retirement: 0.12,  // long, equity — 12%
  business:   0.11,
  gadget:     0.07,  // short, debt — 7%
  custom:     0.10,
}

// Calculate inflation-adjusted target: today's value × (1 + inflation)^years
function calcInflatedTarget(todayAmount, years, inflationRate) {
  if (!years || years <= 0 || !inflationRate) return parseInt(todayAmount)||0
  return Math.round((parseInt(todayAmount)||0) * Math.pow(1 + inflationRate, years))
}

const GOAL_TYPES = [
  { id:'emergency',    label:'Emergency Fund',       icon:'🛡️',  horizon:'short',  inflationRate: INFLATION_RATES.emergency,  returnRate: RETURN_RATES.emergency  },
  { id:'home',         label:'Buy a Home',           icon:'🏠',  horizon:'long',   inflationRate: INFLATION_RATES.home,       returnRate: RETURN_RATES.home       },
  { id:'car',          label:'Buy a Car',            icon:'🚗',  horizon:'medium', inflationRate: INFLATION_RATES.car,        returnRate: RETURN_RATES.car        },
  { id:'education',    label:'Child Education',      icon:'🎓',  horizon:'long',   inflationRate: INFLATION_RATES.education,  returnRate: RETURN_RATES.education  },
  { id:'wedding',      label:'Wedding',              icon:'💍',  horizon:'medium', inflationRate: INFLATION_RATES.wedding,    returnRate: RETURN_RATES.wedding    },
  { id:'travel',       label:'Travel / Vacation',    icon:'✈️',  horizon:'short',  inflationRate: INFLATION_RATES.travel,     returnRate: RETURN_RATES.travel     },
  { id:'retirement',   label:'Retirement',           icon:'🌅',  horizon:'long',   inflationRate: INFLATION_RATES.retirement, returnRate: RETURN_RATES.retirement },
  { id:'business',     label:'Start a Business',     icon:'💼',  horizon:'medium', inflationRate: INFLATION_RATES.business,   returnRate: RETURN_RATES.business   },
  { id:'gadget',       label:'Gadget / Electronics', icon:'💻',  horizon:'short',  inflationRate: INFLATION_RATES.gadget,     returnRate: RETURN_RATES.gadget     },
  { id:'custom',       label:'Custom Goal',          icon:'⭐',  horizon:'medium', inflationRate: INFLATION_RATES.custom,     returnRate: RETURN_RATES.custom     },
]

const STEPS = [
  { id: 1, title: 'Personal Details',       icon: '👤', sub: 'Age, family, employment' },
  { id: 2, title: 'Income & Expenses',      icon: '💰', sub: 'Monthly cash flow' },
  { id: 3, title: 'Protection & Safety',    icon: '🛡️', sub: 'Insurance & emergency fund' },
  { id: 4, title: 'Financial Goals',        icon: '🎯', sub: 'Short & long term targets' },
  { id: 5, title: 'Risk & Investments',     icon: '📈', sub: 'Current portfolio snapshot' },
]

// ─── Calculation helpers ───────────────────────────────────────────────────────
function calcSIP(target, years, rate = 0.12) {
  const n = years * 12, r = rate / 12
  if (n <= 0) return 0
  return Math.round(target * r / (Math.pow(1 + r, n) - 1))
}

function calcFV(pv, years, rate = 0.07) {
  return Math.round(pv * Math.pow(1 + rate, years))
}

function fmt(n, cur = 'INR') {
  if (!n || isNaN(n)) return '—'
  const v = Math.abs(n)
  if (v >= 1e7) return `₹${(v/1e7).toFixed(2)}Cr`
  if (v >= 1e5) return `₹${(v/1e5).toFixed(1)}L`
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

function ageGroup(age) {
  const a = parseInt(age)
  if (a < 25) return 'Gen-Z Starter'
  if (a < 35) return 'Early Career'
  if (a < 45) return 'Mid Career'
  if (a < 55) return 'Peak Earning'
  return 'Pre-Retirement'
}

// ─── Shared UI primitives (defined outside to avoid focus-loss on re-render) ──
function PfCard({ children, style }) {
  return <div className="card" style={{ padding:24, ...style }}>{children}</div>
}

function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'#1a1d2e', fontWeight:700 }}>{title}</div>
      {sub && <div style={{ fontSize:13, color:'#8892b0', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:12, fontWeight:600, color:'#6b7494', letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize:11, color:'#b0b8d0', marginTop:4 }}>{hint}</div>}
    </div>
  )
}

function PfInput({ value, onChange, placeholder, type='text', prefix }) {
  return (
    <div style={{ position:'relative' }}>
      {prefix && <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#8892b0', fontSize:13, pointerEvents:'none' }}>{prefix}</span>}
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: prefix ? 28 : 12, width:'100%', boxSizing:'border-box' }} />
    </div>
  )
}

function PfSelect({ value, onChange, options }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}
      style={{ width:'100%', boxSizing:'border-box' }}>
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  )
}

function RadioGroup({ value, onChange, options }) {
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} type="button"
          style={{ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
            background: value === o.v ? '#c8920a' : '#f0f2f8',
            color:      value === o.v ? '#fff'    : '#6b7494',
            border:     value === o.v ? '1px solid #c8920a' : '1px solid #e0e4f0' }}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

function Pill({ label, color, bg }) {
  return <span style={{ fontSize:11, fontWeight:600, color, background:bg, padding:'2px 10px', borderRadius:20 }}>{label}</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FinancialProfile({ onComplete } = {}) {
  const { session } = useAuth()
  const { data, settings } = useFinance()
  const [step, setStep]         = useState(0)          // 0 = overview/landing
  const [profile, setProfile]   = useState(EMPTY_PROFILE)
  const [saved, setSaved]       = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPlan, setAiPlan]     = useState(null)
  const [aiError, setAiError]   = useState(null)
  const [rawDebug, setRawDebug]  = useState(null)
  const [goalModal, setGoalModal] = useState(false)
  const [newGoal, setNewGoal]   = useState({ type:'home', label:'', targetAmount:'', targetYear:'', currentSaved:'0', priority:'high' })

  // Load saved profile AND saved AI plan
  useEffect(() => {
    if (!session?.userId) return
    const saved = ProfileDB.get(session.userId)
    if (saved) {
      const { _aiPlan, ...profileData } = saved
      setProfile(profileData)
      setSaved(true)
      if (_aiPlan) setAiPlan(_aiPlan)
    }
  }, [session?.userId])

  const setP = (k, v) => setProfile(p => ({ ...p, [k]: v }))

  const saveProfile = () => {
    if (!session?.userId) return
    ProfileDB.save(session.userId, profile)
    setSaved(true)
  }

  const addGoal = () => {
    const type   = GOAL_TYPES.find(g => g.id === newGoal.type) || GOAL_TYPES[9]
    const years  = parseInt(newGoal.targetYear) - new Date().getFullYear()
    const inflationRate = type.inflationRate || 0
    // Store both today's value and the inflation-adjusted future target
    const rawTarget      = parseInt(newGoal.targetAmount)||0
    const inflatedTarget = calcInflatedTarget(rawTarget, years, inflationRate)
    const returnRate = type.returnRate || RETURN_RATES[type.id] || 0.10
    const goal = {
      id: Date.now(), ...newGoal,
      icon: type.icon, label: newGoal.label || type.label, horizon: type.horizon,
      inflationRate,
      returnRate,
      todayValue:        rawTarget,
      targetAmount:      inflationRate > 0 ? inflatedTarget : rawTarget,
      inflationAdjusted: inflationRate > 0,
    }
    setProfile(p => ({ ...p, goals: [...p.goals, goal] }))
    setGoalModal(false)
    setNewGoal({ type:'home', label:'', targetAmount:'', targetYear:'', currentSaved:'0', priority:'high' })
  }

  const removeGoal = (id) => setProfile(p => ({ ...p, goals: p.goals.filter(g => g.id !== id) }))

  // ── AI Plan Generator ───────────────────────────────────────────────────────
  const generatePlan = async () => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'YOUR_ANTHROPIC_API_KEY_HERE') {
      setAiError('ANTHROPIC_API_KEY_MISSING')
      return
    }
    // Debug: log key prefix so user can verify correct key is loaded
    console.log('Using API key:', apiKey.slice(0, 20) + '...')
    setAiLoading(true); setAiError(null); setAiPlan(null)
    const savings = (parseInt(profile.monthlyIncome)||0) + (parseInt(profile.otherIncome)||0)
                  - (parseInt(profile.monthlyExpenses)||0) - (parseInt(profile.emi)||0)
    const netWorth = data?.assets?.reduce((s,a) => s+(a.value||0), 0) || 0

    const prompt = `You are an Indian financial advisor. I will give you a client profile and you MUST return ONLY a valid JSON object with EXACTLY the keys shown below. No extra keys. No markdown. No explanation.

CLIENT:
Age: ${profile.age} | Job: ${profile.employmentType} | Risk: ${profile.riskProfile} | Retire at: ${profile.retirementAge}
Monthly take-home: Rs${profile.monthlyIncome||0} | Other income: Rs${profile.otherIncome||0}
Monthly expenses: Rs${profile.monthlyExpenses||0} | EMIs: Rs${profile.emi||0} | Net savings: Rs${savings}
Term insurance: ${profile.termInsurance==='yes'?'Yes Rs'+profile.termCover:'NOT COVERED'}
Health insurance: ${profile.healthInsurance==='yes'?'Yes Rs'+profile.healthCover:profile.healthInsurance==='employer'?'Employer only':'NOT COVERED'}
Emergency fund: Rs${profile.emergencyFund||0} (${profile.emergencyMonths} months)
Goals: ${profile.goals.length===0?'None':(profile.goals.map(g=>g.label+' Rs'+(g.targetAmount||0)+' by '+g.targetYear+(parseInt(g.currentSaved)>0?' savedRs'+g.currentSaved:'')).join(' | '))}
Existing: MF Rs${profile.existingMF||0} | Equity Rs${profile.existingEquity||0} | PPF Rs${profile.existingPPF||0} | EPF Rs${profile.existingEPF||0} | FD Rs${profile.existingFD||0}

Return ONLY this JSON structure with no changes to key names:
{
  "urgentAlerts": [{"type":"critical","title":"string","message":"string","action":"string"}],
  "protectionPlan": {
    "termInsuranceNeeded": "string",
    "termInsuranceAdvice": "string",
    "healthInsuranceAdvice": "string",
    "emergencyFundTarget": "string",
    "emergencyFundAdvice": "string"
  },
  "assetAllocation": [{"class":"string","pct":0,"rationale":"string","instruments":"string"}],
  "savingsAllocation": [{"category":"string","amount":0,"purpose":"string","instrument":"string"}],
  "goalPlans": [{"goalName":"string","targetAmount":0,"targetYear":"string","yearsLeft":0,"monthlySIP":0,"currentShortfall":0,"instrument":"string","advice":"string"}],
  "quickWins": [{"title":"string","action":"string","impact":"string"}],
  "summary": {"monthlyIncome":0,"monthlySavings":0,"totalAllocated":0,"surplusOrDeficit":0,"overallAdvice":"string","ageGroup":"string","fiTarget":0}
}

Rules: all amounts are integers, all strings under 80 chars, goalPlans has one entry per goal, assetAllocation covers equity/debt/gold, savingsAllocation shows how to split monthly savings.`


    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 4096,
          system: 'You are an Indian financial advisor. Respond with ONLY valid JSON. No text before or after. No markdown. No code blocks.',
          messages: [{ role: 'user', content: prompt }]
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `HTTP ${res.status}`)
      }
      const d   = await res.json()
      const txt = d.content?.find(c => c.type === 'text')?.text || ''
      setRawDebug(txt.slice(0, 500))
      console.log('Full raw response:', txt)
      console.log('Response type:', typeof txt, 'length:', txt.length)
      if (!txt) throw new Error('Empty response from API')
      // Extract the JSON object — find first { and last }
      const fullTxt = txt
      const jsonStart = fullTxt.indexOf('{')
      const jsonEnd   = fullTxt.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON object in response')
      let clean = fullTxt.slice(jsonStart, jsonEnd + 1)
      // Repair truncated JSON by closing unclosed brackets
      const repairJSON = (s) => {
        try { JSON.parse(s); return s } catch (e) {
          console.log('Repair attempt, error was:', e.message)
        }
        let fixed = s
        let opens = 0, arrays = 0, inStr = false, prev = ''
        for (const ch of fixed) {
          if (ch === '"' && prev !== '\\') inStr = !inStr
          if (!inStr) {
            if (ch === '{') opens++
            else if (ch === '}') opens--
            else if (ch === '[') arrays++
            else if (ch === ']') arrays--
          }
          prev = ch
        }
        if (inStr)  fixed += '"'
        for (let i = 0; i < Math.max(0, arrays); i++) fixed += ']'
        for (let i = 0; i < Math.max(0, opens);  i++) fixed += '}'
        return fixed
      }
      const parsed = JSON.parse(repairJSON(clean))
      setAiPlan(parsed)
      // Persist the plan + profile goals currentSaved (indexed by position as reliable fallback)
      if (session?.userId) {
        const existing = ProfileDB.get(session.userId) || {}
        const savedAmounts = (profile.goals||[]).map((g,i) => ({
          index: i, label: g.label, currentSaved: parseInt(g.currentSaved)||0,
          targetAmount: parseInt(g.targetAmount)||0, targetYear: g.targetYear
        }))
        ProfileDB.save(session.userId, { ...existing, _aiPlan: parsed, _profileSavedAmounts: savedAmounts })
      }
      // Notify parent that profile setup is complete
      if (onComplete) setTimeout(onComplete, 1200)
    } catch (e) {
      console.error('AI Plan error:', e)
      setAiError(`${e.message}`)
    }
    setAiLoading(false)
  }

  // ─── Derived values ──────────────────────────────────────────────────────────
  const income = (parseInt(profile.monthlyIncome)||0) + (parseInt(profile.otherIncome)||0)
  const expenses = (parseInt(profile.monthlyExpenses)||0) + (parseInt(profile.emi)||0)
  const savings = income - expenses
  const savingsPct = income > 0 ? Math.round(savings/income*100) : 0

  // ─── Step pages ───────────────────────────────────────────────────────────────
  const stepPages = {
    1: (
      <div style={{ display:'grid', gap:16 }}>
        <SectionHead title="👤 Personal Details" sub="Tell us about yourself — this shapes your entire financial plan." />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Full Name">
            <PfInput value={profile.name} onChange={v => setP('name',v)} placeholder="Your name" />
          </Field>
          <Field label="Age">
            <PfInput value={profile.age} onChange={v => setP('age',v)} placeholder="e.g. 32" type="number" />
          </Field>
          <Field label="Number of Dependents">
            <PfSelect value={profile.dependents} onChange={v => setP('dependents',v)}
              options={['0','1','2','3','4','5+'].map(v => ({v, l: v==='0'?'No dependents': `${v} dependent${v==='1'?'':'s'}`}))} />
          </Field>
          <Field label="City">
            <PfInput value={profile.city} onChange={v => setP('city',v)} placeholder="e.g. Chennai" />
          </Field>
          <Field label="Target Retirement Age">
            <PfInput value={profile.retirementAge} onChange={v => setP('retirementAge',v)} placeholder="e.g. 60" type="number" />
          </Field>
        </div>
        <Field label="Employment Type">
          <RadioGroup value={profile.employmentType} onChange={v => setP('employmentType',v)} options={[
            {v:'salaried',l:'Salaried'},{v:'self-employed',l:'Self-Employed'},
            {v:'business',l:'Business Owner'},{v:'freelancer',l:'Freelancer'},{v:'retired',l:'Retired'}
          ]} />
        </Field>
      </div>
    ),

    2: (
      <div style={{ display:'grid', gap:16 }}>
        <SectionHead title="💰 Income & Expenses" sub="Monthly cash flow is the foundation of your financial plan." />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Monthly Take-home Income" hint="After tax, in hand">
            <PfInput value={profile.monthlyIncome} onChange={v => setP('monthlyIncome',v)} prefix="₹" type="number" placeholder="0" />
          </Field>
          <Field label="Other Monthly Income" hint="Rent, freelance, interest, etc.">
            <PfInput value={profile.otherIncome} onChange={v => setP('otherIncome',v)} prefix="₹" type="number" placeholder="0" />
          </Field>
          <Field label="Monthly Living Expenses" hint="Food, utilities, shopping, entertainment">
            <PfInput value={profile.monthlyExpenses} onChange={v => setP('monthlyExpenses',v)} prefix="₹" type="number" placeholder="0" />
          </Field>
          <Field label="Monthly EMIs" hint="Home loan, car loan, personal loan">
            <PfInput value={profile.emi} onChange={v => setP('emi',v)} prefix="₹" type="number" placeholder="0" />
          </Field>
        </div>
        {income > 0 && (
          <div style={{ background: savings >= 0 ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)',
            border: `1px solid ${savings >= 0 ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
            borderRadius:12, padding:'14px 18px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            {[
              { l:'Total Income', v: fmt(income), c:'#1a1d2e' },
              { l:'Total Outflow', v: fmt(expenses), c:'#dc2626' },
              { l:'Monthly Savings', v: fmt(savings), c: savings >= 0 ? '#16a34a' : '#dc2626' },
              { l:'Savings Rate', v: `${savingsPct}%`, c: savingsPct >= 20 ? '#16a34a' : savingsPct >= 10 ? '#d97706' : '#dc2626' },
            ].map(x => (
              <div key={x.l}>
                <div style={{ fontSize:11, color:'#8892b0', marginBottom:3 }}>{x.l}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, fontWeight:700, color:x.c }}>{x.v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    3: (
      <div style={{ display:'grid', gap:20 }}>
        <SectionHead title="🛡️ Protection & Safety Net" sub="These are mandatory before any investment. Protect first, grow next." />

        <div style={{ background:'rgba(220,38,38,0.04)', border:'1px solid rgba(220,38,38,0.15)', borderRadius:12, padding:'14px 18px', fontSize:13, color:'#6b1a1a', lineHeight:1.6 }}>
          <strong>⚠ Rule of thumb:</strong> Emergency fund = 6 months expenses. Term cover = 10-15x annual income. Health cover = minimum ₹10L per family.
        </div>

        <PfCard>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', marginBottom:16 }}>🔒 Emergency Fund</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <Field label="Current Emergency Fund">
              <PfInput value={profile.emergencyFund} onChange={v => setP('emergencyFund',v)} prefix="₹" type="number" placeholder="0" />
            </Field>
            <Field label="This covers how many months?" hint={`Target: 6 months = ${fmt((parseInt(profile.monthlyExpenses)||0)*6)}`}>
              <PfSelect value={profile.emergencyMonths} onChange={v => setP('emergencyMonths',v)}
                options={['0','1','2','3','4','5','6','7','8','9','10','11','12+'].map(v => ({v, l:`${v} months`}))} />
            </Field>
          </div>
          {parseInt(profile.emergencyMonths) < 6 && (
            <div style={{ background:'rgba(220,38,38,0.07)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#dc2626', marginTop:8 }}>
              ⚠ Short by {fmt((Math.max(0, 6-parseInt(profile.emergencyMonths||0))) * (parseInt(profile.monthlyExpenses)||0))} — you need {6-parseInt(profile.emergencyMonths||0)} more months of expenses in a liquid fund
            </div>
          )}
        </PfCard>

        <PfCard>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', marginBottom:16 }}>💼 Term Life Insurance</div>
          <Field label="Do you have term insurance?">
            <RadioGroup value={profile.termInsurance} onChange={v => setP('termInsurance',v)}
              options={[{v:'yes',l:'Yes, I have it'},{v:'no',l:'No, not yet'},{v:'considering',l:'Considering it'}]} />
          </Field>
          {profile.termInsurance === 'yes' && (
            <Field label="Sum Assured" hint={`Recommended: ${fmt((parseInt(profile.monthlyIncome)||0)*12*12)} (10x annual income)`}>
              <PfInput value={profile.termCover} onChange={v => setP('termCover',v)} prefix="₹" type="number" placeholder="0" />
            </Field>
          )}
          {profile.termInsurance !== 'yes' && (
            <div style={{ background:'rgba(220,38,38,0.07)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#dc2626', marginTop:8 }}>
              ⚠ URGENT — Get term insurance immediately. Recommended cover: {fmt((parseInt(profile.monthlyIncome)||0)*12*12)}
            </div>
          )}
        </PfCard>

        <PfCard>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', marginBottom:16 }}>🏥 Health Insurance</div>
          <Field label="Do you have health insurance?">
            <RadioGroup value={profile.healthInsurance} onChange={v => setP('healthInsurance',v)}
              options={[{v:'yes',l:'Yes, personal/family floater'},{v:'employer',l:'Employer provided only'},{v:'no',l:'No coverage'}]} />
          </Field>
          {profile.healthInsurance === 'yes' && (
            <Field label="Sum Insured" hint="Recommended: ₹10-25L for family">
              <PfInput value={profile.healthCover} onChange={v => setP('healthCover',v)} prefix="₹" type="number" placeholder="0" />
            </Field>
          )}
          {profile.healthInsurance === 'employer' && (
            <div style={{ background:'rgba(245,158,11,0.07)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400e', marginTop:8 }}>
              ⚠ Employer insurance ends when you change jobs. Get a personal health policy as a backup.
            </div>
          )}
          {profile.healthInsurance === 'no' && (
            <div style={{ background:'rgba(220,38,38,0.07)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#dc2626', marginTop:8 }}>
              ⚠ URGENT — One hospitalisation can wipe out years of savings. Get a ₹10L+ family floater immediately.
            </div>
          )}
        </PfCard>
      </div>
    ),

    4: (
      <div style={{ display:'grid', gap:20 }}>
        <SectionHead title="🎯 Financial Goals" sub="What are you saving and investing for? Add all your goals." />
        <div style={{ display:'grid', gap:10 }}>
          {profile.goals.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 16px', color:'#b0b8d0', fontSize:14, border:'2px dashed #e0e4f0', borderRadius:12 }}>
              No goals added yet. Click below to add your first goal.
            </div>
          )}
          {profile.goals.map((g, gi) => {
            const years = parseInt(g.targetYear) - new Date().getFullYear()
            const shortfallCard = Math.max(0, (parseInt(g.targetAmount)||0) - (parseInt(g.currentSaved)||0))
            const rCard = 0.12/12, nCard = Math.max(1, years) * 12
            const sip = years > 0 && shortfallCard > 0 ? Math.round(shortfallCard * rCard / (Math.pow(1+rCard, nCard) - 1)) : 0
            const updateGoal = (fields) => setProfile(p => ({ ...p, goals: p.goals.map((x,xi) => xi===gi ? {...x,...fields} : x) }))
            return (
              <div key={g.id} style={{ background:'#f8f9fc', borderRadius:10, border:'1px solid #eef0f8', overflow:'hidden' }}>
                {/* Goal header row */}
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px' }}>
                  <span style={{ fontSize:24 }}>{g.icon}</span>
                  <div style={{ flex:1 }}>
                    {/* Editable goal name */}
                    <input
                      value={g.label}
                      onChange={e => updateGoal({ label: e.target.value })}
                      style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', border:'none', background:'transparent',
                        outline:'none', width:'100%', fontFamily:"'Outfit',sans-serif", padding:0, marginBottom:4 }}
                      placeholder="Goal name…" />
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:12, color:'#6b7494', alignItems:'center' }}>
                      <span>Target: <strong style={{color:'#1a1d2e'}}>{fmt(parseInt(g.targetAmount))}</strong>
                        {g.inflationAdjusted && <span style={{ fontSize:10, color:'#c8920a', marginLeft:4 }}>(inflation-adj.)</span>}
                      </span>
                      <span>By: <strong style={{color:'#1a1d2e'}}>{g.targetYear}</strong></span>
                      {g.inflationRate > 0 && (
                        <span style={{ fontSize:10, fontWeight:600, color:'#c8920a', background:'rgba(200,146,10,0.08)', padding:'1px 7px', borderRadius:10 }}>
                          📈 {(g.inflationRate*100).toFixed(0)}% inflation
                        </span>
                      )}
                      {years > 0 && sip > 0 && <span>Est. SIP: <strong style={{color:'#c8920a'}}>₹{sip.toLocaleString('en-IN')}/mo</strong></span>}
                      {parseInt(g.currentSaved) > 0 && <span>Saved: <strong>{fmt(parseInt(g.currentSaved))}</strong></span>}
                    </div>
                  </div>
                  <button onClick={() => removeGoal(g.id)} style={{ fontSize:16, color:'#f06a6a', background:'none', border:'none', cursor:'pointer', flexShrink:0 }}>×</button>
                </div>
                {/* Inline edit row for amounts */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, padding:'0 16px 14px', borderTop:'1px solid #eef0f8' }}>
                  {[
                    { label:'Target (₹)', key:'targetAmount', type:'number' },
                    { label:'Target Year', key:'targetYear',   type:'number' },
                    { label:'Already Saved (₹)', key:'currentSaved', type:'number' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize:10, color:'#8892b0', marginBottom:3, fontWeight:500 }}>{f.label}</div>
                      <input className="input" type={f.type} value={g[f.key]||''}
                        onChange={e => updateGoal({ [f.key]: e.target.value })}
                        style={{ width:'100%', boxSizing:'border-box', fontSize:12, padding:'6px 10px' }} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={() => setGoalModal(true)}
          style={{ padding:'12px 0', border:'2px dashed #c8920a', borderRadius:10, background:'rgba(200,146,10,0.04)',
            color:'#c8920a', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
          + Add Financial Goal
        </button>

        {/* Goal Modal */}
        {goalModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:480, width:'100%', maxHeight:'90vh', overflowY:'auto' }}>
              <div style={{ fontSize:18, fontWeight:700, color:'#1a1d2e', marginBottom:20 }}>Add Financial Goal</div>
              <Field label="Goal Type">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8, marginBottom:8 }}>
                  {GOAL_TYPES.map(g => (
                    <button key={g.id} onClick={() => setNewGoal(n => ({...n, type:g.id, label:g.label}))}
                      style={{ padding:'8px 6px', borderRadius:8, fontSize:12, cursor:'pointer', textAlign:'center',
                        background: newGoal.type===g.id ? 'rgba(200,146,10,0.1)' : '#f8f9fc',
                        border:     newGoal.type===g.id ? '1.5px solid #c8920a' : '1px solid #eef0f8',
                        color:      newGoal.type===g.id ? '#c8920a' : '#6b7494' }}>
                      <div style={{ fontSize:20, marginBottom:2 }}>{g.icon}</div>
                      {g.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Goal Name (optional)">
                <PfInput value={newGoal.label} onChange={v => setNewGoal(n=>({...n,label:v}))} placeholder={GOAL_TYPES.find(g=>g.id===newGoal.type)?.label} />
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Field label="Target Amount">
                  <PfInput value={newGoal.targetAmount} onChange={v => setNewGoal(n=>({...n,targetAmount:v}))} prefix="₹" type="number" placeholder="0" />
                </Field>
                <Field label="Target Year">
                  <PfInput value={newGoal.targetYear} onChange={v => setNewGoal(n=>({...n,targetYear:v}))} placeholder={String(new Date().getFullYear()+5)} type="number" />
                </Field>
                <Field label="Already Saved">
                  <PfInput value={newGoal.currentSaved} onChange={v => setNewGoal(n=>({...n,currentSaved:v}))} prefix="₹" type="number" placeholder="0" />
                </Field>
                <Field label="Priority">
                  <PfSelect value={newGoal.priority} onChange={v => setNewGoal(n=>({...n,priority:v}))}
                    options={[{v:'high',l:'High'},{v:'medium',l:'Medium'},{v:'low',l:'Low'}]} />
                </Field>
              </div>
              {newGoal.targetAmount && newGoal.targetYear && (() => {
                const yrs = parseInt(newGoal.targetYear) - new Date().getFullYear()
                const goalType = GOAL_TYPES.find(g => g.id === newGoal.type) || GOAL_TYPES[9]
                const inflRate = goalType.inflationRate || 0
                const rawTarget = parseInt(newGoal.targetAmount)||0
                const inflTarget = calcInflatedTarget(rawTarget, yrs, inflRate)
                const shortfall = Math.max(0, inflTarget - (parseInt(newGoal.currentSaved)||0))
                const r = 0.12/12, n = yrs * 12
                const sip = yrs > 0 && shortfall > 0 ? Math.round(shortfall * r / (Math.pow(1+r, n) - 1)) : shortfall
                return yrs > 0 ? (
                  <div style={{ background:'rgba(200,146,10,0.07)', border:'1px solid rgba(200,146,10,0.2)', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#92700a', marginTop:4, display:'grid', gap:6 }}>
                    {inflRate > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', paddingBottom:6, borderBottom:'1px solid rgba(200,146,10,0.15)' }}>
                        <span>Today's value: <strong>₹{rawTarget.toLocaleString('en-IN')}</strong></span>
                        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:10, background:'rgba(200,146,10,0.15)', padding:'2px 7px', borderRadius:10 }}>📈 {(inflRate*100).toFixed(0)}% inflation/yr</span>
                          <span>→ Future target: <strong>₹{inflTarget.toLocaleString('en-IN')}</strong></span>
                        </span>
                      </div>
                    )}
                    <div>
                      Monthly SIP needed: <strong>₹{sip.toLocaleString('en-IN')}/month</strong> for {yrs} yrs at 12% equity returns
                      {inflRate === 0 && <span style={{ color:'#b0966a', marginLeft:6, fontSize:11 }}>(no inflation applied for this goal type)</span>}
                    </div>
                  </div>
                ) : null
              })()}
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button className="btn btn-outline" style={{ flex:1 }} onClick={() => setGoalModal(false)}>Cancel</button>
                <button className="btn btn-gold"   style={{ flex:1 }} onClick={addGoal}>Add Goal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    ),

    5: (
      <div style={{ display:'grid', gap:20 }}>
        <SectionHead title="📈 Risk Profile & Existing Investments" sub="Your current portfolio and investment style." />
        <PfCard>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', marginBottom:16 }}>Risk Appetite</div>
          <Field label="What best describes you?">
            <div style={{ display:'grid', gap:10 }}>
              {[
                { v:'conservative', l:'🟢 Conservative', d:'I prefer safety. FDs, debt funds, PPF.' },
                { v:'moderate',     l:'🟡 Moderate',     d:'Balance of growth and stability. Balanced/hybrid funds.' },
                { v:'aggressive',   l:'🔴 Aggressive',   d:'I\'m okay with volatility for higher returns. Mostly equities.' },
              ].map(o => (
                <div key={o.v} onClick={() => setP('riskProfile', o.v)}
                  style={{ padding:'12px 16px', borderRadius:10, cursor:'pointer', transition:'all 0.15s',
                    background: profile.riskProfile===o.v ? 'rgba(200,146,10,0.08)' : '#f8f9fc',
                    border:     profile.riskProfile===o.v ? '1.5px solid #c8920a' : '1px solid #eef0f8' }}>
                  <div style={{ fontSize:13, fontWeight:600, color: profile.riskProfile===o.v?'#c8920a':'#1a1d2e' }}>{o.l}</div>
                  <div style={{ fontSize:12, color:'#8892b0', marginTop:2 }}>{o.d}</div>
                </div>
              ))}
            </div>
          </Field>
          <Field label="Investment Experience" hint="">
            <RadioGroup value={profile.investmentExperience} onChange={v => setP('investmentExperience',v)} options={[
              {v:'beginner',l:'Beginner (< 1 yr)'},{v:'intermediate',l:'Intermediate (1-5 yrs)'},{v:'experienced',l:'Experienced (5+ yrs)'}
            ]} />
          </Field>
        </PfCard>
        <PfCard>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', marginBottom:16 }}>Existing Portfolio (approximate values)</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              { k:'existingMF',     l:'Mutual Funds' },
              { k:'existingEquity', l:'Direct Equity/Stocks' },
              { k:'existingPPF',    l:'PPF Balance' },
              { k:'existingEPF',    l:'EPF / PF Balance' },
              { k:'existingFD',     l:'Fixed Deposits' },
            ].map(f => (
              <Field key={f.k} label={f.l}>
                <PfInput value={profile[f.k]} onChange={v => setP(f.k,v)} prefix="₹" type="number" placeholder="0" />
              </Field>
            ))}
          </div>
          <div style={{ fontSize:11, color:'#b0b8d0', marginTop:8 }}>
            * These values are for planning purposes. Your WealthRadar portfolio data is already tracked separately.
          </div>
        </PfCard>
      </div>
    ),
  }

  // ─── Overview / Landing ───────────────────────────────────────────────────────
  if (step === 0) {
    const isComplete = saved && profile.age && profile.monthlyIncome
    return (
      <div style={{ display:'grid', gap:20, maxWidth:900, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg, #1a1d2e 0%, #252945 100%)', borderRadius:16, padding:'32px 36px', color:'#fff', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:200, height:200, background:'rgba(200,146,10,0.08)', borderRadius:'50%' }} />
          <div style={{ position:'absolute', right:60, bottom:-40, width:120, height:120, background:'rgba(200,146,10,0.05)', borderRadius:'50%' }} />
          <div style={{ position:'relative' }}>
            <div style={{ fontSize:12, letterSpacing:'0.1em', color:'#c8920a', fontWeight:600, marginBottom:8, textTransform:'uppercase' }}>Financial Profile</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:700, marginBottom:8 }}>
              {profile.name ? `${profile.name}'s` : 'Your'} Financial Blueprint
            </div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.6)', maxWidth:480 }}>
              Complete this one-time setup to get your personalised AI financial plan. Future updates are done in My Plan.
            </div>
            {isComplete && (
              <div style={{ display:'flex', gap:16, marginTop:20, flexWrap:'wrap' }}>
                <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 16px' }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Age Group</div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{ageGroup(profile.age)}</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 16px' }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Monthly Savings</div>
                  <div style={{ fontSize:14, fontWeight:600, color: savings >= 0 ? '#3ecf8e' : '#f06a6a' }}>{fmt(savings)}</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 16px' }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Goals</div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{profile.goals.length} goal{profile.goals.length!==1?'s':''}</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 16px' }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Savings Rate</div>
                  <div style={{ fontSize:14, fontWeight:600, color: savingsPct >= 20 ? '#3ecf8e' : '#f06a6a' }}>{savingsPct}%</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step progress */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
          {STEPS.map((s, i) => {
            const done = saved && ((s.id===1 && profile.age && profile.name) ||
                                   (s.id===2 && profile.monthlyIncome) ||
                                   (s.id===3 && (profile.termInsurance||profile.healthInsurance)) ||
                                   (s.id===4) ||
                                   (s.id===5 && profile.riskProfile))
            return (
              <button key={s.id} onClick={() => setStep(s.id)}
                style={{ padding:'14px 10px', borderRadius:12, cursor:'pointer', textAlign:'left', transition:'all 0.2s',
                  background: done ? 'rgba(200,146,10,0.07)' : '#f8f9fc',
                  border:     done ? '1.5px solid rgba(200,146,10,0.3)' : '1px solid #eef0f8' }}>
                <div style={{ fontSize:18, marginBottom:6 }}>{done ? '✅' : s.icon}</div>
                <div style={{ fontSize:12, fontWeight:600, color: done?'#c8920a':'#1a1d2e', marginBottom:2 }}>{s.title}</div>
                <div style={{ fontSize:11, color:'#8892b0' }}>{s.sub}</div>
              </button>
            )
          })}
        </div>

        {/* Alerts */}
        {saved && (() => {
          const alerts = []
          if (parseInt(profile.emergencyMonths) < 6) alerts.push({ type:'critical', msg:`Emergency fund only covers ${profile.emergencyMonths} months — need ${6-parseInt(profile.emergencyMonths||0)} more` })
          if (profile.termInsurance !== 'yes') alerts.push({ type:'critical', msg:'No term life insurance — get coverage immediately' })
          if (profile.healthInsurance === 'no') alerts.push({ type:'critical', msg:'No health insurance — one hospitalisation can derail your finances' })
          if (profile.healthInsurance === 'employer') alerts.push({ type:'warning', msg:'Relying only on employer health cover — get a personal policy as backup' })
          if (savingsPct < 10 && income > 0) alerts.push({ type:'warning', msg:`Savings rate is ${savingsPct}% — target at least 20% of income` })
          return alerts.length > 0 ? (
            <div style={{ display:'grid', gap:8 }}>
              {alerts.map((a,i) => (
                <div key={i} style={{ padding:'12px 16px', borderRadius:10, fontSize:13,
                  background: a.type==='critical' ? 'rgba(220,38,38,0.06)' : 'rgba(245,158,11,0.06)',
                  border:     a.type==='critical' ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(245,158,11,0.2)',
                  color:      a.type==='critical' ? '#dc2626' : '#92400e', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:16 }}>{a.type==='critical'?'🚨':'⚠️'}</span>
                  {a.msg}
                </div>
              ))}
            </div>
          ) : null
        })()}

        {/* AI Plan Section */}
        {isComplete && (
          <PfCard>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'#1a1d2e', fontWeight:700 }}>
                  ✨ AI Financial Plan
                </div>
                <div style={{ fontSize:12, color:'#8892b0', marginTop:4 }}>
                  Powered by Claude — personalised recommendations based on your complete profile
                </div>
              </div>
              <button className="btn btn-gold" onClick={generatePlan} disabled={aiLoading}
                style={{ opacity: aiLoading ? 0.7 : 1 }}>
                {aiLoading ? '⏳ Generating...' : aiPlan ? '🔄 Regenerate Plan' : '✨ Generate My Plan'}
              </button>
            </div>

            {aiLoading && (
              <div style={{ textAlign:'center', padding:'32px 0', color:'#8892b0' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🤔</div>
                <div style={{ fontSize:14 }}>Analysing your profile and building your personalised plan...</div>
                <div style={{ fontSize:12, marginTop:6 }}>This takes about 10-15 seconds</div>
              </div>
            )}
            {aiError && (
              <div style={{ padding:'14px 16px', borderRadius:10, background:'rgba(220,38,38,0.05)', border:'1px solid rgba(220,38,38,0.15)' }}>
                {aiError === 'ANTHROPIC_API_KEY_MISSING' ? (
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#dc2626', marginBottom:8 }}>⚙ API Key Required</div>
                    <div style={{ fontSize:12, color:'#6b7494', lineHeight:1.8 }}>
                      To use the AI Financial Plan, add your Anthropic API key:<br/>
                      1. Get a key at <strong>console.anthropic.com</strong> → API Keys<br/>
                      2. Add to your <strong>.env.local</strong> file:<br/>
                      <code style={{ display:'block', background:'#f0f2f8', padding:'6px 10px', borderRadius:6, marginTop:6, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>
                        VITE_ANTHROPIC_API_KEY=sk-ant-...
                      </code>
                      3. Restart the dev server (<strong>npm run dev</strong>)
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:13, color:'#dc2626', marginBottom:8 }}>{aiError}</div>
                    {rawDebug && (
                      <div style={{ background:'#1a1d2e', borderRadius:8, padding:10, marginTop:8 }}>
                        <div style={{ fontSize:10, color:'#8892b0', marginBottom:4 }}>Raw API response (first 500 chars):</div>
                        <pre style={{ fontSize:10, color:'#3ecf8e', whiteSpace:'pre-wrap', wordBreak:'break-all', margin:0 }}>{rawDebug}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {aiPlan && <AIPlanDisplay plan={aiPlan} profile={profile} fmt={fmt} />}
          </PfCard>
        )}

        {!isComplete && (
          <div style={{ textAlign:'center', padding:'32px', background:'#f8f9fc', borderRadius:14, border:'2px dashed #e0e4f0' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🎯</div>
            <div style={{ fontSize:16, color:'#1a1d2e', fontWeight:600, marginBottom:8 }}>Complete your profile to unlock the AI Plan</div>
            <div style={{ fontSize:13, color:'#8892b0', marginBottom:20 }}>Fill in at least Personal Details and Income & Expenses to get started.</div>
            <button className="btn btn-gold" onClick={() => setStep(1)}>Start Profile →</button>
          </div>
        )}
      </div>
    )
  }

  // ─── Step wizard ─────────────────────────────────────────────────────────────
  const currentStep = STEPS[step - 1]
  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      {/* Step header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={() => setStep(0)}
          style={{ fontSize:13, color:'#8892b0', background:'none', border:'none', cursor:'pointer', padding:'4px 0', fontFamily:"'Outfit',sans-serif" }}>
          ← Back to Profile
        </button>
        <span style={{ color:'#e0e4f0' }}>·</span>
        <span style={{ fontSize:13, color:'#c8920a', fontWeight:600 }}>Step {step} of {STEPS.length}: {currentStep?.title}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height:4, background:'#eef0f8', borderRadius:2, marginBottom:28, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${step/STEPS.length*100}%`, background:'#c8920a', borderRadius:2, transition:'width 0.4s' }} />
      </div>

      {/* Step content */}
      <div style={{ display:'grid', gap:16 }}>
        {stepPages[step]}
      </div>

      {/* Nav */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:28, paddingTop:20, borderTop:'1px solid #eef0f8' }}>
        <button className="btn btn-outline" onClick={() => step > 1 ? setStep(s => s-1) : setStep(0)}>
          ← {step > 1 ? `Step ${step-1}` : 'Overview'}
        </button>
        <button className="btn btn-gold" onClick={() => { saveProfile(); step < STEPS.length ? setStep(s => s+1) : setStep(0) }}>
          {step < STEPS.length ? `Save & Continue →` : '✓ Save & Finish'}
        </button>
      </div>
    </div>
  )
}

// ─── AI Plan Display ──────────────────────────────────────────────────────────
function AIPlanDisplay({ plan, profile, fmt }) {
  const [activeSection, setActiveSection] = useState('alerts')

  const sections = [
    { id:'alerts',     label:'🚨 Urgent',         show: plan.urgentAlerts?.length > 0 },
    { id:'protection', label:'🛡️ Protection',     show: true },
    { id:'goals',      label:'🎯 Goal Plans',      show: plan.goalPlans?.length > 0 },
    { id:'allocation', label:'📊 Allocation',      show: plan.assetAllocation?.length > 0 },
    { id:'savings',    label:'💰 Monthly Plan',    show: plan.savingsAllocation?.length > 0 },
    { id:'quickwins',  label:'⚡ Quick Wins',      show: plan.quickWins?.length > 0 },
  ].filter(s => s.show)

  const s = plan.summary || {}

  return (
    <div>
      {/* Summary strip */}
      {s.monthlyIncome > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
          {[
            { l:'Monthly Income',   v: fmt(s.monthlyIncome),   c:'#1a1d2e' },
            { l:'Allocated',        v: fmt(s.totalAllocated),  c:'#c8920a' },
            { l:'Surplus/Deficit',  v: fmt(Math.abs(s.surplusOrDeficit)), c: s.surplusOrDeficit >= 0 ? '#16a34a' : '#dc2626' },
          ].map(x => (
            <div key={x.l} style={{ background:'#f8f9fc', borderRadius:10, padding:'12px 14px', border:'1px solid #eef0f8' }}>
              <div style={{ fontSize:11, color:'#8892b0', marginBottom:4 }}>{x.l}</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:15, fontWeight:700, color:x.c }}>{x.v}</div>
            </div>
          ))}
        </div>
      )}

      {s.overallAdvice && (
        <div style={{ background:'rgba(200,146,10,0.06)', border:'1px solid rgba(200,146,10,0.2)', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#6b4800', marginBottom:16, lineHeight:1.6 }}>
          💡 {s.overallAdvice}
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {sections.map(sec => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            style={{ padding:'6px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
              background: activeSection===sec.id ? '#c8920a' : '#f0f2f8',
              color:      activeSection===sec.id ? '#fff'    : '#6b7494',
              border:     activeSection===sec.id ? 'none'    : '1px solid #e0e4f0' }}>
            {sec.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSection === 'alerts' && plan.urgentAlerts?.map((a, i) => (
        <div key={i} style={{ padding:'14px 16px', borderRadius:10, marginBottom:10,
          background: a.type==='critical' ? 'rgba(220,38,38,0.05)' : 'rgba(245,158,11,0.05)',
          border:     a.type==='critical' ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize:13, fontWeight:600, color: a.type==='critical'?'#dc2626':'#92400e', marginBottom:4 }}>{a.title}</div>
          <div style={{ fontSize:12, color:'#6b7494', marginBottom:6 }}>{a.message}</div>
          {a.action && <div style={{ fontSize:12, fontWeight:500, color:'#c8920a' }}>→ {a.action}</div>}
        </div>
      ))}

      {activeSection === 'protection' && plan.protectionPlan && (() => {
        const p = plan.protectionPlan
        return (
          <div style={{ display:'grid', gap:10 }}>
            {[
              { label:'Term Insurance Needed', value: p.termInsuranceNeeded, advice: p.termInsuranceAdvice },
              { label:'Health Insurance',       value: null,                  advice: p.healthInsuranceAdvice },
              { label:'Emergency Fund Target',  value: p.emergencyFundTarget, advice: p.emergencyFundAdvice },
            ].map((x,i) => x.advice && (
              <div key={i} style={{ background:'#f8f9fc', borderRadius:10, padding:'14px 16px', border:'1px solid #eef0f8' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>{x.label}</div>
                  {x.value && <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:'#c8920a' }}>{x.value}</div>}
                </div>
                <div style={{ fontSize:12, color:'#6b7494', lineHeight:1.6 }}>{x.advice}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {activeSection === 'goals' && (
        <div style={{ display:'grid', gap:10 }}>
          {plan.goalPlans?.map((g, i) => (
            <div key={i} style={{ background:'#f8f9fc', borderRadius:10, padding:'16px', border:'1px solid #eef0f8' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e' }}>{g.goalName}</div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:15, fontWeight:700, color:'#c8920a' }}>
                    ₹{(g.monthlySIP||0).toLocaleString('en-IN')}<span style={{ fontSize:11, fontWeight:400 }}>/mo</span>
                  </div>
                  <div style={{ fontSize:11, color:'#8892b0' }}>SIP required</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:12, color:'#6b7494', marginBottom:8 }}>
                <span>Target: <strong>{typeof g.targetAmount==='number' ? `₹${g.targetAmount.toLocaleString('en-IN')}` : g.targetAmount}</strong></span>
                <span>By: <strong>{g.targetYear}</strong></span>
                <span>Years left: <strong>{g.yearsLeft}</strong></span>
              </div>
              {g.instrument && <div style={{ fontSize:12, fontWeight:500, color:'#5b8ff9', marginBottom:6 }}>📌 {g.instrument}</div>}
              {g.advice && <div style={{ fontSize:12, color:'#6b7494', lineHeight:1.6 }}>{g.advice}</div>}
            </div>
          ))}
        </div>
      )}

      {activeSection === 'allocation' && (
        <div style={{ display:'grid', gap:10 }}>
          {plan.assetAllocation?.map((a, i) => (
            <div key={i} style={{ background:'#f8f9fc', borderRadius:10, padding:'14px 16px', border:'1px solid #eef0f8' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>{a.class}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, fontWeight:700, color:'#c8920a' }}>{a.pct}%</div>
              </div>
              <div style={{ height:5, background:'#eef0f8', borderRadius:2, marginBottom:8, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${a.pct}%`, background:'#c8920a', borderRadius:2 }} />
              </div>
              {a.instruments && <div style={{ fontSize:12, fontWeight:500, color:'#5b8ff9', marginBottom:4 }}>📌 {a.instruments}</div>}
              {a.rationale && <div style={{ fontSize:12, color:'#6b7494', lineHeight:1.6 }}>{a.rationale}</div>}
            </div>
          ))}
        </div>
      )}

      {activeSection === 'savings' && (
        <div style={{ display:'grid', gap:8 }}>
          {plan.savingsAllocation?.map((a, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'12px 14px', background:'#f8f9fc', borderRadius:8, border:'1px solid #eef0f8' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:'#1a1d2e' }}>{a.category}</div>
                {a.instrument && <div style={{ fontSize:11, color:'#5b8ff9', marginTop:2 }}>via {a.instrument}</div>}
                {a.purpose && <div style={{ fontSize:11, color:'#8892b0', marginTop:1 }}>{a.purpose}</div>}
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:700, color:'#c8920a', flexShrink:0 }}>
                ₹{(a.amount||0).toLocaleString('en-IN')}<span style={{ fontSize:11, fontWeight:400 }}>/mo</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'quickwins' && (
        <div style={{ display:'grid', gap:10 }}>
          {plan.quickWins?.map((q, i) => (
            <div key={i} style={{ background:'#f8f9fc', borderRadius:10, padding:'14px 16px', border:'1px solid #eef0f8', display:'flex', gap:12 }}>
              <div style={{ width:28, height:28, background:'rgba(200,146,10,0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:700, color:'#c8920a' }}>{i+1}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e', marginBottom:4 }}>{q.title}</div>
                <div style={{ fontSize:12, color:'#6b7494', marginBottom:6 }}>{q.action}</div>
                {q.impact && <div style={{ fontSize:12, fontWeight:500, color:'#16a34a' }}>✓ {q.impact}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Financial Plan Tab — shows persisted AI plan with goal breakdown ─────────

export function FinancialPlanTab() {
  const { session } = useAuth()
  const { data, settings } = useFinance()
  const cur = settings.currency
  const fmtN = v => formatCurrency(v, cur)

  const [plan,         setPlan]         = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [savedAmounts, setSavedAmounts] = useState([])  // profile goals currentSaved at plan time
  const [activeSection,setActiveSection]= useState('goals')
  const [editingGoal,  setEditingGoal]  = useState(null)   // goalIndex being edited
  const [goalEdits,    setGoalEdits]    = useState({})     // {index: {currentSaved, targetAmount, targetYear, monthlySIP}}
  const [editProt,     setEditProt]     = useState(false)
  const [protEditOpen, setProtEditOpen] = useState(null) // which field is open for edit
  const [protEdits,    setProtEdits]    = useState({})
  const [goalMap,      setGoalMap]      = useState({})     // {goalName: [assetId,...]}
  const [mapModal,     setMapModal]     = useState(null)   // goalName being mapped
  const [tempSelected, setTempSelected] = useState(new Set())  // asset selection in map modal
  const [linkedTooltip, setLinkedTooltip] = useState(null)  // index of goal showing linked assets tooltip
  const [addGoalModal, setAddGoalModal] = useState(false)
  const [newGoal, setNewGoal] = useState({ type:'home', label:'', targetAmount:'', targetYear:'', currentSaved:'0', priority:'high' })

  // ── Load saved data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.userId) return
    const saved = ProfileDB.get(session.userId)
    if (saved) {
      const { _aiPlan, _goalMap, _goalEdits, _protEdits, _profileSavedAmounts, ...profileData } = saved
      setProfile(profileData)
      if (_aiPlan)    { setPlan(_aiPlan); setGoalEdits(_goalEdits||{}); setProtEdits(_protEdits||{}) }
      if (_goalMap)   setGoalMap(_goalMap)
      if (_profileSavedAmounts) setSavedAmounts(_profileSavedAmounts)
    }
  }, [session?.userId])

  // ── Persist helper ───────────────────────────────────────────────────────────
  const persist = (updates) => {
    if (!session?.userId) return
    const existing = ProfileDB.get(session.userId) || {}
    ProfileDB.save(session.userId, { ...existing, ...updates })
  }

  // ── Protection sub-components (defined here to avoid hooks-in-render issues) ──
  const PRIO_STYLE = {
    'Achieved': { color:'#16a34a', bg:'rgba(22,163,74,0.08)',  border:'rgba(22,163,74,0.25)'  },
    'Critical':  { color:'#dc2626', bg:'rgba(220,38,38,0.08)',  border:'rgba(220,38,38,0.25)'  },
    'High':      { color:'#ea580c', bg:'rgba(234,88,12,0.08)',  border:'rgba(234,88,12,0.25)'  },
    'Medium':    { color:'#c8920a', bg:'rgba(200,146,10,0.08)', border:'rgba(200,146,10,0.25)' },
  }

  if (!plan) return (
    <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>📋</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:'#1a1d2e', fontWeight:700, marginBottom:8 }}>No Financial Plan Yet</div>
      <div style={{ fontSize:14, color:'#8892b0', marginBottom:24, lineHeight:1.7 }}>
        Go to the <strong>Profile</strong> tab, complete your details, and click <strong>✨ Generate My Plan</strong>.
      </div>
    </div>
  )

  // ── Derived calculations ─────────────────────────────────────────────────────
  const assets = data?.assets || []
  // ── Profile goals are the SOURCE OF TRUTH for goal name, target, year, currentSaved
  // AI plan only provides: instrument recommendations, advice, monthlySIP suggestion
  // We merge by index (position) — goal 0 in profile = goal 0 in AI plan
  const profileGoals = profile?.goals || []

  // Build AI lookup map by index for instrument/advice enrichment
  const aiGoalByIndex = {}
  ;(plan.goalPlans || []).forEach((g, i) => { aiGoalByIndex[i] = g })

  const goalPlans = profileGoals.map((pg, i) => {
    const e   = goalEdits[i] || {}
    const ai  = aiGoalByIndex[i] || {}

    // Goal name: user edit > profile label (NEVER use AI-renamed title)
    const goalName     = e.goalName     ?? pg.label         ?? ai.goalName ?? `Goal ${i+1}`
    // Amounts: user edit > profile wizard entry > AI suggestion
    const targetAmount = parseInt(e.targetAmount ?? pg.targetAmount ?? ai.targetAmount ?? 0)
    const targetYear   = e.targetYear   ?? pg.targetYear    ?? ai.targetYear  ?? ''
    // Linked assets value — sum of all assets mapped to this goal
    const mappedAssets = (goalMap[goalName] || []).map(id => (data?.assets||[]).find(a => a.id === id)).filter(Boolean)
    const linkedValue  = Math.round(mappedAssets.reduce((s, a) => s + (a.value||0), 0))
    // Fix 1: If assets are linked, their total value IS the currentSaved (overrides manual entry)
    const currentSaved = linkedValue > 0
      ? linkedValue
      : parseInt(e.currentSaved ?? savedAmounts[i]?.currentSaved ?? pg.currentSaved ?? ai.currentSaved ?? 0)
    const yearsLeft     = Math.max(0, (parseInt(targetYear)||0) - new Date().getFullYear())
    const shortfall     = Math.max(0, targetAmount - currentSaved)
    // Per-goal return rate — normalize to decimal (e.returnRate stored as % string e.g."8", pg.returnRate as decimal 0.08)
    const rawR      = e.returnRate !== undefined ? parseFloat(e.returnRate) : null
    const returnRate = rawR !== null
      ? (rawR > 1 ? rawR / 100 : rawR)          // "8" → 0.08, "0.08" → 0.08
      : parseFloat(pg.returnRate ?? RETURN_RATES[pg.type||'custom'] ?? 0.10)
    const inflationRate = parseFloat(pg.inflationRate ?? INFLATION_RATES[pg.type||'custom'] ?? 0.06)
    const r             = returnRate / 12
    const n             = yearsLeft * 12
    const autoSIP       = yearsLeft > 0 && shortfall > 0
      ? Math.round(shortfall * r / (Math.pow(1 + r, n) - 1))
      : (shortfall > 0 ? shortfall : 0)
    const monthlySIP    = e.monthlySIP !== undefined && e.monthlySIP !== '' ? parseInt(e.monthlySIP)||0 : autoSIP
    const pct           = targetAmount > 0 ? Math.min(100, Math.round(currentSaved / targetAmount * 100)) : 0
    // Generate instrument recommendation locally (more reliable than AI)
    const localInstrument = getGoalRecommendation(yearsLeft, pg.horizon || 'medium', pg.type || 'custom')

    return {
      ...ai,
      goalName, targetAmount, targetYear, currentSaved,
      yearsLeft, shortfall, monthlySIP, pct, index: i,
      returnRate, inflationRate,
      inflationAdjusted: pg.inflationAdjusted,
      todayValue: e.todayValue !== undefined && e.todayValue !== '' ? parseInt(e.todayValue)||0 : pg.todayValue,
      type: pg.type,
      icon: pg.icon || ai.icon || '🎯',
      instrument: localInstrument,   // always use local recommendation
      advice: ai.advice || '',
    }
  })

  const totalTarget  = goalPlans.reduce((s,g) => s + g.targetAmount, 0)
  const totalSaved   = goalPlans.reduce((s,g) => s + g.currentSaved, 0)
  const totalSIP     = goalPlans.reduce((s,g) => s + g.monthlySIP, 0)

  // Protection edits merged
  const prot = { ...(plan.protectionPlan||{}), ...protEdits }

  // ── Auto-suggest: map assets to goals ───────────────────────────────────────
  const autoSuggestMapping = (goalName, goalPlan) => {
    const n = goalName.toLowerCase()
    const suggestions = []
    assets.forEach(a => {
      const cls = getAssetClass(a)
      const cat = (a.category||'').toLowerCase()
      const name = (a.name||'').toLowerCase()
      let match = false

      if (/retire|pension|corpus/.test(n)) {
        // Retirement: all equity + debt + gold assets (market-linked or long-term debt)
        match = cls === 'Equity' || cls === 'Debt' || cls === 'Gold & Silver'
      } else if (/child|educat|school|college/.test(n)) {
        // Child goals: mutual funds (both equity and debt), but not direct stocks or cash
        match = (a._isMF || a.category === 'Mutual Funds') && cls !== null
      } else if (/home|house|flat|property/.test(n)) {
        // Home: debt instruments + FDs (safe, capital-guaranteed)
        match = cls === 'Debt' || cls === 'Cash'
      } else if (/emergency/.test(n)) {
        // Emergency: liquid assets only (cash, liquid funds)
        match = cls === 'Cash' || /liquid|overnight/.test(name)
      } else if (/gold|wedding|jewel/.test(n)) {
        // Gold goals: gold & silver assets only
        match = cls === 'Gold & Silver'
      } else if (/tax/.test(n)) {
        // Tax: ELSS (equity) and PPF (debt) — tax-advantaged products
        match = /elss|ppf|nps/.test(name+cat)
      } else if (/car|vehicle/.test(n)) {
        // Vehicle: cash and liquid debt (short-term, capital-safe)
        match = cls === 'Cash' || (cls === 'Debt' && /liquid|fixed deposit/.test(cat))
      } else {
        // Generic short-term: mutual funds only
        match = a._isMF || a.category === 'Mutual Funds'
      }
      if (match) suggestions.push(a.id)
    })
    return suggestions
  }

  // Assets not mapped to any goal
  const mappedAssetIds = new Set(Object.values(goalMap).flat())
  const unmappedAssets = assets.filter(a => !mappedAssetIds.has(a.id) && a.value > 0)

  // New assets added recently (last 7 days) — prompt to map
  const recentAssets = assets.filter(a => {
    if (!a._addedAt) return false
    return (Date.now() - new Date(a._addedAt).getTime()) < 7 * 24 * 3600 * 1000
  })

  // ── Save goal edits ──────────────────────────────────────────────────────────
  const saveGoalEdit = (i, fields) => {
    // Normalize returnRate to decimal on save (user enters as % like "8", store as 0.08)
    const normalized = { ...fields }
    if (normalized.returnRate !== undefined && normalized.returnRate !== '') {
      const rv = parseFloat(normalized.returnRate)
      normalized.returnRate = rv > 1 ? rv / 100 : rv
    }
    const updated = { ...goalEdits, [i]: { ...(goalEdits[i]||{}), ...normalized } }
    setGoalEdits(updated)
    // Also sync goal name + key fields back to profile.goals so Profile wizard stays in sync
    const updatedProfileGoals = (profile?.goals||[]).map((pg, idx) => {
      if (idx !== i) return pg
      return {
        ...pg,
        ...(fields.goalName     !== undefined ? { label:       fields.goalName }     : {}),
        ...(fields.targetAmount !== undefined ? { targetAmount:fields.targetAmount }  : {}),
        ...(fields.targetYear   !== undefined ? { targetYear:  fields.targetYear }    : {}),
        ...(fields.currentSaved !== undefined ? { currentSaved:fields.currentSaved }  : {}),
        ...(fields.todayValue   !== undefined ? { todayValue:  fields.todayValue }    : {}),
      }
    })
    const updatedProfile = { ...(profile||{}), goals: updatedProfileGoals }
    setProfile(updatedProfile)
    persist({ _goalEdits: updated, ...updatedProfile })
    setEditingGoal(null)
  }

  const saveProtEdit = (fields) => {
    const updated = { ...protEdits, ...fields }
    setProtEdits(updated)
    persist({ _protEdits: updated })
    setEditProt(false)
  }

  // ── Save goal mapping ────────────────────────────────────────────────────────
  const saveGoalMap = (goalName, assetIds) => {
    const updated = { ...goalMap, [goalName]: assetIds }
    setGoalMap(updated)
    persist({ _goalMap: updated })
    setMapModal(null)
  }

  const addGoalFromMyGoals = () => {
    if (!profile) return
    const rawTarget = parseInt(newGoal.targetAmount) || 0
    const targetYear = parseInt(newGoal.targetYear) || 0
    if (rawTarget <= 0 || targetYear < new Date().getFullYear()) return

    const type = GOAL_TYPES.find(g => g.id === newGoal.type) || GOAL_TYPES.find(g => g.id === 'custom')
    const years = targetYear - new Date().getFullYear()
    const inflationRate = type?.inflationRate || 0
    const inflatedTarget = calcInflatedTarget(rawTarget, years, inflationRate)
    const returnRate = type?.returnRate || RETURN_RATES[type?.id || 'custom'] || 0.10
    const goal = {
      id: Date.now(),
      ...newGoal,
      targetYear: String(targetYear),
      icon: type?.icon || '🎯',
      label: (newGoal.label || type?.label || 'Custom Goal').trim(),
      horizon: type?.horizon || 'medium',
      inflationRate,
      returnRate,
      todayValue: rawTarget,
      targetAmount: inflationRate > 0 ? inflatedTarget : rawTarget,
      inflationAdjusted: inflationRate > 0,
    }

    const updatedProfile = { ...profile, goals: [...(profile.goals || []), goal] }
    setProfile(updatedProfile)
    persist(updatedProfile)
    setAddGoalModal(false)
    setNewGoal({ type:'home', label:'', targetAmount:'', targetYear:'', currentSaved:'0', priority:'high' })
  }

  const s = plan.summary || {}
  const income = s.monthlyIncome || 0
  const SECTIONS = [
    { id:'goals',      label:'🎯 Goals'           },
    { id:'protection', label:'🛡️ Protection'     },
    { id:'mapping',    label:'🔗 Asset Mapping'   },
    { id:'allocation', label:'📈 Allocation'      },
    { id:'monthly',    label:'💰 Monthly Plan'    },
    { id:'quickwins',  label:'⚡ Quick Wins'      },
  ]

  return (
    <div style={{ display:'grid', gap:20, maxWidth:960, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1a1d2e,#252945)', borderRadius:16, padding:'24px 28px', color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:-20, top:-20, width:160, height:160, background:'rgba(200,146,10,0.07)', borderRadius:'50%' }}/>
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:11, letterSpacing:'0.1em', color:'#c8920a', fontWeight:600, marginBottom:4, textTransform:'uppercase' }}>AI Financial Plan</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:700, marginBottom:14 }}>
            {profile?.name ? `${profile.name}'s` : 'Your'} Financial Roadmap
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[
              { l:'Goals',          v:`${goalPlans.length}` },
              { l:'Total Target',   v: fmtN(totalTarget) },
              { l:'Total Saved',    v: fmtN(totalSaved), c: totalSaved > 0 ? '#3ecf8e' : undefined },
              { l:'Monthly SIP Needed', v: fmtN(totalSIP), c:'#f09b46' },
              { l:'Savings Rate',   v: `${income > 0 ? Math.round((s.totalAllocated||0)/income*100) : 0}%` },
            ].map(x => (
              <div key={x.l} style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'9px 14px' }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginBottom:2 }}>{x.l}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:700, color: x.c||'rgba(255,255,255,0.9)' }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New asset mapping prompt */}
      {unmappedAssets.length > 0 && (
        <div style={{ background:'rgba(91,143,249,0.06)', border:'1px solid rgba(91,143,249,0.25)', borderRadius:12, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e', marginBottom:2 }}>
              💡 {unmappedAssets.length} asset{unmappedAssets.length>1?'s':''} not mapped to any goal
            </div>
            <div style={{ fontSize:12, color:'#8892b0' }}>
              {unmappedAssets.slice(0,3).map(a=>a.name).join(', ')}{unmappedAssets.length>3?` +${unmappedAssets.length-3} more`:''}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" style={{ borderColor:'#5b8ff9', color:'#5b8ff9', flexShrink:0 }}
            onClick={() => setActiveSection('mapping')}>
            Map Now →
          </button>
        </div>
      )}

      {/* Section tabs */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {SECTIONS.map(sec => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            style={{ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
              background: activeSection===sec.id ? '#c8920a' : '#f0f2f8',
              color:      activeSection===sec.id ? '#fff'    : '#6b7494',
              border:     activeSection===sec.id ? 'none'    : '1px solid #e0e4f0',
              fontFamily:"'Outfit',sans-serif" }}>
            {sec.label}
          </button>
        ))}
      </div>

      {/* ── GOALS SECTION ─────────────────────────────────────────────────────── */}
      {activeSection === 'goals' && (
        <div style={{ display:'grid', gap:16 }}>
          {/* Section header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'#1a1d2e', fontWeight:700 }}>Financial Goals Tracker</div>
              <div style={{ fontSize:12, color:'#8892b0', marginTop:2 }}>Click any goal card to edit progress, saved amount, or target</div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-gold btn-sm" onClick={() => setAddGoalModal(true)}>
                + Add Goal
              </button>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:10, color:'#8892b0' }}>Total Monthly SIP</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, fontWeight:700, color:'#c8920a' }}>₹{totalSIP.toLocaleString('en-IN')}/mo</div>
              </div>
            </div>
          </div>

          {goalPlans.map((g, i) => {
            const isEditing = editingGoal === i
            const mapped = (goalMap[g.goalName] || []).map(id => assets.find(a => a.id === id)).filter(Boolean)
            const mappedValue = Math.round(mapped.reduce((s,a) => s+(a.value||0), 0))
            const isLinked = mapped.length > 0
            // g.currentSaved already equals mappedValue (from goalPlans derivation) when assets linked
            const pctColor = g.pct >= 100 ? '#16a34a' : g.pct >= 60 ? '#c8920a' : g.pct >= 30 ? '#f09b46' : '#dc2626'

            // All SIP calculations use the SAME returnRate so they stay consistent
            const rr = g.returnRate || 0.10
            const ir = g.inflationRate || 0

            return (
              <div key={i} className="card" style={{ padding:0, overflow:'hidden',
                border: isEditing ? '1.5px solid #c8920a' : '1px solid #eef0f8',
                boxShadow: isEditing ? '0 4px 20px rgba(200,146,10,0.12)' : '0 1px 4px rgba(0,0,0,0.04)' }}>

                {/* ── Goal header row ── */}
                <div style={{ padding:'16px 20px', background: isEditing ? 'rgba(200,146,10,0.04)' : '#fafbfc',
                  display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer',
                  borderBottom:'1px solid #eef0f8' }}
                  onClick={() => { setEditingGoal(isEditing ? null : i); setLinkedTooltip(null) }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:22 }}>{g.icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:'#1a1d2e' }}>{g.goalName}</div>
                      <div style={{ display:'flex', gap:8, marginTop:3, flexWrap:'wrap' }}>
                        {ir > 0 && (
                          <span style={{ fontSize:10, fontWeight:600, color:'#c8920a', background:'rgba(200,146,10,0.08)', border:'1px solid rgba(200,146,10,0.2)', padding:'1px 7px', borderRadius:10 }}>
                            📈 {(ir*100).toFixed(0)}% inflation
                          </span>
                        )}
                        <span style={{ fontSize:10, fontWeight:600, color:'#5b8ff9', background:'rgba(91,143,249,0.08)', border:'1px solid rgba(91,143,249,0.2)', padding:'1px 7px', borderRadius:10 }}>
                          💹 {(rr*100).toFixed(0)}% returns p.a.
                        </span>
                        {mapped.length > 0 && (
                          <span
                            onClick={ev => { ev.stopPropagation(); setLinkedTooltip(linkedTooltip === i ? null : i) }}
                            style={{ fontSize:10, fontWeight:600, color:'#059669', background:'rgba(5,150,105,0.08)',
                              border:'1px solid rgba(5,150,105,0.25)', padding:'1px 8px', borderRadius:10,
                              cursor:'pointer', position:'relative', userSelect:'none' }}
                            title="Click to see linked assets">
                            🔗 {mapped.length} asset{mapped.length>1?'s':''} ▾
                            {/* Linked assets popover */}
                            {linkedTooltip === i && (
                              <div onClick={ev => ev.stopPropagation()}
                                style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:500,
                                  background:'#fff', borderRadius:10, boxShadow:'0 8px 30px rgba(0,0,0,0.15)',
                                  border:'1px solid #eef0f8', padding:'10px 0', minWidth:260, maxWidth:320 }}>
                                <div style={{ padding:'4px 14px 8px', fontSize:10, fontWeight:700, color:'#8892b0',
                                  textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid #f0f2f8', marginBottom:4 }}>
                                  Linked Investments · ₹{mappedValue.toLocaleString('en-IN')} total
                                </div>
                                {(() => {
                                  // Group: direct stocks as one summary row, everything else listed individually
                                  const directStocks = mapped.filter(a => a.category === 'Stocks & Equities')
                                  const otherAssets  = mapped.filter(a => a.category !== 'Stocks & Equities')
                                  const stockTotal   = directStocks.reduce((s,a) => s+(a.value||0), 0)
                                  const rows = [
                                    // Direct stocks: one summary row
                                    ...(directStocks.length > 0 ? [{
                                      id: '__stocks__', isSummary: true,
                                      name: `Direct Stocks (${directStocks.length} holdings)`,
                                      category: 'Stocks & Equities', value: stockTotal,
                                    }] : []),
                                    // All other assets: individual rows
                                    ...otherAssets,
                                  ]
                                  return rows.map((a, ai2) => (
                                    <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                                      padding:'7px 14px', gap:10, borderBottom: ai2 < rows.length-1 ? '1px solid #f8f9fc' : 'none',
                                      background: a.isSummary ? 'rgba(91,143,249,0.04)' : 'transparent' }}>
                                      <div style={{ minWidth:0 }}>
                                        <div style={{ fontSize:12, fontWeight:600, color: a.isSummary ? '#5b8ff9' : '#1a1d2e',
                                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170 }}>{a.name}</div>
                                        <div style={{ fontSize:10, color:'#8892b0', marginTop:1 }}>{a.category}</div>
                                      </div>
                                      <div style={{ textAlign:'right', flexShrink:0 }}>
                                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700,
                                          color:'#059669' }}>₹{(a.value||0).toLocaleString('en-IN')}</div>
                                        {!a.isSummary && a._plPct !== undefined && (
                                          <div style={{ fontSize:10, color: a._plPct >= 0 ? '#16a34a' : '#dc2626' }}>
                                            {a._plPct >= 0 ? '+' : ''}{(a._plPct||0).toFixed(1)}%
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                })()}
                                <div style={{ padding:'8px 14px 2px', fontSize:11, color:'#8892b0',
                                  borderTop:'1px solid #f0f2f8', marginTop:2 }}>
                                  ↑ Used as Current Saved amount
                                </div>
                              </div>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:17, fontWeight:700, color:'#c8920a' }}>
                        ₹{g.monthlySIP.toLocaleString('en-IN')}
                        <span style={{ fontSize:10, fontWeight:400, color:'#8892b0' }}>/mo</span>
                      </div>
                      <div style={{ fontSize:10, color:'#8892b0', marginTop:1 }}>monthly SIP</div>
                    </div>
                    <span style={{ color:'#c8920a', fontSize:14 }}>{isEditing ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* ── Progress section ── */}
                <div style={{ padding:'14px 20px', borderBottom: isEditing ? '1px solid #eef0f8' : 'none' }}>
                  {/* Progress bar */}
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                    <span style={{ color:'#6b7494' }}>
                      {isLinked ? (
                        <span>
                          <span style={{ fontWeight:600, color:'#059669' }}>₹{mappedValue.toLocaleString('en-IN')}</span>
                          <span style={{ color:'#059669', marginLeft:4 }}>from {mapped.length} linked asset{mapped.length>1?'s':''}</span>
                        </span>
                      ) : (
                        <span>₹{g.currentSaved.toLocaleString('en-IN')} saved</span>
                      )}
                    </span>
                    <span style={{ fontWeight:600, color: pctColor }}>{g.pct}% · ₹{g.shortfall.toLocaleString('en-IN')} to go</span>
                  </div>
                  <div style={{ height:8, background:'#eef0f8', borderRadius:4, overflow:'hidden', marginBottom:10 }}>
                    <div style={{ height:'100%', width:`${g.pct}%`,
                      background: g.pct >= 100 ? '#16a34a' : `linear-gradient(90deg, ${pctColor}cc, ${pctColor})`,
                      borderRadius:4, transition:'width 0.5s' }} />
                  </div>

                  {/* Goal meta row */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:8 }}>
                    {[
                      { l:'Inflation Target', v:`₹${g.targetAmount.toLocaleString('en-IN')}${g.inflationAdjusted?' ↑':''}`, bold:true,
                        hint: g.inflationAdjusted ? 'Inflation-adjusted' : '' },
                      { l:"Today's Value", v:`₹${parseInt(g.todayValue||g.targetAmount).toLocaleString('en-IN')}`,
                        hint: g.inflationRate > 0 ? `Before ${(g.inflationRate*100).toFixed(0)}% inflation` : '' },
                      { l:'Target Year', v: String(g.targetYear) },
                      { l:'Years Left',  v: `${g.yearsLeft} yrs` },
                    ].map(x => (
                      <div key={x.l} style={{ padding:'8px 10px', background:'#f4f5f9', borderRadius:8, borderLeft: x.bold ? '3px solid #c8920a' : 'none' }}>
                        <div style={{ fontSize:10, color:'#8892b0', marginBottom:2 }}>{x.l}</div>
                        <div style={{ fontSize:12, fontWeight: x.bold ? 700 : 500, color:'#1a1d2e' }}>{x.v}</div>
                        {x.hint && <div style={{ fontSize:9, color:'#c8920a', marginTop:1 }}>{x.hint}</div>}
                      </div>
                    ))}
                  </div>
                  {/* Recommendation pill */}
                  {g.instrument && (
                    <div style={{ marginTop:8, padding:'6px 12px', background:'rgba(91,143,249,0.07)', border:'1px solid rgba(91,143,249,0.18)', borderRadius:20, display:'inline-flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11 }}>📌</span>
                      <span style={{ fontSize:11, fontWeight:600, color:'#3b5bdb' }}>{g.instrument}</span>
                    </div>
                  )}
                </div>

                {/* ── Inline edit form ── */}
                {isEditing && (() => {
                  const e = goalEdits[i] || {}
                  // ── Single canonical SIP calculator (same logic as goalPlans derivation) ──
                  // Use g.* as ground truth; only override if user actively changed a field
                  // IMPORTANT: treat e.currentSaved=0 as "not set" (g.currentSaved is the real value)
                  const editSaved  = (e.currentSaved !== undefined && e.currentSaved !== '' && parseInt(e.currentSaved) > 0)
                    ? parseInt(e.currentSaved)
                    : g.currentSaved   // always use the correctly derived value from goalPlans
                  const editTarget = (e.targetAmount !== undefined && e.targetAmount !== '')
                    ? parseInt(e.targetAmount)||0
                    : g.targetAmount
                  const editYear   = (e.targetYear !== undefined && e.targetYear !== '')
                    ? e.targetYear
                    : g.targetYear

                  // returnRate: stored as decimal (0.12) after save, but show as % (12) in input
                  const rawEditR   = e.returnRate !== undefined ? parseFloat(e.returnRate) : null
                  const editReturn = rawEditR !== null
                    ? (rawEditR <= 1 ? (rawEditR * 100).toFixed(1) : String(rawEditR))
                    : (rr * 100).toFixed(0)  // rr is already decimal from goalPlans

                  const pvShortfall = Math.max(0, editTarget - editSaved)
                  const pvYears     = Math.max(0, (parseInt(editYear)||0) - new Date().getFullYear())
                  const liveReturn  = (parseFloat(editReturn)||10) / 100

                  // THE canonical SIP function — identical formula used in goalPlans derivation
                  const calcSIPEdit = (sf, yrs, annRate) => {
                    const mr = annRate / 12, nm = yrs * 12
                    return nm > 0 && sf > 0 ? Math.round(sf * mr / (Math.pow(1 + mr, nm) - 1)) : (sf > 0 ? sf : 0)
                  }
                  const autoCalcSIP = calcSIPEdit(pvShortfall, pvYears, liveReturn)
                  const liveSIP     = (e.monthlySIP !== undefined && e.monthlySIP !== '')
                    ? parseInt(e.monthlySIP)||0
                    : autoCalcSIP
                  const livePct     = editTarget > 0 ? Math.min(100, Math.round(editSaved / editTarget * 100)) : 0

                  return (
                    <div style={{ padding:'18px 20px', background:'rgba(200,146,10,0.02)' }}>
                      {/* Goal name — full width */}
                      <div style={{ marginBottom:14 }}>
                        <label style={{ fontSize:11, fontWeight:600, color:'#6b7494', display:'block', marginBottom:4 }}>Goal Name</label>
                        <input className="input" type="text"
                          value={e.goalName !== undefined ? e.goalName : g.goalName}
                          onChange={ev => setGoalEdits(p => ({...p, [i]: {...(p[i]||{}), goalName: ev.target.value}}))}
                          style={{ width:'100%', boxSizing:'border-box', fontWeight:600 }} />
                      </div>

                      {/* FIX 3: Reverse-calculate target if SIP is manually set */}
                      {(() => {
                        const manualSIP = e.monthlySIP !== undefined && e.monthlySIP !== '' ? parseInt(e.monthlySIP)||0 : 0
                        const reverseTarget = manualSIP > 0 && pvYears > 0
                          ? Math.round(manualSIP * (Math.pow(1 + liveReturn/12, pvYears*12) - 1) / (liveReturn/12)) + editSaved
                          : null
                        return reverseTarget ? (
                          <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(91,143,249,0.06)', border:'1px solid rgba(91,143,249,0.2)', borderRadius:10 }}>
                            <div style={{ fontSize:11, color:'#5b8ff9', fontWeight:600, marginBottom:2 }}>💡 With SIP of ₹{manualSIP.toLocaleString('en-IN')}/mo for {pvYears} yrs at {(liveReturn*100).toFixed(0)}% return:</div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#1a1d2e' }}>
                              Expected corpus: ₹{reverseTarget.toLocaleString('en-IN')}
                              <span style={{ fontSize:11, fontWeight:400, color:'#8892b0', marginLeft:8 }}>
                                (vs current target ₹{editTarget.toLocaleString('en-IN')})
                              </span>
                            </div>
                          </div>
                        ) : null
                      })()}

                      {/* Fields grid — 2 columns */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                        <div>
                          <label style={{ fontSize:11, fontWeight:600, color:'#6b7494', display:'block', marginBottom:4 }}>
                            Current Saved (₹)
                            {isLinked && <span style={{ fontSize:10, fontWeight:400, color:'#059669', marginLeft:4 }}>← from linked assets</span>}
                          </label>
                          <input className="input" type="number" min="0"
                            value={isLinked ? mappedValue : (e.currentSaved !== undefined && e.currentSaved !== '' ? e.currentSaved : editSaved)}
                            readOnly={isLinked}
                            onChange={ev => !isLinked && setGoalEdits(p => ({...p, [i]: {...(p[i]||{}), currentSaved: ev.target.value}}))}
                            style={{ width:'100%', boxSizing:'border-box', background: isLinked ? 'rgba(5,150,105,0.05)' : undefined,
                              color: isLinked ? '#059669' : undefined, cursor: isLinked ? 'not-allowed' : undefined }} />
                          {isLinked && <div style={{ fontSize:10, color:'#059669', marginTop:3 }}>
                            Auto-updated from: {(() => {
                              const directStocks = mapped.filter(a => a.category === 'Stocks & Equities')
                              const otherAssets  = mapped.filter(a => a.category !== 'Stocks & Equities')
                              const parts = []
                              if (directStocks.length > 0) parts.push(`Direct Stocks (${directStocks.length})`)
                              parts.push(...otherAssets.map(a => a.name))
                              return parts.join(', ')
                            })()}
                          </div>}
                        </div>
                        <div>
                          <label style={{ fontSize:11, fontWeight:600, color:'#6b7494', display:'block', marginBottom:4 }}>
                            Today's Value (₹)
                            <span style={{ fontSize:10, fontWeight:400, color:'#b0b8d0', marginLeft:4 }}>before inflation</span>
                          </label>
                          <input className="input" type="number" min="0"
                            value={e.todayValue !== undefined && e.todayValue !== '' ? e.todayValue : (g.todayValue || g.targetAmount)}
                            onChange={ev => {
                              const tv = parseInt(ev.target.value)||0
                              const yrsForCalc = pvYears
                              const ir2 = g.inflationRate || 0
                              const newInflated = ir2 > 0 ? Math.round(tv * Math.pow(1 + ir2, yrsForCalc)) : tv
                              setGoalEdits(p => ({...p, [i]: {...(p[i]||{}), todayValue: ev.target.value, targetAmount: newInflated}}))
                            }}
                            style={{ width:'100%', boxSizing:'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize:11, fontWeight:600, color:'#6b7494', display:'block', marginBottom:4 }}>
                            Target Amount (₹)
                            <span style={{ fontSize:10, fontWeight:400, color:'#b0b8d0', marginLeft:4 }}>inflation-adjusted</span>
                          </label>
                          <input className="input" type="number" min="0"
                            value={e.targetAmount !== undefined && e.targetAmount !== '' ? e.targetAmount : editTarget}
                            onChange={ev => setGoalEdits(p => ({...p, [i]: {...(p[i]||{}), targetAmount: ev.target.value}}))}
                            style={{ width:'100%', boxSizing:'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize:11, fontWeight:600, color:'#6b7494', display:'block', marginBottom:4 }}>Target Year</label>
                          <input className="input" type="number" min={new Date().getFullYear()} max="2060"
                            value={e.targetYear !== undefined && e.targetYear !== '' ? e.targetYear : editYear}
                            onChange={ev => setGoalEdits(p => ({...p, [i]: {...(p[i]||{}), targetYear: ev.target.value}}))}
                            style={{ width:'100%', boxSizing:'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize:11, fontWeight:600, color:'#6b7494', display:'block', marginBottom:4 }}>
                            Expected Return (% p.a.)
                          </label>
                          <input className="input" type="number" min="1" max="30" step="0.5"
                            value={editReturn}
                            onChange={ev => setGoalEdits(p => ({...p, [i]: {...(p[i]||{}), returnRate: ev.target.value}}))}
                            style={{ width:'100%', boxSizing:'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize:11, fontWeight:600, color:'#6b7494', display:'block', marginBottom:4 }}>
                            Monthly SIP (₹)
                            <span style={{ fontSize:10, fontWeight:400, color:'#b0b8d0', marginLeft:4 }}>blank = auto</span>
                          </label>
                          <input className="input" type="number" min="0"
                            value={e.monthlySIP !== undefined ? e.monthlySIP : ''}
                            placeholder={`Auto: ₹${autoCalcSIP.toLocaleString('en-IN')}`}
                            onChange={ev => setGoalEdits(p => ({...p, [i]: {...(p[i]||{}), monthlySIP: ev.target.value}}))}
                            style={{ width:'100%', boxSizing:'border-box' }} />
                        </div>
                      </div>

                      {/* Live preview — single source of truth */}
                      <div style={{ background:'rgba(200,146,10,0.06)', border:'1px solid rgba(200,146,10,0.2)', borderRadius:10, padding:'14px 16px', marginBottom:14 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#c8920a', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10 }}>Live Preview</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                          {[
                            { l:'Remaining', v:`₹${pvShortfall.toLocaleString('en-IN')}`, hint:`of ₹${editTarget.toLocaleString('en-IN')}`, c:'#1a1d2e' },
                            { l:'Monthly SIP', v:`₹${liveSIP.toLocaleString('en-IN')}/mo`, c:'#c8920a', bold:true },
                            { l:'Progress', v:`${livePct}%`, c: livePct>=50?'#16a34a':livePct>=25?'#c8920a':'#dc2626' },
                            { l:'Years Left', v:`${pvYears} yrs`, c:'#1a1d2e' },
                          ].map(x => (
                            <div key={x.l} style={{ textAlign:'center', padding:'8px 6px', background:'rgba(255,255,255,0.6)', borderRadius:8 }}>
                              <div style={{ fontSize:10, color:'#8892b0', marginBottom:4 }}>{x.l}</div>
                              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight: x.bold?700:600, color:x.c }}>{x.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingGoal(null)}>Cancel</button>
                        <button className="btn btn-gold btn-sm" onClick={() => saveGoalEdit(i, {...(goalEdits[i]||{})})}>Save Goal</button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
            )}

      {addGoalModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 16px', overflowY:'auto' }}
          onClick={() => setAddGoalModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:640, maxHeight:'85vh', overflowY:'auto',
              boxShadow:'0 20px 60px rgba(0,0,0,0.2)', padding:'20px 24px' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#1a1d2e', marginBottom:20 }}>Add Financial Goal</div>
            <Field label="Goal Type">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8 }}>
                {GOAL_TYPES.map(g => (
                  <button key={g.id} onClick={() => setNewGoal(n => ({...n, type:g.id, label:g.label}))}
                    style={{ padding:'9px 10px', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:500,
                      background: newGoal.type===g.id ? 'rgba(200,146,10,0.1)' : '#f8f9fc',
                      border:     newGoal.type===g.id ? '1.5px solid #c8920a' : '1px solid #eef0f8',
                      color:      newGoal.type===g.id ? '#c8920a' : '#6b7494' }}>
                    {g.icon} {g.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Goal Name (optional)">
              <PfInput value={newGoal.label} onChange={v => setNewGoal(n=>({...n,label:v}))} placeholder={GOAL_TYPES.find(g=>g.id===newGoal.type)?.label} />
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Target Amount">
                <PfInput value={newGoal.targetAmount} onChange={v => setNewGoal(n=>({...n,targetAmount:v}))} prefix="₹" type="number" placeholder="0" />
              </Field>
              <Field label="Target Year">
                <PfInput value={newGoal.targetYear} onChange={v => setNewGoal(n=>({...n,targetYear:v}))} placeholder={String(new Date().getFullYear()+5)} type="number" />
              </Field>
              <Field label="Already Saved">
                <PfInput value={newGoal.currentSaved} onChange={v => setNewGoal(n=>({...n,currentSaved:v}))} prefix="₹" type="number" placeholder="0" />
              </Field>
              <Field label="Priority">
                <PfSelect value={newGoal.priority} onChange={v => setNewGoal(n=>({...n,priority:v}))}
                  options={[{v:'high',l:'High'},{v:'medium',l:'Medium'},{v:'low',l:'Low'}]} />
              </Field>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-outline" style={{ flex:1 }} onClick={() => setAddGoalModal(false)}>Cancel</button>
              <button className="btn btn-gold" style={{ flex:1 }}
                onClick={addGoalFromMyGoals}
                disabled={(parseInt(newGoal.targetAmount) || 0) <= 0 || (parseInt(newGoal.targetYear) || 0) < new Date().getFullYear()}>
                Add Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROTECTION SECTION ────────────────────────────────────────────────── */}
      {activeSection === 'protection' && (() => {
        // ── Protection score engine ──────────────────────────────────────────
        const pe = protEdits
        const income     = parseInt(profile?.monthlyIncome||0)
        const emi        = parseInt(profile?.emi||0)
        const dependents = parseInt(profile?.dependents||0)

        // Term Insurance
        const termCurrent = parseInt(pe.termCoverCurrent ?? profile?.termCover ?? 0)
        const termNeeded  = parseInt((prot.termInsuranceNeeded||'0').replace(/[^0-9]/g,'')) || income * 12 * 10
        const termHas     = profile?.termInsurance === 'yes' || pe.termStatus === 'yes'
        const termPct     = termNeeded > 0 ? Math.min(100, Math.round(termCurrent/termNeeded*100)) : (termHas?60:0)
        const termScore   = !termHas ? 0 : termPct >= 100 ? 100 : termPct >= 60 ? 70 : 40
        const termPriority= termScore === 100 ? 'Achieved' : termScore === 0 ? 'Critical' : termScore < 50 ? 'High' : 'Medium'

        // Health Insurance
        const healthCurrent = parseInt(pe.healthCoverCurrent ?? profile?.healthCover ?? 0)
        const healthNeeded  = dependents > 2 ? 1000000 : 500000
        const healthHas     = profile?.healthInsurance === 'yes' || profile?.healthInsurance === 'employer' || pe.healthStatus === 'yes'
        const healthPct     = healthNeeded > 0 ? Math.min(100, Math.round(healthCurrent/healthNeeded*100)) : (healthHas?50:0)
        const healthScore   = !healthHas ? 0 : healthCurrent >= healthNeeded ? 100 : healthCurrent >= healthNeeded*0.5 ? 65 : 30
        const healthPriority= healthScore === 100 ? 'Achieved' : healthScore === 0 ? 'Critical' : healthScore < 50 ? 'High' : 'Medium'

        // Emergency Fund — sync with the Emergency Fund goal entry if it exists
        const emergGoal       = profileGoals.find(g => /emergency/i.test(g.label||g.type||'')) || {}
        const emergCurrent    = parseInt(pe.emergencyFundCurrent ?? profile?.emergencyFund ?? emergGoal.currentSaved ?? 0)
        const emergMonths     = parseInt(pe.emergencyMonths !== undefined ? pe.emergencyMonths : profile?.emergencyMonths||0)
        const monthlyExpenses = parseInt(profile?.monthlyExpenses||0) + parseInt(profile?.emi||0)
        // Target: use emergency goal's targetAmount if set, otherwise calculate from expenses × 6
        const emergNeeded     = parseInt(emergGoal.targetAmount||0) > 0
          ? parseInt(emergGoal.targetAmount)
          : (monthlyExpenses > 0 ? monthlyExpenses * 6 : income * 0.4 * 6)
        const emergPct        = emergNeeded > 0 ? Math.min(100, Math.round(emergCurrent/emergNeeded*100)) : 0
        const emergScore      = emergMonths >= 6 ? 100 : emergMonths >= 3 ? 60 : emergMonths >= 1 ? 30 : 0
        const emergPriority   = emergScore === 100 ? 'Achieved' : emergScore === 0 ? 'Critical' : emergScore < 50 ? 'High' : 'Medium'

        // Overall score
        const overallScore = Math.round((termScore + healthScore + emergScore) / 3)
        const overallColor = overallScore >= 80 ? '#16a34a' : overallScore >= 50 ? '#c8920a' : '#dc2626'

        const ScoreBadge = ({ score, priority }) => {
          const ps = PRIO_STYLE[priority] || PRIO_STYLE['Medium']
          return (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background: ps.bg, border:`2px solid ${ps.border}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:ps.color }}>
                {score}
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:ps.color, background:ps.bg, border:`1px solid ${ps.border}`,
                padding:'2px 8px', borderRadius:12 }}>{priority}</span>
            </div>
          )
        }

        // editFieldKey helper — uses component-level protEditOpen state
        const EditField = ({ fieldKey, label, prefix='', type='text', currentVal }) => {
          const isOpen = protEditOpen === fieldKey
          const curValue = pe[fieldKey] !== undefined ? pe[fieldKey] : (currentVal||'')
          return (
            <div style={{ marginTop:8 }}>
              {isOpen ? (
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  {prefix && <span style={{ fontSize:13, color:'#8892b0' }}>{prefix}</span>}
                  <input className="input" type={type} defaultValue={curValue}
                    id={`prot-edit-${fieldKey}`}
                    style={{ flex:1, maxWidth:200, fontSize:13 }} autoFocus />
                  <button className="btn btn-gold btn-sm" onClick={() => {
                    const el = document.getElementById(`prot-edit-${fieldKey}`)
                    const updated = { ...protEdits, [fieldKey]: el?.value || curValue }
                    setProtEdits(updated); persist({ _protEdits: updated }); setProtEditOpen(null)
                  }}>Save</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setProtEditOpen(null)}>✕</button>
                </div>
              ) : (
                <button className="btn btn-outline btn-sm" style={{ fontSize:11, color:'#5b8ff9', borderColor:'rgba(91,143,249,0.3)' }}
                  onClick={() => setProtEditOpen(fieldKey)}>
                  ✏️ Update {label}
                </button>
              )}
            </div>
          )
        }

        return (
          <div style={{ display:'grid', gap:14 }}>
            {/* Overall score card */}
            <div style={{ background:'linear-gradient(135deg,#1a1d2e,#252945)', borderRadius:14, padding:'20px 24px', color:'#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontSize:11, letterSpacing:'0.1em', color:'#c8920a', fontWeight:600, marginBottom:4, textTransform:'uppercase' }}>Protection Score</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, marginBottom:4 }}>Protection & Safety</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)' }}>{prot.emergencyFundAdvice || 'Review and update your protection details'}</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:42, fontWeight:700, color:overallColor, lineHeight:1 }}>{overallScore}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:2 }}>out of 100</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:12, marginTop:14, flexWrap:'wrap' }}>
                {[
                  { l:'Term Insurance', v:termScore, p:termPriority },
                  { l:'Health Insurance', v:healthScore, p:healthPriority },
                  { l:'Emergency Fund', v:emergScore, p:emergPriority },
                ].map(x => {
                  const ps = PRIO_STYLE[x.p]
                  return (
                    <div key={x.l} style={{ background:'rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 14px', flex:'1 1 130px' }}>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginBottom:4 }}>{x.l}</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:700, color:ps?.color||'#fff', marginBottom:4 }}>{x.v}</div>
                      <div style={{ height:3, background:'rgba(255,255,255,0.1)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${x.v}%`, background:ps?.color||'#c8920a', borderRadius:2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Term Insurance card ── */}
            <div className="card" style={{ padding:22, borderLeft:`4px solid ${PRIO_STYLE[termPriority].color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>💼</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1d2e' }}>Term Insurance</div>
                    <div style={{ fontSize:12, color:'#8892b0', marginTop:2 }}>{prot.termInsuranceAdvice||''}</div>
                  </div>
                </div>
                <ScoreBadge score={termScore} priority={termPriority} />
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, marginBottom:10 }}>
                <div><span style={{ color:'#8892b0' }}>Current Cover: </span><strong style={{ color:'#1a1d2e' }}>₹{termCurrent.toLocaleString('en-IN') || (termHas?'Set cover':'Not covered')}</strong></div>
                <div><span style={{ color:'#8892b0' }}>Recommended: </span><strong style={{ color:'#c8920a' }}>{prot.termInsuranceNeeded||'—'}</strong></div>
              </div>
              <div style={{ height:6, background:'#eef0f8', borderRadius:3, overflow:'hidden', marginBottom:10 }}>
                <div style={{ height:'100%', width:`${termPct}%`, background:PRIO_STYLE[termPriority].color, borderRadius:3, transition:'width 0.5s' }} />
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <EditField fieldKey="termCoverCurrent" label="Current Cover" prefix="₹" type="number" currentVal={profile?.termCover||''} />
                <EditField fieldKey="termStatus" label="Status" currentVal={profile?.termInsurance||'no'} />
              </div>
            </div>

            {/* ── Health Insurance card ── */}
            <div className="card" style={{ padding:22, borderLeft:`4px solid ${PRIO_STYLE[healthPriority].color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>🏥</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1d2e' }}>Health Insurance</div>
                    <div style={{ fontSize:12, color:'#8892b0', marginTop:2 }}>{prot.healthInsuranceAdvice||''}</div>
                  </div>
                </div>
                <ScoreBadge score={healthScore} priority={healthPriority} />
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, marginBottom:10 }}>
                <div><span style={{ color:'#8892b0' }}>Current Cover: </span><strong style={{ color:'#1a1d2e' }}>₹{healthCurrent.toLocaleString('en-IN') || (healthHas?'Employer/covered':'Not covered')}</strong></div>
                <div><span style={{ color:'#8892b0' }}>Recommended: </span><strong style={{ color:'#c8920a' }}>₹{healthNeeded.toLocaleString('en-IN')}+</strong></div>
              </div>
              <div style={{ height:6, background:'#eef0f8', borderRadius:3, overflow:'hidden', marginBottom:10 }}>
                <div style={{ height:'100%', width:`${healthPct}%`, background:PRIO_STYLE[healthPriority].color, borderRadius:3, transition:'width 0.5s' }} />
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <EditField fieldKey="healthCoverCurrent" label="Current Cover" prefix="₹" type="number" currentVal={profile?.healthCover||''} />
                <EditField fieldKey="healthStatus" label="Status" currentVal={profile?.healthInsurance||'no'} />
              </div>
            </div>

            {/* ── Emergency Fund card ── */}
            <div className="card" style={{ padding:22, borderLeft:`4px solid ${PRIO_STYLE[emergPriority].color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>🛡️</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1d2e' }}>Emergency Fund</div>
                    <div style={{ fontSize:12, color:'#8892b0', marginTop:2 }}>{prot.emergencyFundAdvice||''}</div>
                  </div>
                </div>
                <ScoreBadge score={emergScore} priority={emergPriority} />
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, marginBottom:10 }}>
                <div><span style={{ color:'#8892b0' }}>Current: </span><strong style={{ color:'#1a1d2e' }}>₹{emergCurrent.toLocaleString('en-IN')} ({emergMonths} months)</strong></div>
                <div><span style={{ color:'#8892b0' }}>Target: </span><strong style={{ color:'#c8920a' }}>₹{emergNeeded.toLocaleString('en-IN')}</strong><span style={{ fontSize:11, color:'#8892b0', marginLeft:6 }}>{emergGoal.targetAmount > 0 ? '← from your Emergency Fund goal' : '(6 months expenses)'}</span></div>
                <div><span style={{ color:'#8892b0' }}>Gap: </span><strong style={{ color: emergCurrent>=emergNeeded?'#16a34a':'#dc2626' }}>₹{Math.max(0,emergNeeded-emergCurrent).toLocaleString('en-IN')}</strong></div>
              </div>
              <div style={{ height:6, background:'#eef0f8', borderRadius:3, overflow:'hidden', marginBottom:10 }}>
                <div style={{ height:'100%', width:`${emergPct}%`, background:PRIO_STYLE[emergPriority].color, borderRadius:3, transition:'width 0.5s' }} />
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <EditField fieldKey="emergencyFundCurrent" label="Current Amount" prefix="₹" type="number" currentVal={profile?.emergencyFund||''} />
                <EditField fieldKey="emergencyMonths" label="Months Covered" type="number" currentVal={profile?.emergencyMonths||'0'} />
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── ASSET MAPPING SECTION ─────────────────────────────────────────────── */}
      {activeSection === 'mapping' && (
        <div style={{ display:'grid', gap:14 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'#1a1d2e', fontWeight:700 }}>
            Map Investments to Goals
          </div>

          {/* Expert recommendation banner */}
          <div style={{ background:'rgba(91,143,249,0.05)', border:'1px solid rgba(91,143,249,0.2)', borderRadius:12, padding:'14px 18px' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#5b8ff9', marginBottom:8 }}>💡 Expert Recommendation</div>
            <div style={{ fontSize:12, color:'#6b7494', lineHeight:1.8 }}>
              {goalPlans.map(g => {
                const suggestions = autoSuggestMapping(g.goalName, g)
                const matched = suggestions.map(id => assets.find(a=>a.id===id)).filter(Boolean)
                if (!matched.length) return null
                return (
                  <div key={g.goalName} style={{ marginBottom:4 }}>
                    <strong style={{color:'#1a1d2e'}}>{g.goalName}:</strong>{' '}
                    {matched.slice(0,2).map(a=>a.name).join(', ')} recommended based on asset type
                  </div>
                )
              }).filter(Boolean)}
              {unmappedAssets.length > 0 && (
                <div style={{ marginTop:6, color:'#f09b46' }}>
                  ⚠️ {unmappedAssets.length} asset{unmappedAssets.length>1?'s':''} unmapped:{' '}
                  {unmappedAssets.slice(0,3).map(a=>a.name).join(', ')}
                </div>
              )}
            </div>
          </div>

          {goalPlans.map((g, i) => {
            const mapped     = (goalMap[g.goalName] || []).map(id => assets.find(a=>a.id===id)).filter(Boolean)
            const mappedVal  = Math.round(mapped.reduce((s,a) => s+(a.value||0), 0))
            const suggestions= autoSuggestMapping(g.goalName, g).map(id => assets.find(a=>a.id===id)).filter(Boolean)

            return (
              <div key={i} className="card" style={{ padding:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1d2e', marginBottom:2 }}>{g.goalName}</div>
                    <div style={{ fontSize:11, color:'#8892b0' }}>
                      Target ₹{g.targetAmount.toLocaleString('en-IN')} by {g.targetYear}
                    </div>
                  </div>
                  <button className="btn btn-outline btn-sm" style={{ fontSize:11 }}
                    onClick={() => { setMapModal(g.goalName); setTempSelected(new Set(goalMap[g.goalName]||[])) }}>
                    {mapped.length > 0 ? '✏️ Edit Mapping' : '+ Map Assets'}
                  </button>
                </div>

                {mapped.length > 0 ? (
                  <>
                    {/* Show as grouped: direct stocks summary + individual others */}
                    {(() => {
                      const directStocks = mapped.filter(a => a.category === 'Stocks & Equities')
                      const others       = mapped.filter(a => a.category !== 'Stocks & Equities')
                      const stockTotal   = Math.round(directStocks.reduce((s,a) => s+(a.value||0), 0))
                      return (
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                          {directStocks.length > 0 && (
                            <div style={{ background:'rgba(91,143,249,0.07)', border:'1px solid rgba(91,143,249,0.2)', borderRadius:8, padding:'5px 10px', fontSize:11 }}>
                              <span style={{ fontWeight:600, color:'#5b8ff9' }}>Direct Stocks ({directStocks.length})</span>
                              <span style={{ color:'#5b8ff9', marginLeft:6 }}>₹{stockTotal.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {others.map(a => (
                            <div key={a.id} style={{ background:'rgba(5,150,105,0.07)', border:'1px solid rgba(5,150,105,0.2)', borderRadius:8, padding:'5px 10px', fontSize:11 }}>
                              <span style={{ fontWeight:600, color:'#1a1d2e' }}>{a.name}</span>
                              <span style={{ color:'#059669', marginLeft:6 }}>₹{Math.round(a.value||0).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'8px 12px', background:'rgba(5,150,105,0.05)', borderRadius:8 }}>
                      <span style={{ color:'#6b7494' }}>Linked assets value</span>
                      <span style={{ fontWeight:700, color:'#059669' }}>₹{mappedVal.toLocaleString('en-IN')} / ₹{g.targetAmount.toLocaleString('en-IN')} ({Math.min(100,Math.round(mappedVal/Math.max(1,g.targetAmount)*100))}%)</span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:12, color:'#8892b0' }}>
                    No assets mapped — click <strong>+ Map Assets</strong> to link investments to this goal
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── ALLOCATION SECTION — links to dedicated tab ─────────────────────── */}
      {activeSection === 'allocation' && (
        <div className="card" style={{ padding:32, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🥧</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'#1a1d2e', fontWeight:700, marginBottom:8 }}>
            Full Allocation Analysis
          </div>
          <div style={{ fontSize:13, color:'#8892b0', marginBottom:20, lineHeight:1.7, maxWidth:440, margin:'0 auto 20px' }}>
            View your current vs target allocation, rebalancing recommendations, and per-asset breakdown in the dedicated Allocation tab.
          </div>
          {plan.assetAllocation?.length > 0 && (
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
              {plan.assetAllocation.map((a,i) => (
                <div key={i} style={{ background:'#f8f9fc', border:'1px solid #eef0f8', borderRadius:10, padding:'10px 16px', minWidth:120 }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:700, color:'#c8920a' }}>{a.pct}%</div>
                  <div style={{ fontSize:12, color:'#1a1d2e', fontWeight:500 }}>{a.class}</div>
                  {a.instruments && <div style={{ fontSize:10, color:'#8892b0', marginTop:2 }}>{a.instruments}</div>}
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-gold" onClick={() => window.__wrSetTab?.('allocation')}>
            🥧 Open Allocation Tab →
          </button>
        </div>
      )}

      {/* ── MONTHLY PLAN SECTION ──────────────────────────────────────────────── */}
      {activeSection === 'monthly' && (
        <div className="card" style={{ padding:24 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'#1a1d2e', fontWeight:700, marginBottom:4 }}>Monthly Savings Plan</div>
          <div style={{ fontSize:12, color:'#8892b0', marginBottom:16 }}>How to split your monthly savings</div>
          <div style={{ display:'grid', gap:10 }}>
            {/* Goal-wise SIP requirements */}
            <div style={{ fontSize:11, fontWeight:600, color:'#8892b0', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Goal SIPs</div>
            {goalPlans.map((g,i) => {
              const pctOfSavings = totalSIP > 0 ? Math.round(g.monthlySIP/totalSIP*100) : 0
              return (
                <div key={i} style={{ padding:'10px 14px', background:'#f8f9fc', borderRadius:10, border:'1px solid #eef0f8' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#1a1d2e' }}>{g.goalName}</span>
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'#8892b0' }}>{pctOfSavings}%</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:700, color:'#c8920a' }}>
                        ₹{g.monthlySIP.toLocaleString('en-IN')}<span style={{ fontSize:10, fontWeight:400 }}>/mo</span>
                      </span>
                    </div>
                  </div>
                  <div style={{ height:4, background:'#eef0f8', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pctOfSavings}%`, background:'#c8920a', borderRadius:2 }} />
                  </div>
                  {g.instrument && <div style={{ fontSize:11, color:'#5b8ff9', marginTop:4 }}>via {g.instrument}</div>}
                </div>
              )
            })}
            {/* Total */}
            <div style={{ marginTop:8, padding:'12px 16px', background:'rgba(200,146,10,0.06)', border:'1px solid rgba(200,146,10,0.2)', borderRadius:10, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>Total Monthly SIP Required</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:15, fontWeight:700, color:'#c8920a' }}>
                ₹{totalSIP.toLocaleString('en-IN')}/mo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK WINS SECTION ────────────────────────────────────────────────── */}
      {activeSection === 'quickwins' && (
        <div style={{ display:'grid', gap:12 }}>
          {plan.quickWins?.map((q, i) => (
            <div key={i} className="card" style={{ padding:20, display:'flex', gap:16 }}>
              <div style={{ width:32, height:32, background:'rgba(200,146,10,0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:15, fontWeight:700, color:'#c8920a' }}>{i+1}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', marginBottom:4 }}>{q.title}</div>
                <div style={{ fontSize:13, color:'#6b7494', marginBottom:6 }}>{q.action}</div>
                {q.impact && <div style={{ fontSize:12, fontWeight:500, color:'#16a34a' }}>✓ {q.impact}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ASSET MAPPING MODAL ───────────────────────────────────────────────── */}
      {mapModal && (() => {
        const currentMapped = goalMap[mapModal] || []
        const totalSelected = [...tempSelected].reduce((s,id) => {
          const a = assets.find(x=>x.id===id); return s + (a?.value||0)
        }, 0)
        const goalForModal = goalPlans.find(g => g.goalName === mapModal)

        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ padding:'20px 24px', borderBottom:'1px solid #eef0f8' }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'#1a1d2e', fontWeight:700, marginBottom:4 }}>
                  Map Assets → {mapModal}
                </div>
                <div style={{ fontSize:12, color:'#8892b0' }}>
                  Select investments to link to this goal · Target ₹{goalForModal?.targetAmount.toLocaleString('en-IN')} by {goalForModal?.targetYear}
                </div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'12px 24px', display:'flex', flexDirection:'column', gap:8 }}>
                {assets.filter(a => a.value > 0).map(a => {
                  const sel = tempSelected.has(a.id)
                  const suggested = autoSuggestMapping(mapModal, goalForModal).includes(a.id)
                  return (
                    <div key={a.id}
                      onClick={() => setTempSelected(p => { const n=new Set(p); sel?n.delete(a.id):n.add(a.id); return n })}
                      style={{ padding:'10px 14px', borderRadius:10, border:`1px solid ${sel?'rgba(200,146,10,0.4)':'#eef0f8'}`,
                        background: sel ? 'rgba(200,146,10,0.04)' : '#f8f9fc', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${sel?'#c8920a':'#d0d4e0'}`,
                          background:sel?'#c8920a':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {sel && <span style={{ color:'#fff', fontSize:10 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>{a.name}</div>
                          <div style={{ fontSize:11, color:'#8892b0' }}>{a.category}</div>
                        </div>
                        {suggested && <span style={{ fontSize:10, color:'#5b8ff9', background:'rgba(91,143,249,0.08)', padding:'1px 7px', borderRadius:10 }}>✨ suggested</span>}
                      </div>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600, color:'#059669' }}>
                        ₹{(a.value||0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'14px 24px', borderTop:'1px solid #eef0f8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:12 }}>
                  <span style={{ color:'#8892b0' }}>{tempSelected.size} assets linked · </span>
                  <span style={{ fontWeight:600, color:'#059669' }}>₹{totalSelected.toLocaleString('en-IN')}</span>
                  {goalForModal && <span style={{ color:'#8892b0' }}> / ₹{goalForModal.targetAmount.toLocaleString('en-IN')} ({Math.min(100,Math.round(totalSelected/Math.max(1,goalForModal.targetAmount)*100))}%)</span>}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setMapModal(null)}>Cancel</button>
                  <button className="btn btn-gold btn-sm" onClick={() => saveGoalMap(mapModal, [...tempSelected])}>Save Mapping</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── How SIP is Calculated — Example Box ──────────────────────────── */}
      {activeSection === 'goals' && goalPlans.length > 0 && (() => {
        const exGoal   = goalPlans.find(g => /education|child/i.test(g.goalName)) || goalPlans[0]
        const todayVal = parseInt(exGoal.todayValue || exGoal.targetAmount) || 0
        const ir       = exGoal.inflationRate || 0
        const rr2      = exGoal.returnRate || 0.12
        const yrs      = exGoal.yearsLeft || 5
        const inflated = ir > 0 ? Math.round(todayVal * Math.pow(1 + ir, yrs)) : todayVal
        const saved    = exGoal.currentSaved || 0
        const sfAmt    = Math.max(0, inflated - saved)
        const r2       = rr2 / 12, n2 = yrs * 12
        const sip2     = n2 > 0 && sfAmt > 0 ? Math.round(sfAmt * r2 / (Math.pow(1+r2, n2) - 1)) : sfAmt
        return (
          <div className="card" style={{ padding:24, background:'rgba(26,29,46,0.97)', border:'none', borderRadius:14 }}>
            <div style={{ fontSize:11, letterSpacing:'0.1em', color:'#c8920a', fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>
              📐 How We Calculate Your Monthly SIP
            </div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, color:'#fff', fontWeight:600, marginBottom:16 }}>
              Example: {exGoal.goalName}
            </div>
            <div style={{ display:'grid', gap:10 }}>
              {[
                { step:'1', label:"Today's Goal Value",
                  calc:`₹${todayVal.toLocaleString('en-IN')} (amount entered in today's rupees)`,
                  result:`₹${todayVal.toLocaleString('en-IN')}` },
                { step:'2', label:'Inflation-Adjusted Future Target',
                  calc: ir > 0 ? `₹${todayVal.toLocaleString('en-IN')} × (1 + ${(ir*100).toFixed(0)}%)^${yrs} yrs` : 'No inflation applied for this goal type',
                  formula:'FV = PV × (1 + i)ⁿ',
                  result:`₹${inflated.toLocaleString('en-IN')}` },
                { step:'3', label:'Shortfall to Fund',
                  calc:`₹${inflated.toLocaleString('en-IN')} − ₹${saved.toLocaleString('en-IN')} (already saved)`,
                  result:`₹${sfAmt.toLocaleString('en-IN')}` },
                { step:'4', label:'Monthly SIP Required',
                  calc:`₹${sfAmt.toLocaleString('en-IN')} × (${(rr2*100).toFixed(0)}%÷12) ÷ [(1 + ${(rr2*100).toFixed(0)}%÷12)^${n2} − 1]`,
                  formula:'SIP = Shortfall × r / [(1+r)ⁿ − 1]   where r = annual rate ÷ 12',
                  result:`₹${sip2.toLocaleString('en-IN')}/mo`, highlight:true },
              ].map(s => (
                <div key={s.step} style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'12px 14px',
                  background: s.highlight ? 'rgba(200,146,10,0.12)' : 'rgba(255,255,255,0.05)',
                  borderRadius:10, border:`1px solid ${s.highlight ? 'rgba(200,146,10,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:'#c8920a', display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{s.step}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.9)', marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', fontFamily:"'JetBrains Mono',monospace", marginBottom: s.formula ? 3 : 0 }}>{s.calc}</div>
                    {s.formula && <div style={{ fontSize:10, color:'#c8920a', fontStyle:'italic' }}>Formula: {s.formula}</div>}
                  </div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: s.highlight ? 16 : 14, fontWeight:700,
                    color: s.highlight ? '#c8920a' : 'rgba(255,255,255,0.85)', flexShrink:0 }}>{s.result}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:10, fontSize:11, color:'rgba(255,255,255,0.3)', lineHeight:1.6 }}>
              * Assumes {(rr2*100).toFixed(0)}% p.a. expected return (monthly compounding) and {ir>0?`${(ir*100).toFixed(0)}% annual inflation`:'no inflation adjustment'}. Equity returns are not guaranteed — adjust the Expected Return % per goal based on your risk profile.
            </div>
          </div>
        )
      })()}

      <div style={{ textAlign:'center', padding:'8px 0', fontSize:12, color:'#8892b0', display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
        <span>Need to update your details or regenerate?</span>
        <button style={{ background:'none', border:'none', color:'#c8920a', fontWeight:600, cursor:'pointer', fontSize:12, padding:0, textDecoration:'underline' }}
          onClick={() => window.__wrSetTab?.('profile')}>
          ✏️ Edit Profile & Regenerate
        </button>
      </div>
    </div>
  )
}


function formatCurrency(v, cur) {
  if (!v || isNaN(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e7) return `₹${(abs/1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `₹${(abs/1e5).toFixed(1)}L`
  return `₹${Math.round(abs).toLocaleString('en-IN')}`
}
