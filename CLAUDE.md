# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server at http://localhost:3000
npm run build      # production build → dist/
npm run preview    # preview production build locally
npm run lint       # ESLint over src/
npm run deploy     # build + firebase deploy (requires firebase login)
```

No test suite is configured.

## Environment Setup

Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_CLIENT_ID` for Google SSO to work. Without it, Google sign-in shows a configuration error but email/password auth still works.

## Architecture

**Stack:** React 18 + Vite 5, no backend — all data lives in `localStorage`/`sessionStorage`.

**Path alias:** `@` maps to `./src` (configured in `vite.config.js`).

### Data Flow

All finance data is scoped to a `userId` and persisted via `DB` helpers in `src/utils/helpers.js`:
- `wr_users` — user registry (keyed by email)
- `wr_data_<userId>` — finance data (`assets`, `liabilities`, `income`, `expenses`, `snapshots`, `history`)
- `wr_settings_<userId>` — currency and other preferences
- `wr_session` — sessionStorage, cleared on tab close

`FinanceContext` (`src/context/FinanceContext.jsx`) loads data on session change and exposes generic CRUD (`addItem`, `updateItem`, `deleteItem`, `batchUpdateCollection`) plus export/import helpers. Components never touch `localStorage` directly.

`useTotals` (`src/hooks/useTotals.js`) derives all computed values (net worth, FI number, savings rate, etc.) from `data` via `useMemo`. This is the single source of truth for derived financials.

### Auth

`AuthContext` (`src/context/AuthContext.jsx`) handles three auth paths:
1. Email/password — stored in `localStorage` with a simple hash (`hashPassword` in helpers)
2. Google SSO — uses Google Identity Services popup, requires `VITE_GOOGLE_CLIENT_ID`
3. Demo login — hardcoded `demo@wealthradar.in` account

`src/utils/firebaseAuth.js` provides optional Firebase Auth integration (password reset emails, Firebase Google SSO) — only activates when `VITE_FIREBASE_API_KEY` is set. Password reset flow uses URL params `?reset=TOKEN&email=...` handled in `App.jsx`.

### Routing / Navigation

No React Router routes — navigation is tab-based state (`activeTab`) inside `Shell` in `App.jsx`. All 9 tabs (`dashboard`, `assets`, `liabilities`, `cashflow`, `analytics`, `networth`, `profile`, `taxharvest`, `settings`) are defined in `src/utils/constants.js` (`TABS`) and rendered via a map in `Shell`.

### Component Structure

- `src/components/Tabs.jsx` — all 7 main page components (`Dashboard`, `Assets`, `Liabilities`, `CashFlow`, `Analytics`, `NetWorth`, `Settings`) in one file
- `src/components/UI.jsx` — shared primitives (cards, modals, `Notification` toast)
- `src/components/EntryModal.jsx` — add/edit form for all entry types
- `src/components/ImportModal.jsx` — JSON import UI
- `src/components/FinancialProfile.jsx`, `TaxHarvest.jsx` — standalone feature tabs
- `src/styles/global.css` — full design system with CSS classes (`btn`, `btn-gold`, `nav-item`, `chip`, `gold-gradient`, `fade-up`)

### Key Conventions

- INR is the default currency; `formatCompact` uses Indian number system (L/Cr suffixes for INR, M/B for others)
- `uid()` generates item IDs as `${Date.now()}_${random}`
- Charts use Recharts with a consistent color palette from `CAT_COLORS` in constants (same category always same color)
- Build splits vendor (react, react-dom, react-router-dom) and charts (recharts) into separate chunks
