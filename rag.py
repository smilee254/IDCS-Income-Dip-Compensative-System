"""
IDCS RAG (Retrieval-Augmented Generation) Knowledge Base
=========================================================
Embeds IDCS policy documents and retrieves relevant context
for the AI Copilot at query time.

Embedding backend: Gemini text-embedding-004
Fallback (no API key): TF-IDF / Jaccard keyword similarity
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Dict, List

import numpy as np

log = logging.getLogger("idcs.rag")

# ─── Knowledge Corpus ─────────────────────────────────────────────────────────

_CORPUS: List[Dict[str, str]] = [
    {
        "id": "fraud_velocity_paradox",
        "title": "Velocity Paradox — Cash Diversion Signal",
        "content": """
The Velocity Paradox is IDCS's single strongest fraud detection signal (weight: +35 points).
It fires when a user's income AMOUNT falls more than 30% month-on-month while their transaction
COUNT barely drops (less than 10% fall). Genuine income dips shrink both amount and frequency
simultaneously. If only the amount collapses while the user still receives the same number of
M-Pesa credits — just at much smaller values — income is likely being redirected to untraceable
cash. A rider earning 40 × KSh 1,250 who suddenly reports 38 × KSh 263 should be scrutinised.
Detection formula: amount_drop_ratio > 0.30 AND count_drop_ratio < 0.10.
""",
    },
    {
        "id": "fraud_sector_squad_gap",
        "title": "Sector & Squad Corroboration Gap Signal",
        "content": """
Signal weight: up to +25 points (sector +15, squad +10).
Real economic shocks hit entire industries and geographic clusters, not isolated individuals.
Sector gap: if a user claims a 40% personal dip but their employment sector shows only a 2%
macro dip, the system flags a corroboration gap (+15 pts).
Squad gap: if the user's Trust Squad peers average only a 5% dip while the user claims 40%,
peer evidence contradicts the claim (+10 pts).
Both signals are suppressed for severe_weather_event = True (parametric oracle bypass).
""",
    },
    {
        "id": "fraud_debit_credit_shift",
        "title": "Debit/Credit Ratio Shift Signal",
        "content": """
Signal weight: +20 points.
A user redirecting income to cash continues to spend digitally (airtime, rent, M-Pesa goods).
This means debits stay constant or increase while credits crater — creating an abnormal ratio.
Detection: if current debit/credit ratio > 2.5× the prior-period ratio, the pattern suggests
digital spending continues while digital earnings are artificially suppressed.
""",
    },
    {
        "id": "fraud_recidivism",
        "title": "Recidivism Watch Signal",
        "content": """
Signal weight: +15 points (≥3 claims) or +5 points (2 claims) in a rolling 12-month window.
Genuine structural income volatility rarely triggers three approved income-dip claims per year.
Repeated claimants are placed on a watch list and their next claim is automatically routed
through enhanced scrutiny regardless of other signal scores.
""",
    },
    {
        "id": "fraud_forecast_mismatch",
        "title": "Prophet Forecast Mismatch Signal",
        "content": """
Signal weight: +10 points.
IDCS uses Facebook Prophet to forecast 6 months of income. If the model predicted a stable
month (risk_level = LOW, dip_probability < 20%) and the user is now claiming a dip of more
than 20%, the AI forecast and the claim disagree. This mismatch is an independent corroborating
fraud signal — it does not block claims alone but contributes to the composite score.
""",
    },
    {
        "id": "fraud_decision_tree",
        "title": "Composite Fraud Score Decision Tree",
        "content": """
IDCS compounds 5 independent signals into a score 0–100 per claim event.

Score 0–29  → CLEAN:     Process normally. 70% co-insurance applied.
Score 30–49 → SOFT_FLAG: Claim approved but co-insurance tightened to 60% (was 70%).
                          Account added to compliance watch list.
Score 50–74 → 72H_HOLD:  Claim held for 72-hour manual review. Compliance officer contacts user.
                          Most casual fraudsters abandon at this stage rather than face verification.
Score 75+   → HARD_BLOCK: Claim rejected (REJECTED status). Account flagged UNDER_REVIEW.
                          Trust Squad notified. User must appeal through compliance portal.

The 72-hour hold is the system's most powerful deterrent: fabricating a paper trail is too costly
for the expected marginal gain after co-insurance deductions.
""",
    },
    {
        "id": "grace_period_lifecycle",
        "title": "Grace Period & Lapse Prevention System",
        "content": """
IDCS policy lifecycle stages when income goes silent:

ACTIVE (healthy): Micro-premiums deducted from every M-Pesa credit automatically.
GRACE_PERIOD (day 7–37): No credit detected for 7+ days. Policy REMAINS ACTIVE.
  - Daily arrears accumulate: avg_daily_income × premium_rate per day.
  - SMS reminders at day 7 (soft ping), day 14 (debt statement), day 30 (urgent warning).
SUSPENDED (day 37–90): Policy suspended. Cannot file new claims. Reinstates automatically
  on first income received — NO HUMAN NEEDED.
