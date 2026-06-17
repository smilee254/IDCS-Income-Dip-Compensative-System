import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    Boolean, ForeignKey, DateTime, Text, Enum, Index, event
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
    reference        = Column(String, nullable=True)    # M-Pesa transaction ID
    micro_premium_deducted = Column(Float, default=0.0)
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
    status         = Column(String, default="ACTIVE")   # "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "LAPSED"
    start_date     = Column(DateTime, default=datetime.utcnow)
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


# ─── Composite Indexes (hot-path query optimisation) ────────────────────────────
#
# Transaction queries: user_id + type filter + timestamp ORDER BY
Index("ix_txn_user_type_ts",
      Transaction.__table__.c.user_id,
      Transaction.__table__.c.transaction_type,
      Transaction.__table__.c.timestamp)

# Claim queries: user_id + status filter + created_at ORDER BY
Index("ix_claim_user_status_ts",
      Claim.__table__.c.user_id,
      Claim.__table__.c.status,
      Claim.__table__.c.created_at)

# Risk score queries: user_id + snapshot_at DESC
Index("ix_risk_user_ts",
      RiskScore.__table__.c.user_id,
      RiskScore.__table__.c.snapshot_at)

# Policy queries: user_id + status filter
Index("ix_policy_user_status",
      Policy.__table__.c.user_id,
      Policy.__table__.c.status)

# Premium alert queries: policy_id + status filter
Index("ix_alert_policy_status",
      PremiumAlert.__table__.c.policy_id,
      PremiumAlert.__table__.c.status)

# Grace-period job: policies by status only (full-table scan of ACTIVE/GRACE_PERIOD)
Index("ix_policy_status", Policy.__table__.c.status)


# ─── DB Initialisation ────────────────────────────────────────────────────────

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./idcs.db")

engine_kwargs: dict = {}
if DB_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
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
        cursor.execute("PRAGMA cache_size=-64000")  # 64 MB page cache
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("  Database initialised with full IDCS schema.")
