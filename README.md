# IDCS — Income Deficiency Compensation System 🇰🇪

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue.svg" alt="Python 3.10+"/>
  <img src="https://img.shields.io/badge/Framework-Streamlit-FF4B4B.svg" alt="Streamlit"/>
  <img src="https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4.svg" alt="Gemini"/>
  <img src="https://img.shields.io/badge/Forecasting-Prophet-FF6F00.svg" alt="Prophet"/>
  <img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="Proprietary"/>
  <img src="https://img.shields.io/badge/Market-Nairobi%2C%20Kenya-006600.svg" alt="Nairobi"/>
</p>

> **A parametric, AI-driven insurance engine that predicts income dips for Kenyan gig workers — and automatically calculates what they should be compensated.**

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [What IDCS Does](#2-what-idcs-does)
3. [How It Works — System Architecture](#3-how-it-works--system-architecture)
4. [The Actuarial Engine — Deep Dive](#4-the-actuarial-engine--deep-dive)
5. [AI Vision Layer — Gemini OCR](#5-ai-vision-layer--gemini-ocr)
6. [Prophet Forecasting Pipeline](#6-prophet-forecasting-pipeline)
7. [Insurance Matching & Scheme Scoring](#7-insurance-matching--scheme-scoring)
8. [Fraud & Moral Hazard Controls](#8-fraud--moral-hazard-controls)
9. [Security Architecture](#9-security-architecture)
10. [Project Structure](#10-project-structure)
11. [Tech Stack](#11-tech-stack)
12. [Getting Started](#12-getting-started)
13. [Configuration & Secrets](#13-configuration--secrets)
14. [API Reference](#14-api-reference)
15. [Roadmap](#15-roadmap)

---

## 1. The Problem

Kenya's gig economy is large and growing. Ride-hailing drivers, freelance developers, Jua Kali artisans, market traders, and tutors all share one structural vulnerability: **income volatility**. A bad month — a market slowdown, a school holiday, a weather event — can wipe out cash flow entirely. Traditional insurance products ignore these workers because they lack payslips, employer records, or formal credit histories.

IDCS was built to close that gap.

---

## 2. What IDCS Does

IDCS is a **parametric insurance engine**. Rather than requiring a worker to prove loss after the fact (indemnity insurance), it uses AI and time-series forecasting to:

- **Profile** a worker's income using their M-Pesa or bank statement (uploaded as a PDF).
- **Forecast** their income for the next 6 months using Facebook Prophet, incorporating Kenyan public holidays and school-fee cycles.
- **Detect** whether the current month constitutes a qualifying income dip (income below 80% of the mean).
- **Calculate** a payout automatically — no claims adjustor, no paperwork.
- **Match** the worker to appropriate existing insurance products (Britam, Liberty, Jubilee, SHIF) based on their income profile.

The trigger is mathematical. If the parametric threshold is crossed, compensation is disbursed.

---

## 3. How It Works — System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User (Browser)                           │
│                    Streamlit Dashboard (app.py)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼────────────────────────────────────┐
│                  FastAPI Backend (main.py)                       │
│              REST API   ·   SQLite (idcs.db)                    │
│         Auth (JWT + Bcrypt)  ·  OTP Registration                │
└───────┬──────────────────────────┬──────────────────────────────┘
        │                          │
┌───────▼────────┐       ┌─────────▼──────────────────────────────┐
│  data_handler  │       │           engine.py (IDCS_Engine)       │
│  .py           │       │                                         │
│                │       │  ┌─────────────────────────────────┐   │
│  Gemini 2.5    │       │  │  calculate_metrics()            │   │
│  Flash (OCR)   │──────▶│  │  · μ (mean income)              │   │
│                │       │  │  · σ (std deviation)            │   │
│  pdfplumber    │       │  │  · Stability Score (S)          │   │
│  (text parse)  │       │  │  · Transaction Velocity         │   │
│                │       │  │  · Dip Detection                │   │
│  Pydantic      │       │  │  · Eligibility Gate             │   │
│  (validation)  │       │  │  · Payout Calculation           │   │
└────────────────┘       │  └─────────────────────────────────┘   │
                         │                                         │
                         │  ┌─────────────────────────────────┐   │
                         │  │  predict_risk_horizon()         │   │
                         │  │  · Prophet 6-month forecast     │   │
                         │  │  · Kenyan holiday regressors    │   │
                         │  │  · Sector dip regressor         │   │
                         │  │  · Deficiency Zone detection    │   │
                         │  └─────────────────────────────────┘   │
                         │                                         │
                         │  ┌─────────────────────────────────┐   │
                         │  │  validate_forecast() /          │   │
                         │  │  tune_hyperparameters()         │   │
                         │  │  · Cross-validation (MAE/MAPE)  │   │
                         │  │  · Grid search (cp × sp)        │   │
                         │  └─────────────────────────────────┘   │
                         └────────────────────────────────────────┘
```

---

## 4. The Actuarial Engine — Deep Dive

The core of IDCS lives in `engine.py`. The `calculate_metrics()` method is the underwriting brain.

### Step 1 — Transaction Metadata Isolation

Before any calculation, irregular inflows are stripped out. Loans, Chama contributions, and P2P transfers are **not** income and must not inflate the baseline:

```python
valid_history = [r for r in income_history
                 if r.get('category', 'Revenue') not in ['Loan', 'Chama', 'P2P_Transfer']]
```

### Step 2 — Baseline Statistics

| Variable | Meaning | Formula |
|---|---|---|
| `μ` (mu) | Mean monthly income | `np.mean(amounts)` |
| `σ` (sigma) | Income standard deviation | `np.std(amounts, ddof=0)` |
| `dip_threshold` | The trigger line | `0.8 × μ` |

A month qualifies as a **dip** when recorded income falls below 80% of the historical mean.

### Step 3 — Stability Score

The Stability Score `S` is a blended metric (0–100) combining income variance and transaction velocity. High velocity (many M-Pesa transactions per month) is treated as a proxy for active business operations:

```
velocity_score  = min(100, (transaction_count / 30) × 100)
s_base          = 100 × (1 - σ/μ) × w_emp
S               = (s_base × 0.6) + (velocity_score × 0.4) − (5 × unpaid_months)
```

Workers with higher velocity and lower variance score higher, unlocking better premium rates and faster auto-disbursement.

### Step 4 — Pattern & Risk Detection

IDCS analyses the historical dip sequence for periodicity. If dips have recurred at a **fixed interval**, the engine predicts the next dip date:

```
if len(set(intervals)) == 1:        # all gaps are equal → periodic pattern
    predicted_dip_month = last_dip + pattern_interval
```

Risk levels are assigned as: `LOW → MEDIUM → HIGH → CRITICAL`, based on how soon the next predicted dip falls.

### Step 5 — Eligibility Gate

A worker must pass **all** of the following to be eligible:

| Condition | Requirement |
|---|---|
| Current income | Below `dip_threshold` (active dip) |
| Premium history | At least 3 paid months |
| Stability Score | ≥ 50 |
| Business activity | `transaction_count > 0` |
| Fraud flag | Not flagged for manual audit |

### Step 6 — Payout Calculation (Co-Insurance)

IDCS uses a **70% co-insurance cap** to preserve worker incentive and pool sustainability:

```
verified_dip         = max(0, μ − current_income)
payout               = min(src_cap, verified_dip × 0.70)
```

The worker absorbs 30% of the shortfall. The pool covers the rest, capped at the Sum Registered Cover (`src_cap`).

### Step 7 — Auto-Disbursement Trigger

If a verified parametric event (sector-wide dip > 20% or a confirmed severe weather event) aligns with high transaction velocity, the payout fires without manual review:

```python
auto_disburse = eligible and (sector_dip > 0.2 or severe_weather_event) and velocity_score > 80
```

### Step 8 — Micro-Premium Rate

Premiums are dynamically priced based on stability and gamification level:

```
base_rate = 1.5%  if S > 70  else  2.5%
if financial_level == 3:   base_rate -= 0.2%   # Level 3 discount
if squad_no_claim_bonus:   base_rate -= 0.3%   # Trust Squad dividend
micro_deduction_rate = max(0.5%, base_rate)
```

---

## 5. AI Vision Layer — Gemini OCR

`data_handler.py` handles document ingestion. The pipeline works in three stages:

**Stage 1 — PDF Text Extraction**
`pdfplumber` extracts raw text from each page of the uploaded M-Pesa or bank statement PDF.

**Stage 2 — Gemini Vision Parsing**
The extracted text is passed to `gemini-2.5-flash` with a structured output schema enforcing the `IncomeData` Pydantic model. The prompt explicitly instructs the model to extract **only inflows** (credits/deposits) and ignore all debits:

```python
self.model = genai.GenerativeModel(
    model_name="models/gemini-2.5-flash",
    generation_config={
        "response_mime_type": "application/json",
        "response_schema": { ... }   # enforces {date, amount, description}
    }
)
```

**Stage 3 — Validation & Monthly Aggregation**
Each transaction is validated against the `IncomeData` Pydantic model (flexible date parsing across multiple formats). Transactions are grouped by `YYYY-MM` and zero-income months are explicitly flagged for the forecasting engine.

**Stage 4 — Plain-English Summary**
A second Gemini call (non-JSON mode) generates a plain-language explanation of the extracted data for the user, covering transaction count, date range, income sources, and notable patterns.

---

## 6. Prophet Forecasting Pipeline

`engine.py`'s `predict_risk_horizon()` method runs a tuned Prophet model over the monthly income history.

### Key Configuration Choices

| Parameter | Value | Rationale |
|---|---|---|
| `seasonality_mode` | `multiplicative` | Income scales with level; multiplicative fits gig variability better than additive |
| `changepoint_prior_scale` | `0.15` | Allows flexible trend for gig volatility without overfitting |
| `interval_width` | `0.80` | Explicit 80% confidence band |
| `yearly_seasonality` | `True` only if ≥ 24 months | Prevents unreliable seasonality on sparse data |

### Kenyan Holiday Regressors

The engine injects Kenyan public holidays **and** school-fee income spikes directly into Prophet as named holiday regressors:

```python
# School fee payment windows — significant income spikes for tutors, traders
{'holiday': 'SchoolFees Jan', 'ds': f'{y}-01-10', 'lower_window': -3, 'upper_window': 5},
{'holiday': 'SchoolFees May', 'ds': f'{y}-05-05', 'lower_window': -3, 'upper_window': 5},
{'holiday': 'SchoolFees Sep', 'ds': f'{y}-09-05', 'lower_window': -3, 'upper_window': 5},
```

### Sector Dip Regressor

An optional `sector_dip` float (0–1) can be passed as an external regressor, anchoring the forecast to macro data from industry-level indicators. This enables the model to distinguish personal underperformance from a market-wide event.

### Deficiency Zone Detection

A predicted month enters the **Deficiency Zone** when `yhat_lower` (the pessimistic confidence bound) falls below `0.7 × μ`:

```python
threshold = mu * 0.7
predictions_df['is_high_risk'] = predictions_df['yhat_lower'] < threshold
```

### Risk Score Formula

```
risk_score = min(100, (risk_events × 10) + depth_penalty)
depth_penalty = min(50, (avg_depth / threshold) × 100)
```

### Forecast Validation (Step 7)

`validate_forecast()` runs Prophet's built-in cross-validation with rolling windows, returning `MAE`, `MAPE`, `RMSE`, and `coverage` metrics. Requires a minimum of 6 months of data.

### Hyperparameter Tuning (Step 8)

`tune_hyperparameters()` runs a grid search over 12 combinations of `changepoint_prior_scale` and `seasonality_prior_scale`, selecting the configuration with the lowest cross-validated MAPE.

---

## 7. Insurance Matching & Scheme Scoring

IDCS maps each user profile to four real Kenyan insurance products using a match-scoring algorithm in `engine.py`:

| Scheme | Best For | Key Benefit |
|---|---|---|
| **Britam Family Income Protection** | Families, irregular income | Monthly cash replacement for 3–10 years |
| **Liberty Combined Solution** | Formal/salaried workers | Weekly wages + 96-month salary replacement |
| **Jubilee Bima Ya Mwananchi** | Jua Kali / informal workers | Daily hospital cash, low entry point |
| **SHIF** | All workers | 2.75% of gross income baseline health cover |

**Match scoring factors:**

- Employment status alignment (`+40` points for strong match)
- Income volatility vs. scheme payout structure (`+30` points)
- Dependant weighting for family schemes (`+20` points)
- Affordability deduction if premium exceeds 10% of mean income (`−20` points)

---

## 8. Fraud & Moral Hazard Controls

IDCS implements several layers to prevent gaming:

**Sector Corroboration Check**
If a worker reports a personal income dip exceeding 30% but the macro sector shows less than 5% decline, the claim is flagged for manual audit — unless a severe weather event is active (parametric oracle bypass):

```python
if personal_dip_pct > 0.3 and sector_dip < 0.05:
    if not severe_weather_event:
        needs_manual_audit = True
```

**Co-Insurance Obligation**
The 30% worker co-pay (only 70% covered) eliminates the incentive to deliberately suppress income.

**Transaction Velocity Gate**
Auto-disbursement requires `velocity_score > 80`, ensuring the worker has demonstrable recent economic activity.

**Loan/Chama Isolation**
Non-revenue inflows are stripped before any calculation, preventing inflation of the income baseline.

**Premium History Gate**
A minimum of 3 paid months is required before any payout is possible.

---

## 9. Security Architecture

| Layer | Implementation |
|---|---|
| Password hashing | `bcrypt` via `passlib[bcrypt]` |
| Session tokens | JWT (`python-jose`) |
| OTP registration | Time-limited one-time passwords |
| API secrets | Stored in `.streamlit/secrets.toml`, never in source |
| Type validation | Pydantic models on all external data |

---

## 10. Project Structure

```
IDCS-Income-Dip-Compensative-System/
│
├── .streamlit/
│   └── secrets.toml              # GEMINI_API_KEY and DB credentials (git-ignored)
│
├── assets/                       # WebP branding and logo assets
│
├── frontend/                     # CSS / Glassmorphism UI components
│
├── main.py                       # FastAPI app — REST API entry point
├── app.py                        # Streamlit dashboard — UI entry point
├── auth.py                       # JWT auth, OTP registration, bcrypt hashing
├── database.py                   # SQLAlchemy models & SQLite init (idcs.db)
├── data_handler.py               # Gemini Vision OCR, PDF parsing, monthly aggregation
├── engine.py                     # IDCS_Engine — actuarial core + Prophet pipeline
├── pdf_generator.py              # Policy document & compensation certificate generation
├── run.py                        # Convenience launcher
├── activate_idcs.sh              # Shell script to activate venv and start servers
├── check_env.py                  # Environment dependency checker
│
├── idcs_walkthrough.md           # Quick-start guide
├── idcs_implementation_plan.md   # Detailed implementation notes
├── validation_report.md          # Forecast validation results
├── COUNCIL_LEDGER.txt            # Design decision log
├── UPDATE_LOG.md                 # Changelog
│
├── requirements.txt              # Python dependencies
└── idcs.db                       # SQLite database (auto-created on first run)
```

---

## 11. Tech Stack

| Category | Library / Tool | Version |
|---|---|---|
| Language | Python | 3.10+ |
| Frontend | React | Latest |
| API Backend | FastAPI + Uvicorn | Latest |
| AI / OCR | Google Generative AI SDK (`gemini-2.5-flash`) | Latest |
| Time-Series | Facebook Prophet | Latest |
| PDF Parsing | pdfplumber, tabula-py | Latest |
| Data Processing | Pandas, NumPy | Latest |
| Validation | Pydantic | v1/v2 |
| Database | SQLite + SQLAlchemy | Latest |
| Auth | python-jose (JWT), passlib[bcrypt] | Latest |
| PDF Output | (pdf_generator.py) | Custom |
| OS Target | Linux (Zorin OS / Ubuntu-compatible) | Any |

---

## 12. Getting Started

### Prerequisites

- Python 3.10 or higher
- A Google Cloud API key with the Generative AI API enabled
- A virtual environment (recommended)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/smilee254/IDCS-Income-Dip-Compensative-System.git
cd IDCS-Income-Dip-Compensative-System

# 2. Create and activate a virtual environment
python3 -m venv idcs_venv
source idcs_venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

### Configure Secrets

Create `.streamlit/secrets.toml` (see [Configuration](#13-configuration--secrets)).

### Run the Application

**Option A — Manual (two terminals)**

```bash
# Terminal 1: Start the FastAPI backend
uvicorn main:app --reload
# API docs available at http://127.0.0.1:8000/docs

# Terminal 2: Start the Streamlit frontend
streamlit run app.py
# Dashboard at http://localhost:8501
```

**Option B — Shell script**

```bash
chmod +x activate_idcs.sh
./activate_idcs.sh
```

### Quick Test

Once both servers are running, open the Streamlit dashboard and try these built-in test profiles:

| User ID | Profile | Income to trigger dip |
|---|---|---|
| `1` | Amani Kenya — Teacher | `20,000 KES` (normal: 40,000) |
| `2` | Baraka Dev — IT Worker | `50,000 KES` (normal: 90,000) |

---

## 13. Configuration & Secrets

All secrets are managed via `.streamlit/secrets.toml`. **Never commit this file.**

```toml
# .streamlit/secrets.toml

GEMINI_API_KEY = "your-google-generativeai-api-key"

# Optional: database path override
# DB_PATH = "/path/to/idcs.db"
```

Add `.streamlit/secrets.toml` to `.gitignore` if not already present.

---

## 14. API Reference

The FastAPI backend exposes a REST API with auto-generated docs at `http://127.0.0.1:8000/docs`.

Key endpoints (illustrative — check `/docs` for full spec):

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | OTP-based user registration |
| `POST` | `/auth/login` | Returns JWT token |
| `POST` | `/upload/mpesa` | Upload M-Pesa PDF for OCR extraction |
| `POST` | `/engine/calculate` | Run actuarial engine for a user |
| `GET` | `/engine/forecast/{user_id}` | Retrieve 6-month Prophet forecast |
| `GET` | `/schemes/match/{user_id}` | Get ranked insurance scheme matches |

---

## 15. Roadmap

- [ ] M-Pesa Daraja API direct integration (remove PDF upload requirement)
- [ ] Sector-level dip oracle sourced from CBK / KNBS data feeds
- [ ] Mobile-first PWA wrapper for the Streamlit dashboard
- [ ] Multi-user "Trust Squad" pooling with group no-claim bonuses
- [ ] SHIF contribution tracking and reporting module
- [ ] Automated policy PDF generation and delivery via email/SMS
- [ ] Hyperparameter auto-tuning on new data (scheduled retrain)
- [ ] Extended insurance partner integrations beyond the current four schemes

---

<p align="center">
  Built in Nairobi. For Nairobi. 🌍<br/>
  <em>From the matatus of Thika Road to the offices of Times Tower — income resilience for every worker.</em>
</p>
