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

from fastapi import FastAPI, HTTPException, Depends, status, Header, UploadFile, File, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    OTPRequest, OTPVerifyRequest,
    register_user, login_user, dispatch_otp, verify_otp_code,
    get_current_user, get_current_admin, get_db
)
from database import (
    init_db, SessionLocal,
    User, IncomeHistory, Transaction, Policy, Claim, RiskScore, PremiumAlert,
    TrustSquad, SquadMember, ForecastCache, SquadAttestation, CashDeclaration
)
from engine import IDCS_Engine, calculate_custom_premium
from data_handler import get_extractor
from rag import get_knowledge_base
from weather_oracle import check_severe_weather
from daraja_client import get_b2c_client
from inflow_classifier import classify_inflow, hash_sender_phone

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


# ─── Parametric Protection Tiers ──────────────────────────────────────────────

PARAMETRIC_TIERS = {
    "TIER_1": {
        "tier_id":          "TIER_1",
        "name":             "Bronze Shield",
        "benchmark_income": 25000.0,
        "coverage_limit":   17500.0,   # 70% of 25,000
        "premium_rate":     0.012,     # 1.2% micro-deduction
        "description":      "Solo operator, single chair, kiosk, mobile hawker",
    },
    "TIER_2": {
        "tier_id":          "TIER_2",
        "name":             "Silver Shield",
        "benchmark_income": 50000.0,
        "coverage_limit":   35000.0,   # 70% of 50,000
        "premium_rate":     0.015,     # 1.5% micro-deduction
        "description":      "2–3 stations, rented physical stall, 1 assistant",
    },
    "TIER_3": {
        "tier_id":          "TIER_3",
        "name":             "Gold Shield",
        "benchmark_income": 90000.0,
        "coverage_limit":   63000.0,   # 70% of 90,000
        "premium_rate":     0.018,     # 1.8% micro-deduction
        "description":      "Multi-chair salon, high-traffic retail workshop",
    },
}

class SelectTierRequest(BaseModel):
    tier: str                      # "TIER_1" | "TIER_2" | "TIER_3"
    till_number: Optional[str] = None


class IncomeDataIn(BaseModel):
    amount:   float
    status:   str
    category: str = "Revenue"


class EvaluationRequest(BaseModel):
    current_income:       float
    income_history:       Optional[List[IncomeDataIn]] = []
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
    sender_phone:     Optional[str] = None  # Customer MSISDN (hashed for KDPA privacy)
    description:      Optional[str] = None  # Transaction narrative / remarks
    bill_ref_number:  Optional[str] = None  # Account or Till reference
    shortcode:        Optional[str] = None  # Till / Paybill number


class ReversalPayload(BaseModel):
    original_reference: str           # M-Pesa transaction ID that was reversed
    reversal_reference: Optional[str] = None
    amount:             float
    user_phone:         str
    reason:             Optional[str] = None


class TillLinkRequest(BaseModel):
    till_number: str
    till_type:   str = "BUY_GOODS"    # "BUY_GOODS" | "POCHI_LA_BIASHARA" | "PAYBILL"


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


class CreateSquadRequest(BaseModel):
    name: Optional[str] = None
    squad_name: Optional[str] = None

    @property
    def squad_title(self) -> str:
        val = self.name or self.squad_name or ""
        return val.strip()


class JoinSquadRequest(BaseModel):
    code: Optional[str] = None
    invite_code: Optional[str] = None

    @property
    def squad_code(self) -> str:
        val = self.code or self.invite_code or ""
        return val.strip().upper()


# ─── Auth Endpoints ───────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse, tags=["Auth"])
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new IDCS user and return a JWT."""
    return register_user(req, db)


@app.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login and return a JWT."""
    return login_user(req, db)


@app.post("/auth/request-otp", tags=["Auth"])
def request_otp(req: OTPRequest, db: Session = Depends(get_db)):
    """Generate and dispatch a 6-digit OTP code to the requested phone number."""
    return dispatch_otp(req.phone, db)


@app.post("/auth/verify-otp", tags=["Auth"])
def verify_otp(req: OTPVerifyRequest, db: Session = Depends(get_db)):
    """Verify submitted phone OTP code."""
    valid = verify_otp_code(req.phone, req.code, db)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code.")
    return {"status": "success", "message": "Phone verified successfully."}


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
    ] if req.income_history else []

    # If client didn't supply income history, load real records from DB
    if not income_history_data:
        db_incomes = (
            db.query(IncomeHistory)
            .filter(IncomeHistory.user_id == current_user.id)
            .order_by(IncomeHistory.recorded_at.asc())
            .all()
        )
        if db_incomes:
            income_history_data = [
                {"month": f"M{inc.month_index or i+1}", "amount": inc.income_amount, "status": inc.status, "category": inc.category}
                for i, inc in enumerate(db_incomes)
            ]
        else:
            recent_credits = (
                db.query(Transaction)
                .filter(
                    Transaction.user_id == current_user.id,
                    Transaction.transaction_type == "credit"
                )
                .order_by(Transaction.timestamp.asc())
                .limit(30)
                .all()
            )
            if recent_credits:
                # Group by transaction date or relative interval
                income_history_data = [
                    {
                        "month": t.timestamp.strftime("%b %d") if t.timestamp else f"Txn #{t.id}",
                        "amount": t.amount,
                        "status": "Paid",
                        "category": "Revenue"
                    }
                    for t in recent_credits
                ]

    w_emp = 1.1 if current_user.employment_type == "SRC_Teacher" else 1.0

    # ── Cash Income Supplement (Cash Economy Baseline) ────────────────────────
    import numpy as np
    cash_decls = (
        db.query(CashDeclaration)
        .filter(CashDeclaration.user_id == current_user.id)
        .order_by(CashDeclaration.week_ending.desc())
        .limit(12)
        .all()
    )
    cash_supplement = 0.0
    if cash_decls:
        weekly_weighted = [d.amount * (d.credibility_weight or 1.0) for d in cash_decls]
        cash_supplement = float(np.mean(weekly_weighted) * 4.33) if weekly_weighted else 0.0

    # Real transactional velocity
    db_txn_count = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.timestamp >= (datetime.utcnow() - timedelta(days=30))
        )
        .count()
    )
    effective_txn_count = max(req.transaction_count, db_txn_count)

    result = engine.calculate_metrics(
        income_history       = income_history_data,
        src_cap              = current_user.src_cap,
        current_income       = req.current_income,
        w_emp                = w_emp,
        transaction_count    = effective_txn_count,
        sector_dip           = max(req.sector_dip, _calculate_sector_dip(current_user.sector, current_user.county, db)),
        squad_no_claim_bonus = req.squad_no_claim_bonus or bool(db.query(SquadMember).filter(SquadMember.user_id == current_user.id, SquadMember.status == "ACTIVE").first()),
        severe_weather_event = req.severe_weather_event or check_severe_weather(current_user.county or "Nairobi"),
        cash_supplement      = cash_supplement,
    )

    # ── Non-blocking Forecast (Read from persistent DB cache only) ────────────
    prophet_forecast   = []
    prophet_risk_score = 0
    try:
        cached_fc = (
            db.query(ForecastCache)
            .filter(ForecastCache.user_id == current_user.id)
            .order_by(ForecastCache.created_at.desc())
            .first()
        )
        if cached_fc and cached_fc.forecast_json:
            prophet_forecast = json.loads(cached_fc.forecast_json)
            prophet_risk_score = cached_fc.risk_score or 0
    except Exception:
        pass

    # Calibration Status
    total_data_points = len(income_history_data) + len(cash_decls) + db_txn_count
    is_calibrated = bool(len(income_history_data) >= 3 or db_txn_count >= 5 or len(cash_decls) >= 2)
    calibration_progress = 100 if is_calibrated else min(95, int((max(1, total_data_points) / 7.0) * 100))

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

    # Active policy tier & incubation metadata
    active_policy = db.query(Policy).filter(
        Policy.user_id == current_user.id,
        Policy.status.in_(["ACTIVE", "INCUBATING", "GRACE_PERIOD"])
    ).first()
    tier_info = PARAMETRIC_TIERS.get(active_policy.tier if (active_policy and active_policy.tier) else "TIER_2", PARAMETRIC_TIERS["TIER_2"])
    incubation_status = None
    if active_policy and active_policy.status == "INCUBATING":
        now = datetime.utcnow()
        days_left = max(0, (active_policy.incubation_ends_at - now).days) if active_policy.incubation_ends_at else 0
        inc_txns = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.timestamp >= (active_policy.start_date or (now - timedelta(days=30)))
        ).count()
        incubation_status = {
            "is_incubating":  True,
            "days_left":      days_left,
            "txns_observed":  inc_txns,
            "txns_required":  10,
            "target_tier":    active_policy.tier,
            "ends_at":        active_policy.incubation_ends_at.isoformat() if active_policy.incubation_ends_at else None,
        }

    return {
        "user": {
            "id":              current_user.id,
            "name":            current_user.name,
            "phone":           current_user.phone,
            "till_number":     current_user.till_number,
            "employment_type": current_user.employment_type,
            "src_cap":         current_user.src_cap,
        },
        "evaluation":        {**result, "prophet_risk_score": prophet_risk_score},
        "income_history":    income_history_data,
        "forecast":          prophet_forecast,
        "tier":              tier_info,
        "incubation":        incubation_status,
        "policy_status":     active_policy.status if active_policy else "NONE",
        "calibration": {
            "is_calibrated":   is_calibrated,
            "progress_pct":    calibration_progress,
            "txns_observed":   db_txn_count,
            "cash_decls_count": len(cash_decls),
            "data_points":     total_data_points,
            "target_points":   7,
        }
    }


