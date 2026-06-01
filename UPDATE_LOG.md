# IDCS Update Log - Phase 1.5

---

## Prophet Fine-Tuning (Steps 1–3, 5–8) + Login Fix — 2026-06-02

### `engine.py` — Prophet Engine Overhaul

| Step | Change | Benefit |
|---|---|---|
| 1 | `yearly_seasonality = n >= 24` | Prevents overfitting on short histories (< 2 years). Avoids confidently predicting a pattern seen only once. |
| 1 | `seasonality_mode = 'multiplicative'` | Seasonality now scales proportionally with income level — correct for gig workers whose income varies widely. |
| 2 | `changepoint_prior_scale = 0.15` (was default 0.05) | More flexible trend detection. Captures real structural breaks: new job, rainy season, election downturn. |
| 3 | `interval_width = 0.80` (explicit) | 80% confidence bands are now intentional, not accidental. Honest uncertainty in the forecast UI. |
| 5 | `_kenyan_holidays()` injected into Prophet | Model learns how Kenyan holidays (Madaraka, Jamhuri, Christmas) and school-fee months (Jan/May/Sep) shift gig worker income. Reduces holiday-period forecast error. |
| 6 | `sector_dip` passed as external regressor | If the broader sector is dipping, Prophet now factors that into its 6-month projection. Sector corroboration flows from `/evaluate` all the way into the forecast. |
| 7 | `validate_forecast(df_monthly)` method added | Runs Prophet's built-in cross-validation. Returns MAE, MAPE, RMSE, coverage — real accuracy numbers per horizon window. |
| 8 | `tune_hyperparameters(df_monthly)` method added | 12-combination grid search over `changepoint_prior_scale` × `seasonality_prior_scale`. Returns best params ranked by MAPE. Run this as data accumulates to continuously improve the model. |

### `main.py` — New Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /forecast/validate` | User JWT | Runs cross-validation on income history. Returns accuracy metrics (Step 7). |
| `POST /forecast/tune` | Admin only | Runs hyperparameter grid search. Returns best Prophet config (Step 8). Slow (~30–60s). |

Also: `sector_dip` now correctly passed from `req.sector_dip` into `predict_risk_horizon()`.

### `run.py` — Critical Login Fix

- **Bug:** `run.py` used `sys.executable` to launch uvicorn — when run without activating the venv first, this resolves to the system Python which has no FastAPI installed. Result: backend crashes silently, frontend shows "Network error".
- **Fix:** Hardcoded `VENV_PYTHON = os.path.join(os.path.dirname(__file__), "env", "bin", "python")`. Backend now always launches with the correct venv interpreter regardless of shell state.
- **Result:** `python3 run.py` works correctly from any terminal without requiring `source env/bin/activate` first.

---

## Prophet AI Forecasting — Wired & Live — 2026-06-01

### Problem
`predict_risk_horizon()` in `engine.py` was fully implemented but **completely dead** — never called by any endpoint. The system had no forward-looking forecasting whatsoever. `calculate_metrics()` only reported historical dip frequency.

### What Was Built

**`engine.py`**
- Added `prepare_monthly_df(income_history)` helper method
  - Strips non-revenue inflows (Loans, Chamas, P2P) before constructing the Prophet input
  - Assigns synthetic calendar months (item `n-1` = this month, `n-2` = last month, etc.)
  - Returns a `DataFrame` with `month` (YYYY-MM) and `Total Income` columns

**`main.py` — `/evaluate` endpoint**
- After `calculate_metrics()`, calls `engine.prepare_monthly_df()` + `engine.predict_risk_horizon()`
- Wrapped in `try/except` — Prophet failure **never blocks** evaluation
- Returns `prophet_risk_score` merged into the `evaluation` dict
- Returns `forecast` (6-month array) as a top-level key alongside `income_history`

**`frontend/src/App.jsx`**
- Added `forecast` state (`useState([])`)
- `handleSync` now captures `d.forecast` from the evaluate response
- Added **"🔮 6-Month Income Forecast"** card in the dashboard (above AI Copilot):
  - 3-column grid of month tiles
  - High-risk months: red border + red text + `⚠ High Risk — Dip Likely` label
  - Safe months: subtle green + `✓ Stable` label
  - Each tile shows predicted income + confidence floor (yhat_lower)
  - Prophet Risk Score bar at the bottom: green / amber / red + contextual message

### Architecture Note
Prophet handles **seasonality and trend** (6-month horizon premium pricing).
Velocity scoring handles **real-time transaction adjudication**.
The two systems are complementary, not competing.

---

## Phase 1 Bug Fixes — 2026-06-01

