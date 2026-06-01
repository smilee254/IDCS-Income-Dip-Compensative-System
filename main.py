"""
IDCS FastAPI Backend — Phase 1 Complete
Endpoints: Auth, Evaluation, Daraja Webhook, Claims, Pool Metrics
"""
import json
import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, status, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    register_user, login_user,
    get_current_user, get_current_admin, get_db
)
from database import (
    init_db, SessionLocal,
    User, IncomeHistory, Transaction, Policy, Claim, RiskScore
)
from engine import IDCS_Engine, calculate_custom_premium

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Income Dip Compensation System API",
    version="1.1.0",
    description="Actuarially-modelled micro-insurance for gig workers."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
engine = IDCS_Engine()


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
                df_monthly, result["mu"], sector_dip=req.sector_dip
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

    # 2. Calculate micro-premium deduction (only on credit transactions)
    micro_deducted = 0.0
    if payload.transaction_type.lower() == "credit" and payload.amount > 0:
        micro_deducted = round(payload.amount * policy.premium_rate, 2)
        policy.total_premiums_collected += micro_deducted

    # 3. Record the transaction
    txn = Transaction(
        user_id                = current_user.id,
        amount                 = payload.amount,
        transaction_type       = payload.transaction_type,
        source                 = payload.source,
        reference              = payload.reference,
        micro_premium_deducted = micro_deducted,
        timestamp              = datetime.fromisoformat(payload.timestamp),
        raw_payload            = json.dumps(payload.dict()),
    )
    db.add(txn)

    # 4. Recalculate velocity score from last 30 transactions
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

    # 5. Snapshot the updated risk score
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

    return {
        "status":           "success",
        "transaction_id":   txn.id,
        "micro_deducted":   micro_deducted,
        "velocity_score":   velocity_score,
        "policy_id":        policy.id,
        "premiums_total":   round(policy.total_premiums_collected, 2),
        "message":          f"Transaction recorded. KSh {micro_deducted:.2f} micro-premium deducted."
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
    Requires a prior /evaluate call to have established eligibility.
    Persists the claim with APPROVED, AUTO_DISBURSED, or FLAGGED_FOR_AUDIT status.
    """
    # Fetch latest risk snapshot to get current scores
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

    # Fetch active policy
    policy = db.query(Policy).filter(
        Policy.user_id == current_user.id,
        Policy.status  == "ACTIVE"
    ).first()

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active policy found. Please complete onboarding."
        )

    # Recalculate quick metrics for the claim record
    recent_txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.timestamp.desc())
        .limit(30)
        .all()
    )
    credit_txns = [t for t in recent_txns if t.transaction_type == "credit"]
    if not credit_txns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No recent credit transactions detected. Claim cannot proceed."
        )

    avg_income  = sum(t.amount for t in credit_txns) / len(credit_txns)
    latest_income = credit_txns[0].amount if credit_txns else 0.0
    dip_amount  = max(0.0, avg_income - latest_income)
    payout      = min(policy.coverage_limit, dip_amount * 0.70)

    # Fraud / audit flag
    needs_audit = (
        dip_amount > 0.3 * avg_income and
        req.sector_dip < 0.05 and
        not req.severe_weather_event
    )

    # Determine claim status
    velocity_score = latest.velocity_score
    auto_disburse  = (
        not needs_audit and
        (req.sector_dip > 0.2 or req.severe_weather_event) and
        velocity_score > 80
    )

    if needs_audit:
        claim_status = "FLAGGED_FOR_AUDIT"
    elif auto_disburse:
        claim_status = "AUTO_DISBURSED"
    else:
        claim_status = "APPROVED"

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
        audit_notes     = "Auto-flagged: high personal dip with no macro corroboration." if needs_audit else None,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    return {
        "claim_id":      claim.id,
        "status":        claim.status,
        "dip_amount":    round(dip_amount, 2),
        "payout":        round(payout, 2),
        "auto_disbursed": auto_disburse,
        "needs_audit":   needs_audit,
        "message":       (
            "🚨 Claim flagged for manual audit. A compliance officer will review within 48 hours."
            if needs_audit else
            "✅ Claim approved. Payout will be sent to your M-Pesa by the 1st."
        )
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
    IDCS AI Copilot — context-aware financial advice.
    Pulls the user's real transaction and risk score history to personalise responses.
    """
    user_prompt = req.messages[-1].get("content", "").lower() if req.messages else ""

    # Build real context from DB
    recent_txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.timestamp.desc())
        .limit(10)
        .all()
    )
    latest_score = (
        db.query(RiskScore)
        .filter(RiskScore.user_id == current_user.id)
        .order_by(RiskScore.snapshot_at.desc())
        .first()
    )

    velocity = latest_score.velocity_score if latest_score else 0.0
    level    = latest_score.financial_level if latest_score else 1

    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("models/gemini-2.5-flash")

        system_context = f"""You are the IDCS AI Copilot, a financial advisor for African gig workers.

User: {current_user.name}
Employment: {current_user.employment_type or 'Gig Worker'}
Sector: {current_user.sector or 'Informal'}
Velocity Score: {velocity:.1f}/100
Financial Level: {level}/3
Recent Transactions: {len(recent_txns)} in last 30 days

Your role: Give hyper-personalized, actionable advice to help this worker
stabilize their income and improve their IDCS score. Be concise (max 3 sentences).
Do not use generic advice. Reference their actual metrics."""

        full_prompt = f"{system_context}\n\nUser question: {user_prompt}"
        response    = model.generate_content(full_prompt)
        reply       = response.text

    except Exception:
        # Graceful fallback if API key not configured
        if "velocity" in user_prompt or "score" in user_prompt:
            reply = f"Your velocity score is {velocity:.0f}/100. {'You are at Level 3 — excellent standing!' if level == 3 else 'Increase daily transactions to reach Level 3 and unlock premium discounts.'}"
        elif "claim" in user_prompt:
            reply = "To file a claim, ensure your income dip is verified by the sector data. Use /claims/file after your /evaluate call confirms eligibility."
        else:
            reply = f"Hello {current_user.name}! Your current velocity score is {velocity:.0f}/100. I monitor your M-Pesa flows daily to help you stay ahead of income dips."

    return {"content": reply, "velocity_score": velocity, "financial_level": level}


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

