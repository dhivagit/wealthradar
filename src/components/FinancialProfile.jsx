import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFinance } from '../context/FinanceContext'
import { DB } from '../utils/helpers'

// ─── Persist profile separately from main data ────────────────────────────────
const ProfileDB = {
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

const GOAL_TYPES = [
  { id:'emergency',    label:'Emergency Fund',      icon:'🛡️',  horizon:'short'  },
  { id:'home',         label:'Buy a Home',          icon:'🏠',  horizon:'long'   },
  { id:'car',          label:'Buy a Car',           icon:'🚗',  horizon:'medium' },
  { id:'education',    label:'Child Education',     icon:'🎓',  horizon:'long'   },
  { id:'wedding',      label:'Wedding',             icon:'💍',  horizon:'medium' },
  { id:'travel',       label:'Travel / Vacation',   icon:'✈️',  horizon:'short'  },
  { id:'retirement',   label:'Retirement',          icon:'🌅',  horizon:'long'   },
  { id:'business',     label:'Start a Business',    icon:'💼',  horizon:'medium' },
  { id:'gadget',       label:'Gadget / Electronics',icon:'💻',  horizon:'short'  },
  { id:'custom',       label:'Custom Goal',         icon:'⭐',  horizon:'medium' },
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
export function FinancialProfile() {
  const { session } = useAuth()
  const { data, settings } = useFinance()
  const [step, setStep]         = useState(0)          // 0 = overview/landing
  const [profile, setProfile]   = useState(EMPTY_PROFILE)
  const [saved, setSaved]       = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPlan, setAiPlan]     = useState(null)
  const [aiError, setAiError]   = useState(null)
  const [goalModal, setGoalModal] = useState(false)
  const [newGoal, setNewGoal]   = useState({ type:'home', label:'', targetAmount:'', targetYear:'', currentSaved:'0', priority:'high' })

  // Load saved profile
  useEffect(() => {
    if (!session?.userId) return
    const saved = ProfileDB.get(session.userId)
    if (saved) { setProfile(saved); setSaved(true) }
  }, [session?.userId])

  const setP = (k, v) => setProfile(p => ({ ...p, [k]: v }))

  const saveProfile = () => {
    if (!session?.userId) return
    ProfileDB.save(session.userId, profile)
    setSaved(true)
  }

  const addGoal = () => {
    const type   = GOAL_TYPES.find(g => g.id === newGoal.type) || GOAL_TYPES[9]
    const goal   = { id: Date.now(), ...newGoal, icon: type.icon, label: newGoal.label || type.label, horizon: type.horizon }
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

    const prompt = `Indian financial plan. Respond ONLY with JSON matching the schema below.

PROFILE: ${profile.name||'Client'}, age ${profile.age}, ${profile.city}, ${profile.dependents} dependents, ${profile.employmentType}, retire at ${profile.retirementAge}, risk: ${profile.riskProfile}, experience: ${profile.investmentExperience}
INCOME: take-home ₹${profile.monthlyIncome||0}/mo, other ₹${profile.otherIncome||0}/mo, expenses ₹${profile.monthlyExpenses||0}/mo, EMI ₹${profile.emi||0}/mo, net savings ₹${savings}/mo
PROTECTION: term=${profile.termInsurance}${profile.termInsurance==='yes'?' cover ₹'+profile.termCover:''}, health=${profile.healthInsurance}${profile.healthInsurance==='yes'?' cover ₹'+profile.healthCover:''}, emergency=₹${profile.emergencyFund||0} (${profile.emergencyMonths} months)
GOALS: ${profile.goals.length===0?'none':profile.goals.map(g=>`${g.label} ₹${g.targetAmount||0} by ${g.targetYear} saved ₹${g.currentSaved||0} priority:${g.priority}`).join('; ')}
PORTFOLIO: MF ₹${profile.existingMF||0}, equity ₹${profile.existingEquity||0}, PPF ₹${profile.existingPPF||0}, EPF ₹${profile.existingEPF||0}, FD ₹${profile.existingFD||0}, net worth ₹${netWorth}

JSON schema (return exactly this structure, numbers not strings for amounts):
{"urgentAlerts":[{"type":"critical|warning","title":"","message":"","action":""}],"protectionPlan":{"termInsuranceNeeded":"","termInsuranceAdvice":"","healthInsuranceAdvice":"","emergencyFundTarget":"","emergencyFundAdvice":""},"savingsAllocation":[{"category":"","amount":0,"purpose":"","instrument":""}],"goalPlans":[{"goalName":"","targetAmount":0,"targetYear":"","yearsLeft":0,"monthlySIP":0,"currentShortfall":0,"instrument":"","advice":""}],"assetAllocation":[{"class":"","pct":0,"rationale":"","instruments":""}],"quickWins":[{"title":"","action":"","impact":""}],"summary":{"monthlyIncome":0,"monthlySavings":0,"totalAllocated":0,"surplusOrDeficit":0,"overallAdvice":"","ageGroup":"","fiTarget":0}}`

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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: 'You are a SEBI-registered Indian financial advisor. Always respond with valid JSON only — no markdown, no explanation, no text outside the JSON object.',
          messages: [{ role: 'user', content: prompt }]
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `HTTP ${res.status}`)
      }
      const d   = await res.json()
      const txt = d.content?.find(c => c.type === 'text')?.text || ''
      if (!txt) throw new Error('Empty response from API')
      const clean = txt.replace(/```json[\s\S]*?```/g, m => m.slice(7, -3)).replace(/```/g, '').trim()
      setAiPlan(JSON.parse(clean))
    } catch (e) {
      console.error('AI Plan error:', e)
      setAiError(`Could not generate plan: ${e.message}. Please try again.`)
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
          {profile.goals.map(g => {
            const years = parseInt(g.targetYear) - new Date().getFullYear()
            const sip   = calcSIP(parseInt(g.targetAmount||0) - parseInt(g.currentSaved||0), years)
            return (
              <div key={g.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                background:'#f8f9fc', borderRadius:10, border:'1px solid #eef0f8' }}>
                <span style={{ fontSize:24 }}>{g.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:600, color:'#1a1d2e' }}>{g.label}</span>
                    <Pill label={g.priority} color={g.priority==='high'?'#dc2626':g.priority==='medium'?'#d97706':'#16a34a'}
                      bg={g.priority==='high'?'rgba(220,38,38,0.08)':g.priority==='medium'?'rgba(217,119,6,0.08)':'rgba(22,163,74,0.08)'} />
                  </div>
                  <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'#6b7494' }}>
                    <span>Target: <strong style={{color:'#1a1d2e'}}>{fmt(parseInt(g.targetAmount))}</strong></span>
                    <span>By: <strong style={{color:'#1a1d2e'}}>{g.targetYear}</strong></span>
                    {years > 0 && sip > 0 && <span>Est. SIP: <strong style={{color:'#c8920a'}}>₹{sip.toLocaleString('en-IN')}/mo</strong></span>}
                    {parseInt(g.currentSaved) > 0 && <span>Saved: <strong>{fmt(parseInt(g.currentSaved))}</strong></span>}
                  </div>
                </div>
                <button onClick={() => removeGoal(g.id)} style={{ fontSize:16, color:'#f06a6a', background:'none', border:'none', cursor:'pointer' }}>×</button>
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
                const sip = calcSIP(parseInt(newGoal.targetAmount||0) - parseInt(newGoal.currentSaved||0), yrs)
                return yrs > 0 ? (
                  <div style={{ background:'rgba(200,146,10,0.07)', border:'1px solid rgba(200,146,10,0.2)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92700a', marginTop:4 }}>
                    To reach this goal: <strong>₹{sip.toLocaleString('en-IN')}/month SIP</strong> for {yrs} years (assuming 12% p.a. equity returns)
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
              A personalised plan built around your income, goals, and risk appetite — with AI-powered recommendations.
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
                  <div style={{ fontSize:13, color:'#dc2626' }}>{aiError}</div>
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
