// ─── Currencies ───────────────────────────────────────────────────────────────
export const CURRENCIES = [
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee',       locale: 'en-IN' },
  { code: 'USD', symbol: '$',    name: 'US Dollar',          locale: 'en-US' },
  { code: 'EUR', symbol: '€',    name: 'Euro',               locale: 'de-DE' },
  { code: 'GBP', symbol: '£',    name: 'British Pound',      locale: 'en-GB' },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen',       locale: 'ja-JP' },
  { code: 'CAD', symbol: 'CA$',  name: 'Canadian Dollar',    locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar',  locale: 'en-AU' },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar',   locale: 'en-SG' },
  { code: 'AED', symbol: 'AED',  name: 'UAE Dirham',         locale: 'ar-AE' },
]

// ─── Category Lists ───────────────────────────────────────────────────────────
export const ASSET_CATS = [
  'Cash & Equivalents', 'Fixed Deposits', 'Bonds & Debentures', 'Mutual Funds',
  'Stocks & Equities', 'PPF / EPF', 'SSA (Sukanya Samriddhi)', 'NPS', 'Real Estate',
  'Gold & Precious Metals', 'Cryptocurrency', 'Vehicles',
  'Business Assets', 'Others',
]

export const LIABILITY_CATS = [
  'Home Loan', 'Vehicle Loan', 'Personal Loan', 'Education Loan',
  'Credit Card Debt', 'Business Loan', 'Medical Debt', 'Others',
]

export const INCOME_CATS = [
  'Salary', 'Business Income', 'Freelance', 'Rental Income',
  'Dividends', 'Interest', 'Capital Gains', 'Government Benefits', 'Others',
]

export const EXPENSE_CATS = [
  'Housing / Rent', 'Food & Groceries', 'Transport', 'Healthcare',
  'Education', 'Entertainment', 'Utilities', 'Insurance',
  'EMIs', 'Shopping', 'Subscriptions', 'Others',
]

// ─── Chart Colour Palette ─────────────────────────────────────────────────────
export const PALETTE = [
  '#c8953a', '#3ecf8e', '#5b8ff9', '#f06a6a', '#f09b46',
  '#9b8ff9', '#e8c060', '#56d8c8', '#e87070', '#88d060',
  '#d97706', '#06b6d4', '#8b5cf6', '#10b981', '#f43f5e',
]

// Consistent category → colour mapping so same category always same colour
export const CAT_COLORS = {
  'Stocks & Equities':     '#5b8ff9',
  'Mutual Funds':          '#9b8ff9',
  'Gold & Precious Metals':'#c8953a',
  'Fixed Deposits':        '#3ecf8e',
  'Cash & Equivalents':    '#56d8c8',
  'Real Estate':           '#f09b46',
  'PPF / EPF':             '#88d060',
  'SSA (Sukanya Samriddhi)':'#ec4899',
  'NPS':                   '#06b6d4',
  'Fixed Income & Bonds':  '#10b981',
  'Bonds & Debentures':    '#10b981',
  'Cryptocurrency':        '#f43f5e',
  'Business Assets':       '#d97706',
  'Vehicles':              '#8b5cf6',
  'Others':                '#e8c060',
}

// ─── Navigation Tabs ─────────────────────────────────────────────────────────
export const TABS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '⬡' },
  { id: 'assets',      label: 'Assets',      icon: '△' },
  { id: 'liabilities', label: 'Liabilities', icon: '▽' },
  { id: 'cashflow',    label: 'Cash Flow',   icon: '⇄' },
  { id: 'analytics',   label: 'Analytics',   icon: '◈' },
  { id: 'networth',    label: 'Net Worth',   icon: '◉' },
  { id: 'profile',     label: 'Profile',     icon: '⊕' },
  { id: 'taxharvest',  label: 'Tax Harvest', icon: '⚡' },
  { id: 'settings',    label: 'Settings',    icon: '⚙' },
]

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Wealth Milestones (in INR; scale per currency) ───────────────────────────
export const MILESTONES = [
  100_000, 500_000, 1_000_000, 2_500_000,
  5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000,
]
