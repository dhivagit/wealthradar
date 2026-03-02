# 📡 WealthRadar — Personal Finance Command Centre

> Track assets, liabilities, cash flow, and net worth — with beautiful charts,
> Google SSO, INR-first multi-currency, full PWA mobile support,
> hosted at **wealthradar.web.app** on Firebase.

![WealthRadar](https://img.shields.io/badge/WealthRadar-v1.0-gold)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)
![PWA](https://img.shields.io/badge/PWA-Ready-green)
![Firebase](https://img.shields.io/badge/Firebase-Hosting-orange)

---

## ✨ Features

| Feature           | Details                                              |
|-------------------|------------------------------------------------------|
| 🔐 Auth           | Email/password + Google SSO                          |
| 📊 Dashboard      | Net worth trend, allocation charts, cash flow        |
| △  Assets         | Holdings by category with allocation %               |
| ▽  Liabilities    | Debts with interest rates                            |
| ⇄  Cash Flow      | Income & expenses with savings rate                  |
| ◈  Analytics      | FI number, health metrics, debt analysis             |
| ◉  Net Worth      | Milestones, FI progress, 4% rule                     |
| 💱 Multi-Currency | INR default + USD, EUR, GBP, JPY, AED & more         |
| 📤 Export         | JSON backup, CSV, Print/PDF, Snapshots               |
| 📱 PWA            | Install on mobile — works offline                    |
| 🔒 Privacy        | All data in browser localStorage — no servers        |

---

## 🚀 Local Development

```bash
npm install
cp .env.example .env.local     # add your Google Client ID
npm run dev                    # → http://localhost:3000
```

---

## 🔥 Deploy to Firebase

```bash
npm install -g firebase-tools  # install Firebase CLI (once)
firebase login                 # sign in with your Google account
firebase use wealthradar       # link to your Firebase project
npm run deploy                 # build + deploy in one command
```

Live at → **https://wealthradar.web.app** 🎉

---

## 🔵 Google SSO Setup

1. Go to **https://console.cloud.google.com** → New Project `WealthRadar`
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Authorised JavaScript origins:
   ```
   http://localhost:3000
   https://wealthradar.web.app
   https://wealthradar.firebaseapp.com
   ```
4. Copy Client ID → add to `.env.local`:
   ```
   VITE_GOOGLE_CLIENT_ID=your_client_id_here
   ```

---

## 📱 Install on Mobile (PWA)

**Android (Chrome):** Menu ⋮ → "Install app"

**iPhone (Safari):** Share button ⎙ → "Add to Home Screen"

---

## 🏗 Project Structure

```
wealthradar/
├── public/
│   ├── favicon.svg            # SVG favicon (radar design)
│   ├── favicon-32.png         # PNG favicon
│   ├── icon-192.png           # Android PWA icon
│   ├── icon-512.png           # Splash screen icon
│   ├── apple-touch-icon.png   # iOS home screen icon
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker (offline)
├── src/
│   ├── components/
│   │   ├── AuthScreen.jsx     # Login + Google SSO
│   │   ├── EntryModal.jsx     # Add/edit form
│   │   ├── Tabs.jsx           # All 7 page components
│   │   └── UI.jsx             # Shared UI primitives
│   ├── context/
│   │   ├── AuthContext.jsx    # Auth state + Google SSO
│   │   └── FinanceContext.jsx # Finance data & CRUD
│   ├── hooks/
│   │   └── useTotals.js       # Financial calculations
│   ├── utils/
│   │   ├── constants.js       # Currencies, categories
│   │   └── helpers.js         # Formatting, storage, export
│   ├── styles/
│   │   └── global.css         # Full design system
│   ├── App.jsx                # Root layout + sidebar
│   └── main.jsx               # Entry point
├── .env.example               # Environment template
├── firebase.json              # Firebase hosting config
├── .firebaserc                # Firebase project: wealthradar
├── vercel.json                # Vercel config (alternative host)
├── vite.config.js
└── package.json
```

---

## 🔄 Updating the App

```bash
# Make your code changes, then:
git add .
git commit -m "feat: your change description"
git push          # updates GitHub
npm run deploy    # updates wealthradar.web.app
```

---

## 📄 License

MIT — free to use, fork, and deploy.

---

Built with ❤️ · React 18 · Vite 5 · Recharts · Firebase Hosting