LAPSED (day 90+): Permanent lapse. Full re-underwriting required to restart cover.

Key distinction: SUSPENDED ≠ LAPSED. A SUSPENDED user who resumes earning recovers instantly.
Arrears recovery: spread across min(60, gap_days × 2) future transactions automatically.
Arrears calculation is PROPORTIONAL — a high-income user owes more per silent day than a
low-income user. This is actuarially correct and fair.
""",
    },
    {
        "id": "velocity_score_levels",
        "title": "Velocity Score & Financial Levels",
        "content": """
Velocity Score (0–100) = min(100, credit_transactions_last_30_days / 30 × 100).
Measures M-Pesa receipt frequency. Higher velocity = more stable business = lower risk.

Financial Levels:
Level 1 (velocity < 50): Base premium rate. Standard cover.
Level 2 (velocity 50–90): Solid standing. One step from elite discount.
Level 3 (velocity > 90): ELITE. Earns −0.2% discount on micro-premium rate.

How to improve velocity score:
1. Ask customers to pay via M-Pesa for every transaction, not just large ones.
2. Small, frequent payments score better than one large monthly lump sum.
3. Consistency matters — sporadic high days hurt the monthly average.
4. Avoid cash payments entirely — they are invisible to the system.
""",
    },
    {
        "id": "micro_premium_rates",
        "title": "Micro-Premium Deduction Rates",
        "content": """
IDCS micro-premiums are embedded in each M-Pesa credit — no end-of-month bill.

Base rates:
  Stability score > 70: 1.5% per credit transaction
  Stability score ≤ 70: 2.5% per credit transaction

Discounts (stackable):
  Level 3 velocity: −0.2%
  Trust Squad No-Claim Dividend: −0.3%
  Minimum floor: 0.5% (never below this regardless of discounts)

Co-insurance payout rates:
  CLEAN fraud score (0–29): 70% of verified income dip (max = SRC Cap)
  SOFT_FLAG fraud score (30–49): 60% of verified income dip
  70% co-insurance gap is deliberate: ensures earning > claiming at all times.
""",
    },
    {
        "id": "trust_squad",
        "title": "Trust Squad — Peer Risk Pools",
        "content": """
Trust Squads are voluntary peer groups that share a collective risk reputation.

Benefits:
  No-Claim Dividend: All members get −0.3% premium discount after 12 clean months.
  Collective fraud deterrence: Squad members are notified when a member's claim is held for review.
  Their dividend is at risk — peer pressure is IDCS's strongest anti-fraud mechanism.

Formation rules:
  Members should share a compatible employment sector and county.
  Squads are dissolved if the group's aggregate loss ratio exceeds 80% over 12 months.
  Founding members receive a first-mover dividend advantage.

Squad dip corroboration:
  Squad average income dip is used as an independent fraud-detection signal.
  If peers are unaffected, an individual's dip is more suspicious.
""",
    },
    {
        "id": "claim_eligibility",
        "title": "Claim Eligibility Rules",
        "content": """
All of the following must be true to file an income-dip claim:

1. Income dip detected: current_income < 80% of historical mean (μ).
2. Minimum 3 paid premium months on record (status = 'Paid' in income history).
3. Stability score ≥ 50.
4. Active business: transaction_count > 0 — zero activity disqualifies.
5. No manual audit already pending.
6. Policy status: ACTIVE or GRACE_PERIOD. SUSPENDED and LAPSED cannot file.

Additional checks at claim time:
  Fraud composite score runs automatically on every claim (5 signals).
  Sector corroboration: large personal dip with no sector/weather explanation = audit.
  Auto-disbursement: CLEAN score + sector_dip > 20% OR severe_weather_event + velocity > 80.
""",
    },
    {
        "id": "income_categories",
        "title": "Income Category Filtering — Non-Revenue Exclusions",
        "content": """
IDCS strips non-revenue inflows BEFORE any statistical calculations to prevent gaming:

Revenue   → INCLUDED: genuine earned income from work/business
Loan      → EXCLUDED: borrowed money artificially inflates the income baseline
Chama     → EXCLUDED: rotating savings payouts are cyclic, not earned income
P2P_Transfer → EXCLUDED: peer-to-peer transfers are not business revenue

Why this matters: A KSh 100,000 loan landing in month 3 would set a false high baseline (μ),
making any subsequent normal month appear to be a 'dip'. Stripping Loans/Chamas/P2P ensures
the system measures only what the worker actually earns.
""",
    },
    {
        "id": "prophet_forecasting",
        "title": "Prophet AI Income Forecasting — Configuration",
        "content": """
IDCS uses Facebook Prophet for a rolling 6-month income forecast, tuned for Kenya.

Key configuration:
  seasonality_mode = 'multiplicative': income seasonality scales with income level.
  changepoint_prior_scale = 0.15: flexible trend detection for gig-worker structural breaks.
  Kenyan holidays: Madaraka Day, Mashujaa Day, Jamhuri Day, Christmas, school-fee months
    (January, May, September — when parents send children back to school and income spikes).
  sector_dip: injected as external regressor when provided.

