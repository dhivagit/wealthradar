/**
 * Fetch USD→INR spot (no API key).
 *
 * Note: some FX endpoints block browser requests via CORS. This function tries
 * a couple of CORS-friendly sources with a short timeout.
 */
export async function fetchUsdInrRate({ timeoutMs = 8000 } = {}) {
  const controllers = []
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('FX timeout')), ms))

  const tryJson = async (url, pickRate) => {
    const ac = new AbortController()
    controllers.push(ac)
    const res = await fetch(url, { signal: ac.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`)
    const data = await res.json()
    const rate = pickRate(data)
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) throw new Error('Invalid INR rate')
    return rate
  }

  try {
    // 1) open.er-api.com (CORS-friendly)
    return await Promise.race([
      tryJson('https://open.er-api.com/v6/latest/USD', (d) => d?.rates?.INR),
      timeout(timeoutMs),
    ])
  } catch {
    try {
      // 2) Frankfurter (ECB-based) — may be blocked on some networks
      return await Promise.race([
        tryJson('https://api.frankfurter.app/latest?from=USD&to=INR', (d) => d?.rates?.INR),
        timeout(timeoutMs),
      ])
    } finally {
      controllers.forEach(c => { try { c.abort() } catch {} })
    }
  }
}
