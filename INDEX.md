# Fibonacci Wealth Calculator — Project Index

## Overview
Property wealth trajectory calculator using Fibonacci stage progression. Deployed on Netlify (calculator) + GitHub Pages (static mirror). Lead capture forwards to Google Sheets + WordPress.

**Live:** https://hwi-wealth-calculator.netlify.app

## Architecture

```
Browser (index.html)
  ├── UI: form inputs, Chart.js visualisation, stage pills
  ├── POST /.netlify/functions/simulate  → returns yearData + KPIs
  └── POST /.netlify/functions/submit-lead → proxies to Google Sheets + WP
```

All proprietary logic (simulation engine, tax calculations, Fibonacci multipliers, stage thresholds) is server-side in Netlify Functions. Client source contains only UI wiring.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Single-page app — form, chart, results display. No proprietary logic. |
| `logo.png` | HWI brand mark |
| `netlify.toml` | Build config, function routing, redirect rules (blocks `/netlify/functions/*`), CORS headers |
| `netlify/functions/simulate.js` | **Proprietary engine** — `simulateStream()`, `getStage()`, `getTaxOnIncome()`, FIB_MULTIPLIERS, dual-stream merge. CORS-locked to allowed origins. |
| `netlify/functions/submit-lead.js` | Lead proxy — forwards email capture to Google Sheets (env: `GOOGLE_SHEETS_WEBHOOK`) and WordPress (env: `WP_LEAD_ENDPOINT`). CORS-locked. |
| `.github/workflows/gh-pages.yml` | Deploys only `index.html` + `logo.png` to GitHub Pages (no function source) |
| `.gitignore` | Excludes `.netlify/` local build artefacts |

## Environment Variables (Netlify Dashboard)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_SHEETS_WEBHOOK` | Google Apps Script URL for lead spreadsheet |
| `WP_LEAD_ENDPOINT` | WordPress REST endpoint (`hwi/v1/lead`) |
| `ALLOWED_ORIGINS` | (hardcoded in function source — not env var) |

## Security Hardening (completed 5 Mar 2026)

### What's Protected
- **Proprietary logic** — All calculations server-side (Netlify Functions)
- **Secrets** — Webhook URLs in env vars, not source
- **Source files** — Redirect rule blocks direct access to `/netlify/functions/*`
- **CORS** — Strict origin whitelist in function code (overrides netlify.toml wildcard)
- **GitHub Pages** — Only `index.html` + `logo.png` deployed via Actions workflow
- **Anti-inspection** — Copyright comment, right-click guard, selection guard, console warning

### Security Audit Results (5 Mar 2026)
- Source Recon: **PASS** — no secrets or formulas in client source
- Endpoint Exposure: **WARN** — 2 Netlify function URLs visible (expected, CORS-locked)
- File Probing: **PASS** — all 40 sensitive paths return 404
- CORS Audit: **PASS** — strict origin whitelist, evil/null origins rejected
- API Abuse: **WARN** — no input validation (accepts any payload, returns zeros for bad input)
- Cache/History: **WARN** — Google Apps Script URL in git commit `8176a1e` (removed in `d192c03`)
- Dependency Scan: **WARN** — Chart.js 3.9.1 (maintenance mode, no critical CVEs)

### Remaining Hardening (not urgent)
1. Add input validation to `/simulate` — reject non-numeric, cap ranges
2. Add rate limiting / CAPTCHA to `/submit-lead` — prevent spam
3. Scrub Google Apps Script URL from git history before making repo public (or keep private)
4. Update `publish = "."` to `publish = "public"` with static assets in `/public/` (belt-and-braces)
5. Consider Chart.js 4.x upgrade (breaking changes — test first)

## Commit History (security-relevant)

| Hash | What |
|------|------|
| `0e0601e` | GitHub Pages deploys only static files via Actions |
| `f9bbbfd` | Move static assets to docs/ — isolate function source |
| `34adfd9` | Block direct access to function source files |
| `d192c03` | Move proprietary engine + lead endpoints to Netlify Functions |
| `c337d43` | Add IP protection friction layer |
