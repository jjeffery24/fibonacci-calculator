# Fibonacci Wealth Calculator — Project Index

## Overview
Property wealth trajectory calculator using Fibonacci stage progression, now fronted by an SMSF property structure test for the Structure Beats Prediction book funnel. Deployed on Cloudflare Pages.

**Live:** https://hwi-wealth-calculator.pages.dev

## Architecture

```
Browser (index.html)
  ├── UI: form inputs, Chart.js visualisation, stage pills
  ├── Structure Test → ungated result
  ├── Email unlock → POST /api/submit-lead
  ├── POST /api/simulate → returns yearData + KPIs
  └── Lead capture → Listmonk primary, Google Sheets fallback
```

All proprietary simulation logic is server-side in Cloudflare Pages Functions. Client source contains UI wiring and the public lightweight structure-test triage.

## Files

| File | Purpose |
|------|---------|
| `public/index.html` | Cloudflare Pages frontend: structure test, email unlock, projection UI, chart, results display. |
| `public/logo.png` | HWI brand mark |
| `wrangler.toml` | Cloudflare Pages project config and non-secret vars |
| `functions/api/simulate.js` | **Proprietary engine** — `simulateStream()`, `getStage()`, `getTaxOnIncome()`, stage thresholds, D296 support. CORS-locked to allowed origins. |
| `functions/api/submit-lead.js` | Lead proxy — forwards email capture to Listmonk primary and Google Sheets fallback. CORS-locked. |
| `.gitignore` | Excludes `.netlify/` local build artefacts |

## Environment Variables / Secrets (Cloudflare Pages)

| Variable | Purpose |
|----------|---------|
| `LISTMONK_BASE_URL` | Public Listmonk base URL, currently `https://list.healthywealthyinvestor.com.au` |
| `LISTMONK_LIST_IDS` | Primary lead list IDs, currently `24` |
| `LISTMONK_API_USER` | Secret: Listmonk API user |
| `LISTMONK_API_TOKEN` | Secret: Listmonk API token |
| `GOOGLE_SHEETS_WEBHOOK` | Secret fallback only: Google Apps Script URL for lead spreadsheet |
| `ALLOWED_ORIGINS` | (hardcoded in function source — not env var) |

Primary lead storage:

- Listmonk list ID `24`: `HWI Structure Test - Wealth Path Calculator`

Deployment note:

- Cloudflare OAuth was refreshed via Wrangler on 4 May 2026.
- Production secrets uploaded: `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`.
- `GOOGLE_SHEETS_WEBHOOK` was not present in the local env, so the fallback is not currently uploaded.
- Latest Pages deployment: `https://8e4b820f.hwi-wealth-calculator.pages.dev`, promoted to `https://hwi-wealth-calculator.pages.dev`.

## Security Hardening (completed 5 Mar 2026)

### What's Protected
- **Proprietary logic** — All calculations server-side in Cloudflare Pages Functions
- **Secrets** — Listmonk credentials in Cloudflare Pages secrets, not source
- **Lead capture** — Listmonk is primary; Google Sheets is fallback only if configured
- **CORS** — Strict origin whitelist in function code
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