### Fix 1 — AI Copilot Chat UI (`frontend/src/App.jsx`)
- **Problem:** The `/chat` backend endpoint was fully built but had zero frontend UI — it was completely unreachable from the dashboard.
- **Fix:** Added a messenger-style **IDCS AI Copilot** card to the dashboard scroll area (between Claims and Plans sections).
  - Chat history rendered as speech bubbles (user = green right, assistant = dark left)
  - Auto-scrolls to the latest message via `useRef` + `useEffect`
  - `Enter` key sends the message; spinner shown during API call
  - Graceful fallback messages on API/network errors
- **Imports added:** `useRef` (React), `MessageSquare`, `Send` (lucide-react)

### Fix 2 — Missing CSS Badge Classes (`frontend/src/index.css`)
- **Problem:** `App.jsx` used `.badge-warning` (audit flags) and `.badge-secondary` (level/info labels) but neither class was defined — both rendered completely unstyled.
- **Fix:** Added both classes to the design system:
  - `.badge-warning` — amber background (`rgba(245,166,35,0.12)`) with `--warning` text
  - `.badge-secondary` — muted background with `--border-color` outline

### Fix 3 — Daraja Webhook JWT Auth (`main.py`)
- **Problem:** `POST /webhook/daraja` used `Depends(get_current_user)` (JWT). A real Safaricom Daraja push would never send a user's Bearer token — making the webhook non-functional in any real integration.
- **Fix:** Replaced JWT dependency with:
  - **Shared secret** via `X-Webhook-Secret` HTTP header, read from `DARAJA_WEBHOOK_SECRET` env var (no-op in dev if env var not set)
  - **Phone-based user lookup** — `user_phone` field added to `WebhookPayload`; the user is resolved via `User.phone` column
  - `Header` added to FastAPI imports

---

# IDCS Update Log - Phase 1.5

## Frontend (`frontend/src/App.jsx`)
- **Fixed render crash:** Moved the `SettingsPanel` component declaration outside of the main `App` component function to prevent React from recreating it on every render, which was breaking hook rules.
- **Implemented Settings Panel:** Added a slide-in panel triggered by the gear icon. The panel includes three tabs:
    - **Account:** Allows updating Name, Phone, Sector, County, and Employment Type.
    - **Coverage:** Allows updating Max Coverage Cap and Deferred Period.
    - **Trust Squad:** Informational UI for the peer risk pool feature (to be wired in Phase 2). It allows users to request to join or create a new squad.
- **Wired Settings to Backend:** The Settings panel now pre-fills its data by calling `GET /api/auth/me` when opened. Saving the settings fires a `PATCH /api/user/settings` request to persist the changes.

## Backend (`main.py`)
- **Added `PATCH /user/settings`:** Created a new endpoint to handle user profile and coverage updates.
    - Fields that can be updated: `name`, `phone`, `sector`, `county`, `employment_type`, `src_cap`, `deferred_period`.
    - Automatically updates the `coverage_limit` on the user's active `Policy` if the `src_cap` is changed.

---

## Settings Panel Fix (`frontend/src/App.jsx`) — 2026-05-31

- **Root cause identified:** The `SettingsPanel` was defined as a `const` arrow function *inside* the `App` component body, causing React to treat it as a new component type on every re-render — a violation of the Rules of Hooks that crashes the app on login.
- **Fix:** Promoted `SettingsPanel` to a top-level `function` component above `App`, receiving all required state as props (`settingsTab`, `settingsData`, `saveSettings`, `squadMsg`, etc.).
- **Removed:** Purged the leftover broken inline `const SettingsPanel` declaration that remained after the initial refactor attempt.
- **Result:** Braces/parens balance confirmed `0/0`. Two and only two `SettingsPanel` references remain — the definition and the single JSX usage.
- **Backend confirmed:** `PATCH /user/settings` persists changes correctly. `GET /auth/me` reflects updates immediately.

---

## Silent Login Crash Fix (`frontend/src/App.jsx`) — 2026-05-31

- **Bug:** After login or registration, the dashboard appeared completely unresponsive (blank/no transition).
- **Root cause:** `selectedPlan` and `setSelectedPlan` were referenced 6 times in the pricing section JSX but were never declared as a `useState` hook — dropped during a prior refactor. This caused an immediate `ReferenceError` the moment the dashboard component tried to render post-login.
- **Fix:** Re-added `const [selectedPlan, setSelectedPlan] = useState(null)` to the state block.
- **Audit:** Ran a full state declaration audit — all 20 state variables now confirmed declared and accounted for (zero missing).


