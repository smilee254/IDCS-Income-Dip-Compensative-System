"""
IDCS FastAPI Backend — Phase 2
Endpoints: Auth, Evaluation, Daraja Webhook, Claims, Pool Metrics,
           Grace-Period Lapse Prevention, Composite Fraud Scoring
"""
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, status, Header, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    register_user, login_user,
    get_current_user, get_current_admin, get_db
)
from database import (
    init_db, SessionLocal,
    User, IncomeHistory, Transaction, Policy, Claim, RiskScore, PremiumAlert
)
from engine import IDCS_Engine, calculate_custom_premium
from data_handler import get_extractor
from rag import get_knowledge_base

# ─── Grace-Period Background Scheduler ───────────────────────────────────────

log = logging.getLogger("idcs.scheduler")

SILENCE_GRACE_DAYS       = 7     # Days of no income before GRACE_PERIOD status
SILENCE_SUSPEND_DAYS     = 37    # Days before policy SUSPENDED
SILENCE_LAPSE_DAYS       = 90    # Days before policy LAPSED
CATCH_UP_MULTIPLIER      = 2     # catch-up spread = min(60, gap_days * multiplier)
REMINDER_INTERVALS       = [7, 14, 30]   # Days at which SMS reminders fire


def _send_sms(phone: str, message: str):
    """
    Dispatch SMS via Africa's Talking / Safaricom API.
    Falls back to log in dev if AT_API_KEY not configured.
    """
    api_key = os.getenv("AFRICASTALKING_API_KEY", "")
    if not api_key:
        log.info(f"[SMS-DEV] → {phone}: {message}")
        return
    try:
        import africastalking
        africastalking.initialize(
            username=os.getenv("AFRICASTALKING_USERNAME", "sandbox"),
            api_key=api_key,
        )
        sms = africastalking.SMS
        sms.send(message, [phone])
    except Exception as exc:
        log.warning(f"SMS dispatch failed for {phone}: {exc}")


def grace_period_job():
    """
    Nightly job — runs once every 24 hours.
    For every ACTIVE or GRACE_PERIOD policy, checks whether the user has had
    any credit transaction in the last N days. Escalates through:
      ACTIVE → GRACE_PERIOD (day 7) → SUSPENDED (day 37) → LAPSED (day 90)
    Accumulates daily_arrears and sends tiered SMS reminders.
    """
    db = SessionLocal()
    try:
        now   = datetime.utcnow()
        today = now.date()

        policies = (
            db.query(Policy)
            .filter(Policy.status.in_(["ACTIVE", "GRACE_PERIOD"]))
            .all()
        )
        log.info(f"[GracePeriodJob] Scanning {len(policies)} active/grace policies…")

        for policy in policies:
            user = db.query(User).filter(User.id == policy.user_id).first()
            if not user:
                continue

            # Find last credit transaction
            last_credit = (
                db.query(Transaction)
                .filter(
                    Transaction.user_id         == user.id,
                    Transaction.transaction_type == "credit",
                )
                .order_by(Transaction.timestamp.desc())
                .first()
            )

            if last_credit:
                days_silent = (today - last_credit.timestamp.date()).days
            else:
                # No credit ever — measure from policy start
                days_silent = (today - policy.start_date.date()).days

            if days_silent < SILENCE_GRACE_DAYS:
                # Income is healthy — clear any grace state
                if policy.status == "GRACE_PERIOD":
                    policy.status            = "ACTIVE"
                    policy.grace_period_since = None
                    db.query(PremiumAlert).filter(
                        PremiumAlert.policy_id == policy.id,
                        PremiumAlert.status    == "ACTIVE",
                    ).update({"status": "RESOLVED", "resolved_at": now})
                continue

            # ── Silence threshold crossed ──────────────────────────────────
            if policy.grace_period_since is None:
                policy.grace_period_since = now - timedelta(days=days_silent)

            # Calculate daily arrears based on user's rolling avg income
            recent_credits = (
                db.query(Transaction)
                .filter(
                    Transaction.user_id         == user.id,
                    Transaction.transaction_type == "credit",
                )
                .order_by(Transaction.timestamp.desc())
                .limit(30)
                .all()
            )
            if recent_credits:
                avg_daily_income = (
                    sum(t.amount for t in recent_credits) / len(recent_credits)
                ) / 30.0
            else:
                avg_daily_income = 0.0

            daily_premium = avg_daily_income * policy.premium_rate
            daily_arrears_today = round(daily_premium, 2)
            policy.arrears_balance = round(
                (policy.arrears_balance or 0.0) + daily_arrears_today, 2
            )

            # ── Status escalation ─────────────────────────────────────────
            if days_silent >= SILENCE_LAPSE_DAYS:
                policy.status = "LAPSED"
                log.warning(f"Policy {policy.id} LAPSED — user {user.id} silent {days_silent}d.")

            elif days_silent >= SILENCE_SUSPEND_DAYS:
                if policy.status != "SUSPENDED":
                    policy.status = "SUSPENDED"
                    log.info(f"Policy {policy.id} SUSPENDED — user {user.id} silent {days_silent}d.")

            elif days_silent >= SILENCE_GRACE_DAYS:
                policy.status = "GRACE_PERIOD"

            # ── Upsert PremiumAlert ───────────────────────────────────────
            alert = (
                db.query(PremiumAlert)
                .filter(
                    PremiumAlert.policy_id == policy.id,
                    PremiumAlert.status    == "ACTIVE",
                )
                .first()
            )
            if not alert:
                alert = PremiumAlert(
                    user_id   = user.id,
                    policy_id = policy.id,
                )
                db.add(alert)
                db.flush()

            alert.days_silent    = days_silent
            alert.arrears_amount = policy.arrears_balance

            # ── Tiered SMS Reminders ──────────────────────────────────────
            phone = user.phone
            if not phone:
                continue

            should_remind = (
                days_silent in REMINDER_INTERVALS or
                (days_silent > 30 and days_silent % 7 == 0)
            )
            last_rem = alert.last_reminder
            already_reminded_today = (
                last_rem and last_rem.date() == today
            )

            if should_remind and not already_reminded_today:
                arrears_ksh = round(policy.arrears_balance, 0)
                catch_up_n  = min(60, days_silent * CATCH_UP_MULTIPLIER)

                if days_silent == REMINDER_INTERVALS[0]:   # Day 7
                    msg = (
                        f"Hi {user.name}, IDCS here. We noticed no income activity this week. "
                        f"Your cover is still ACTIVE. Reply 1 if you're okay or need help."
                    )
                elif days_silent == REMINDER_INTERVALS[1]: # Day 14
                    msg = (
                        f"Hi {user.name}, your IDCS premium arrears are KSh {arrears_ksh:.0f}. "
                        f"Your cover continues. When income resumes, we'll spread recovery "
                        f"across your next {catch_up_n} transactions automatically. No stress."
                    )
                elif days_silent == REMINDER_INTERVALS[2]: # Day 30
                    msg = (
                        f"URGENT — {user.name}, your IDCS policy enters a 7-day suspension window. "
                        f"Outstanding: KSh {arrears_ksh:.0f}. Call us or make a manual payment to "
                        f"keep your cover. Reply HELP for assistance."
                    )
                else:
                    msg = (
                        f"{user.name}, IDCS policy {policy.status}. "
                        f"Outstanding: KSh {arrears_ksh:.0f}. Contact us to reinstate."
                    )

                _send_sms(phone, msg)
                alert.last_reminder  = now
                alert.reminders_sent = (alert.reminders_sent or 0) + 1

        db.commit()
        log.info("[GracePeriodJob] Complete.")
    except Exception as exc:
        db.rollback()
        log.error(f"[GracePeriodJob] Error: {exc}")
    finally:
        db.close()


