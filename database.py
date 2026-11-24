import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    Boolean, ForeignKey, DateTime, Text, Enum, Index, event, text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

Base = declarative_base()

# ─── Core User ────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String, nullable=False)
    email             = Column(String, unique=True, index=True, nullable=False)
    phone             = Column(String, unique=True, nullable=True)
    password_hash     = Column(String, nullable=False)
    age               = Column(Integer, nullable=True)
    employment_type   = Column(String, nullable=True)
    sector            = Column(String, nullable=True)
    county            = Column(String, nullable=True)
    src_tax_bracket   = Column(String, default="Bracket 3")
    src_cap           = Column(Float, default=50000.0)
    premium           = Column(Float, default=0.0)
    till_number       = Column(String, nullable=True)
    till_type         = Column(String, default="BUY_GOODS") # "BUY_GOODS" | "PAYBILL" | "POCHI_LA_BIASHARA" | "PERSONAL"
    till_verified     = Column(Boolean, default=False)
    deferred_period   = Column(Integer, default=30)
    is_admin          = Column(Boolean, default=False)
    created_at        = Column(DateTime, default=datetime.utcnow)

    # Relationships
    incomes      = relationship("IncomeHistory",  back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction",    back_populates="user", cascade="all, delete-orphan")
    policies     = relationship("Policy",         back_populates="user", cascade="all, delete-orphan")
    claims       = relationship("Claim",          back_populates="user", cascade="all, delete-orphan")
    risk_scores  = relationship("RiskScore",      back_populates="user", cascade="all, delete-orphan")


# ─── Income History (manual / CSV ingestion) ──────────────────────────────────

class IncomeHistory(Base):
    __tablename__ = "income_history"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    month_index   = Column(Integer)           # 1–N relative month
    income_amount = Column(Float, default=0.0)
    status        = Column(String, default="Paid")   # "Paid" | "Unpaid"
    category      = Column(String, default="Revenue") # "Revenue" | "Loan" | "Chama" | "P2P_Transfer"
    recorded_at   = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="incomes")


# ─── Live Transactions (webhook / M-Pesa ingestion) ───────────────────────────

class Transaction(Base):
    __tablename__ = "transactions"
    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount           = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)   # "credit" | "debit"
    source           = Column(String, default="daraja") # "daraja" | "open_banking"
    reference        = Column(String, unique=True, index=True, nullable=True)    # M-Pesa transaction ID
    micro_premium_deducted = Column(Float, default=0.0)
    category         = Column(String, default="Revenue") # "Revenue" | "Loan" | "P2P_Personal" | "Chama" | "Reversal" | "Cashback"
    sender_hash      = Column(String, nullable=True, index=True) # SHA-256 of payer MSISDN (KDPA Privacy)
    is_settled       = Column(Boolean, default=False)   # True after 24h settlement window without reversal
    reversal_ref     = Column(String, nullable=True)    # References original transaction reference if reversed
    anomaly_flag     = Column(String, nullable=True)    # "OUTLIER_AMOUNT" | "SUSPECTED_DIVERSION"
    timestamp        = Column(DateTime, default=datetime.utcnow)
    raw_payload      = Column(Text, nullable=True)      # full JSON for audit

    user = relationship("User", back_populates="transactions")


# ─── Policies ─────────────────────────────────────────────────────────────────

class Policy(Base):
    __tablename__ = "policies"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    premium_rate   = Column(Float, nullable=False)      # e.g. 0.015 = 1.5%
    coverage_limit = Column(Float, nullable=False)      # max payout ceiling (KSh)
    tier           = Column(String, default="TIER_2")   # "TIER_1" | "TIER_2" | "TIER_3" | "CUSTOM"
    status         = Column(String, default="ACTIVE")   # "INCUBATING" | "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "LAPSED"
    start_date     = Column(DateTime, default=datetime.utcnow)
    incubation_ends_at = Column(DateTime, nullable=True)# When 21-day observation finishes
    end_date       = Column(DateTime, nullable=True)
    total_premiums_collected = Column(Float, default=0.0)
    arrears_balance          = Column(Float, default=0.0)   # Outstanding premium debt (KSh)
    arrears_catch_up_txns    = Column(Integer, default=0)   # Remaining catch-up transactions
    grace_period_since       = Column(DateTime, nullable=True)  # When silence was first detected

    user   = relationship("User",  back_populates="policies")
    claims = relationship("Claim", back_populates="policy", cascade="all, delete-orphan")
    alerts = relationship("PremiumAlert", back_populates="policy", cascade="all, delete-orphan")


