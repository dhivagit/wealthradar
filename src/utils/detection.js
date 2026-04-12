/**
 * Intelligent detection for Asset Sectors and Categories
 */

// ── Stock Sector Detection ────────────────────────────────────────────────────
// Based on official AMFI classifications and common Indian stock market names
export function detectStockSector(name) {
  const n = (name || '').toLowerCase()
  const rules = [
    // Banking
    [['bank','banking','indusind','federal bank','yes bank','bandhan bank','au small','dcb bank','karur','city union','tmb','south indian','hdb financial','rbl bank','csb bank','hdfc bank','icici bank','axis bank','kotak mah','sbi bank'], 'Banking'],
    // Insurance
    [['insurance','life ins','general ins','bajaj allianz','icici pru','hdfc life','sbi life','star health','niva bupa','go digit'], 'Insurance'],
    // Financial Services
    [['power finance','pfc','rec limited','lic housing','gruh finance','repco','manappuram','muthoot','sphoorty','bajaj fin','cholaman','shriram','mahindra fin','l&t fin','pnb housing','can fin','aptus','home first','aditya birla cap','iifl','microfinance','nbfc'], 'Financial Services'],
    [['finance','financial'], 'Financial Services'],
    // Software & IT
    [['tata consultancy','tcs','infosys','wipro','hcl tech','tech mahindra','ltimindtree','mphasis','persistent','coforge','oracle fin','hexaware','zensar','niit tech','mastek','kpit','happiest','birlasoft','saksoft','tanla','tanla platforms','newgen','tata elxsi','cyient','sasken','sonata','intellect design','nucleus software','rategain','latent view','nuvei','indiamart'], 'Software & IT'],
    // Automobiles
    [['mahindra','maruti','tata motors','ashok leyland','hero moto','bajaj auto','tvs motor','eicher','bosch','mrf','apollo tyre','ceat','motherson','endurance','sona bly','uno minda','rane','samvardhana','suprajit','precision camshaft','gabriel','fiem'], 'Automobiles'],
    // Healthcare
    [['healthcare','health care','ttk health','apollo hosp','fortis','max health','narayana','aster','global health','rainbow','kims','yatharth','metropolis','dr lal','thyrocare','vijaya diag'], 'Healthcare'],
    // Pharmaceuticals
    [['pharma','cipla','sun pharma','drreddy','dr. reddy','biocon','divis','lupin','zydus','cadila','abbott','pfizer','natco','alkem','torrent pharma','ipca','laurus','granules','strides','glenmark','mankind','ajanta','eris','suven','sequent','solara','windlas','lincoln pharma','marksans'], 'Pharmaceuticals'],
    // Oil & Gas
    [['oil','petroleum','ongc','bpcl','hpcl','ioc','indian oil','gail','castrol','gujarat gas','indraprastha','mahanagar gas','petronet','aegis logistics','gulf oil'], 'Oil & Gas'],
    // Energy & Power
    [['coal india','ntpc','adani power','tata power','torrent power','cesc','jsw energy','renewable','green energy','avaada','acme','greenko','power grid','sjvn','nhpc','neepco','ireda','waaree','premier energies','suzlon','inox wind'], 'Energy & Power'],
    // Metals & Mining
    [['steel','tata steel','jsw steel','sail','jspl','jindal','hindalco','vedanta','nalco','moil','nmdc','national aluminium','vedl','hindustan zinc','national mineral','sandur','mishra dhatu'], 'Metals & Mining'],
    // FMCG
    [['hindustan unilever','hul','itc','dabur','godrej consumer','marico','nestle','britannia','colgate','emami','jyothy','varun bev','radico','united spirits','united breweries','tilaknagar','globus spirits','som distilleries','mcdowell','mil industries','heritage foods'], 'FMCG'],
    // Capital Goods & Engineering
    [['larsen','l&t','siemens','abb','bhel','cummins','thermax','bharat forge','grindwell','timken','schaeffler','skf','elgi','kirloskar','honeywell','voltas','blue star','prakash industries','ncc','kalpataru','kec international','patel engineering','irb infra','ashoka buildcon','hem holdings'], 'Capital Goods'],
    // Industrials
    [['prakash pipes','supreme industries','astral','finolex','prince pipes','apollo pipes','nile','jain irrigation','kiri industries'], 'Industrials'],
    [['pipes','fittings','valves','industrial'], 'Industrials'],
    // Telecom
    [['airtel','jio','vodafone','bharti','tata comm','sterlite tech','hfcl','route mobile','videocon'], 'Telecom'],
    // Real Estate
    [['dlf','godrej prop','oberoi','prestige','brigade','sobha','macrotech','lodha','kolte patil','phoenix','puravankara','mahindra lifespace','sunteck','nirlon'], 'Real Estate'],
    // Cement
    [['ultratech','shree cement','acc','ambuja','dalmia','jk cement','ramco','birla corp','heidelberg','india cements','prism johnson'], 'Cement'],
    // Chemicals
    [['pidilite','asian paint','berger','kansai','nerolac','deepak nitrite','aarti ind','navin fluorine','srf','clean science','galaxy surf','fine organics','vinati organics','sudarshan chem','bodal chem','chemcrux','anupam rasayan'], 'Chemicals'],
    // Retail & Consumer
    [['avenue supermarts','dmart','trent','v-mart','metro brands','bata','relaxo','titan','kalyan','rajesh exports','vedant','manyavar','go fashion','aditya birla fashion','shoppers stop'], 'Retail & Consumer'],
    // Logistics
    [['adani port','concor','gateway dist','blue dart','gati','allcargo','transport corp','mahindra logistics','tvs supply','delhivery','xpressbees','safexpress'], 'Logistics'],
    // Capital Markets
    [['nse','bse','cdsl','nsdl','cams','computer age','kfin tech','crisil','care ratings','icra','angel one','motilal','iifl sec','5paisa','geojit','hdfc sec'], 'Capital Markets'],
    // Textiles
    [['textile','fabric','yarn','fibre','raymond','arvind','vardhman','welspun','trident','ktm','siyaram','nitin spinners','indo count'], 'Textiles'],
    // Agriculture
    [['fertiliser','fertilizer','agri','coromandel','chambal','deepak fert','gnfc','national fertilizers','rashtriya chemicals','bayer crop','pi industries','dhanuka','rallis'], 'Agriculture'],
    // Media & Entertainment
    [['media','entertainment','zee','sony','network18','sun tv','tv18','dish tv','pvr','inox','balaji telefilms','tips music','saregama'], 'Media & Entertainment'],
    // Defence
    [['defence','defense','aerospace','hal','bharat electronics','bel','bharat dynamics','mazagon','cochin shipyard','garden reach','paras defence','data patterns'], 'Defence'],
  ]
  for (const [keywords, sector] of rules) {
    if (keywords.some(k => n.includes(k))) return sector
  }
  return ''
}

