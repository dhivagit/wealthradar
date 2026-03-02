# 🛠 WealthRadar — Developer Setup Guide

Complete guide to clone, run, and develop WealthRadar locally using Cursor or VS Code.

---

## 1. Choose Your Code Editor

### 🥇 Cursor (Recommended for AI-assisted development)

Cursor is a fork of VS Code with built-in Claude/GPT AI that understands your entire codebase.
It's the best choice for this project because:
- You can ask it to **modify components** in plain English ("add a pie chart to the cash flow tab")
- It understands the full project context, not just one file
- Free tier is generous for solo projects
- Identical UI to VS Code — zero learning curve if you already use it

**Download:** https://cursor.com

### 🥈 VS Code (Most popular, battle-tested)

Free, open source, massive extension ecosystem. Excellent for React/JavaScript.

**Download:** https://code.visualstudio.com

---

## 2. Clone the Repo from GitHub

Open a terminal and run:

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/wealthradar.git

# Enter the project
cd wealthradar

# Open in Cursor
cursor .

# OR open in VS Code
code .
```

> If `cursor .` or `code .` doesn't work, open the editor first → **File → Open Folder** → select the `wealthradar/` folder.

---

## 3. Install Recommended Extensions

### For Cursor
Cursor has AI built-in. Also install these:

| Extension | Purpose |
|---|---|
| **ES7+ React/Redux Snippets** | React shorthand like `rafce` → full component |
| **Prettier** | Auto-format code on save |
| **ESLint** | Catch bugs as you type |
| **GitLens** | See who changed what, line by line |

### For VS Code
Same extensions above, plus:

| Extension | Purpose |
|---|---|
| **GitHub Copilot** | AI code completion (paid, $10/mo) |
| **Tailwind CSS IntelliSense** | Autocomplete class names |

**How to install:** Press `Ctrl+Shift+X` (Windows) or `Cmd+Shift+X` (Mac) → search extension name → Install.

---

## 4. Configure Prettier (Auto-format on Save)

Create `.vscode/settings.json` in the project root:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.wordWrap": "on",
  "emmet.includeLanguages": { "javascript": "javascriptreact" },
  "files.associations": { "*.jsx": "javascriptreact" }
}
```

Create `.prettierrc` in the project root:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "jsxSingleQuote": true
}
```

---

## 5. Environment Setup

```bash
# Copy the template
cp .env.example .env.local

# Open it and add your Google Client ID (optional for now)
# VITE_GOOGLE_CLIENT_ID=your_client_id_here
```

---

## 6. Install & Run

```bash
npm install       # install dependencies (~30 seconds)
npm run dev       # start dev server
```

Open **http://localhost:3000** — the app hot-reloads instantly every time you save a file.

---

## 7. Understand the Project Structure

```
wealthradar/
├── src/
│   ├── components/
│   │   ├── AuthScreen.jsx     ← Login page
│   │   ├── ImportModal.jsx    ← Broker/bank import wizard
│   │   ├── EntryModal.jsx     ← Add/edit asset form
│   │   ├── Tabs.jsx           ← All 7 page tabs (Dashboard, Assets, etc.)
│   │   └── UI.jsx             ← Reusable: StatCard, Modal, DataTable, etc.
│   │
│   ├── context/
│   │   ├── AuthContext.jsx    ← Who is logged in
│   │   └── FinanceContext.jsx ← All financial data (assets, liabilities, etc.)
│   │
│   ├── hooks/
│   │   └── useTotals.js       ← Calculated values: netWorth, savingsRate, etc.
│   │
│   ├── utils/
│   │   ├── constants.js       ← Currency list, category names, chart colours
│   │   └── helpers.js         ← Format money, localStorage DB, sample data
│   │
│   ├── styles/
│   │   └── global.css         ← All styles (design tokens, card, button, etc.)
│   │
│   ├── App.jsx                ← Root: sidebar + topbar layout shell
│   └── main.jsx               ← Entry point
│
├── public/
│   ├── manifest.json          ← PWA config (app name, icons)
│   └── sw.js                  ← Service worker (offline)
│
├── firebase.json              ← Firebase hosting config
├── .env.example               ← Copy → .env.local
└── package.json
```

### Key rule: where does data live?

All financial data lives in `FinanceContext.jsx` and is persisted to `localStorage`.
The flow is:

```
User action → component calls addItem/updateItem/deleteItem
           → FinanceContext updates state + saves to localStorage
           → All components re-render with new data
