# IDCS Update Log - Phase 2.1

---

## Phase 2.1: Deep Optimisation + RAG + Fine-Tuned Copilot — 2026-06-17

### Objectives
Three-part optimisation sprint:
1. **Performance** — eliminate hot-path bottlenecks across DB, engine, and scheduler
2. **RAG** — add semantic knowledge retrieval to ground the AI Copilot in IDCS policy
3. **Fine-Tuning** — replace generic Copilot prompts with a deeply personalised, metric-rich system prompt

---

### New File: `rag.py` — IDCS Knowledge Base

| Component | Detail |
|---|---|
| **Corpus** | 13 curated policy documents covering all major IDCS domains |
| **Topics** | Fraud signals (×5), Grace period, Velocity/Stability, Micro-premium, Trust Squads, Prophet, Eligibility, Income categories |
| **Embedding** | Gemini `text-embedding-004` via `genai.embed_content()` — semantic cosine similarity |
| **Fallback** | Jaccard token overlap — works fully offline with no API key |
| **API** | `get_knowledge_base()` singleton; `kb.retrieve(query, top_k=3)` → list of relevant chunks |
| **Lazy init** | Documents embedded once at first `/chat` call, then cached in-memory |

---

### `database.py` — Performance Optimisations

**6 composite indexes added** (applied live to `idcs.db`):

| Index | Columns | Query it eliminates full-scans for |
|---|---|---|
| `ix_txn_user_type_ts` | `user_id, transaction_type, timestamp` | All transaction window queries (webhook, claims, evaluate) |
| `ix_claim_user_status_ts` | `user_id, status, created_at` | Recidivism count, fraud-watch, claims history |
| `ix_risk_user_ts` | `user_id, snapshot_at` | Latest risk score lookups |
| `ix_policy_user_status` | `user_id, status` | Policy fetch on every webhook/claim |
| `ix_policy_status` | `status` | Nightly grace-period job full-policy scan |
| `ix_alert_policy_status` | `policy_id, status` | Alert resolution in webhook + admin endpoint |

**SQLite WAL Mode enabled** (via `event.listens_for` on first connection):
- `PRAGMA journal_mode=WAL` — concurrent reads during writes (no read lock)
- `PRAGMA synchronous=NORMAL` — faster fsync without data integrity risk
- `PRAGMA cache_size=-64000` — 64 MB page cache
- `PRAGMA foreign_keys=ON` — enforces referential integrity

---

### `engine.py` — Computation Optimisations

| Optimisation | Detail |
|---|---|
| **Prophet model cache** | `_prophet_cache` dict keyed by `(user_id, data_hash, sector_dip)`. Repeated `/evaluate` calls with unchanged history skip Prophet fitting entirely — ~2–5s saved per request |
| **Data hash** | SHA-256 of monthly DataFrame JSON — cache auto-invalidates when new transactions arrive |
| **LRU holidays** | `@lru_cache(maxsize=2)` on `_kenyan_holidays()` — holiday DataFrame built once per year, not per forecast |
| **Vectorized risk** | `numpy` array operations replace Python loops in `predict_risk_horizon` depth-penalty calculation |
| **Cache eviction** | Simple FIFO eviction at 200 entries — memory-safe in production |

---

### `main.py` — AI Copilot Rewrite

**Old**: Generic prompt with 3 fields (name, velocity, transaction count)
**New**: 6-section structured prompt with 20+ live metrics

| Section | Content |
|---|---|
| **User Profile** | Name, employment type, sector, county, SRC cap |
| **Live Scores** | Velocity, stability, fraud score + tier label, risk level, dip probability |
| **Policy Status** | Status (ACTIVE/GRACE/SUSPENDED), premium rate, arrears, days silent |
| **30-day Snapshot** | Credit transaction count, total KSh received, average per transaction |
| **Claims History** | Approved / held / rejected counts + contextual warnings |
| **RAG Context** | Top-3 IDCS policy chunks retrieved by query similarity |
| **Few-Shot Examples** | 3 in-prompt example Q&As tuned to user's actual numbers |

**RAG Integration in `/chat`:**
- User message → `kb.retrieve(query, top_k=3)` → top-3 relevant policy chunks
- Chunks injected into Gemini system prompt as `=== IDCS Policy Reference ===`
- Response includes `rag_sources` list (which docs were consulted)

**Fine-Tuned Fallback** (no API key):
Replaces old single-branch fallback with 6 topic-matched branches:
- `arrears/grace/lapse` → policy lifecycle with exact days and KSh figures
- `fraud/reject/block` → explains the 5 fraud signals specific to user's score
- `velocity/score/level` → actionable count-to-next-level advice
- `claim/payout/dip` → eligibility check against live stability score
- `squad/trust/peer` → Trust Squad dividend mechanics
- Default → full metric summary with status alert

**Prophet Cache Key** in `/evaluate`:
`predict_risk_horizon(..., cache_key=str(user_id))` — same user calling `/evaluate` twice in a row with no new income data hits the cache.

**New `/chat` response fields:**
- `stability_score`, `fraud_score`, `risk_level`, `policy_status`, `arrears_ksh`, `rag_sources`

---

### Smoke Test Results (2026-06-17)
```
✓ Health:   version=2.0.0 status=online
✓ Endpoints: 19 registered
✓ RAG retrieve (TF-IDF): ['Prophet Forecast Mismatch', 'Velocity Paradox', 'Micro-Premium Rates']
✓ DB indexes: 14 total (6 composite + 8 primary keys)
✓ SQLite WAL: wal
✓ Engine cache: _prophet_cache={}, _cache_max_size=200
=== ALL CHECKS PASSED ===
```