// ── Mutual Fund Category Detection ────────────────────────────────────────────
export function detectMFCategory(name) {
  const n = (name || '').toLowerCase()
  
  if (/large.?cap/.test(n)) return 'Large Cap'
  if (/mid.?cap/.test(n)) return 'Mid Cap'
  if (/small.?cap/.test(n)) return 'Small Cap'
  if (/flexi.?cap/.test(n)) return 'Flexi Cap'
  if (/multi.?cap/.test(n)) return 'Multi Cap'
  if (/focused/.test(n)) return 'Focused Fund'
  if (/value|contra/.test(n)) return 'Value / Contra'
  if (/elss|tax.?saver/.test(n)) return 'ELSS (Tax Saver)'
  if (/index|nifty|sensex|sp500|nasdaq/.test(n)) return 'Index Fund'
  
  if (/balanced advantage|baf|dynamic asset/.test(n)) return 'Balanced Advantage'
  if (/hybrid|aggressive hybrid|conservative hybrid/.test(n)) return 'Hybrid'
  if (/arbitrage/.test(n)) return 'Arbitrage'
  if (/equity.?savings/.test(n)) return 'Equity Savings'
  if (/multi.?asset/.test(n)) return 'Multi Asset'
  
  if (/liquid|overnight|money market/.test(n)) return 'Liquid / Overnight'
  if (/debt|bond|gilt|banking psu|corporate bond|dynamic bond|credit risk|short dur|low dur|ultra short/.test(n)) return 'Debt Fund'
  
  if (/gold|silver|commodity/.test(n)) return 'Commodity Fund'
  if (/international|global|us equity|overseas|nasdaq|fang/.test(n)) return 'International'
  
  if (/thematic|sectoral|it fund|pharma fund|banking fund|fmcg fund|infrastructure fund|consumption|psu equity/.test(n)) return 'Thematic / Sectoral'
  
  return ''
}

// ── Gold & Precious Metals Type Detection ────────────────────────────────────
export function detectGoldType(name) {
  const n = (name || '').toLowerCase()
  
  if (/sgb|sovereign/.test(n)) return 'SGB'
  if (/etf|bees/.test(n)) return 'Gold/Silver ETF'
  if (/fund|fof/.test(n)) return 'Gold/Silver Fund'
  if (/digital/.test(n)) return 'Digital Gold'
  if (/coin|bar|brick/.test(n)) return 'Physical (Coin/Bar)'
  if (/jewel|ornament/.test(n)) return 'Physical (Jewelry)'
  if (/silver/.test(n)) return 'Silver'
  if (/platinum/.test(n)) return 'Platinum'
  
  if (/gold/.test(n)) return 'Gold'
  
  return ''
}

// ── Cryptocurrency (light labels for allocation / column display) ─────────────
export function detectCryptoLabel(name) {
  const n = (name || '').toLowerCase()
  if (/bitcoin|\bbtc\b/.test(n)) return 'Bitcoin'
  if (/ethereum|\beth\b/.test(n)) return 'Ethereum'
  if (/usdt|tether/.test(n)) return 'Stablecoin'
  if (/solana|\bsol\b/.test(n)) return 'Solana'
  if (n.trim()) return 'Cryptocurrency'
  return ''
}

/**
 * Combined detection for all equity-like assets
 */
export function detectSubCategory(name, category) {
  if (category === 'Stocks & Equities') {
    return detectStockSector(name)
  }
  if (category === 'Mutual Funds') {
    return detectMFCategory(name)
  }
  if (category === 'Gold & Precious Metals') {
    return detectGoldType(name)
  }
  if (category === 'Cryptocurrency') {
    return detectCryptoLabel(name)
  }
  return ''
}