# ─── Lifespan (startup / shutdown) ────────────────────────────────────────────

_scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Start the grace-period scheduler on boot; shut it down cleanly."""
    _scheduler.add_job(
        grace_period_job,
        trigger="interval",
        hours=24,
        id="grace_period_job",
        replace_existing=True,
        next_run_time=datetime.utcnow() + timedelta(seconds=10),  # run shortly after boot
    )
    _scheduler.start()
    log.info("[Scheduler] Grace-period job started (24h interval).")
    yield
    _scheduler.shutdown(wait=False)
    log.info("[Scheduler] Scheduler stopped.")


init_db()
engine = IDCS_Engine()

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Income Dip Compensation System API",
    version="2.0.0",
    description="Actuarially-modelled micro-insurance for gig workers.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic Request/Response Schemas ────────────────────────────────────────

class IncomeDataIn(BaseModel):
    amount:   float
    status:   str
    category: str = "Revenue"


class EvaluationRequest(BaseModel):
    current_income:       float
    income_history:       List[IncomeDataIn]
    premium:              float = 0.0
    deferred_period:      int   = 30
    transaction_count:    int   = 15
    sector_dip:           float = 0.0
    squad_no_claim_bonus: bool  = False
    severe_weather_event: bool  = False


class WebhookPayload(BaseModel):
    amount:           float
    transaction_type: str           # "credit" | "debit"
    timestamp:        str
    reference:        Optional[str] = None
    source:           str           = "daraja"
    user_phone:       Optional[str] = None  # M-Pesa registered phone for user lookup


class ClaimRequest(BaseModel):
    policy_id:   Optional[int] = None
    sector_dip:  float         = 0.0
    severe_weather_event: bool = False


class ChatRequest(BaseModel):
    messages: List[dict]


class PoolMetrics(BaseModel):
    total_users:        int
    active_policies:    int
    total_premiums_ksh: float
    total_payouts_ksh:  float
    loss_ratio:         float
    pending_claims:     int
    flagged_claims:     int


# ─── Auth Endpoints ───────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse, tags=["Auth"])
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new IDCS user and return a JWT."""
    return register_user(req, db)


