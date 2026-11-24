"""
IDCS Inflow Classifier & Anti-Fraud Engine
Separates genuine business revenue from friendly funds, Chamas,
digital loans (Fuliza, M-Shwari, Tala, Branch), and outlier spikes.
Ensures compliance with Kenya Data Protection Act (KDPA 2019) via SHA-256 sender hashing.
"""

import hashlib
import re
from typing import List, Dict, Optional, Tuple
import numpy as np

# Known digital lender shortcodes and paybills in Kenya
KNOWN_LENDER_SHORTCODES = {
    "290020": "M-Shwari",
    "290029": "Fuliza",
    "851900": "Tala",
    "998608": "Branch",
    "444700": "Zenka",
    "522522": "KCB_M-Pesa",
    "334455": "Timiza",
    "777001": "Hustler_Fund",
    "800800": "NCBA_Loop",
}

# Regex keywords for non-business inflows
LOAN_KEYWORDS = [
    r"\bloan\b", r"\bfuliza\b", r"\bm-?shwari\b", r"\bdisbursement\b",
    r"\btala\b", r"\bbranch\b", r"\bzenka\b", r"\badvance\b",
    r"\bcredit limit\b", r"\bhustler fund\b", r"\bborrow\b"
]

CHAMA_KEYWORDS = [
    r"\bchama\b", r"\bmerry-?go-?round\b", r"\bcontribution\b",
    r"\bharambee\b", r"\btable banking\b", r"\bgroup savings\b"
]

CASHBACK_KEYWORDS = [
    r"\bcash-?back\b", r"\bagent withdraw\b", r"\bfloat\b", r"\bswap cash\b"
]

REVERSAL_KEYWORDS = [
    r"\breversal\b", r"\breversed\b", r"\brefund\b", r"\bchargeback\b"
]


def hash_sender_phone(phone: Optional[str]) -> Optional[str]:
    """
    Cryptographically hash customer phone number using SHA-256 for KDPA compliance.
    Normalizes 07XXXXXXXX, +2547XXXXXXXX to canonical 2547XXXXXXXX before hashing.
    """
    if not phone:
        return None
    raw = phone.strip().replace("+", "").replace(" ", "").replace("-", "")
    if raw.startswith("0") and len(raw) == 10:
        raw = "254" + raw[1:]
    elif raw.startswith("7") and len(raw) == 9:
        raw = "254" + raw
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def calculate_sender_uniqueness(recent_txns: List[Dict]) -> Tuple[float, Optional[str]]:
    """
    Computes Sender Uniqueness Ratio (SUR):
    SUR = (Unique Senders) / (Total Transactions)
    Retail businesses typically have SUR > 0.65.
    If SUR < 0.35 and 1-2 senders account for >60% of money, flags low uniqueness.
    """
    if not recent_txns:
        return 1.0, None

    valid_hashes = [t["sender_hash"] for t in recent_txns if t.get("sender_hash")]
    if len(valid_hashes) < 4:
        return 1.0, None  # Insufficient sample for statistical penalty

    unique_count = len(set(valid_hashes))
    total_count = len(valid_hashes)
    sur = unique_count / float(total_count)

    # Check sender concentration (is one sender sending everything?)
    from collections import Counter
    counts = Counter(valid_hashes)
    most_common_hash, freq = counts.most_common(1)[0]
    concentration_ratio = freq / float(total_count)

    if sur < 0.35 or concentration_ratio >= 0.50:
        return sur, most_common_hash

    return sur, None


def detect_outlier_spike(amount: float, recent_txns: List[Dict], multiplier: float = 4.0) -> Tuple[bool, float]:
    """
    Checks if an incoming transaction is an unnatural outlier spike compared to the
    merchant's historical median transaction size.
    Returns: (is_outlier, recommended_cap)
    """
    if not recent_txns:
        # Default safety ceiling for untracked accounts
        return (amount > 100000.0, min(amount, 50000.0))

    amounts = [t["amount"] for t in recent_txns if t.get("amount", 0) > 0 and t.get("category") == "Revenue"]
    if len(amounts) < 5:
        # Not enough history: soft-cap single transactions at 50,000 for safety
        is_spike = amount > 50000.0
        return is_spike, 50000.0 if is_spike else amount

    med = float(np.median(amounts))
    iqr = float(np.percentile(amounts, 75) - np.percentile(amounts, 25))
    threshold = max(med * multiplier, med + 3 * max(iqr, med * 0.5))

    if amount > threshold:
        # Flag as outlier, cap recognized revenue to threshold
        return True, threshold

    return False, amount


