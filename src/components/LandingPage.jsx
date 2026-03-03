import { useState } from 'react'

function CountUp({ end, prefix = '', suffix = '' }) {
  const [val, setVal] = useState(0)
  const [started, setStarted] = useState(false)
  const start = (el) => {
    if (!el || started) return
    setStarted(true)
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const t0 = Date.now()
      const tick = () => {
        const p = Math.min((Date.now() - t0) / 1800, 1)
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * end))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    observer.observe(el)
  }
  return <span ref={start}>{prefix}{val.toLocaleString()}{suffix}</span>
}

function FeatureCard({ icon, title, desc, color, delay }) {
  return (
    <div
      style={{ background:'#fff', border:'1px solid #eaecf4', borderRadius:16, padding:'28px 24px', transition:'all 0.25s', animation:`fadeUp 0.5s ease ${delay}ms both` }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor=color+'55' }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor='#eaecf4' }}>
      <div style={{ width:48, height:48, borderRadius:12, background:color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:16 }}>{icon}</div>
      <h3 style={{ fontSize:16, fontWeight:600, color:'#1a1d2e', marginBottom:8 }}>{title}</h3>
      <p style={{ fontSize:14, color:'#6b7494', lineHeight:1.65 }}>{desc}</p>
    </div>
  )
}

function StatBadge({ value, label, icon }) {
  return (
    <div style={{ textAlign:'center', padding:'20px 24px', background:'rgba(255,255,255,0.12)', borderRadius:14, backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.2)' }}>
      <div style={{ fontSize:28, marginBottom:6 }}>{icon}</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30, fontWeight:700, color:'#fff', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:6, letterSpacing:'0.05em' }}>{label}</div>
    </div>
  )
}