```

---

## 8. How to Make Common Changes

### Add a new chart to the Dashboard

1. Open `src/components/Tabs.jsx`
2. Find `export function Dashboard()`
3. Import the chart type from recharts at the top
4. Add your chart JSX inside the return

```jsx
// Example: add a simple bar chart
import { BarChart, Bar, XAxis, YAxis } from 'recharts'

// Inside Dashboard return:
<div className="card" style={{ padding: 24 }}>
  <h3 className="section-heading">My New Chart</h3>
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={myData}>
      <XAxis dataKey="name" />
      <YAxis />
      <Bar dataKey="value" fill="#c8953a" />
    </BarChart>
  </ResponsiveContainer>
</div>
```

### Add a new asset category

Open `src/utils/constants.js` → add to `ASSET_CATS` array:

```js
export const ASSET_CATS = [
  'Cash & Equivalents',
  'Fixed Deposits',
  // ... existing categories
  'My New Category',   // ← add here
]
```

### Change a colour

Open `src/styles/global.css`. The main tokens are at the top:

```css
/* Key colours used everywhere */
--gold:    #c8953a   /* gold accent */
--green:   #3ecf8e   /* positive / assets */
--red:     #f06a6a   /* negative / liabilities */
--blue:    #5b8ff9   /* info */
--bg:      #06070a   /* page background */
--card:    #0d1117   /* card background */
```

### Add a new tab/page

1. Add to `TABS` array in `src/utils/constants.js`
2. Create `export function MyNewTab()` in `Tabs.jsx`
3. Add to `TAB_COMPONENTS` object in `App.jsx`

---

## 9. Using Cursor AI to Develop Faster

In Cursor, press **Cmd+K** (Mac) or **Ctrl+K** (Windows) to open the AI command bar. Some useful prompts:

```
"Add a line chart showing savings rate over the last 6 months to the Cash Flow tab"

"Add a new liability category called 'BNPL Debt' to the constants file"

"Create a new component called GoalTracker that lets users set a savings goal and tracks progress"

"Refactor the Dashboard to show a summary card with FI number and years to FI"

"Add dark/light theme toggle to the Settings tab"
```

Cursor reads your whole codebase, so it understands the existing patterns, style system, and data structure.

---

## 10. Git Workflow — Save & Deploy Changes

```bash
# See what you changed
git status

# Stage all changes
git add .

# Commit with a message
git commit -m "feat: add goal tracker component"

# Push to GitHub
git push

# Deploy to wealthradar.web.app
npm run deploy
```

### Branch workflow (for bigger features)

```bash
# Create a new branch
git checkout -b feature/goal-tracker

# ... make your changes ...

# Push the branch
git push -u origin feature/goal-tracker

# Merge back to main when ready
git checkout main
git merge feature/goal-tracker
git push
npm run deploy
```

---

## 11. Debugging Tips

### App not updating after code change?
The dev server hot-reloads automatically. If it doesn't: stop with `Ctrl+C` → `npm run dev` again.

### Data looks wrong / stale?
Open browser DevTools → Application → Local Storage → delete `wr_data_*` keys → refresh.

### Build failing?
```bash
# Check for errors
npm run build

# Most common fixes:
rm -rf node_modules package-lock.json
npm install
npm run build
```

### See what's in localStorage
Open browser DevTools (`F12`) → Application tab → Local Storage → `localhost:3000`.
You'll see keys like `wr_users`, `wr_data_xxx`, `wr_session`.

---

## 12. Useful npm Scripts

```bash
npm run dev        # Start local dev server (hot reload)
npm run build      # Build for production → dist/
npm run preview    # Preview the production build locally
npm run deploy     # Build + deploy to Firebase
```

---

Happy building! 🚀 The project is intentionally kept in a single `Tabs.jsx` file
so Cursor AI can read the full context in one go. As it grows, split tabs into
separate files in `src/pages/`.