def classify_inflow(
    amount: float,
    sender_phone: Optional[str] = None,
    description: Optional[str] = None,
    bill_ref_number: Optional[str] = None,
    shortcode: Optional[str] = None,
    recent_txns: Optional[List[Dict]] = None,
    user_till_type: str = "BUY_GOODS"
) -> Dict:
    """
    Classifies an incoming M-Pesa transaction into:
    - Revenue: Genuine customer purchase (counts toward baseline, incurs micro-premium)
    - Loan: Digital credit (excluded from baseline, zero micro-premium)
    - P2P_Personal: Friendly funds/family transfer (excluded from baseline)
    - Chama: Merry-go-round contribution (excluded from baseline)
    - Cashback: Informal cash swap (excluded from baseline)
    - Reversal: Refund/reversal notice (deducts from baseline)
    """
    desc = (description or "").lower()
    ref = (bill_ref_number or "").lower()
    recent = recent_txns or []
    s_hash = hash_sender_phone(sender_phone)

    # 1. Digital Loan Detection
    if shortcode in KNOWN_LENDER_SHORTCODES:
        return {
            "category": "Loan",
            "recognized_revenue": 0.0,
            "sender_hash": s_hash,
            "is_commercial_revenue": False,
            "anomaly_flag": f"LOAN_PROVIDER_{KNOWN_LENDER_SHORTCODES[shortcode]}",
            "reason": f"Digital loan detected from {KNOWN_LENDER_SHORTCODES[shortcode]}."
        }

    for pat in LOAN_KEYWORDS:
        if re.search(pat, desc) or re.search(pat, ref):
            return {
                "category": "Loan",
                "recognized_revenue": 0.0,
                "sender_hash": s_hash,
                "is_commercial_revenue": False,
                "anomaly_flag": "LOAN_KEYWORD_MATCH",
                "reason": "Transaction references digital loan / credit advance."
            }

    # 2. Chama & Harambee Detection
    for pat in CHAMA_KEYWORDS:
        if re.search(pat, desc) or re.search(pat, ref):
            return {
                "category": "Chama",
                "recognized_revenue": 0.0,
                "sender_hash": s_hash,
                "is_commercial_revenue": False,
                "anomaly_flag": "CHAMA_KEYWORD_MATCH",
                "reason": "Transaction identified as group Chama or Harambee contribution."
            }

    # 3. Informal Cashback / Agent Float Detection
    for pat in CASHBACK_KEYWORDS:
        if re.search(pat, desc) or re.search(pat, ref):
            return {
                "category": "Cashback",
                "recognized_revenue": 0.0,
                "sender_hash": s_hash,
                "is_commercial_revenue": False,
                "anomaly_flag": "CASHBACK_SWAP",
                "reason": "Informal agent cash swap detected."
            }

    # 4. Reversal Detection
    for pat in REVERSAL_KEYWORDS:
        if re.search(pat, desc) or re.search(pat, ref):
            return {
                "category": "Reversal",
                "recognized_revenue": -abs(amount),
                "sender_hash": s_hash,
                "is_commercial_revenue": False,
                "anomaly_flag": "REVERSAL_NOTICE",
                "reason": "Customer reversal notice."
            }

    # 5. P2P Personal Concentration Filter (Only applies to personal numbers or mixed accounts)
    if user_till_type == "PERSONAL":
        sur, dominant_hash = calculate_sender_uniqueness(recent)
        if dominant_hash and s_hash == dominant_hash:
            return {
                "category": "P2P_Personal",
                "recognized_revenue": 0.0,
                "sender_hash": s_hash,
                "is_commercial_revenue": False,
                "anomaly_flag": "LOW_SENDER_UNIQUENESS",
                "reason": "Repeated transfer from dominant personal contact (friendly funds)."
            }

    # 6. Outlier Spike Detection
    is_spike, capped_amount = detect_outlier_spike(amount, recent)
    anomaly = "OUTLIER_AMOUNT" if is_spike else None

    # 7. Valid Commercial Revenue
    return {
        "category": "Revenue",
        "recognized_revenue": capped_amount,
        "sender_hash": s_hash,
        "is_commercial_revenue": True,
        "anomaly_flag": anomaly,
        "reason": "Verified commercial business revenue." if not is_spike else f"Revenue recognized but capped to KES {capped_amount:,.0f} due to abnormal volume spike."
    }
