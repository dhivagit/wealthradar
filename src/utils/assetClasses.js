// Unified asset classification system — source of truth for all components
// Provides consistent 5-class categorization across Dashboard, Analytics, Allocation, and Goal Planning

export const ALL_CLASSES = ['Equity', 'Debt', 'Gold & Silver', 'Cash', 'Real Estate']

export const CLASS_COLORS = {
  'Equity':        '#5b8ff9',
  'Debt':          '#34d399',
  'Gold & Silver': '#c8953a',
  'Cash':          '#56d8c8',
  'Real Estate':   '#f09b46',
}

// Maps asset category → asset class
// null = excluded from 5-class allocation math (but may be shown visually elsewhere)
export const ASSET_CLASS_MAP = {
  'Stocks & Equities':       'Equity',
  'Mutual Funds':            'Equity',      // overridden by mfClass() for debt/gold MFs
  'NPS':                     'Equity',      // market-linked
  'Gold & Precious Metals':  'Gold & Silver',
  'Cryptocurrency':          null,          // excluded from 5-class allocation
  'Fixed Deposits':          'Debt',
  'PPF / EPF':               'Debt',
  'SSA (Sukanya Samriddhi)': 'Debt',
  'Bonds & Debentures':      'Debt',
  'Cash & Equivalents':      'Cash',
  'Real Estate':             'Real Estate',
  'Vehicles':                null,          // excluded
  'Business Assets':         null,          // excluded
  'Others':                  null,          // excluded
}

/**
 * Classify a mutual fund by its sub-type (equity, debt, gold)
 * Based on keywords in the note or _sector field
 */
export function mfClass(note = '') {
  const n = (note || '').toLowerCase()
  if (/debt|bond|gilt|liquid|overnight|money market|banking psu|floater|credit risk|short dur|long dur|government|securities|fixed income/.test(n)) {
    return 'Debt'
  }
  if (/gold|silver|commodity/.test(n)) {
    return 'Gold & Silver'
  }
  return 'Equity'
}

/**
 * Get the asset class for any asset — the single function all components should call
 * Returns one of: 'Equity', 'Debt', 'Gold & Silver', 'Cash', 'Real Estate', or null (excluded)
 */
export function getAssetClass(asset) {
  if (!asset) return null

  const cls = ASSET_CLASS_MAP[asset.category]
  if (cls === undefined) return null  // unknown category

  // For mutual funds, check if it's actually a debt or gold MF
  if (cls === 'Equity' && (asset.category === 'Mutual Funds' || asset._isMF)) {
    return mfClass(asset.note || asset._sector || '')
  }

  return cls
}