@app.get("/user/activity", tags=["User Activity"])
def get_user_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns recent transactions (credits/debits) and cash declarations
    for the authenticated user.
    """
    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.timestamp.desc())
        .limit(20)
        .all()
    )
    cash_decls = (
        db.query(CashDeclaration)
        .filter(CashDeclaration.user_id == current_user.id)
        .order_by(CashDeclaration.week_ending.desc())
        .limit(10)
        .all()
    )
    return {
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "type": t.transaction_type,
                "reference": t.reference,
                "source": t.source,
                "category": t.category or "Revenue",
                "anomaly_flag": t.anomaly_flag,
                "is_settled": t.is_settled,
                "reversal_ref": t.reversal_ref,
                "micro_premium": t.micro_premium_deducted,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            }
            for t in txns
        ],
        "cash_declarations": [
            {
                "id": c.id,
                "amount": c.amount,
                "week_ending": c.week_ending.isoformat() if hasattr(c.week_ending, 'isoformat') else str(c.week_ending),
                "credibility": c.credibility_weight,
                "notes": c.notes,
            }
            for c in cash_decls
        ]
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

    # 0c. Idempotency check: if reference already recorded, do not duplicate charges or records
    if payload.reference:
        existing_txn = db.query(Transaction).filter(Transaction.reference == payload.reference).first()
        if existing_txn:
            return {
                "status": "duplicate_ignored",
                "transaction_id": existing_txn.id,
                "reference": payload.reference,
                "message": f"Transaction reference {payload.reference} already recorded."
            }

    # 1. Inflow Classification & Anti-Noise Filtering
    recent_classifier_data = [
        {"amount": t.amount, "category": t.category, "sender_hash": t.sender_hash}
        for t in db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.timestamp.desc())
        .limit(20)
        .all()
    ]

    classification = classify_inflow(
        amount           = payload.amount,
        sender_phone     = payload.sender_phone,
        description      = payload.description,
        bill_ref_number  = payload.bill_ref_number,
        shortcode        = payload.shortcode,
        recent_txns      = recent_classifier_data,
        user_till_type   = current_user.till_type or "BUY_GOODS"
    )

    is_commercial = classification["is_commercial_revenue"]
    recognized_amount = classification["recognized_revenue"]
    s_hash = classification["sender_hash"]
    anomaly = classification["anomaly_flag"]
    cat = classification["category"]

    # 2. Fetch or create active or incubating policy
    policy = db.query(Policy).filter(
        Policy.user_id == current_user.id,
        Policy.status.in_(["ACTIVE", "INCUBATING", "GRACE_PERIOD", "SUSPENDED"])
    ).first()

    if not policy:
        tier_info = PARAMETRIC_TIERS["TIER_2"]
        policy = Policy(
            user_id            = current_user.id,
            tier               = "TIER_2",
            premium_rate       = current_user.premium if current_user.premium > 0 else tier_info["premium_rate"],
            coverage_limit     = current_user.src_cap if current_user.src_cap > 0 else tier_info["coverage_limit"],
            status             = "INCUBATING",
            incubation_ends_at = datetime.utcnow() + timedelta(days=21),
        )
        db.add(policy)
        db.flush()

    # Incubation Graduation: Only genuine commercial revenue counts toward the 10 transactions
    if policy.status == "INCUBATING":
        now = datetime.utcnow()
        inc_txns = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.category == "Revenue",
            Transaction.transaction_type == "credit",
            Transaction.timestamp >= (policy.start_date or (now - timedelta(days=30)))
        ).count()
        if payload.transaction_type.lower() == "credit" and is_commercial:
            inc_txns += 1
        if (policy.incubation_ends_at and now >= policy.incubation_ends_at) or inc_txns >= 10:
            policy.status = "ACTIVE"
            log.info(f"Policy {policy.id} graduated from INCUBATING to ACTIVE.")

    # 3. Arrears catch-up & micro-premium (strictly on commercial revenue)
    arrears_catch_up = 0.0
    micro_deducted = 0.0

    if payload.transaction_type.lower() == "credit" and is_commercial and recognized_amount > 0:
        if policy.status in ("GRACE_PERIOD", "SUSPENDED"):
            policy.status             = "ACTIVE"
            policy.grace_period_since = None
            db.query(PremiumAlert).filter(
                PremiumAlert.policy_id == policy.id,
                PremiumAlert.status    == "ACTIVE",
            ).update({"status": "RESOLVED", "resolved_at": datetime.utcnow()})
            log.info(f"Policy {policy.id} reinstated — commercial revenue resumed.")

        if (policy.arrears_balance or 0.0) > 0 and (policy.arrears_catch_up_txns or 0) > 0:
            arrears_catch_up = round(policy.arrears_balance / policy.arrears_catch_up_txns, 2)
            policy.arrears_balance = max(0.0, round(policy.arrears_balance - arrears_catch_up, 2))
            policy.arrears_catch_up_txns -= 1
        elif (policy.arrears_balance or 0.0) > 0 and policy.arrears_catch_up_txns == 0:
            grace_start = policy.grace_period_since or policy.start_date
            days_silent = (datetime.utcnow().date() - grace_start.date()).days if grace_start else 0
            policy.arrears_catch_up_txns = max(1, min(60, days_silent * CATCH_UP_MULTIPLIER))
            arrears_catch_up = round(policy.arrears_balance / policy.arrears_catch_up_txns, 2)
            policy.arrears_balance = max(0.0, round(policy.arrears_balance - arrears_catch_up, 2))
            policy.arrears_catch_up_txns -= 1

        micro_deducted = round(recognized_amount * policy.premium_rate, 2)
        total_deducted = micro_deducted + arrears_catch_up
        policy.total_premiums_collected += total_deducted

    # 4. Record transaction with KDPA sender hash and classification tags
    txn = Transaction(
        user_id                = current_user.id,
        amount                 = payload.amount,
        transaction_type       = payload.transaction_type,
        source                 = payload.source,
        reference              = payload.reference,
        micro_premium_deducted = micro_deducted + arrears_catch_up,
        category               = cat,
        sender_hash            = s_hash,
        is_settled             = False,  # Becomes settled after 24h window
        anomaly_flag           = anomaly,
        timestamp              = datetime.fromisoformat(payload.timestamp),
        raw_payload            = json.dumps(payload.model_dump()),
    )
    db.add(txn)

    # 5. Velocity score based on last 30 commercial transactions
    recent_txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id         == current_user.id,
            Transaction.category        == "Revenue",
            Transaction.transaction_type == "credit"
        )
        .order_by(Transaction.timestamp.desc())
        .limit(30)
        .all()
    )
    velocity_score = min(100.0, (len(recent_txns) / 30.0) * 100.0)

    snapshot = RiskScore(
        user_id         = current_user.id,
        velocity_score  = velocity_score,
        stability_score = 0.0,
        fraud_score     = 0.0,
        risk_level      = "LOW",
        financial_level = 3 if velocity_score > 90 else (2 if velocity_score > 50 else 1),
    )
    db.add(snapshot)
    db.commit()

    catch_up_msg = (
        f" Arrears catch-up: KSh {arrears_catch_up:.2f} recovered."
        if arrears_catch_up > 0 else ""
    )
    return {
        "status":             "success",
        "transaction_id":     txn.id,
        "category":           cat,
        "is_commercial":      is_commercial,
        "recognized_revenue": recognized_amount,
        "anomaly_flag":       anomaly,
        "classification_note": classification["reason"],
        "micro_deducted":     micro_deducted,
        "arrears_catch_up":   arrears_catch_up,
        "arrears_remaining":  round(policy.arrears_balance or 0.0, 2),
        "velocity_score":     velocity_score,
        "policy_id":          policy.id,
        "policy_status":      policy.status,
        "premiums_total":     round(policy.total_premiums_collected, 2),
        "message":            f"Inflow classified as {cat}. {classification['reason']}{catch_up_msg}"
    }


# ─── Two-Way M-Pesa Reversal Webhook ──────────────────────────────────────────

@app.post("/webhook/daraja/reversal", tags=["Webhooks"])
def daraja_reversal_webhook(
    payload:          ReversalPayload,
    db:               Session       = Depends(get_db),
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
):
    """
    Real-time M-Pesa transaction reversal webhook.
    Reverses the original transaction, claws back credited micro-premiums,
    deducts from baseline revenue, and flags high-frequency reversal accounts.
    """
    expected = os.getenv("DARAJA_WEBHOOK_SECRET", "")
    if expected and x_webhook_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret."
        )

    current_user = db.query(User).filter(User.phone == payload.user_phone).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No account found for phone {payload.user_phone}."
        )

    rev_ref = payload.reversal_reference or f"REV-{payload.original_reference}"
    existing_rev = db.query(Transaction).filter(Transaction.reference == rev_ref).first()
    if existing_rev:
        return {"status": "already_processed", "reversal_ref": rev_ref}

    original_txn = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.reference == payload.original_reference
    ).first()

    policy = db.query(Policy).filter(
        Policy.user_id == current_user.id,
        Policy.status.in_(["ACTIVE", "INCUBATING", "GRACE_PERIOD", "SUSPENDED"])
    ).first()

    clawback_premium = 0.0
    if original_txn:
        original_txn.is_settled = False
        original_txn.anomaly_flag = "REVERSED"
        clawback_premium = original_txn.micro_premium_deducted or 0.0
        if policy and clawback_premium > 0:
            policy.total_premiums_collected = max(0.0, policy.total_premiums_collected - clawback_premium)

    reversal_txn = Transaction(
        user_id                = current_user.id,
        amount                 = payload.amount,
        transaction_type       = "debit",
        source                 = "daraja_reversal",
        reference              = rev_ref,
        micro_premium_deducted = -clawback_premium,
        category               = "Reversal",
        reversal_ref           = payload.original_reference,
        anomaly_flag           = "REVERSAL",
        is_settled             = True,
        timestamp              = datetime.utcnow(),
        raw_payload            = json.dumps(payload.model_dump()),
    )
    db.add(reversal_txn)

    # Check for excessive reversal rate (> 15% of recent transactions)
    all_recent = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.timestamp.desc())
        .limit(30)
        .all()
    )
    rev_count = sum(1 for t in all_recent if t.category == "Reversal" or t.anomaly_flag == "REVERSED")
    is_suspicious = len(all_recent) >= 5 and (rev_count / len(all_recent)) > 0.15

    if is_suspicious:
        # Flag user for manual audit
        risk_score = db.query(RiskScore).filter(RiskScore.user_id == current_user.id).order_by(RiskScore.snapshot_at.desc()).first()
        if risk_score:
            risk_score.fraud_score = 95.0

    db.commit()

    return {
        "status":             "REVERSED_SUCCESS",
        "original_reference": payload.original_reference,
        "reversal_reference": rev_ref,
        "clawback_premium":   clawback_premium,
        "suspicious_rate":    is_suspicious,
        "message":            f"Transaction #{payload.original_reference} reversed. KSh {clawback_premium:.2f} premium clawed back."
    }


# ─── Till & Pochi la Biashara Linkage ─────────────────────────────────────────

@app.post("/policy/link-till", tags=["Policies"])
def link_till_number(
    payload: TillLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Connect a Safaricom Buy Goods Till, Paybill, or Pochi la Biashara.
    """
    till = payload.till_number.strip()
    if not till.isdigit() or len(till) < 5 or len(till) > 12:
        raise HTTPException(
            status_code=400,
            detail="Invalid till or account number format. Expected 5 to 12 digits."
        )

    current_user.till_number = till
    current_user.till_type = payload.till_type
    current_user.till_verified = True
    db.commit()

    return {
        "status": "success",
        "till_number": till,
        "till_type": payload.till_type,
        "verified": True,
        "message": f"Successfully linked {payload.till_type.replace('_', ' ').title()} #{till} to your IDCS Shield."
    }