@app.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login and return a JWT."""
    return login_user(req, db)


@app.get("/auth/me", tags=["Auth"])
def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return {
        "user_id":          current_user.id,
        "name":             current_user.name,
        "email":            current_user.email,
        "phone":            current_user.phone,
        "employment_type":  current_user.employment_type,
        "sector":           current_user.sector,
        "county":           current_user.county,
        "src_cap":          current_user.src_cap,
        "is_admin":         current_user.is_admin,
        "created_at":       current_user.created_at.isoformat() if current_user.created_at else None,
    }


# ─── File Upload ──────────────────────────────────────────────────────────────

@app.post("/upload/statement", tags=["Risk Engine"])
async def upload_statement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a PDF statement, verify name, extract inflows."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    content = await file.read()
    extractor = get_extractor()
    try:
        inflows = await run_in_threadpool(extractor.extract_inflows, content, True, current_user.name)
        return {"status": "success", "inflows": inflows}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process statement: {e}")

# ─── Risk Evaluation ──────────────────────────────────────────────────────────

@app.post("/evaluate", tags=["Risk Engine"])
def evaluate_claim(
    req: EvaluationRequest,
    db:  Session             = Depends(get_db),
    current_user: User       = Depends(get_current_user)
):
    """
    Run a full risk evaluation for the authenticated user.
    Persists the resulting RiskScore snapshot and returns evaluation metrics.
    """
    income_history_data = [
        {"amount": inc.amount, "status": inc.status, "category": inc.category}
        for inc in req.income_history
    ]

    w_emp = 1.1 if current_user.employment_type == "SRC_Teacher" else 1.0

    result = engine.calculate_metrics(
        income_history       = income_history_data,
        src_cap              = current_user.src_cap,
        current_income       = req.current_income,
        w_emp                = w_emp,
        transaction_count    = req.transaction_count,
        sector_dip           = req.sector_dip,
        squad_no_claim_bonus = req.squad_no_claim_bonus,
        severe_weather_event = req.severe_weather_event,
    )

    # ── Prophet 6-Month Forecast (non-blocking) ───────────────────────────────
    prophet_forecast   = []
    prophet_risk_score = 0
    try:
        df_monthly = engine.prepare_monthly_df(income_history_data)
        if len(df_monthly) >= 3:
            prophet_forecast, prophet_risk_score, _ = engine.predict_risk_horizon(
                df_monthly, result["mu"],
                sector_dip=req.sector_dip,
                cache_key=str(current_user.id),   # cache per user — auto-invalidates on new data
            )
    except Exception:
        pass  # Forecast is optional — never block evaluation on Prophet failure

    # Persist risk score snapshot
    snapshot = RiskScore(
        user_id         = current_user.id,
        velocity_score  = result["velocity_score"],
        stability_score = result["stability_score"],
        fraud_score     = 100.0 if result["needs_manual_audit"] else 0.0,
        risk_level      = result["risk_level"],
        financial_level = result["financial_level"],
        dip_probability = result["dip_probability"],
    )
    db.add(snapshot)

    # Update user premium
    current_user.premium      = req.premium
    current_user.deferred_period = req.deferred_period
    db.commit()

    return {
        "user": {
            "id":              current_user.id,
            "name":            current_user.name,
            "employment_type": current_user.employment_type,
            "src_cap":         current_user.src_cap,
        },
        "evaluation":     {**result, "prophet_risk_score": prophet_risk_score},
        "income_history": income_history_data,
        "forecast":       prophet_forecast,
    }


# ─── Daraja / Open Banking Webhook ────────────────────────────────────────────

@app.post("/webhook/daraja", tags=["Webhooks"])
def daraja_webhook(
    payload:          WebhookPayload,
    db:               Session       = Depends(get_db),
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
):
    """
    Real-time transaction ingestion from Safaricom Daraja or Open Banking.
    Auth: shared DARAJA_WEBHOOK_SECRET header (not JWT — Daraja never sends user tokens).
    User resolved by M-Pesa phone number in the payload.
    """
    # 0a. Verify shared webhook secret (skip check if env var not set — dev mode)
    expected = os.getenv("DARAJA_WEBHOOK_SECRET", "")
    if expected and x_webhook_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret."
        )

    # 0b. Resolve the IDCS user by their M-Pesa phone number
    if not payload.user_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_phone is required to route this transaction."
        )
    current_user = db.query(User).filter(User.phone == payload.user_phone).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No IDCS account found for phone {payload.user_phone}."
        )
    # 1. Fetch or create active policy
    policy = db.query(Policy).filter(
        Policy.user_id == current_user.id,
        Policy.status  == "ACTIVE"
    ).first()

    if not policy:
        # Auto-provision a default policy on first webhook
        policy = Policy(
            user_id        = current_user.id,
            premium_rate   = current_user.premium if current_user.premium > 0 else 0.015,
            coverage_limit = current_user.src_cap,
            status         = "ACTIVE",
        )
        db.add(policy)
        db.flush()

    # 2. Self-healing reinstatement: credit received on a grace/suspended policy
    arrears_catch_up = 0.0
    if payload.transaction_type.lower() == "credit" and payload.amount > 0:
        if policy.status in ("GRACE_PERIOD", "SUSPENDED"):
            # Reinstate the policy on first income received
            policy.status             = "ACTIVE"
            policy.grace_period_since = None
            # Resolve any open PremiumAlert
            db.query(PremiumAlert).filter(
                PremiumAlert.policy_id == policy.id,
                PremiumAlert.status    == "ACTIVE",
            ).update({"status": "RESOLVED", "resolved_at": datetime.utcnow()})
            log.info(f"Policy {policy.id} reinstated — income resumed.")

        # Calculate catch-up share from arrears
        if (policy.arrears_balance or 0.0) > 0 and (policy.arrears_catch_up_txns or 0) > 0:
            arrears_catch_up = round(
                policy.arrears_balance / policy.arrears_catch_up_txns, 2
            )
            policy.arrears_balance        = max(0.0, round(
                policy.arrears_balance - arrears_catch_up, 2
            ))
            policy.arrears_catch_up_txns -= 1
        elif (policy.arrears_balance or 0.0) > 0 and policy.arrears_catch_up_txns == 0:
            # First income after grace — set up catch-up schedule
            from datetime import date as _date
            grace_start = policy.grace_period_since or policy.start_date
            days_silent = (datetime.utcnow().date() - grace_start.date()).days if grace_start else 0
            policy.arrears_catch_up_txns = max(1, min(60, days_silent * CATCH_UP_MULTIPLIER))
            arrears_catch_up = round(
                policy.arrears_balance / policy.arrears_catch_up_txns, 2
            )
            policy.arrears_balance        = max(0.0, round(
                policy.arrears_balance - arrears_catch_up, 2
            ))
            policy.arrears_catch_up_txns -= 1

    # 3. Calculate regular micro-premium deduction (only on credit transactions)
    micro_deducted = 0.0
    if payload.transaction_type.lower() == "credit" and payload.amount > 0:
        micro_deducted = round(payload.amount * policy.premium_rate, 2)
        total_deducted = micro_deducted + arrears_catch_up
        policy.total_premiums_collected += total_deducted

    # 4. Record the transaction
    txn = Transaction(
        user_id                = current_user.id,
        amount                 = payload.amount,
        transaction_type       = payload.transaction_type,
        source                 = payload.source,
        reference              = payload.reference,
        micro_premium_deducted = micro_deducted + arrears_catch_up,
        timestamp              = datetime.fromisoformat(payload.timestamp),
        raw_payload            = json.dumps(payload.dict()),
    )
    db.add(txn)

    # 5. Recalculate velocity score from last 30 transactions
    recent_txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id         == current_user.id,
            Transaction.transaction_type == "credit"
        )
        .order_by(Transaction.timestamp.desc())
        .limit(30)
        .all()
    )
    velocity_score = min(100.0, (len(recent_txns) / 30.0) * 100.0)

    # 6. Snapshot the updated risk score
    snapshot = RiskScore(
        user_id         = current_user.id,
        velocity_score  = velocity_score,
        stability_score = 0.0,  # recalculated on full /evaluate calls
        fraud_score     = 0.0,
        risk_level      = "LOW",
        financial_level = 3 if velocity_score > 90 else (2 if velocity_score > 50 else 1),
    )
    db.add(snapshot)
    db.commit()

    catch_up_msg = (
        f" Arrears catch-up: KSh {arrears_catch_up:.2f} recovered "
        f"(KSh {policy.arrears_balance:.2f} remaining)."
        if arrears_catch_up > 0 else ""
    )
    return {
        "status":             "success",
        "transaction_id":     txn.id,
        "micro_deducted":     micro_deducted,
        "arrears_catch_up":   arrears_catch_up,
        "arrears_remaining":  round(policy.arrears_balance or 0.0, 2),
        "velocity_score":     velocity_score,
        "policy_id":          policy.id,
        "policy_status":      policy.status,
        "premiums_total":     round(policy.total_premiums_collected, 2),
        "message":            f"Transaction recorded. KSh {micro_deducted:.2f} micro-premium deducted.{catch_up_msg}"
    }


# ─── Claims ───────────────────────────────────────────────────────────────────

@app.post("/claims/file", tags=["Claims"])
def file_claim(
    req:          ClaimRequest,
    db:           Session  = Depends(get_db),
    current_user: User     = Depends(get_current_user)
):
    """
    File an income-dip claim for the authenticated user.
    Now powered by the 5-signal Composite Fraud Scorer.
    Claim status determined by fraud_score:
      CLEAN / SOFT_FLAG (0–49)  → APPROVED
      72H_HOLD          (50–74)  → FLAGGED_FOR_AUDIT
      HARD_BLOCK        (75+)    → REJECTED
    """
    now = datetime.utcnow()
    one_year_ago = now - timedelta(days=365)
    two_months_ago = now - timedelta(days=60)

    # Fetch latest risk snapshot
    latest = (
        db.query(RiskScore)
        .filter(RiskScore.user_id == current_user.id)
        .order_by(RiskScore.snapshot_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No evaluation found. Please run /evaluate before filing a claim."
        )

    # Fetch active policy (grace period policies can still file — arrears will be settled)
    policy = db.query(Policy).filter(
        Policy.user_id == current_user.id,
        Policy.status.in_(["ACTIVE", "GRACE_PERIOD"])
    ).first()

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active policy found. A SUSPENDED or LAPSED policy cannot file claims."
        )

    # ── Pull current-period transactions (last 30 days) ───────────────────────
    curr_txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id  == current_user.id,
            Transaction.timestamp >= now - timedelta(days=30),
        )
        .all()
    )
    curr_credits = [t for t in curr_txns if t.transaction_type == "credit"]
    curr_debits  = [t for t in curr_txns if t.transaction_type == "debit"]

    if not curr_credits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No recent credit transactions detected. Claim cannot proceed."
        )

    # ── Pull prior-period transactions (30–60 days ago) for delta comparison ──
    prev_txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id  == current_user.id,
            Transaction.timestamp >= now - timedelta(days=60),
            Transaction.timestamp <  now - timedelta(days=30),
        )
        .all()
    )
    prev_credits = [t for t in prev_txns if t.transaction_type == "credit"]
    prev_debits  = [t for t in prev_txns if t.transaction_type == "debit"]

    # ── Income dip calculation ────────────────────────────────────────
    curr_credit_total = sum(t.amount for t in curr_credits)
    prev_credit_total = sum(t.amount for t in prev_credits) if prev_credits else curr_credit_total
    avg_income        = prev_credit_total if prev_credit_total > 0 else curr_credit_total
    dip_amount        = max(0.0, avg_income - curr_credit_total)
    claimed_dip_pct   = dip_amount / avg_income if avg_income > 0 else 0.0

    # ── Recidivism count ────────────────────────────────────────────
    claims_last_12m = (
        db.query(Claim)
        .filter(
            Claim.user_id    == current_user.id,
            Claim.status.in_(["APPROVED", "AUTO_DISBURSED"]),
            Claim.created_at >= one_year_ago,
        )
        .count()
    )

    # ── Prophet forecast mismatch (use last snapshot prophet_risk_score proxy) ──
    # A risk_level of LOW from the last evaluation = Prophet predicted stable
    prophet_predicted_stable = (latest.risk_level == "LOW" and latest.dip_probability < 20)

    # ── Squad avg dip (placeholder until Squad model fully wired) ─────────
    squad_avg_dip = 0.0   # TODO: query Squad members' dip rates when Squad model is live

    # ── Run composite fraud scorer ───────────────────────────────────
    fraud_result = engine.calculate_fraud_score(
        current_credit_count     = len(curr_credits),
        prev_credit_count        = len(prev_credits),
        current_credit_total     = curr_credit_total,
        prev_credit_total        = prev_credit_total,
        current_debit_count      = len(curr_debits),
        prev_debit_count         = len(prev_debits),
        sector_dip               = req.sector_dip,
        squad_avg_dip            = squad_avg_dip,
        claims_last_12m          = claims_last_12m,
        prophet_predicted_stable = prophet_predicted_stable,
        claimed_dip_pct          = claimed_dip_pct,
        severe_weather_event     = req.severe_weather_event,
    )
    fraud_action = fraud_result["action"]
    fraud_score  = fraud_result["fraud_score"]

    # ── Co-insurance tightening for repeat soft-flags ───────────────────
    co_insurance_rate = 0.60 if fraud_action == "SOFT_FLAG" else 0.70
    payout = min(policy.coverage_limit, dip_amount * co_insurance_rate)

    # ── Map fraud action to claim status ─────────────────────────────
    velocity_score = latest.velocity_score
    auto_disburse  = False

    if fraud_action == "HARD_BLOCK":
        claim_status = "REJECTED"
        payout       = 0.0
    elif fraud_action == "72H_HOLD":
        claim_status = "FLAGGED_FOR_AUDIT"
    elif fraud_action == "SOFT_FLAG":
        claim_status = "APPROVED"   # approved but reduced co-insurance already applied
    else:  # CLEAN
        # Auto-disburse if macro conditions confirm it
        auto_disburse = (
            (req.sector_dip > 0.2 or req.severe_weather_event) and
            velocity_score > 80
        )
        claim_status = "AUTO_DISBURSED" if auto_disburse else "APPROVED"

    # Build audit note
    audit_note_parts = []
    if fraud_result["signals"]:
        audit_note_parts.append("Fraud signals: " + " | ".join(fraud_result["signals"]))
    if fraud_action == "SOFT_FLAG":
        audit_note_parts.append(f"Co-insurance reduced to 60% (was 70%) due to SOFT_FLAG.")
    audit_notes = "\n".join(audit_note_parts) if audit_note_parts else None

    claim = Claim(
        user_id         = current_user.id,
        policy_id       = policy.id,
        dip_amount      = dip_amount,
        payout          = payout,
        status          = claim_status,
        auto_disbursed  = auto_disburse,
        sector_dip      = req.sector_dip,
        velocity_score  = velocity_score,
        stability_score = latest.stability_score,
        audit_notes     = audit_notes,
    )
    db.add(claim)

    # Persist the fraud score into the risk snapshot
    fraud_snapshot = RiskScore(
        user_id         = current_user.id,
        velocity_score  = velocity_score,
        stability_score = latest.stability_score,
        fraud_score     = float(fraud_score),
        risk_level      = latest.risk_level,
        financial_level = latest.financial_level,
        dip_probability = latest.dip_probability,
    )
    db.add(fraud_snapshot)
    db.commit()
    db.refresh(claim)

    # Compose response message
    if claim_status == "REJECTED":
        msg = (
            f"[BLOCKED] Claim rejected by fraud detection. "
            f"Fraud score: {fraud_score}/100. Contact support to dispute."
        )
    elif claim_status == "FLAGGED_FOR_AUDIT":
        msg = (
            f"[REVIEW] Claim held for 72-hour review. "
            f"Fraud score: {fraud_score}/100. A compliance officer will contact you."
        )
    elif fraud_action == "SOFT_FLAG":
        msg = (
            f"[APPROVED] Claim approved at 60% indemnity (reduced from 70% — see audit notes). "
            f"Payout: KSh {payout:.2f} to your M-Pesa by the 1st."
        )
    else:
        msg = f"[APPROVED] Claim approved. KSh {payout:.2f} to your M-Pesa by the 1st."


    return {
        "claim_id":        claim.id,
        "status":          claim.status,
        "dip_amount":      round(dip_amount, 2),
        "payout":          round(payout, 2),
        "co_insurance":    co_insurance_rate,
        "auto_disbursed":  auto_disburse,
        "fraud_score":     fraud_score,
        "fraud_action":    fraud_action,
        "fraud_signals":   fraud_result["signals"],
        "message":         msg,
    }


@app.get("/claims/history", tags=["Claims"])
def claim_history(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """Return all claims for the authenticated user."""
    claims = (
        db.query(Claim)
        .filter(Claim.user_id == current_user.id)
        .order_by(Claim.created_at.desc())
        .all()
    )
    return [
        {
            "claim_id":    c.id,
            "dip_amount":  c.dip_amount,
            "payout":      c.payout,
            "status":      c.status,
            "created_at":  c.created_at.isoformat() if c.created_at else None,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
        }
        for c in claims
    ]


# ─── Admin Endpoints ──────────────────────────────────────────────────────────

@app.get("/admin/pool-metrics", response_model=PoolMetrics, tags=["Admin"])
def pool_metrics(
    db:    Session = Depends(get_db),
    _admin: User  = Depends(get_current_admin)
):
    """
    Live pool health metrics — the actuarial dashboard.
    Loss Ratio = Total Payouts / Total Premiums Collected.
    """
    total_users     = db.query(User).count()
    active_policies = db.query(Policy).filter(Policy.status == "ACTIVE").count()

    premiums_row = db.query(Policy.total_premiums_collected).all()
    total_premiums = sum(r[0] or 0.0 for r in premiums_row)

    payouts_row = (
        db.query(Claim.payout)
        .filter(Claim.status.in_(["APPROVED", "AUTO_DISBURSED"]))
        .all()
    )
    total_payouts = sum(r[0] or 0.0 for r in payouts_row)

    loss_ratio    = (total_payouts / total_premiums) if total_premiums > 0 else 0.0
    pending       = db.query(Claim).filter(Claim.status == "PENDING").count()
    flagged       = db.query(Claim).filter(Claim.status == "FLAGGED_FOR_AUDIT").count()

    return PoolMetrics(
        total_users        = total_users,
        active_policies    = active_policies,
        total_premiums_ksh = round(total_premiums, 2),
        total_payouts_ksh  = round(total_payouts, 2),
        loss_ratio         = round(loss_ratio, 4),
        pending_claims     = pending,
        flagged_claims     = flagged,
    )


@app.get("/admin/flagged-claims", tags=["Admin"])
def flagged_claims(
    db:    Session = Depends(get_db),
    _admin: User  = Depends(get_current_admin)
):
    """Return all claims that are flagged for manual audit."""
    claims = (
        db.query(Claim)
        .filter(Claim.status == "FLAGGED_FOR_AUDIT")
        .order_by(Claim.created_at.asc())
        .all()
    )
    return [
        {
            "claim_id":      c.id,
            "user_id":       c.user_id,
            "dip_amount":    c.dip_amount,
            "payout":        c.payout,
            "sector_dip":    c.sector_dip,
            "velocity_score": c.velocity_score,
            "audit_notes":   c.audit_notes,
            "created_at":    c.created_at.isoformat() if c.created_at else None,
        }
        for c in claims
    ]


@app.patch("/admin/claims/{claim_id}/resolve", tags=["Admin"])
def resolve_claim(
    claim_id:   int,
    approve:    bool,
    notes:      Optional[str] = None,
    db:         Session       = Depends(get_db),
    _admin:     User          = Depends(get_current_admin)
):
    """Approve or reject a flagged claim (admin only)."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    claim.status      = "APPROVED" if approve else "REJECTED"
    claim.audit_notes = notes or claim.audit_notes
    claim.resolved_at = datetime.utcnow()
    db.commit()

    return {"claim_id": claim_id, "new_status": claim.status}