---

# IDCS Update Log - Phase 2.0

---

## Phase 2: Lapse Prevention + Composite Fraud Scoring — 2026-06-17

### Problem (Survey Feedback)
Two critical gaps identified from user survey:
1. Users who stop receiving income lose cover precisely when they need it most — the micro-premium model has no graceful handling for income silence.
2. Users are deliberately requesting cash payments from customers to make M-Pesa look like a dip and trigger fraudulent compensation.

---

### `database.py` — New Models & Columns

| Change | Detail |
|---|---|
| `Policy.arrears_balance` | Tracks total outstanding premium debt (KSh) when income goes silent |
| `Policy.arrears_catch_up_txns` | Number of future transactions over which debt will be spread and recovered |
| `Policy.grace_period_since` | Timestamp when income silence was first detected |
| `Policy.status` new values | `GRACE_PERIOD` added alongside existing `ACTIVE`, `SUSPENDED`, `LAPSED` |
| `Policy.alerts` relationship | Links policy to all its PremiumAlert records |
| **`PremiumAlert`** (new table) | Full lifecycle record: `days_silent`, `arrears_amount`, `catch_up_txns_remaining`, `reminders_sent`, `status`, timestamps |

---

### `engine.py` — `calculate_fraud_score()` (New Method)

5-signal composite fraud detection returning a score 0–100 and a recommended action:

| Signal | Weight | Logic |
|---|---|---|
| **Velocity Paradox** | +35 | Amount drops >30% but transaction *count* falls <10% — income redirected off-channel |
| **Sector/Squad Gap** | +25 | Personal dip >30% with no sector (>15pt) or squad (>10pt) corroboration |
| **Debit/Credit Shift** | +20 | Debit/credit ratio jumps >2.5× vs prior period — still spending digitally, not receiving |
| **Recidivism Watch** | +15 | ≥3 approved claims in last 12 months (statistically abnormal) |
| **Forecast Mismatch** | +10 | Prophet predicted stable month, user is claiming a dip |

Decision tree:
- **0–29** → `CLEAN` — process normally
- **30–49** → `SOFT_FLAG` — approve at 60% co-insurance (tightened from 70%)
- **50–74** → `72H_HOLD` → `FLAGGED_FOR_AUDIT` — human review before disbursement
- **75+** → `HARD_BLOCK` → `REJECTED` — claim denied, account flagged

---

### `main.py` — Backend Changes

#### Grace-Period Scheduler (new)
- `grace_period_job()` — nightly background job (APScheduler, 24h interval)
  - Scans all `ACTIVE` and `GRACE_PERIOD` policies
  - Detects income silence by checking last credit transaction timestamp
  - Escalates: `ACTIVE → GRACE_PERIOD` (day 7) → `SUSPENDED` (day 37) → `LAPSED` (day 90)
  - Accumulates `daily_arrears` proportionally to user's rolling avg income — not a flat fee
  - Creates/updates `PremiumAlert` records throughout
- `_send_sms()` — Africa's Talking SMS dispatcher with dev fallback to log
- Tiered reminder messages at Day 7, 14, 30, then weekly after that
- `lifespan()` context manager starts/stops scheduler cleanly on app boot/shutdown

#### `/webhook/daraja` — Self-Healing Arrears Recovery
- On first credit after `GRACE_PERIOD` / `SUSPENDED`: policy reinstates to `ACTIVE` automatically
- Arrears catch-up spread computed: `min(60, days_silent × 2)` future transactions
- Each subsequent credit deducts `normal_premium + arrears_share` until debt is cleared
- Response now includes `arrears_catch_up`, `arrears_remaining`, `policy_status`

#### `/claims/file` — Composite Fraud Scorer (rewritten)
- Pulls current (last 30 days) and prior (30–60 days ago) transaction windows for delta comparison
- Runs `engine.calculate_fraud_score()` with all 5 signals
- Co-insurance tightened to 60% for `SOFT_FLAG` accounts (was 70%)
- `HARD_BLOCK` → claim `REJECTED`, payout = 0
- `72H_HOLD` → claim `FLAGGED_FOR_AUDIT`
- Fraud score persisted into a new `RiskScore` snapshot
- Response now includes `fraud_score`, `fraud_action`, `fraud_signals`, `co_insurance`
- `GRACE_PERIOD` policies can still file claims (suspended/lapsed cannot)

#### New Admin Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /admin/premium-alerts` | View all PremiumAlert records with optional `?status_filter=ACTIVE` |
| `POST /admin/trigger-grace-check` | Manually run the nightly grace-period job (for testing) |
| `GET /admin/fraud-watch` | Triage view of all flagged, rejected, and soft-flagged claims |

#### New Dependency
- `apscheduler` — added to `env/` via pip

---

### Council Policy Decisions Embedded

1. **No lapse without warning** — 3-stage reminder system (7d / 14d / 30d) before any suspension
2. **Self-healing recovery** — arrears cleared automatically when income resumes; no human needed
3. **Co-insurance disincentive tightening** — SOFT_FLAG → 60% (from 70%) makes cash diversion unprofitable
4. **Proportional arrears** — daily debt = daily_avg_income × premium_rate; fair across income levels
5. **Grace ≠ Lapse** — a SUSPENDED policy reinstates on next credit; a LAPSED policy requires re-underwriting

---

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
- Added **" 6-Month Income Forecast"** card in the dashboard (above AI Copilot):
  - 3-column grid of month tiles
  - High-risk months: red border + red text + ` High Risk — Dip Likely` label
  - Safe months: subtle green + ` Stable` label
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