# ─── Parametric Tiers & Incubation (Zero-Document Underwriting) ───────────────

@app.get("/policy/tiers", tags=["Policies"])
def list_parametric_tiers():
    """Return available parametric protection tiers."""
    return list(PARAMETRIC_TIERS.values())


@app.post("/policy/select-tier", tags=["Policies"])
def select_parametric_tier(
    req:          SelectTierRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """
    Zero-Document Underwriting: User selects their parametric protection tier.
    Eliminates PDF uploads and KRA integration.
    New users enter a 21-day incubation window where live Daraja webhooks verify velocity.
    """
    if req.tier not in PARAMETRIC_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier '{req.tier}'. Available: {list(PARAMETRIC_TIERS.keys())}"
        )

    tier_info = PARAMETRIC_TIERS[req.tier]

    if req.till_number:
        current_user.till_number = req.till_number

    # Look up existing policy
    policy = db.query(Policy).filter(
        Policy.user_id == current_user.id,
        Policy.status.in_(["ACTIVE", "INCUBATING", "GRACE_PERIOD", "SUSPENDED"])
    ).first()

    # Count prior transactions
    txn_count = db.query(Transaction).filter(Transaction.user_id == current_user.id).count()

    now = datetime.utcnow()
    # If user has >= 5 historical transactions, policy can be ACTIVE directly; otherwise INCUBATING
    initial_status = "ACTIVE" if txn_count >= 5 else "INCUBATING"
    incubation_ends = None if initial_status == "ACTIVE" else (now + timedelta(days=21))

    if policy:
        policy.tier           = req.tier
        policy.coverage_limit = tier_info["coverage_limit"]
        policy.premium_rate   = tier_info["premium_rate"]
        if policy.status == "INCUBATING":
            policy.incubation_ends_at = incubation_ends
        db.commit()
        db.refresh(policy)
    else:
        policy = Policy(
            user_id            = current_user.id,
            tier               = req.tier,
            coverage_limit     = tier_info["coverage_limit"],
            premium_rate       = tier_info["premium_rate"],
            status             = initial_status,
            incubation_ends_at = incubation_ends,
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)

    current_user.src_cap = tier_info["coverage_limit"]
    current_user.premium = tier_info["premium_rate"]
    db.commit()

    days_left = max(0, (policy.incubation_ends_at - now).days) if policy.incubation_ends_at else 0
    return {
        "status":               "success",
        "policy_id":            policy.id,
        "tier":                 req.tier,
        "tier_name":            tier_info["name"],
        "policy_status":        policy.status,
        "coverage_limit":       policy.coverage_limit,
        "premium_rate":         policy.premium_rate,
        "is_incubating":        (policy.status == "INCUBATING"),
        "incubation_days_left": days_left,
        "message": (
            f"You have selected {tier_info['name']}. "
            + (f"Policy is in Progressive Incubation ({days_left} days remaining). Safaricom Daraja will build your verified baseline." if policy.status == "INCUBATING" else "Policy is ACTIVE with full parametric protection.")
        )
    }