function DashboardPreview() {
  const bars = [
    {m:'Aug',a:65,l:28},{m:'Sep',a:70,l:26},{m:'Oct',a:74,l:25},
    {m:'Nov',a:78,l:24},{m:'Dec',a:82,l:22},{m:'Jan',a:88,l:20},
  ]
  const alloc = [
    {label:'Real Estate',pct:42,color:'#c8920a'},
    {label:'Stocks & MF',pct:28,color:'#2563eb'},
    {label:'Fixed Deposits',pct:16,color:'#16a34a'},
    {label:'Gold & Bonds',pct:9,color:'#d97706'},
    {label:'Cash',pct:5,color:'#6b7494'},
  ]
  return (
    <div style={{ background:'#fff', borderRadius:20, padding:24, boxShadow:'0 32px 80px rgba(0,0,0,0.14)', border:'1px solid #eaecf4', maxWidth:520, width:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:11, color:'#9098b8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:2 }}>Net Worth</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:'#1a1d2e' }}>₹<CountUp end={8720000} /></div>
          <div style={{ fontSize:12, color:'#16a34a', fontWeight:500, marginTop:2 }}>▲ ₹1.2L this month</div>
        </div>
        <div style={{ padding:'5px 12px', background:'rgba(22,163,74,0.1)', borderRadius:20, fontSize:12, color:'#16a34a', fontWeight:500 }}>+18.4% YTD</div>
      </div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, color:'#9098b8', marginBottom:10, display:'flex', justifyContent:'space-between' }}>
          <span style={{ letterSpacing:'0.06em', textTransform:'uppercase' }}>6-Month Trend</span>
          <div style={{ display:'flex', gap:12 }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:'#16a34a', display:'inline-block' }}/>Assets</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:'#fca5a5', display:'inline-block' }}/>Liabilities</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80 }}>
          {bars.map((b,i) => (
            <div key={b.m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ width:'60%', height:b.a*0.72, background:'linear-gradient(180deg,#22c55e,#16a34a)', borderRadius:'3px 3px 0 0', opacity:0.85+i*0.02 }}/>
                <div style={{ width:'60%', height:b.l*0.72, background:'linear-gradient(180deg,#fca5a5,#ef4444)', borderRadius:'0 0 3px 3px', opacity:0.6 }}/>
              </div>
              <div style={{ fontSize:9, color:'#9098b8', marginTop:2 }}>{b.m}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize:11, color:'#9098b8', marginBottom:10, letterSpacing:'0.06em', textTransform:'uppercase' }}>Asset Allocation</div>
        {alloc.map(a => (
          <div key={a.label} style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:12, color:'#4a4f6a' }}>{a.label}</span>
              <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:a.color, fontWeight:500 }}>{a.pct}%</span>
            </div>
            <div style={{ height:4, background:'#f0f2f8', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${a.pct}%`, background:a.color, borderRadius:2 }}/>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:16, paddingTop:16, borderTop:'1px solid #eef0f8' }}>
        {[{icon:'📊',label:'12 Assets'},{icon:'📉',label:'3 Liabilities'},{icon:'💰',label:'+₹32K/mo'}].map(b => (
          <div key={b.label} style={{ flex:1, textAlign:'center', padding:'8px 4px', background:'#f8f9fc', borderRadius:8, fontSize:12, color:'#6b7494' }}>{b.icon} {b.label}</div>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage({ onGetStarted, onSignIn }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const features = [
    {icon:'📊',title:'Complete Net Worth View',color:'#c8920a',delay:0,desc:'Track every asset and liability — stocks, MFs, real estate, gold, EPF, loans — all in one live dashboard.'},
    {icon:'📥',title:'Import from Any Broker',color:'#2563eb',delay:80,desc:'Import holdings from Zerodha, Groww, MF Central, CAMS, NSDL/CDSL, and your bank with a single CSV upload.'},
    {icon:'💸',title:'Cash Flow Intelligence',color:'#16a34a',delay:160,desc:'Map every income stream and expense. Know your savings rate and exactly where your money goes each month.'},
    {icon:'🎯',title:'FIRE / FI Calculator',color:'#7c3aed',delay:240,desc:'See your Financial Independence number, your current progress, and projected passive income at the 4% rule.'},
    {icon:'🏆',title:'Wealth Milestones',color:'#d97706',delay:320,desc:'Celebrate every ₹10L, ₹25L, ₹50L, ₹1Cr milestone. Visual progress keeps you motivated on the journey.'},
    {icon:'🔒',title:'100% Private — No Servers',color:'#dc2626',delay:400,desc:'Your data never leaves your device. No cloud sync, no trackers, no ads — pure finance tracking locally.'},
  ]

  return (
    <div style={{ fontFamily:"'Outfit',sans-serif", color:'#1a1d2e', background:'#f8f9fd', minHeight:'100vh' }}>

      {/* NAVBAR */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(255,255,255,0.95)', borderBottom:'1px solid #eaecf4', backdropFilter:'blur(16px)', padding:'0 6%', display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#c8920a,#e8a820)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, boxShadow:'0 3px 10px rgba(200,146,10,0.3)' }}>📡</div>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:'#1a1d2e' }}>
            Wealth<span style={{ background:'linear-gradient(135deg,#b8820e,#e8a820)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Radar</span>
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:28 }} className="nav-desktop">
          {[['Features','#features'],['How it works','#howitworks'],['Privacy','#privacy']].map(([l,h]) => (
            <a key={l} href={h} style={{ fontSize:14, color:'#4a4f6a', textDecoration:'none', transition:'color 0.15s' }}
              onMouseEnter={e => e.target.style.color='#c8920a'} onMouseLeave={e => e.target.style.color='#4a4f6a'}>{l}</a>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onSignIn} style={{ background:'#fff', border:'1.5px solid #e2e5f0', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:500, color:'#4a4f6a', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Sign In</button>
          <button onClick={onGetStarted} style={{ background:'linear-gradient(135deg,#c8920a,#e8a820)', color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif", boxShadow:'0 3px 10px rgba(200,146,10,0.3)' }}>Get Started Free</button>
          <button onClick={() => setMobileMenuOpen(o=>!o)} style={{ display:'none', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#4a4f6a' }} className="nav-hamburger">{mobileMenuOpen?'✕':'☰'}</button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div style={{ position:'fixed', top:64, left:0, right:0, zIndex:99, background:'#fff', borderBottom:'1px solid #eaecf4', padding:'12px 24px', display:'flex', flexDirection:'column', gap:4, boxShadow:'0 8px 24px rgba(0,0,0,0.1)' }}>
          {[['Features','#features'],['How it works','#howitworks'],['Privacy','#privacy']].map(([l,h]) => (
            <a key={l} href={h} onClick={()=>setMobileMenuOpen(false)} style={{ fontSize:15, color:'#4a4f6a', padding:'12px 0', borderBottom:'1px solid #f0f1f8', textDecoration:'none' }}>{l}</a>
          ))}
          <button onClick={()=>{setMobileMenuOpen(false);onSignIn()}} style={{ marginTop:12, padding:12, background:'#f5f6fa', border:'1px solid #e2e4ef', borderRadius:8, fontSize:14, color:'#4a4f6a', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Sign In</button>
        </div>
      )}

      {/* HERO */}
      <section style={{ background:'linear-gradient(160deg,#0f1729 0%,#1a2540 50%,#0f1729 100%)', padding:'80px 6% 70px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 0%, rgba(200,146,10,0.15) 0%, transparent 65%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>
        <div style={{ position:'relative', maxWidth:720, width:'100%' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(200,146,10,0.15)', border:'1px solid rgba(200,146,10,0.3)', borderRadius:20, padding:'5px 14px', fontSize:12, color:'#e8a820', marginBottom:28 }}>
            ✨ Free forever · No credit card · No account needed to try
          </div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(36px,6vw,64px)', fontWeight:700, color:'#fff', lineHeight:1.1, marginBottom:20 }}>
            Your Personal Finance<br/>
            <span style={{ background:'linear-gradient(135deg,#c8920a,#f0c040)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Command Centre</span>
          </h1>
          <p style={{ fontSize:'clamp(15px,2vw,18px)', color:'rgba(255,255,255,0.65)', lineHeight:1.7, marginBottom:36, maxWidth:540, margin:'0 auto 36px' }}>
            Track your net worth, investments, loans, and cash flow in one dashboard.
            Built for India — works with Zerodha, Groww, MF Central, EPF, and more.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:48 }}>
            <button onClick={onGetStarted} style={{ background:'linear-gradient(135deg,#c8920a,#e8a820)', color:'#fff', border:'none', borderRadius:10, padding:'14px 28px', fontSize:16, fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif", boxShadow:'0 8px 24px rgba(200,146,10,0.4)', transition:'transform 0.15s' }} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform=''}>Start Tracking Free →</button>
            <button onClick={onSignIn} style={{ background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', borderRadius:10, padding:'14px 24px', fontSize:15, cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'background 0.15s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.15)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}>Sign In</button>
          </div>
          <div style={{ display:'flex', gap:20, justifyContent:'center', flexWrap:'wrap' }}>
            {['🔒 100% Private','⚡ No Setup','📱 Mobile-Ready','🇮🇳 Built for India'].map(b => (
              <div key={b} style={{ fontSize:13, color:'rgba(255,255,255,0.5)' }}>{b}</div>
            ))}
          </div>
        </div>
        <div style={{ marginTop:60, width:'100%', maxWidth:540, position:'relative' }}>
          <div style={{ position:'absolute', inset:-20, background:'radial-gradient(ellipse, rgba(200,146,10,0.12) 0%, transparent 70%)', pointerEvents:'none' }}/>
          <DashboardPreview />
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{ background:'linear-gradient(135deg,#c8920a,#b8780a)', padding:'36px 6%' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:16 }}>
          <StatBadge value="₹Cr+" label="Assets Tracked" icon="💎" />
          <StatBadge value="8+" label="Brokers Supported" icon="🏦" />
          <StatBadge value="100%" label="Data Private" icon="🔐" />
          <StatBadge value="Free" label="Forever — No Fees" icon="🎁" />
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding:'80px 6%', background:'#f8f9fd' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:12, color:'#c8920a', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>What you get</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(26px,4vw,40px)', color:'#1a1d2e', marginBottom:14 }}>Everything to master your wealth</h2>
            <p style={{ fontSize:16, color:'#6b7494', maxWidth:500, margin:'0 auto' }}>No spreadsheets. No subscriptions. Just a clear picture of where you stand financially.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {features.map(f => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="howitworks" style={{ padding:'80px 6%', background:'#fff' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:12, color:'#c8920a', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Simple setup</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(24px,4vw,38px)', color:'#1a1d2e' }}>Up and running in 5 minutes</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:36 }}>
            {[
              {step:'01',icon:'🧑‍💻',title:'Create your account',desc:'Sign up with Google or email in seconds. No credit card or payment ever required.'},
              {step:'02',icon:'📥',title:'Import your holdings',desc:'Download a CSV from Zerodha, Groww, MF Central or your bank, and upload it. Done in one click.'},
              {step:'03',icon:'📈',title:'Watch your wealth grow',desc:'Your net worth, asset allocation, FI progress, and cash flow update automatically.'},
            ].map((s,i) => (
              <div key={s.step} style={{ textAlign:'center', animation:`fadeUp 0.5s ease ${i*120}ms both` }}>
                <div style={{ width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg,rgba(200,146,10,0.12),rgba(232,168,32,0.06))', border:'1.5px solid rgba(200,146,10,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:'0 auto 16px' }}>{s.icon}</div>
                <div style={{ fontSize:11, color:'#c8920a', fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>STEP {s.step}</div>
                <h3 style={{ fontSize:17, fontWeight:600, color:'#1a1d2e', marginBottom:8 }}>{s.title}</h3>
                <p style={{ fontSize:14, color:'#6b7494', lineHeight:1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BROKERS */}
      <section style={{ padding:'56px 6%', background:'#f8f9fd' }}>
        <div style={{ maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#9098b8', marginBottom:24, letterSpacing:'0.04em' }}>Import directly from these platforms</div>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            {[{name:'Zerodha',icon:'🟡'},{name:'Groww',icon:'🟢'},{name:'MF Central',icon:'🔵'},{name:'Kuvera',icon:'🟣'},{name:'NSDL / CDSL',icon:'🏛️'},{name:'EPFO / UAN',icon:'🏢'},{name:'Any Bank',icon:'🏦'},{name:'Generic CSV',icon:'📄'}].map(b => (
              <div key={b.name} style={{ padding:'10px 18px', background:'#fff', border:'1px solid #e4e7f0', borderRadius:40, display:'flex', alignItems:'center', gap:7, fontSize:13, color:'#4a4f6a', fontWeight:500, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize:16 }}>{b.icon}</span> {b.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRIVACY */}
      <section id="privacy" style={{ padding:'80px 6%', background:'#fff' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:48, alignItems:'center' }}>
            <div>
              <div style={{ fontSize:12, color:'#c8920a', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Privacy First</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(22px,3.5vw,34px)', color:'#1a1d2e', marginBottom:16, lineHeight:1.25 }}>Your financial data stays on your device</h2>
              <p style={{ fontSize:15, color:'#6b7494', lineHeight:1.7, marginBottom:24 }}>WealthRadar stores everything in your browser. There is no backend server. We don't know your name, email, or what you own.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {['No cloud — data never leaves your device','No analytics or tracking scripts','No ads, no data selling — ever','Export your data as CSV or JSON anytime'].map(item => (
                  <div key={item} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(22,163,74,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#16a34a', flexShrink:0, marginTop:1 }}>✓</div>
                    <span style={{ fontSize:14, color:'#4a4f6a', lineHeight:1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[{icon:'🔐',title:'End-to-End Local',desc:'All data stored in your browser only'},{icon:'🚫',title:'No Trackers',desc:'Zero analytics or advertising scripts'},{icon:'📤',title:'Full Export',desc:'Download all your data any time'}].map(c => (
                <div key={c.title} style={{ padding:20, background:'#f8f9fc', borderRadius:14, border:'1px solid #eaecf4', display:'flex', gap:16, alignItems:'flex-start' }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:'#fff', border:'1px solid #eaecf4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#1a1d2e', marginBottom:3 }}>{c.title}</div>
                    <div style={{ fontSize:13, color:'#8892b0' }}>{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background:'linear-gradient(135deg,#0f1729,#1a2540)', padding:'72px 6%', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 50%, rgba(200,146,10,0.12) 0%, transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'relative', maxWidth:580, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(24px,4vw,42px)', color:'#fff', marginBottom:14 }}>Start knowing your net worth today</h2>
          <p style={{ fontSize:16, color:'rgba(255,255,255,0.6)', marginBottom:32, lineHeight:1.6 }}>No spreadsheets. No subscriptions. No excuses.<br/>Your financial clarity is one click away.</p>
          <button onClick={onGetStarted} style={{ background:'linear-gradient(135deg,#c8920a,#e8a820)', color:'#fff', border:'none', borderRadius:10, padding:'15px 36px', fontSize:16, fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif", boxShadow:'0 8px 28px rgba(200,146,10,0.4)', transition:'transform 0.15s' }} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform=''}>Get Started Free →</button>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.35)', marginTop:16 }}>No credit card · No setup · Takes 2 minutes</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#0f1729', padding:'28px 6%', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>📡</span>
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'rgba(255,255,255,0.7)' }}>WealthRadar</span>
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>© {new Date().getFullYear()} WealthRadar · Built with ❤️ for India</div>
          <div style={{ display:'flex', gap:20 }}>
            {['Privacy','Terms','Contact'].map(l => (
              <span key={l} style={{ fontSize:12, color:'rgba(255,255,255,0.35)', cursor:'pointer' }}>{l}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
