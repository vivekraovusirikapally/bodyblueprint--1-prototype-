# BodyBlueprint - HealthHub Hack

A personal health dashboard built as a **3-tier app**: a React front end, an Express REST API and a SQLite database.
It calculates BMI and BMR, tracks water and sleep, and combines them into a daily wellness score with advice.

> Educational wellness information only, not medical advice.

## Features
- BMI + BMR (Mifflin-St Jeor) with a WHO gauge, healthy-weight range and a metric/imperial toggle
- Water logger (+250 / +500 / custom amount / undo) with a fill animation
- Sleep logger (bedtime, wake time incl. past-midnight sleep, 1-5 star rating)
- Wellness score: BMI 30%, hydration 35%, sleep 35%
- Rule-based advice cards
- Calorie target (cut / maintain / bulk) with **activity level**, macro starting point and a safe-minimum floor
- **Weekly insights**: logging streak, hydration streak, 7-day averages, weight change
- 7-day Chart.js trend chart with an accessible data table
- **CSV export**, **dark mode**, keyboard-accessible tabs, skip link, ARIA labels
- Local-first: works offline from `localStorage`; mirrors to the SQLite API automatically when the server is running

## Quick start
Requires **Node 22.13+** (the API uses Node's built-in `node:sqlite`, so nothing native to compile).

```bash
npm install
npm run dev:all        # React on http://localhost:5173 + API on http://127.0.0.1:3001
```
Run them separately with `npm run dev` and `npm run server`. Without the server the app simply shows
"Offline: saved on this device". Copy `.env.example` to `.env` to configure ports, DB path, API key and CORS.

## Scripts
| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `preview` | Vite dev server / production build (adds a strict CSP) / preview |
| `npm run server` | Start the Express + SQLite API |
| `npm test` | Vitest: shared logic, formulas, storage and React component tests |
| `npm run test:server` | `node --test` for the API (repository, service, security, HTTP) |
| `npm run test:coverage` | Vitest with coverage report |
| `npm run lint` / `format` | ESLint / Prettier |

CI (`.github/workflows/ci.yml`) runs lint, tests, server tests and the build on every push.

## How the score works
Each metric becomes a 0-100 sub-score by how far it is from its target:
- BMI: 100 inside 18.5-24.9, loses 10 points per BMI unit outside
- Water: intake / goal, where goal = 35 ml x body weight (rounded to 50 ml)
- Sleep: 100 for 7-9 hours, scaled down below 7, 15 points per hour above 9

`score = 0.30*bmi + 0.35*water + 0.35*sleep`

## Demo script
Height 175 cm, weight 72 kg. Log 2000 ml of water and save 7.5 hours of sleep.
The ring lands at **93** with "Hydration and sleep targets met!" (this exact case is a unit test).

## Architecture (3 tiers)
```
React UI (src/)  --fetch /api-->  Express (backend/src/app.js)  -->  service.js  -->  repository.js  -->  SQLite
      |                                   security.js: headers, rate limit, CORS allow-list, optional API key
   localStorage (validated on load)       shared/: constants + validation used by BOTH tiers
```
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the API reference, data model and design decisions.

## Testing
- `shared/*.test.js`, `src/lib/__tests__/` - formulas (boundaries, midnight sleep, invalid input), validation, storage
  recovery/migration, insights, CSV export
- `src/components/__tests__/` - React Testing Library: forms, error messages, error boundary, tabs
- `backend/test/` - SQL injection safety, CHECK constraints, atomic imports, validation, rate limiting, API key,
  CORS and end-to-end HTTP tests

## Security
- One allow-list validator (`shared/validation.js`) used by forms, the `localStorage` loader and the API
- Saved data is re-validated on load, so tampered or corrupted values cannot crash or inject content
- React escapes output; CSV cells neutralise spreadsheet formulas; production builds ship a strict CSP
- API: parameterised SQL only, DB `CHECK` constraints, 100 kb body limit, security headers, rate limiting,
  CORS allow-list (default none), optional `X-API-Key`, no stack traces in errors, binds to localhost by default

## Requirements traceability
| Requirement | Code | Tests |
| --- | --- | --- |
| BMI / BMR (Mifflin-St Jeor), WHO bands | `src/lib/health.js`, `Calculator.jsx` | `health.test.js` |
| Metric / imperial | `shared/units.js`, `Calculator.jsx` | `validation.test.js`, `forms.test.jsx` |
| Water tracker + goal | `WaterLogger.jsx`, `waterGoal` | `health.test.js`, `forms.test.jsx` |
| Sleep tracker (midnight) | `SleepLogger.jsx`, `shared/time.js` | `time.test.js`, `health.test.js` |
| Wellness score 30/35/35 | `wellnessScore` | `health.test.js` |
| Advice engine | `buildAdvice` | `health.test.js` |
| Trends | `Trends.jsx`, `insights.js` | `insights.test.js` |
| Node/Express + SQLite tier | `backend/src/*` | `backend/test/*` |

## Project layout
```
shared/            constants, units, time helpers, validation (used by UI and API)
src/lib/           formulas, insights, storage, export, API client, seed data
src/context/       shared state, localStorage + optional server sync
src/components/    UI pieces (+ __tests__)
backend/src/       app (Express), service, repository, db, security, server
backend/test/      node:test suites
docs/              architecture + API reference
```

## Disclaimer
Educational wellness info only, not medical advice. Please talk to a doctor about any health concerns.
