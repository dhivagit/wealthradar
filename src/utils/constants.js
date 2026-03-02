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
  'Cash & Equivalents', 'Fixed Deposits', 'Mutual Funds',
  'Stocks & Equities', 'PPF / EPF', 'NPS', 'Real Estate',
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
]

// ─── Navigation Tabs ─────────────────────────────────────────────────────────
export const TABS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '⬡' },
  { id: 'assets',      label: 'Assets',      icon: '△' },
  { id: 'liabilities', label: 'Liabilities', icon: '▽' },
  { id: 'cashflow',    label: 'Cash Flow',   icon: '⇄' },
  { id: 'analytics',   label: 'Analytics',   icon: '◈' },
  { id: 'networth',    label: 'Net Worth',   icon: '◉' },
  { id: 'settings',    label: 'Settings',    icon: '⚙' },
]

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Wealth Milestones (in INR; scale per currency) ───────────────────────────
export const MILESTONES = [
  100_000, 500_000, 1_000_000, 2_500_000,
  5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000,
]