@app.get("/admin/premium-alerts", tags=["Admin"])
def list_premium_alerts(
    status_filter: Optional[str] = None,
    db:    Session = Depends(get_db),
    _admin: User  = Depends(get_current_admin)
):
    """
    Return all PremiumAlert records.
    Filter by status: ACTIVE | RESOLVED | ESCALATED
    Lets the compliance team see users in grace period and their arrears.
    """
    q = db.query(PremiumAlert)
    if status_filter:
        q = q.filter(PremiumAlert.status == status_filter.upper())
    alerts = q.order_by(PremiumAlert.first_detected.desc()).all()

    user_ids = {a.user_id for a in alerts}
    users    = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    return [
        {
            "alert_id":           a.id,
            "user_id":            a.user_id,
            "user_name":          users[a.user_id].name  if a.user_id in users else None,
            "user_phone":         users[a.user_id].phone if a.user_id in users else None,
            "policy_id":          a.policy_id,
            "days_silent":        a.days_silent,
            "arrears_amount_ksh": round(a.arrears_amount or 0.0, 2),
            "catch_up_txns_left": a.catch_up_txns_remaining,
            "reminders_sent":     a.reminders_sent,
            "status":             a.status,
            "first_detected":     a.first_detected.isoformat() if a.first_detected else None,
            "last_reminder":      a.last_reminder.isoformat() if a.last_reminder else None,
        }
        for a in alerts
    ]