Prophet Risk Score interpretation:
  0–30: LOW — stable months ahead. No action needed.
  31–60: MEDIUM — some volatility expected. Consider extra savings buffer.
  61–100: HIGH — dip likely in at least one of next 6 months. Reduce discretionary spend.

Requires ≥ 3 months of history. Yearly seasonality only enabled with ≥ 24 months.
Cross-validation available via POST /forecast/validate (admin: POST /forecast/tune).
""",
    },
    {
        "id": "stability_score_formula",
        "title": "Stability Score Formula",
        "content": """
Stability Score (0–100) measures income variance relative to mean, weighted by velocity.

s_base        = 100 × (1 − σ/μ) × employment_weight
blended       = (s_base × 0.60) + (velocity_score × 0.40)
stability_score = max(0, blended − 5 × unpaid_months)

employment_weight: 1.1 for SRC_Teacher, 1.0 for all others.
unpaid_months: each recorded "Unpaid" month costs −5 stability points.

Thresholds:
  ≥ 70: Earns the lower 1.5% micro-premium rate.
  ≥ 50: Minimum required for claim eligibility.
  < 50: INELIGIBLE for claims — too volatile for verified payout.
""",
    },
]


# ─── Knowledge Base Class ──────────────────────────────────────────────────────

class IDCSKnowledgeBase:
    """
    Lightweight RAG retrieval engine for the IDCS AI Copilot.

    Primary: Gemini text-embedding-004 — semantic cosine similarity.
    Fallback: Jaccard + keyword scoring — works with no API key.
    """

    def __init__(self) -> None:
        self._embeddings: Dict[str, List[float]] = {}
        self._initialized = False
        self._gemini_ok = False

    # ── Embedding backends ────────────────────────────────────────────────────

    def _gemini_embed(self, text: str) -> List[float]:
        """Call Gemini text-embedding-004. Returns [] on any failure."""
        try:
            import google.generativeai as genai
            api_key = os.getenv("GEMINI_API_KEY", "")
            if not api_key:
                return []
            genai.configure(api_key=api_key)
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document",
            )
            return result["embedding"]
        except Exception as exc:
            log.debug(f"[RAG] Gemini embed failed: {exc}")
            return []

    def _jaccard(self, query: str, doc: str) -> float:
        """Token-level Jaccard similarity as TF-IDF-free fallback."""
        q_tokens = set(query.lower().split())
        d_tokens = set(doc.lower().split())
        if not q_tokens or not d_tokens:
            return 0.0
        inter = q_tokens & d_tokens
        union = q_tokens | d_tokens
        # Boost: exact title keywords score higher
        return len(inter) / len(union)

    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        va, vb = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
        na, nb = np.linalg.norm(va), np.linalg.norm(vb)
        if na == 0 or nb == 0:
            return 0.0
        return float(np.dot(va, vb) / (na * nb))

    # ── Initialisation ────────────────────────────────────────────────────────

    def initialize(self) -> None:
        """Embed all corpus documents. Called once at Copilot first-use."""
        if self._initialized:
            return
        log.info("[RAG] Initialising knowledge base…")
        for doc in _CORPUS:
            text = f"{doc['title']}\n{doc['content']}"
            emb = self._gemini_embed(text)
            if emb:
                self._embeddings[doc["id"]] = emb
                self._gemini_ok = True
        mode = "Gemini embeddings" if self._gemini_ok else "Jaccard fallback"
        log.info(f"[RAG] Ready — {len(_CORPUS)} documents, mode={mode}")
        self._initialized = True

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def retrieve(self, query: str, top_k: int = 3) -> List[Dict]:
        """Return top-k most semantically relevant knowledge chunks."""
        if not self._initialized:
            self.initialize()

        scores: List[tuple] = []

        if self._gemini_ok and self._embeddings:
            q_emb = self._gemini_embed(query)
            if q_emb:
                for doc in _CORPUS:
                    if doc["id"] in self._embeddings:
                        sim = self._cosine(q_emb, self._embeddings[doc["id"]])
                        scores.append((sim, doc))
            else:
                # Gemini failed at query time — degrade gracefully
                for doc in _CORPUS:
                    sim = self._jaccard(query, f"{doc['title']} {doc['content']}")
                    scores.append((sim, doc))
        else:
            for doc in _CORPUS:
                sim = self._jaccard(query, f"{doc['title']} {doc['content']}")
                scores.append((sim, doc))

        scores.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scores[:top_k]]

    def format_context(self, chunks: List[Dict]) -> str:
        """Render retrieved chunks as a compact prompt block."""
        if not chunks:
            return ""
        lines = ["=== IDCS Policy Reference ==="]
        for chunk in chunks:
            lines.append(f"\n[{chunk['title']}]{chunk['content'].rstrip()}")
        return "\n".join(lines)


# ─── Singleton ────────────────────────────────────────────────────────────────

_kb = IDCSKnowledgeBase()


def get_knowledge_base() -> IDCSKnowledgeBase:
    """Return the module-level knowledge base singleton."""
    return _kb
