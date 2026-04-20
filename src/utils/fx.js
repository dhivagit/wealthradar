/**
 * Fetch USD→INR spot (no API key).
 *
 * Note: some FX endpoints block browser requests via CORS. This function tries
 * a couple of CORS-friendly sources with a short timeout.
 */
export const fetchUsdInrRate = async () => {
  try {
    // Try multiple reliable sources in order of preference
    const sources = [
      // Source 1: Frankfurter API (EU-based, free, no API key needed, ~1-2 min delay)
      {
        name: 'Frankfurter',
        fn: async () => {
          const r = await Promise.race([
            fetch('https://api.frankfurter.app/latest?from=USD&to=INR'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000))
          ])
          if (!r.ok) throw new Error('Failed')
          const d = await r.json()
          return d.rates.INR
        }
      },
      // Source 2: ExchangeRate-API (free tier, 1500 calls/month, very accurate, real-time)
      {
        name: 'ExchangeRate-API',
        fn: async () => {
          const r = await Promise.race([
            fetch('https://api.exchangerate-api.com/v4/latest/USD'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000))
          ])
          if (!r.ok) throw new Error('Failed')
          const d = await r.json()
          return d.rates.INR
        }
      },
      // Source 3: @fawazahmed0 currency API (free, reliable, updated daily)
      {
        name: 'fawazahmed0 CDN',
        fn: async () => {
          const r = await Promise.race([
            fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000))
          ])
          if (!r.ok) throw new Error('Failed')
          const d = await r.json()
          return d.usd.inr
        }
      },
      // Source 4: CBOE/Financial data (HTTPS, no-cors may be needed)
      {
        name: 'X-Rate',
        fn: async () => {
          const r = await Promise.race([
            fetch('https://xrates.app/latest?from=USD&to=INR'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000))
          ])
          if (!r.ok) throw new Error('Failed')
          const d = await r.json()
          return d.rates.INR
        }
      },
    ]

    let lastError = new Error('No sources available')
    
    // Try each source sequentially until one succeeds
    for (const source of sources) {
      try {
        const rate = await source.fn()
        
        // Validate rate is reasonable (between ₹70 and ₹150 — typical historical range)
        if (rate && typeof rate === 'number' && rate > 70 && rate < 150) {
          // Round to 2 decimal places for clean display
          const rounded = Math.round(rate * 100) / 100
          console.log(`✓ USD→INR rate fetched from ${source.name}: ₹${rounded}`)
          return rounded
        } else {
          throw new Error(`Rate out of range: ${rate}`)
        }
      } catch (err) {
        lastError = err
        console.warn(`⚠ USD→INR fetch from ${source.name}: ${err.message}`)
        continue
      }
    }
    
    throw new Error(`All USD→INR sources failed. Last: ${lastError.message}`)
  } catch (err) {
    console.error('❌ fetchUsdInrRate error:', err.message)
    throw err
  }
}