def _calculate_sector_dip(sector: Optional[str], county: Optional[str], db: Session) -> float:
    """Calculate aggregate macroeconomic revenue change across users in the same sector."""
    if not sector:
        return 0.0
    now = datetime.utcnow()
    cohort_users = db.query(User.id).filter(User.sector == sector).all()
    if not cohort_users or len(cohort_users) < 2:
        return 0.0
    uids = [u[0] for u in cohort_users]
    c_now = db.query(Transaction.amount).filter(
        Transaction.user_id.in_(uids),
        Transaction.transaction_type == "credit",
        Transaction.timestamp >= now - timedelta(days=30)
    ).all()
    c_prev = db.query(Transaction.amount).filter(
        Transaction.user_id.in_(uids),
        Transaction.transaction_type == "credit",
        Transaction.timestamp >= now - timedelta(days=60),
        Transaction.timestamp < now - timedelta(days=30)
    ).all()
    sum_now = sum(r[0] for r in c_now)
    sum_prev = sum(r[0] for r in c_prev)
    if sum_prev > 0 and sum_now < sum_prev:
        return round((sum_prev - sum_now) / sum_prev, 4)
    return 0.0


def _calculate_squad_dip(user_id: int, db: Session) -> float:
    """Calculate average income drop across peers in the user's Trust Squad."""
    membership = db.query(SquadMember).filter(
        SquadMember.user_id == user_id,
        SquadMember.status == "ACTIVE"
    ).first()
    if not membership:
        return 0.0
    peers = db.query(SquadMember.user_id).filter(
        SquadMember.squad_id == membership.squad_id,
        SquadMember.user_id != user_id,
        SquadMember.status == "ACTIVE"
    ).all()
    peer_ids = [p[0] for p in peers]
    if not peer_ids:
        return 0.0
    now = datetime.utcnow()
    p_now = db.query(Transaction.amount).filter(
        Transaction.user_id.in_(peer_ids),
        Transaction.transaction_type == "credit",
        Transaction.timestamp >= now - timedelta(days=30)
    ).all()
    p_prev = db.query(Transaction.amount).filter(
        Transaction.user_id.in_(peer_ids),
        Transaction.transaction_type == "credit",
        Transaction.timestamp >= now - timedelta(days=60),
        Transaction.timestamp < now - timedelta(days=30)
    ).all()
    tot_now = sum(r[0] for r in p_now)
    tot_prev = sum(r[0] for r in p_prev)
    if tot_prev > 0 and tot_now < tot_prev:
        return round((tot_prev - tot_now) / tot_prev, 4)
    return 0.0


# ─── Claims ───────────────────────────────────────────────────────────────────

