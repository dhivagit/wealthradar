import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { DB, createSampleData, dataToCSV, downloadBlob } from '../utils/helpers'
import { detectSubCategory } from '../utils/detection'

const FinanceContext = createContext(null)

const DEFAULT_SETTINGS = { currency: 'INR', usdInrRate: 83 }

const SUBCAT_ASSET_CATS = ['Stocks & Equities', 'Mutual Funds', 'Gold & Precious Metals', 'Cryptocurrency']

export function FinanceProvider({ children }) {
  const { session } = useAuth()
  const [data,     setDataState] = useState(null)
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_SETTINGS }))

  // ── Sync with detection ───────────────────────────────────────────────────
  // Automatically fill missing sectors/categories for existing data
  const enrichData = useCallback((d) => {
    if (!d || !d.assets) return d
    let changed = false
    const newAssets = d.assets.map(a => {
      if (a._isUS) return a
      if (!SUBCAT_ASSET_CATS.includes(a.category)) return a
      const hasSec = Boolean((a._sector || '').trim())
      const hasNote = Boolean((a.note || '').trim())
      if (hasSec || hasNote) return a
      const detected = detectSubCategory(a.name, a.category)
      if (!detected) return a
      changed = true
      return { ...a, _sector: detected, note: detected }
    })
    return changed ? { ...d, assets: newAssets } : d
  }, [])

  // Load from storage when session changes
  useEffect(() => {
    if (!session) { setDataState(null); return }
    const rawData = DB.getData(session.userId)
    const enriched = rawData ? enrichData(rawData) : createSampleData()
    const s = { ...DEFAULT_SETTINGS, ...(DB.getSettings(session.userId) || {}) }
    
    // If enrichData modified anything, persist it back immediately
    if (rawData && JSON.stringify(enriched) !== JSON.stringify(rawData)) {
      DB.saveData(session.userId, enriched)
    }
    
    setDataState(enriched)
    setSettingsState(s)
  }, [session, enrichData])

  const persistData = useCallback((d) => {
    setDataState(d)
    if (session) DB.saveData(session.userId, d)
  }, [session])

  const persistSettings = useCallback((s) => {
    setSettingsState(s)
    if (session) DB.saveSettings(session.userId, s)
  }, [session])

  // ── Generic CRUD ───────────────────────────────────────────────────────────
  const addItem = useCallback((collection, item) => {
    setDataState(prev => {
      const updated = { ...prev, [collection]: [...prev[collection], item] }
      if (session) DB.saveData(session.userId, updated)
      return updated
    })
  }, [session])

  const updateItem = useCallback((collection, item) => {
    setDataState(prev => {
      const updated = { ...prev, [collection]: prev[collection].map(x => x.id === item.id ? item : x) }
      if (session) DB.saveData(session.userId, updated)
      return updated
    })
  }, [session])

  // Batch replace entire collection at once (used for bulk fixes like sector casing)
  const batchUpdateCollection = useCallback((collection, items) => {
    setDataState(prev => {
      const updated = { ...prev, [collection]: items }
      if (session) DB.saveData(session.userId, updated)
      return updated
    })
  }, [session])

  const deleteItem = useCallback((collection, id) => {
    setDataState(prev => {
      const updated = { ...prev, [collection]: prev[collection].filter(x => x.id !== id) }
      if (session) DB.saveData(session.userId, updated)
      return updated
    })
  }, [session])

  // ── Snapshots ──────────────────────────────────────────────────────────────
  const takeSnapshot = useCallback((totals) => {
    const snap = {
      id:               Date.now(),
      date:             new Date().toLocaleDateString('en-IN'),
      timestamp:        new Date().toISOString(),
      currency:         settings.currency,
      ...totals,
    }
    setDataState(prev => {
      const updated = { ...prev, snapshots: [...(prev.snapshots || []), snap] }
      if (session) DB.saveData(session.userId, updated)
      return updated
    })
    return snap
  }, [session, settings.currency])

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportJSON = useCallback(() => {
    if (!data) return
    const payload = JSON.stringify({ ...data, exportedAt: new Date().toISOString(), currency: settings.currency }, null, 2)
    downloadBlob(payload, `wealthradar-backup-${new Date().toISOString().slice(0,10)}.json`, 'application/json')
  }, [data, settings.currency])

  const exportCSV = useCallback(() => {
    if (!data) return
    downloadBlob(dataToCSV(data, settings.currency), `wealthradar-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv')
  }, [data, settings.currency])

  const importJSON = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result)
          if (!imported.assets || !imported.liabilities) throw new Error('Invalid format')
          persistData(imported)
          if (imported.currency) persistSettings({ ...settings, currency: imported.currency })
          resolve(true)
        } catch (e) { reject(e) }
      }
      reader.readAsText(file)
    })
  }, [persistData, persistSettings, settings])

  const resetToSample = useCallback(() => {
    persistData(createSampleData())
  }, [persistData])

  const clearMirroredRemarks = useCallback(() => {
    if (!data) return
    const EQUITY_LIKE = new Set(['Stocks & Equities', 'Mutual Funds', 'Gold & Precious Metals', 'Cryptocurrency'])
    const clearedAssets = data.assets.map(asset => {
      if (!EQUITY_LIKE.has(asset.category)) return asset
      const sec = (asset._sector || '').trim()
      const note = (asset.note || '').trim()
      if (!sec && note) return { ...asset, _sector: note, note: '' }
      if (sec && note === sec) return { ...asset, note: '' }
      return asset
    })
    batchUpdateCollection('assets', clearedAssets)
  }, [data, batchUpdateCollection])

  return (
    <FinanceContext.Provider value={{
      data, settings,
      persistData, persistSettings,
      addItem, updateItem, deleteItem, batchUpdateCollection,
      takeSnapshot, exportJSON, exportCSV, importJSON, resetToSample,
      clearMirroredRemarks,
    }}>
      {children}
    </FinanceContext.Provider>
  )
}

export const useFinance = () => useContext(FinanceContext)