@app.post("/admin/trigger-grace-check", tags=["Admin"])
def trigger_grace_check(_admin: User = Depends(get_current_admin)):
    """
    Manually trigger the nightly grace-period job (admin only).
    Use during testing or to force an immediate scan without waiting 24 hours.
    """
    try:
        grace_period_job()
        return {"status": "ok", "message": "Grace-period job completed successfully."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Grace-period job failed: {exc}")


@app.get("/admin/fraud-watch", tags=["Admin"])
def fraud_watch(
    db:     Session = Depends(get_db),
    _admin: User    = Depends(get_current_admin)
):
    """
    Return all claims with elevated fraud signals:
    - FLAGGED_FOR_AUDIT (72H_HOLD) and REJECTED (HARD_BLOCK)
    - APPROVED claims that triggered SOFT_FLAG signals
    Sorted by creation date descending for immediate triage.
    """
    flagged = (
        db.query(Claim)
        .filter(Claim.status.in_(["FLAGGED_FOR_AUDIT", "REJECTED"]))
        .order_by(Claim.created_at.desc())
        .all()
    )
    user_ids = {c.user_id for c in flagged}
    users    = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    soft = (
        db.query(Claim)
        .filter(
            Claim.status == "APPROVED",
            Claim.audit_notes.isnot(None),
        )
        .order_by(Claim.created_at.desc())
        .limit(50)
        .all()
    )
    soft_flagged = [c for c in soft if c.audit_notes and "Fraud signals" in c.audit_notes]
    all_claims   = flagged + soft_flagged

    return [
        {
            "claim_id":       c.id,
            "user_id":        c.user_id,
            "user_name":      users[c.user_id].name if c.user_id in users else None,
            "status":         c.status,
            "dip_amount":     c.dip_amount,
            "payout":         c.payout,
            "velocity_score": c.velocity_score,
            "fraud_signals":  c.audit_notes,
            "created_at":     c.created_at.isoformat() if c.created_at else None,
        }
        for c in all_claims
    ]


# ─── Forecast Validation & Tuning (Steps 7 & 8) ─────────────────────────────────

@app.post("/forecast/validate", tags=["Risk Engine"])
def forecast_validate(
    req:          EvaluationRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Step 7: Cross-validate the Prophet model on the user's income history."""
    income_history_data = [
        {"amount": inc.amount, "status": inc.status, "category": inc.category}
        for inc in req.income_history
    ]
    df_monthly = engine.prepare_monthly_df(income_history_data)
    metrics, err = engine.validate_forecast(df_monthly)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"n_months": len(df_monthly), "yearly_seasonality_used": len(df_monthly) >= 24, "metrics": metrics}


@app.post("/forecast/tune", tags=["Admin"])
def forecast_tune(
    req:    EvaluationRequest,
    db:     Session = Depends(get_db),
    _admin: User    = Depends(get_current_admin),
):
    """Step 8: Hyperparameter grid search (admin only — slow, ~30–60s)."""
    income_history_data = [
        {"amount": inc.amount, "status": inc.status, "category": inc.category}
        for inc in req.income_history
    ]
    df_monthly = engine.prepare_monthly_df(income_history_data)
    best, results = engine.tune_hyperparameters(df_monthly)
    if best is None:
        raise HTTPException(status_code=400, detail=str(results))
    return {"best_params": best, "all_results": results}


# ─── AI Copilot ───────────────────────────────────────────────────────────────

@app.post("/chat", tags=["AI Copilot"])
def chat_endpoint(
    req:          ChatRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """
    IDCS AI Copilot — RAG-augmented, context-rich financial advice.
    Retrieves the most relevant IDCS policy knowledge chunks via semantic search,
    then builds a deeply personalised prompt from the user's live DB metrics.
    """
    user_prompt = req.messages[-1].get("content", "").strip() if req.messages else ""
    now         = datetime.utcnow()

    # ── 1. Gather all live user context in a single batched DB pass ───────────
    recent_credits = (
        db.query(Transaction)
        .filter(
            Transaction.user_id          == current_user.id,
            Transaction.transaction_type == "credit",
            Transaction.timestamp        >= now - timedelta(days=30),
        )
        .order_by(Transaction.timestamp.desc())
        .all()
    )
    latest_score = (
        db.query(RiskScore)
        .filter(RiskScore.user_id == current_user.id)
        .order_by(RiskScore.snapshot_at.desc())
        .first()
    )
    active_policy = (
        db.query(Policy)
        .filter(
            Policy.user_id == current_user.id,
            Policy.status.in_(["ACTIVE", "GRACE_PERIOD", "SUSPENDED"]),
        )
        .order_by(Policy.start_date.desc())
        .first()
    )
    recent_claims = (
        db.query(Claim)
        .filter(
            Claim.user_id    == current_user.id,
            Claim.created_at >= now - timedelta(days=365),
        )
        .order_by(Claim.created_at.desc())
        .limit(5)
        .all()
    )
    active_alert = (
        db.query(PremiumAlert)
        .filter(
            PremiumAlert.user_id == current_user.id,
            PremiumAlert.status  == "ACTIVE",
        )
        .first()
    )

    # ── 2. Extract metrics ──────────────────────────────────────────
    velocity      = latest_score.velocity_score  if latest_score else 0.0
    stability     = latest_score.stability_score if latest_score else 0.0
    fraud_score   = latest_score.fraud_score     if latest_score else 0.0
    risk_level    = latest_score.risk_level      if latest_score else "UNKNOWN"
    fin_level     = latest_score.financial_level if latest_score else 1
    dip_prob      = latest_score.dip_probability if latest_score else 0.0

    policy_status   = active_policy.status           if active_policy else "NO_POLICY"
    premium_rate    = active_policy.premium_rate      if active_policy else 0.0
    arrears         = active_policy.arrears_balance   if active_policy else 0.0
    coverage_limit  = active_policy.coverage_limit    if active_policy else 0.0

    total_credit_30d = sum(t.amount for t in recent_credits)
    avg_txn_value    = total_credit_30d / len(recent_credits) if recent_credits else 0.0

    days_silent      = active_alert.days_silent    if active_alert else 0
    arrears_ksh      = active_alert.arrears_amount if active_alert else 0.0

    approved_claims  = [c for c in recent_claims if c.status in ("APPROVED", "AUTO_DISBURSED")]
    rejected_claims  = [c for c in recent_claims if c.status == "REJECTED"]
    held_claims      = [c for c in recent_claims if c.status == "FLAGGED_FOR_AUDIT"]

    # ── 3. RAG retrieval ──────────────────────────────────────────
    kb     = get_knowledge_base()
    chunks = kb.retrieve(user_prompt, top_k=3)
    policy_context = kb.format_context(chunks)

    # ── 4. Build fine-tuned system prompt ────────────────────────────
    system_prompt = f"""You are the IDCS AI Copilot — a hyper-personalised financial advisor
for African gig workers using the Income Dip Compensation System.

Your responses MUST:
1. Be grounded in the user's REAL metrics shown below.
2. Reference specific numbers — never give generic advice.
3. Be concise: 2–4 sentences max per response.
4. Prioritise the user's most urgent financial risk first.
5. Use the IDCS Policy Reference below to answer policy questions accurately.

═══ USER PROFILE ═══
Name:             {current_user.name}
Employment:       {current_user.employment_type or 'Gig Worker'}
Sector:           {current_user.sector or 'Informal'}
County:           {current_user.county or 'Kenya'}
SRC Cap:          KSh {coverage_limit:,.0f}

═══ LIVE SCORES ═══
Velocity Score:   {velocity:.1f}/100  (Level {fin_level}/3)
Stability Score:  {stability:.1f}/100
Fraud Score:      {fraud_score:.0f}/100  ({'CLEAN' if fraud_score < 30 else 'SOFT_FLAG' if fraud_score < 50 else 'ELEVATED'})
Risk Level:       {risk_level}
Dip Probability:  {dip_prob:.1f}%

═══ POLICY STATUS ═══
Policy Status:    {policy_status}
Micro-Premium:    {premium_rate*100:.2f}% per transaction
Arrears Balance:  KSh {arrears:,.2f}
Days Silent:      {days_silent}
{'[ALERT] Grace period active. ' + str(days_silent) + ' days of no income detected.' if days_silent > 0 else '[OK] Income stream active.'}

═══ 30-DAY INCOME SNAPSHOT ═══
Credit transactions: {len(recent_credits)}
Total received:      KSh {total_credit_30d:,.2f}
Average per txn:     KSh {avg_txn_value:,.2f}

═══ CLAIMS HISTORY (last 12 months) ═══
Approved: {len(approved_claims)}  |  Held for review: {len(held_claims)}  |  Rejected: {len(rejected_claims)}
{'[WARNING] You have rejected claims. High fraud score may block future payouts.' if rejected_claims else ''}
{'[WARNING] You have ' + str(len(held_claims)) + ' claim(s) held for 72h review.' if held_claims else ''}

{policy_context}

═══ FEW-SHOT EXAMPLES OF GOOD RESPONSES ═══
Q: How do I improve my score?
A: Your velocity is {velocity:.0f}/100 — you need {max(0, 90-velocity):.0f} more M-Pesa credits this
month to reach Level 3 and unlock a 0.2% premium discount. Focus on getting every customer to
pay via M-Pesa, even for small amounts under KSh 100.

Q: Why was my claim rejected?
A: Based on your fraud score of {fraud_score:.0f}/100 and {len(rejected_claims)} rejection(s) in
the past 12 months, the system detected an anomaly in your transaction pattern. Request a
compliance review at /admin to get the specific signals explained.

Q: What happens if I don't pay my premium?
A: Since your policy is {policy_status} with KSh {arrears:,.0f} in arrears, if income remains
silent for {max(0, 37 - days_silent)} more days, the policy will be SUSPENDED. Resume M-Pesa
receipts immediately and the system will auto-recover arrears in small installments.
═══"""

    # ── 5. Call Gemini ──────────────────────────────────────────
    reply = ""
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")

        genai.configure(api_key=api_key)
        llm    = genai.GenerativeModel("models/gemini-2.5-flash")
        prompt = f"{system_prompt}\n\nUser: {user_prompt}\nCopilot:"
        reply  = llm.generate_content(prompt).text.strip()

    except Exception as exc:
        log.debug(f"[Copilot] Gemini fallback: {exc}")
        # ── Fine-tuned rule-based fallback (matches RAG topics) ────────────
        q = user_prompt.lower()
        if any(w in q for w in ["arrears", "grace", "lapse", "suspend", "silent"]):
            if days_silent > 0:
                reply = (
                    f"Your policy is {policy_status} with {days_silent} days of no income detected "
                    f"and KSh {arrears_ksh:,.0f} in arrears. "
                    f"The moment you receive an M-Pesa credit, the system will auto-reinstate your cover "
                    f"and spread your arrears across the next {min(60, days_silent*2)} transactions automatically."
                )
            else:
                reply = "Your policy is active and your arrears balance is zero. Keep receiving M-Pesa credits to maintain your cover."
        elif any(w in q for w in ["fraud", "reject", "block", "flag", "review"]):
            reply = (
                f"Your fraud score is {fraud_score:.0f}/100 ({'clean' if fraud_score < 30 else 'elevated'}). "
                f"The system checks 5 signals: transaction count vs amount ratio, sector corroboration, "
                f"debit/credit shift, claim frequency, and Prophet forecast alignment. "
                f"To lower your score, ensure all income arrives via M-Pesa and sector data supports your dip."
            )
        elif any(w in q for w in ["velocity", "score", "level", "premium"]):
            reply = (
                f"Your velocity is {velocity:.0f}/100 (Level {fin_level}/3). "
                f"You need {max(0, 30 - len(recent_credits))} more M-Pesa credits this month "
                f"to reach the next level. Each credit — even small ones — counts toward your score."
            )
        elif any(w in q for w in ["claim", "payout", "dip", "eligible"]):
            reply = (
                f"You have {len(approved_claims)} approved claim(s) in the past 12 months. "
                f"To file a new claim: run /evaluate, then /claims/file. "
                f"Your stability score is {stability:.0f}/100 "
                f"({'eligible' if stability >= 50 else 'below the 50-point eligibility threshold'})."
            )
        elif any(w in q for w in ["squad", "trust", "peer", "dividend"]):
            reply = (
                "Trust Squads pool your risk with peers in the same sector. "
                "12 months of zero suspicious claims earns your entire squad a 0.3% premium discount. "
                "Your squad peers' income dip averages also corroborate your own claims — "
                "a strong squad makes your dips more credible to the system."
            )
        else:
            reply = (
                f"Hello {current_user.name}! Your velocity is {velocity:.0f}/100 "
                f"and stability is {stability:.0f}/100. "
                f"{'Your income stream is active and your policy is in good standing.' if policy_status == 'ACTIVE' and days_silent == 0 else f'[ALERT] Policy is {policy_status} with {days_silent} silent days. Resume M-Pesa receipts to keep your cover.'}"
            )

    return {
        "content":       reply,
        "velocity_score":  velocity,
        "stability_score": stability,
        "fraud_score":     fraud_score,
        "financial_level": fin_level,
        "risk_level":      risk_level,
        "policy_status":   policy_status,
        "arrears_ksh":     round(arrears, 2),
        "rag_sources":     [c["title"] for c in chunks],
    }


# ─── User Settings ────────────────────────────────────────────────────────────

class UserSettingsUpdate(BaseModel):
    name:            Optional[str]   = None
    phone:           Optional[str]   = None
    sector:          Optional[str]   = None
    county:          Optional[str]   = None
    employment_type: Optional[str]   = None
    src_cap:         Optional[float] = None
    deferred_period: Optional[int]   = None


@app.patch("/user/settings", tags=["User"])
def update_settings(
    req:          UserSettingsUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """Update the authenticated user's profile and coverage settings."""
    if req.name            is not None: current_user.name            = req.name
    if req.phone           is not None: current_user.phone           = req.phone
    if req.sector          is not None: current_user.sector          = req.sector
    if req.county          is not None: current_user.county          = req.county
    if req.employment_type is not None: current_user.employment_type = req.employment_type
    if req.src_cap         is not None: current_user.src_cap         = req.src_cap
    if req.deferred_period is not None: current_user.deferred_period = req.deferred_period

    # If coverage limit changed, update the active policy too
    if req.src_cap is not None:
        policy = db.query(Policy).filter(
            Policy.user_id == current_user.id,
            Policy.status  == "ACTIVE"
        ).first()
        if policy:
            policy.coverage_limit = req.src_cap

    db.commit()
    db.refresh(current_user)
    return {
        "message":        "Settings updated successfully.",
        "name":           current_user.name,
        "phone":          current_user.phone,
        "sector":         current_user.sector,
        "county":         current_user.county,
        "employment_type":current_user.employment_type,
        "src_cap":        current_user.src_cap,
        "deferred_period":current_user.deferred_period,
    }


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def read_root():
    return {"status": "online", "version": "1.1.0", "system": "IDCS API — Phase 1 Complete"}