@app.post("/claims/file", tags=["Claims"])
def file_claim(
    req:          ClaimRequest,
    db:           Session  = Depends(get_db),
    current_user: User     = Depends(get_current_user)
):
    """
    File an income-dip claim for the authenticated user.
    Powered by 5-signal Composite Fraud Scorer + server-verified weather & sector oracles.
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
        inc_policy = db.query(Policy).filter(
            Policy.user_id == current_user.id,
            Policy.status  == "INCUBATING"
        ).first()
        if inc_policy:
            server_weather = check_severe_weather(current_user.county or "Nairobi")
            server_sector_dip = _calculate_sector_dip(current_user.sector, current_user.county, db)
            if not (server_weather or server_sector_dip > 0.2 or req.severe_weather_event or req.sector_dip > 0.2):
                days_left = max(0, (inc_policy.incubation_ends_at - now).days) if inc_policy.incubation_ends_at else 14
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Policy is in Progressive Incubation ({days_left} days remaining). Only severe weather or macro sector shocks (>20%) are covered during incubation."
                )
            policy = inc_policy
        else:
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

    # ── Income dip calculation: Multi-Month Rolling Mean (mu) ─────────────────
    curr_credit_total = sum(t.amount for t in curr_credits)
    prev_credit_total = sum(t.amount for t in prev_credits) if prev_credits else curr_credit_total

    # Historical 6-12 month revenue records
    hist_incomes = (
        db.query(IncomeHistory.income_amount)
        .filter(
            IncomeHistory.user_id == current_user.id,
            IncomeHistory.category == "Revenue",
            IncomeHistory.status == "Paid"
        )
        .all()
    )
    import numpy as np
    cash_decls = (
        db.query(CashDeclaration)
        .filter(CashDeclaration.user_id == current_user.id)
        .order_by(CashDeclaration.week_ending.desc())
        .limit(12)
        .all()
    )
    cash_supplement = 0.0
    if cash_decls:
        weekly_weighted = [d.amount * (d.credibility_weight or 1.0) for d in cash_decls]
        cash_supplement = float(np.mean(weekly_weighted) * 4.33) if weekly_weighted else 0.0

    mu_val = (float(np.mean([r[0] for r in hist_incomes])) if hist_incomes else prev_credit_total) + cash_supplement

    # Baseline average is true moving average, mitigating single-month distortion
    avg_income      = max(mu_val, prev_credit_total) if mu_val > 0 else (prev_credit_total if prev_credit_total > 0 else curr_credit_total)
    dip_amount      = max(0.0, avg_income - curr_credit_total)
    claimed_dip_pct = dip_amount / avg_income if avg_income > 0 else 0.0

    # ── Server-Side Macro & Weather Oracles (Tamper-Resistant) ────────────────
    server_sector_dip = _calculate_sector_dip(current_user.sector, current_user.county, db)
    sector_dip = max(server_sector_dip, req.sector_dip)

    server_weather = check_severe_weather(current_user.county or "Nairobi")
    severe_weather_event = server_weather or req.severe_weather_event

    squad_avg_dip = _calculate_squad_dip(current_user.id, db)

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

    # ── Prophet forecast mismatch ────────────────────────────────────
    prophet_predicted_stable = (latest.risk_level == "LOW" and latest.dip_probability < 20)

    # ── Run composite fraud scorer ───────────────────────────────────
    fraud_result = engine.calculate_fraud_score(
        current_credit_count     = len(curr_credits),
        prev_credit_count        = len(prev_credits),
        current_credit_total     = curr_credit_total,
        prev_credit_total        = prev_credit_total,
        current_debit_count      = len(curr_debits),
        prev_debit_count         = len(prev_debits),
        sector_dip               = sector_dip,
        squad_avg_dip            = squad_avg_dip,
        claims_last_12m          = claims_last_12m,
        prophet_predicted_stable = prophet_predicted_stable,
        claimed_dip_pct          = claimed_dip_pct,
        severe_weather_event     = severe_weather_event,
    )
    fraud_action = fraud_result["action"]
    fraud_score  = fraud_result["fraud_score"]

    # ── Moral Hazard Dual-Trigger Gate ───────────────────────────────────────
    # Regardless of fraud score, a claim requires evidence of business activity.
    # If debits in the past 7 days are below threshold, check for squad attestation.
    seven_days_ago = now - timedelta(days=7)
    debits_7d = [t for t in curr_txns if t.transaction_type == "debit" and t.timestamp >= seven_days_ago]
    debit_count_7d  = len(debits_7d)
    debit_total_7d  = sum(t.amount for t in debits_7d)

    mu_for_gate = mu_val if mu_val > 0 else avg_income
    activity = engine.check_activity_signal(debit_count_7d, debit_total_7d, mu_for_gate)

    if not activity["active"]:
        # Check if any Trust Squad member has attested this user's claim (pre-filed)
        # We look for an open attestation for this user pending claim (most recent PENDING claim)
        pending_claim_attestation = (
            db.query(SquadAttestation)
            .join(Claim, SquadAttestation.claim_id == Claim.id)
            .filter(
                Claim.user_id == current_user.id,
                Claim.status  == "PENDING",
            )
            .first()
        )
        if not pending_claim_attestation:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "claim_blocked": "IDLE_BUSINESS_GATE",
                    "reason": activity["reason"],
                    "remedy": (
                        "To proceed, have a Trust Squad member attest your claim via "
                        "POST /squads/attest-claim. Their vouching will allow this claim "
                        "to process at 65% payout (5% attestation penalty applies)."
                    ),
                    "debit_count_last_7d": debit_count_7d,
                    "debit_total_last_7d": round(debit_total_7d, 2),
                }
            )
        # Squad attested — allow claim at 65% (5% penalty)
        attestation_penalty = True
    else:
        attestation_penalty = False


    co_insurance_rate = 0.60 if fraud_action == "SOFT_FLAG" else 0.70
    if attestation_penalty:
        co_insurance_rate = max(0.50, co_insurance_rate - 0.05)  # 5% attestation penalty

    # ── Pool Solvency Circuit Breaker ──────────────────────────────────
    all_policies = db.query(Policy.total_premiums_collected).all()
    tot_premiums = sum(p[0] for p in all_policies) if all_policies else 0.0
    all_payouts = db.query(Claim.payout).filter(Claim.status.in_(["APPROVED", "AUTO_DISBURSED"])).all()
    tot_payouts = sum(c[0] for c in all_payouts) if all_payouts else 0.0
    pool_loss_ratio = (tot_payouts / tot_premiums) if tot_premiums > 0 else 0.0

    circuit_breaker_active = False
    if pool_loss_ratio > 0.85:
        circuit_breaker_active = True
        co_insurance_rate = min(co_insurance_rate, 0.50)

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
        claim_status = "APPROVED"
    else:  # CLEAN
        # Auto-disburse if macro conditions confirm it and circuit breaker is not triggered
        auto_disburse = (
            (sector_dip > 0.2 or severe_weather_event) and
            velocity_score > 80 and
            not circuit_breaker_active
        )
        claim_status = "AUTO_DISBURSED" if auto_disburse else "APPROVED"

    # Build audit notes
    audit_note_parts = []
    if fraud_result["signals"]:
        audit_note_parts.append("Fraud signals: " + " | ".join(fraud_result["signals"]))
    if fraud_action == "SOFT_FLAG":
        audit_note_parts.append("Co-insurance reduced to 60% due to SOFT_FLAG.")
    if circuit_breaker_active:
        audit_note_parts.append(f"CIRCUIT_BREAKER_TRIGGERED: Pool loss ratio {pool_loss_ratio:.1%} > 85%. Co-insurance throttled to 50%.")
    audit_notes = "\n".join(audit_note_parts) if audit_note_parts else None

    claim = Claim(
        user_id         = current_user.id,
        policy_id       = policy.id,
        dip_amount      = dip_amount,
        payout          = payout,
        status          = claim_status,
        auto_disbursed  = auto_disburse,
        sector_dip      = sector_dip,
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

    # ── Real Safaricom Daraja B2C Payout Integration ─────────────────
    disbursement_info = None
    if claim_status in ("AUTO_DISBURSED", "APPROVED") and payout > 0:
        b2c = get_b2c_client()
        disbursement_info = b2c.disburse(
            phone=current_user.phone or "254700000000",
            amount=payout,
            claim_id=claim.id
        )

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
            f"[APPROVED] Claim approved at 60% indemnity. "
            f"Payout: KSh {payout:.2f} dispatched to M-Pesa."
        )
    else:
        msg = f"[APPROVED] Claim approved. KSh {payout:.2f} dispatched to M-Pesa."

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


# ─── Trust Squads (Peer Risk Pools) ──────────────────────────────────────────

@app.post("/squads/create", tags=["Trust Squads"])
def create_squad(
    req:          CreateSquadRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """Create a new Trust Squad and assign current user as leader."""
    import secrets
    code = f"SQ-{secrets.token_hex(3).upper()}"
    squad_name = req.squad_title or "My Squad"
    squad = TrustSquad(
        name      = squad_name,
        code      = code,
        county    = current_user.county,
        sector    = current_user.sector,
        leader_id = current_user.id
    )
    db.add(squad)
    db.flush()

    member = SquadMember(
        squad_id = squad.id,
        user_id  = current_user.id,
        status   = "ACTIVE"
    )
    db.add(member)
    db.commit()
    db.refresh(squad)

    return {
        "status":     "success",
        "squad_id":   squad.id,
        "name":       squad.name,
        "squad_name": squad.name,
        "code":        squad.code,
        "invite_code": squad.code,
        "message":    f"Squad '{squad.name}' created! Share code {squad.code} with your peers."
    }


@app.post("/squads/join", tags=["Trust Squads"])
def join_squad(
    req:          JoinSquadRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """Join an existing Trust Squad using its unique invite code."""
    code = req.squad_code
    squad = db.query(TrustSquad).filter(TrustSquad.code == code).first()
    if not squad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad with code '{code}' not found."
        )

    # Check if already a member
    existing = db.query(SquadMember).filter(
        SquadMember.squad_id == squad.id,
        SquadMember.user_id  == current_user.id
    ).first()
    if existing:
        return {
            "status":      "already_member",
            "squad_id":    squad.id,
            "name":        squad.name,
            "squad_name":  squad.name,
            "code":        squad.code,
            "invite_code": squad.code,
            "message":     f"You are already a member of squad '{squad.name}'."
        }

    member = SquadMember(
        squad_id = squad.id,
        user_id  = current_user.id,
        status   = "ACTIVE"
    )
    db.add(member)
    db.commit()

    return {
        "status":      "success",
        "squad_id":    squad.id,
        "name":        squad.name,
        "squad_name":  squad.name,
        "code":        squad.code,
        "invite_code": squad.code,
        "message":     f"Successfully joined '{squad.name}'! Your No-Claim Dividend is now active."
    }


@app.get("/squads/me", tags=["Trust Squads"])
def get_my_squad(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """Get the authenticated user's active Trust Squad and peers."""
    membership = (
        db.query(SquadMember)
        .filter(
            SquadMember.user_id == current_user.id,
            SquadMember.status  == "ACTIVE"
        )
        .first()
    )
    if not membership:
        return {"has_squad": False}

    squad = db.query(TrustSquad).filter(TrustSquad.id == membership.squad_id).first()
    all_members = (
        db.query(SquadMember)
        .filter(
            SquadMember.squad_id == squad.id,
            SquadMember.status   == "ACTIVE"
        )
        .all()
    )
    members_data = []
    for m in all_members:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            members_data.append({
                "user_id":   u.id,
                "name":      u.name,
                "sector":    u.sector,
                "is_leader": (u.id == squad.leader_id)
            })

    return {
        "has_squad":         True,
        "squad_id":          squad.id,
        "name":              squad.name,
        "code":              squad.code,
        "county":            squad.county,
        "sector":            squad.sector,
        "member_count":      len(members_data),
        "members":           members_data,
        "no_claim_dividend": True,
        "dividend_rate":     0.003,  # -0.3% discount
    }