# ─── Claims ───────────────────────────────────────────────────────────────────

class Claim(Base):
    __tablename__ = "claims"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    policy_id      = Column(Integer, ForeignKey("policies.id"), nullable=True)
    dip_amount     = Column(Float, nullable=False)      # verified income drop (KSh)
    payout         = Column(Float, nullable=False)      # 70% of dip_amount, capped
    status         = Column(String, default="PENDING")  # "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED_FOR_AUDIT" | "AUTO_DISBURSED"
    auto_disbursed = Column(Boolean, default=False)
    sector_dip     = Column(Float, default=0.0)
    velocity_score = Column(Float, default=0.0)
    stability_score= Column(Float, default=0.0)
    audit_notes    = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    resolved_at    = Column(DateTime, nullable=True)

    user   = relationship("User",   back_populates="claims")
    policy = relationship("Policy", back_populates="claims")


# ─── Risk Scores (snapshot per evaluation) ────────────────────────────────────

class RiskScore(Base):
    __tablename__ = "risk_scores"
    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    velocity_score  = Column(Float, default=0.0)
    stability_score = Column(Float, default=0.0)
    fraud_score     = Column(Float, default=0.0)    # 0 = clean, 100 = high suspicion
    risk_level      = Column(String, default="LOW") # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    financial_level = Column(Integer, default=1)    # gamification tier
    dip_probability = Column(Float, default=0.0)
    snapshot_at     = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="risk_scores")


# ─── Premium Alerts (Grace Period & Arrears Tracking) ─────────────────────────

class PremiumAlert(Base):
    __tablename__ = "premium_alerts"
    id                       = Column(Integer, primary_key=True, index=True)
    user_id                  = Column(Integer, ForeignKey("users.id"), nullable=False)
    policy_id                = Column(Integer, ForeignKey("policies.id"), nullable=False)
    reason                   = Column(String, default="Income Gap Detected")
    days_silent              = Column(Integer, default=0)         # Calendar days with no credit txn
    arrears_amount           = Column(Float, default=0.0)         # Total KSh owed at detection
    catch_up_txns_remaining  = Column(Integer, default=0)         # Transactions left to spread debt
    reminders_sent           = Column(Integer, default=0)         # Count of SMS reminders dispatched
    status                   = Column(String, default="ACTIVE")   # "ACTIVE" | "RESOLVED" | "ESCALATED"
    first_detected           = Column(DateTime, default=datetime.utcnow)
    last_reminder            = Column(DateTime, nullable=True)
    resolved_at              = Column(DateTime, nullable=True)

    user   = relationship("User")
    policy = relationship("Policy", back_populates="alerts")


# ─── Phone OTP Verification ───────────────────────────────────────────────────

class OTPVerification(Base):
    __tablename__ = "otp_verifications"
    id          = Column(Integer, primary_key=True, index=True)
    phone       = Column(String, index=True, nullable=False)
    otp_code    = Column(String, nullable=False)
    expires_at  = Column(DateTime, nullable=False)
    is_verified = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)


# ─── Trust Squads (Peer Risk Pools) ──────────────────────────────────────────

class TrustSquad(Base):
    __tablename__ = "trust_squads"
    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    code        = Column(String, unique=True, index=True, nullable=False)
    county      = Column(String, nullable=True)
    sector      = Column(String, nullable=True)
    leader_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    leader      = relationship("User", foreign_keys=[leader_id])
    members     = relationship("SquadMember", back_populates="squad", cascade="all, delete-orphan")


