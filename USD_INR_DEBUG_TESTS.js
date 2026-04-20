// Verify the fetchUsdInrRate function is exported and working
// Add this test in your browser console (F12):

// 1. Test import:
import { fetchUsdInrRate } from '@/utils/fx'

// 2. Test fetch:
await fetchUsdInrRate()
  .then(rate => console.log('✅ Success! Rate:', rate))
  .catch(err => console.error('❌ Error:', err.message))

// 3. If error, test individual API sources:
// Frankfurter
fetch('https://api.frankfurter.app/latest?from=USD&to=INR')
  .then(r => r.json())
  .then(d => console.log('Frankfurter:', d.rates.INR))
  .catch(e => console.error('Frankfurter failed:', e.message))

// ExchangeRate-API
fetch('https://api.exchangerate-api.com/v4/latest/USD')
  .then(r => r.json())
  .then(d => console.log('ExchangeRate-API:', d.rates.INR))
  .catch(e => console.error('ExchangeRate-API failed:', e.message))

// fawazahmed0 CDN
fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
  .then(r => r.json())
  .then(d => console.log('fawazahmed0:', d.usd.inr))
  .catch(e => console.error('fawazahmed0 failed:', e.message))