# ─── Squad Attestation (Moral Hazard Gate) ───────────────────────────────────

class AttestClaimRequest(BaseModel):
    claim_id: int
    notes: Optional[str] = None


@app.post("/squads/attest-claim", tags=["Trust Squads"])
def attest_claim(
    req:          AttestClaimRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """
    A Trust Squad member vouches for a peer's income dip claim.
    Required when the claimant has insufficient debit activity in the last 7 days.
    Attestation allows the claim to proceed at 65% payout (5% penalty vs standard 70%).
    """
    # 1. Find the claim
    claim = db.query(Claim).filter(Claim.id == req.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    # 2. Verify attester is a squad peer of the claimant
    attester_membership = (
        db.query(SquadMember)
        .filter(SquadMember.user_id == current_user.id, SquadMember.status == "ACTIVE")
        .first()
    )
    if not attester_membership:
        raise HTTPException(
            status_code=403,
            detail="You must be an active Trust Squad member to attest a claim."
        )

    claimant_membership = (
        db.query(SquadMember)
        .filter(
            SquadMember.user_id  == claim.user_id,
            SquadMember.squad_id == attester_membership.squad_id,
            SquadMember.status   == "ACTIVE"
        )
        .first()
    )
    if not claimant_membership:
        raise HTTPException(
            status_code=403,
            detail="Claimant is not in your Trust Squad. You can only attest for squad peers."
        )

    # 3. Cannot attest your own claim
    if current_user.id == claim.user_id:
        raise HTTPException(status_code=400, detail="You cannot attest your own claim.")

    # 4. Check for duplicate attestation
    existing = db.query(SquadAttestation).filter(
        SquadAttestation.claim_id         == req.claim_id,
        SquadAttestation.attester_user_id == current_user.id,
    ).first()
    if existing:
        return {"status": "already_attested", "claim_id": req.claim_id}

    # 5. Record attestation
    attestation = SquadAttestation(
        claim_id         = req.claim_id,
        attester_user_id = current_user.id,
        notes            = req.notes,
    )
    db.add(attestation)
    db.commit()

    return {
        "status":    "attested",
        "claim_id":  req.claim_id,
        "attester":  current_user.name,
        "message":   (
            "Attestation recorded. The claimant's pending claim will now be processed "
            "at 65% payout (5% attestation penalty applies)."
        ),
    }


# ─── Cash Income Declaration (Cash Economy Supplement) ───────────────────────

class CashDeclarationRequest(BaseModel):
    amount:      float
    week_ending: str            # ISO date "YYYY-MM-DD"
    notes:       Optional[str] = None


@app.post("/income/declare-cash", tags=["Income"])
def declare_cash_income(
    req:          CashDeclarationRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """
    Self-report weekly cash income that did not pass through M-Pesa.
    Stored with a credibility weight computed from the ratio of declared cash
    to M-Pesa credits in the same week. A HIGH_CASH_RATIO flag is raised when
    declared cash exceeds 3× M-Pesa credits (not rejected — weighted at 60%).
    """
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Declared cash amount must be positive.")

    # Determine the 7-day window for the declared week
    try:
        from datetime import date
        week_end   = date.fromisoformat(req.week_ending)
        week_start = week_end - timedelta(days=6)
        week_start_dt = datetime.combine(week_start, datetime.min.time())
        week_end_dt   = datetime.combine(week_end,   datetime.max.time())
    except ValueError:
        raise HTTPException(status_code=400, detail="week_ending must be a valid ISO date (YYYY-MM-DD).")

    # Sum M-Pesa credits in this same week
    mpesa_credits_this_week = (
        db.query(Transaction.amount)
        .filter(
            Transaction.user_id          == current_user.id,
            Transaction.transaction_type == "credit",
            Transaction.timestamp        >= week_start_dt,
            Transaction.timestamp        <= week_end_dt,
        )
        .all()
    )
    mpesa_total = sum(r[0] for r in mpesa_credits_this_week) if mpesa_credits_this_week else 0.0

    # Credibility weighting
    if mpesa_total > 0 and req.amount > mpesa_total * 3:
        credibility_weight = 0.6
        credibility_flag   = "HIGH_CASH_RATIO"
        badge              = "🟡 Partially counted (60%)"
        badge_detail       = (
            f"Declared cash (KSh {req.amount:,.0f}) is more than 3× your M-Pesa "
            f"credits this week (KSh {mpesa_total:,.0f}). "
            f"It has been weighted at 60% of face value."
        )
    elif req.amount > 100_000:
        # Very large cash declarations without any M-Pesa anchor → flag for review
        credibility_weight = 0.0
        credibility_flag   = "FLAGGED"
        badge              = "🔴 Flagged for admin review"
        badge_detail       = (
            "Declarations above KSh 100,000 with no corresponding M-Pesa income "
            "are held for manual review before being added to your baseline."
        )
    else:
        credibility_weight = 1.0
        credibility_flag   = "OK"
        badge              = "🟢 Fully counted (100%)"
        badge_detail       = "Your declared cash income will be fully included in your income baseline."

    # Upsert — if same user + week_ending already exists, update it
    existing = db.query(CashDeclaration).filter(
        CashDeclaration.user_id     == current_user.id,
        CashDeclaration.week_ending == req.week_ending,
    ).first()

    if existing:
        existing.amount             = req.amount
        existing.credibility_weight = credibility_weight
        existing.credibility_flag   = credibility_flag
        existing.notes              = req.notes
        db.commit()
        db.refresh(existing)
        decl_id = existing.id
    else:
        decl = CashDeclaration(
            user_id            = current_user.id,
            amount             = req.amount,
            week_ending        = req.week_ending,
            credibility_weight = credibility_weight,
            credibility_flag   = credibility_flag,
            notes              = req.notes,
        )
        db.add(decl)
        db.commit()
        db.refresh(decl)
        decl_id = decl.id

    return {
        "status":             "recorded",
        "declaration_id":     decl_id,
        "amount":             req.amount,
        "week_ending":        req.week_ending,
        "credibility_weight": credibility_weight,
        "credibility_flag":   credibility_flag,
        "badge":              badge,
        "badge_detail":       badge_detail,
        "mpesa_credits_same_week": round(mpesa_total, 2),
        "weighted_amount":    round(req.amount * credibility_weight, 2),
    }


@app.get("/income/cash-declarations", tags=["Income"])
def get_cash_declarations(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    """List all cash declarations for the authenticated user, most recent first."""
    decls = (
        db.query(CashDeclaration)
        .filter(CashDeclaration.user_id == current_user.id)
        .order_by(CashDeclaration.week_ending.desc())
        .limit(52)  # up to 1 year of weekly records
        .all()
    )
    return [
        {
            "id":                 d.id,
            "amount":             d.amount,
            "week_ending":        d.week_ending,
            "credibility_weight": d.credibility_weight,
            "credibility_flag":   d.credibility_flag,
            "weighted_amount":    round(d.amount * d.credibility_weight, 2),
            "notes":              d.notes,
            "declared_at":        d.declared_at.isoformat() if d.declared_at else None,
        }
        for d in decls
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


# ─── Africa's Talking USSD Gateway (Pillar 4: Feature-Phone Access) ──────────

@app.post("/ussd", tags=["USSD Gateway"])
async def ussd_gateway(request: Request, db: Session = Depends(get_db)):
    """
    Africa's Talking / Telco GSM USSD Gateway endpoint (*384*432#).
    Supports multi-turn USSD sessions for non-smartphone and remote users:
      - 1: Select Protection Tier (Bronze, Silver, Gold)
      - 2: Check Policy & Incubation Status
      - 3: Declare Weekly Cash Income
      - 4: File Parametric Dip Claim
      - 5: Trust Squad & Dividends
    Returns text/plain starting with CON (continue) or END (terminate session).
    """
    content_type = request.headers.get("content-type", "")
    session_id   = ""
    service_code = "*384*432#"
    phone_number = ""
    text_input   = ""

    if "application/json" in content_type:
        try:
            body = await request.json()
            session_id   = str(body.get("sessionId", ""))
            service_code = str(body.get("serviceCode", "*384*432#"))
            phone_number = str(body.get("phoneNumber", ""))
            text_input   = str(body.get("text", "")).strip()
        except Exception:
            pass
    else:
        form = await request.form()
        session_id   = str(form.get("sessionId", ""))
        service_code = str(form.get("serviceCode", "*384*432#"))
        phone_number = str(form.get("phoneNumber", ""))
        text_input   = str(form.get("text", "")).strip()

    # Fallback to query params if empty
    if not phone_number and request.query_params.get("phoneNumber"):
        phone_number = str(request.query_params.get("phoneNumber", ""))
    if not text_input and request.query_params.get("text"):
        text_input = str(request.query_params.get("text", "")).strip()

    # Normalize phone: +2547...
    clean_digits = "".join(ch for ch in phone_number if ch.isdigit())
    if clean_digits.startswith("07") or clean_digits.startswith("01"):
        clean_digits = "254" + clean_digits[1:]
    elif not clean_digits.startswith("254") and len(clean_digits) == 9:
        clean_digits = "254" + clean_digits

    phone_normalized = f"+{clean_digits}" if clean_digits else "+254700000000"

    # Resolve or auto-provision USSD user
    user = db.query(User).filter(
        (User.phone == phone_normalized) | (User.phone == clean_digits)
    ).first()
    if not user:
        from auth import hash_password
        user = User(
            name=f"USSD Trader {clean_digits[-4:] if len(clean_digits) >= 4 else '0000'}",
            email=f"{clean_digits}@ussd.idcs.co.ke",
            phone=phone_normalized,
            password_hash=hash_password("ussd_secret_pass"),
            employment_type="Self-Employed/Jua Kali",
            sector="Retail",
            county="Nairobi",
            src_cap=35000.0,
            premium=0.015,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    policy = db.query(Policy).filter(
        Policy.user_id == user.id,
        Policy.status.in_(["ACTIVE", "INCUBATING", "GRACE_PERIOD", "SUSPENDED"])
    ).first()

    parts = [p.strip() for p in text_input.split("*")] if text_input else []

    # 1. Root Menu
    if not parts or parts == [""]:
        menu = (
            "CON Karibu IDCS Bima ya Gig (*384*432#)\n"
            "1. Select Protection Tier\n"
            "2. Check Policy & Incubation\n"
            "3. Declare Weekly Cash\n"
            "4. File Income Dip Claim\n"
            "5. Trust Squad Status"
        )
        return Response(content=menu, media_type="text/plain")

    # 2. Tier Selection Menu
    if parts[0] == "1":
        if len(parts) == 1:
            menu = (
                "CON Choose Protection Tier:\n"
                "1. Bronze (KES 25k base, KES 17.5k cover)\n"
                "2. Silver (KES 50k base, KES 35k cover)\n"
                "3. Gold (KES 90k base, KES 63k cover)"
            )
            return Response(content=menu, media_type="text/plain")

        tier_choice = parts[1]
        tier_map = {"1": "TIER_1", "2": "TIER_2", "3": "TIER_3"}
        selected_tier_id = tier_map.get(tier_choice, "TIER_2")
        tier_info = PARAMETRIC_TIERS[selected_tier_id]

        txn_count = db.query(Transaction).filter(Transaction.user_id == user.id).count()
        now = datetime.utcnow()
        init_status = "ACTIVE" if txn_count >= 5 else "INCUBATING"
        inc_ends = None if init_status == "ACTIVE" else (now + timedelta(days=21))

        if policy:
            policy.tier           = selected_tier_id
            policy.coverage_limit = tier_info["coverage_limit"]
            policy.premium_rate   = tier_info["premium_rate"]
            if policy.status == "INCUBATING":
                policy.incubation_ends_at = inc_ends
            db.commit()
        else:
            policy = Policy(
                user_id            = user.id,
                tier               = selected_tier_id,
                coverage_limit     = tier_info["coverage_limit"],
                premium_rate       = tier_info["premium_rate"],
                status             = init_status,
                incubation_ends_at = inc_ends,
            )
            db.add(policy)
            db.commit()

        user.src_cap = tier_info["coverage_limit"]
        user.premium = tier_info["premium_rate"]
        db.commit()

        msg = (
            f"END {tier_info['name']} Activated!\n"
            f"Cover: KES {tier_info['coverage_limit']:,.0f} (70% indemnity).\n"
            f"Rate: {tier_info['premium_rate']:.1%} per Lipa M-Pesa txn.\n"
            + ("Live Daraja incubation started (21 days). Zero documents needed." if init_status == "INCUBATING" else "Protection is ACTIVE immediately.")
        )
        return Response(content=msg, media_type="text/plain")

    # 3. Check Policy & Incubation Status
    if parts[0] == "2":
        if not policy:
            return Response(
                content="END No policy found. Redial *384*432# and press 1 to choose your tier.",
                media_type="text/plain"
            )
        now = datetime.utcnow()
        if policy.status == "INCUBATING":
            days_left = max(0, (policy.incubation_ends_at - now).days) if policy.incubation_ends_at else 21
            inc_txns = db.query(Transaction).filter(
                Transaction.user_id == user.id,
                Transaction.timestamp >= (policy.start_date or now)
            ).count()
            msg = (
                f"END Policy Status: INCUBATING ({policy.tier})\n"
                f"Observation: Day {21 - days_left}/21\n"
                f"Txns Observed: {inc_txns}/10\n"
                f"Target Cover: KES {policy.coverage_limit:,.0f}\n"
                f"Full shield unlocks after incubation."
            )
        else:
            msg = (
                f"END Policy Status: {policy.status} ({policy.tier})\n"
                f"Coverage Limit: KES {policy.coverage_limit:,.0f}\n"
                f"Micro-Rate: {policy.premium_rate:.1%}\n"
                f"Total Premiums: KES {policy.total_premiums_collected:,.2f}"
            )
        return Response(content=msg, media_type="text/plain")

    # 4. Declare Weekly Cash Income
    if parts[0] == "3":
        if len(parts) == 1:
            return Response(
                content="CON Enter weekly cash earned in KES (e.g. 15000):",
                media_type="text/plain"
            )
        try:
            amt = float(parts[1])
            if amt <= 0:
                return Response(content="END Invalid amount. Must be positive.", media_type="text/plain")
        except ValueError:
            return Response(content="END Invalid number entered.", media_type="text/plain")

        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        decl = CashDeclaration(
            user_id            = user.id,
            amount             = amt,
            week_ending        = today_str,
            credibility_weight = 1.0 if amt <= 30000 else 0.6,
            credibility_flag   = "OK" if amt <= 30000 else "HIGH_CASH_RATIO",
            notes              = "Self-declared via USSD *384*432#",
        )
        db.add(decl)
        db.commit()

        msg = (
            f"END KES {amt:,.0f} cash declared for week of {today_str}.\n"
            f"Weight: {decl.credibility_weight:.0%} counted.\n"
            f"Added to your baseline income!"
        )
        return Response(content=msg, media_type="text/plain")

    # 5. File Income Dip Claim
    if parts[0] == "4":
        if not policy:
            return Response(
                content="END You have no policy. Dial *384*432# and press 1 to select a tier first.",
                media_type="text/plain"
            )

        # Activity signal check
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        txns_7d = db.query(Transaction).filter(
            Transaction.user_id == user.id,
            Transaction.timestamp >= seven_days_ago
        ).all()
        debits_7d = [t for t in txns_7d if t.transaction_type == "debit"]
        debit_count = len(debits_7d)
        debit_total = sum(t.amount for t in debits_7d)

        # Baseline mu
        mu = policy.coverage_limit / 0.7 if policy.coverage_limit > 0 else 35000.0
        activity = engine.check_activity_signal(debit_count, debit_total, mu)

        if not activity["active"]:
            # Check squad attestation
            attestation = (
                db.query(SquadAttestation)
                .join(Claim, SquadAttestation.claim_id == Claim.id)
                .filter(Claim.user_id == user.id, Claim.status == "PENDING")
                .first()
            )
            if not attestation:
                return Response(
                    content=(
                        "END Claim BLOCKED (IDLE_BUSINESS_GATE).\n"
                        "No spending activity detected in last 7 days.\n"
                        "Ask a Trust Squad member to vouch for your shop."
                    ),
                    media_type="text/plain"
                )
            payout = round(policy.coverage_limit * 0.65, 2)  # 65% with attestation penalty
        else:
            payout = round(policy.coverage_limit * 0.70, 2)

        # Disburse simulated B2C
        b2c = get_b2c_client()
        b2c.disburse(phone=user.phone or "254700000000", amount=payout, claim_id=0)

        # Record claim
        claim = Claim(
            user_id         = user.id,
            policy_id       = policy.id,
            dip_amount      = mu * 0.5,
            payout          = payout,
            status          = "AUTO_DISBURSED",
            auto_disbursed  = True,
            audit_notes     = "Filed via USSD *384*432#",
        )
        db.add(claim)
        db.commit()

        msg = (
            f"END Claim APPROVED!\n"
            f"KES {payout:,.0f} dispatched via M-Pesa B2C.\n"
            f"Ref: M-Pesa confirmation SMS will arrive shortly."
        )
        return Response(content=msg, media_type="text/plain")

    # 6. Trust Squad Menu
    if parts[0] == "5":
        membership = (
            db.query(SquadMember)
            .filter(SquadMember.user_id == user.id, SquadMember.status == "ACTIVE")
            .first()
        )
        if not membership:
            return Response(
                content="END You are not in a Trust Squad yet. Visit the web app to create or join a squad.",
                media_type="text/plain"
            )
        squad = db.query(TrustSquad).filter(TrustSquad.id == membership.squad_id).first()
        count = db.query(SquadMember).filter(SquadMember.squad_id == squad.id, SquadMember.status == "ACTIVE").count()
        msg = (
            f"END Trust Squad: {squad.name}\n"
            f"Invite Code: {squad.code}\n"
            f"Active Peers: {count}\n"
            f"Dividend: -0.3% discount active!"
        )
        return Response(content=msg, media_type="text/plain")

    # Fallback
    return Response(content="END Invalid option selected. Dial *384*432# to restart.", media_type="text/plain")


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def read_root():
    return {"status": "online", "version": "1.2.0", "system": "IDCS API — Zero-Document Underwriting Live"}


