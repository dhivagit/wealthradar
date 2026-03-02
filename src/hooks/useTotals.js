import { useMemo } from 'react'
import { useFinance } from '../context/FinanceContext'

export function useTotals() {
  const { data } = useFinance()

  return useMemo(() => {
    if (!data) return {}

    const totalAssets      = data.assets.reduce((s, a) => s + (a.value || 0), 0)
    const totalLiabilities = data.liabilities.reduce((s, l) => s + (l.value || 0), 0)
    const netWorth         = totalAssets - totalLiabilities
    const totalIncome      = data.income.reduce((s, i) => s + (i.monthly || 0), 0)
    const totalExpenses    = data.expenses.reduce((s, e) => s + (e.monthly || 0), 0)
    const cashFlow         = totalIncome - totalExpenses
    const savingsRate      = totalIncome > 0 ? (cashFlow / totalIncome) * 100 : 0
    const debtRatio        = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0
    const fiNumber         = totalExpenses * 12 * 25
    const fiPct            = fiNumber > 0 ? Math.min((netWorth / fiNumber) * 100, 100) : 0
    const monthlyInterest  = data.liabilities.reduce((s, l) => s + (l.rate ? (l.value * l.rate / 100) / 12 : 0), 0)
    const cashAssets       = data.assets.filter(a => a.category === 'Cash & Equivalents').reduce((s, x) => s + x.value, 0)
    const emergencyMonths  = totalExpenses > 0 ? cashAssets / totalExpenses : 0

    const history = data.history || []
    const prevNW  = history.length > 1 ? history[history.length - 2].netWorth : netWorth
    const nwChange = prevNW > 0 ? ((netWorth - prevNW) / prevNW) * 100 : 0

    const avgNW = history.length ? history.reduce((s, x) => s + x.netWorth, 0) / history.length : netWorth
    const maxNW = history.length ? Math.max(...history.map(x => x.netWorth)) : netWorth

    return {
      totalAssets, totalLiabilities, netWorth,
      totalIncome, totalExpenses, cashFlow,
      savingsRate, debtRatio, fiNumber, fiPct,
      monthlyInterest, cashAssets, emergencyMonths,
      nwChange, avgNW, maxNW,
    }
  }, [data])
}
