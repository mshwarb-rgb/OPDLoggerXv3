# OPD LoggerX (v1.2)

Rebuilt from scratch.

## Features
- Date-based daily logging
- One-screen summary (no collapsibles)
- WW/Non-WW appears only when a surgical diagnosis is selected
- Export **Excel .xlsx** for the selected day (Raw Data + Summary formulas)
- Backup/restore JSON
- Single doctor per phone (Doctor name in Settings, included in export)

## Run locally
```bash
npm install
npm run dev
```

## Deploy on GitHub Pages (recommended)
1) Push to `main`
2) Repo → Settings → Pages → Source: **GitHub Actions**
3) Wait for Actions to finish ✅
4) Open the Pages URL