class SquadMember(Base):
    __tablename__ = "squad_members"
    id          = Column(Integer, primary_key=True, index=True)
    squad_id    = Column(Integer, ForeignKey("trust_squads.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    status      = Column(String, default="ACTIVE")   # "ACTIVE" | "INACTIVE"
    joined_at   = Column(DateTime, default=datetime.utcnow)

    squad       = relationship("TrustSquad", back_populates="members")
    user        = relationship("User")


# ─── Forecast Cache (Persistent Prophet Storage) ──────────────────────────────

class ForecastCache(Base):
    __tablename__ = "forecast_cache"
    id               = Column(Integer, primary_key=True, index=True)
    cache_key        = Column(String, unique=True, index=True, nullable=False)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    risk_score       = Column(Float, default=0.0)
    predictions_json = Column(Text, nullable=False)
    created_at       = Column(DateTime, default=datetime.utcnow)

    user             = relationship("User")


# ─── Squad Attestation (Moral Hazard Gate) ────────────────────────────────────
# A Trust Squad member can vouch for a peer's claim when debit-activity signals
# are absent. Attestation allows the claim but triggers a 5% payout penalty.

class SquadAttestation(Base):
    __tablename__ = "squad_attestations"
    id               = Column(Integer, primary_key=True, index=True)
    claim_id         = Column(Integer, ForeignKey("claims.id"), nullable=False)
    attester_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    attested_at      = Column(DateTime, default=datetime.utcnow)
    notes            = Column(Text, nullable=True)

    claim    = relationship("Claim")
    attester = relationship("User", foreign_keys=[attester_user_id])


# ─── Cash Declaration (Cash Economy Supplement) ───────────────────────────────
# Self-reported weekly cash income. Credibility-weighted before merging with
# M-Pesa credits when computing the income baseline (µ).

class CashDeclaration(Base):
    __tablename__ = "cash_declarations"
    id                 = Column(Integer, primary_key=True, index=True)
    user_id            = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount             = Column(Float, nullable=False)             # Declared KSh for the week
    week_ending        = Column(String, nullable=False)            # ISO date string "YYYY-MM-DD"
    credibility_weight = Column(Float, default=1.0)                # 1.0=full, 0.6=partial, 0.0=flagged
    credibility_flag   = Column(String, default="OK")              # "OK"|"HIGH_CASH_RATIO"|"FLAGGED"
    notes              = Column(Text, nullable=True)
    declared_at        = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


# ─── Composite Indexes (hot-path query optimisation) ─────────────────────────
Index("ix_txn_user_type_ts",
      Transaction.__table__.c.user_id,
      Transaction.__table__.c.transaction_type,
      Transaction.__table__.c.timestamp)

Index("ix_claim_user_status_ts",
      Claim.__table__.c.user_id,
      Claim.__table__.c.status,
      Claim.__table__.c.created_at)

Index("ix_risk_user_ts",
      RiskScore.__table__.c.user_id,
      RiskScore.__table__.c.snapshot_at)

Index("ix_policy_user_status",
      Policy.__table__.c.user_id,
      Policy.__table__.c.status)

Index("ix_alert_policy_status",
      PremiumAlert.__table__.c.policy_id,
      PremiumAlert.__table__.c.status)

Index("ix_squad_member_pair",
      SquadMember.__table__.c.squad_id,
      SquadMember.__table__.c.user_id)

Index("ix_policy_status", Policy.__table__.c.status)

# Cash declaration queries: user_id + week_ending
Index("ix_cash_decl_user_week",
      CashDeclaration.__table__.c.user_id,
      CashDeclaration.__table__.c.week_ending)

# Squad attestation queries: claim_id
Index("ix_attestation_claim",
      SquadAttestation.__table__.c.claim_id)


# ─── DB Initialisation ────────────────────────────────────────────────────────

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./idcs.db")

engine_kwargs: dict = {}
if DB_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30.0}
else:
    # Production PostgreSQL — tuned connection pool
    engine_kwargs["pool_size"]    = 20
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_timeout"] = 30
    engine_kwargs["pool_recycle"] = 1800

engine = create_engine(DB_URL, **engine_kwargs)

# Enable WAL mode for SQLite — allows concurrent reads during writes
# (no-op for PostgreSQL; only applied when the first connection is made)
if DB_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA cache_size=-64000")  # 64 MB page cache
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    # Safe SQLite column migration for existing databases
    if DB_URL.startswith("sqlite"):
        with engine.connect() as conn:
            for sql in [
                "ALTER TABLE users ADD COLUMN till_number VARCHAR",
                "ALTER TABLE users ADD COLUMN till_type VARCHAR DEFAULT 'BUY_GOODS'",
                "ALTER TABLE users ADD COLUMN till_verified BOOLEAN DEFAULT 0",
                "ALTER TABLE policies ADD COLUMN tier VARCHAR DEFAULT 'TIER_2'",
                "ALTER TABLE policies ADD COLUMN incubation_ends_at TIMESTAMP",
                "ALTER TABLE transactions ADD COLUMN category VARCHAR DEFAULT 'Revenue'",
                "ALTER TABLE transactions ADD COLUMN sender_hash VARCHAR",
                "ALTER TABLE transactions ADD COLUMN is_settled BOOLEAN DEFAULT 0",
                "ALTER TABLE transactions ADD COLUMN reversal_ref VARCHAR",
                "ALTER TABLE transactions ADD COLUMN anomaly_flag VARCHAR",
            ]:
                try:
                    conn.execute(text(sql))
                    conn.commit()
                except Exception:
                    pass  # column already exists



if __name__ == "__main__":
    init_db()
    print("  Database initialised with full IDCS schema.")
