from prophet import Prophet
import numpy as np
import pandas as pd

class IDCS_Engine:
    def __init__(self):
        pass

    def prepare_monthly_df(self, income_history):
        """
        Convert income_history list to a Prophet-ready monthly DataFrame.
        Strips non-revenue inflows (Loans, Chamas, P2P) and assigns
        synthetic calendar months ending at the current month.
        """
        valid = [r for r in income_history
                 if r.get('category', 'Revenue') not in ['Loan', 'Chama', 'P2P_Transfer']]
        amounts = [r['amount'] for r in valid]
        n = len(amounts)
        if n == 0:
            return pd.DataFrame(columns=['month', 'Total Income'])

        # item[n-1] = this month, item[n-2] = last month, etc.
        import datetime
        today = datetime.date.today()
        months = []
        for i in range(n - 1, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            months.append(f"{y}-{m:02d}")

        return pd.DataFrame({'month': months, 'Total Income': amounts})

    def _kenyan_holidays(self):
        """Kenyan public holidays + school-fee income spikes for Prophet."""
        import datetime
        yr = datetime.date.today().year
        rows = []
        for y in [yr, yr + 1]:
            rows.extend([
                {'holiday': 'New Year',       'ds': f'{y}-01-01', 'lower_window': -1, 'upper_window': 2},
                {'holiday': 'Labour Day',     'ds': f'{y}-05-01', 'lower_window': -1, 'upper_window': 1},
                {'holiday': 'Madaraka Day',   'ds': f'{y}-06-01', 'lower_window': -1, 'upper_window': 1},
                {'holiday': 'Mashujaa Day',   'ds': f'{y}-10-20', 'lower_window': -1, 'upper_window': 1},
                {'holiday': 'Jamhuri Day',    'ds': f'{y}-12-12', 'lower_window': -1, 'upper_window': 2},
                {'holiday': 'Christmas',      'ds': f'{y}-12-25', 'lower_window': -2, 'upper_window': 3},
                {'holiday': 'SchoolFees Jan', 'ds': f'{y}-01-10', 'lower_window': -3, 'upper_window': 5},
                {'holiday': 'SchoolFees May', 'ds': f'{y}-05-05', 'lower_window': -3, 'upper_window': 5},
                {'holiday': 'SchoolFees Sep', 'ds': f'{y}-09-05', 'lower_window': -3, 'upper_window': 5},
            ])
        return pd.DataFrame(rows)

    def predict_risk_horizon(self, df_monthly, mu, sector_dip=0.0):
        """
        Prophet 6-month forecast — tuned for Kenyan gig economy.
        Steps 1-3: adaptive seasonality, changepoint tuning, multiplicative mode.
        Step 5: Kenyan holidays injected.
        Step 6: sector_dip external regressor when provided.
        """
        if df_monthly.empty or mu <= 0:
            return [], 0, None

        n = len(df_monthly)
        df_prophet = df_monthly.copy()
        df_prophet['ds'] = pd.to_datetime(df_prophet['month'])
        df_prophet = df_prophet.rename(columns={'Total Income': 'y'})

        model = Prophet(
            yearly_seasonality      = n >= 24,      # Step 1: only reliable with 2+ years
            weekly_seasonality      = False,
            daily_seasonality       = False,
            seasonality_mode        = 'multiplicative',  # Step 1: scales with income level
            changepoint_prior_scale = 0.15,         # Step 2: flexible trend for gig volatility
            seasonality_prior_scale = 10.0,
            interval_width          = 0.80,         # Step 3: explicit 80% confidence band
            holidays                = self._kenyan_holidays(),  # Step 5
        )

        use_regressor = sector_dip > 0.0
        if use_regressor:                           # Step 6
            model.add_regressor('sector_dip')
            df_prophet['sector_dip'] = sector_dip

        fit_cols = ['ds', 'y'] + (['sector_dip'] if use_regressor else [])
        model.fit(df_prophet[fit_cols])

        future = model.make_future_dataframe(periods=6, freq='MS')
        if use_regressor:
            future['sector_dip'] = sector_dip
        forecast = model.predict(future)

        predictions_df = forecast.tail(6).copy()
        threshold = mu * 0.7
        predictions_df['is_high_risk'] = predictions_df['yhat_lower'] < threshold

        risk_events  = predictions_df['is_high_risk'].sum()
        depth_penalty = 0
        if risk_events > 0:
            avg_depth   = (threshold - predictions_df[predictions_df['is_high_risk']]['yhat_lower']).mean()
            depth_penalty = min(50, (avg_depth / threshold) * 100)
        risk_score = min(100, (risk_events * 10) + depth_penalty)

        predictions = []
        for _, row in predictions_df.iterrows():
            predictions.append({
                "month":            row['ds'].strftime('%Y-%m'),
                "predicted_income": float(row['yhat']),
                "predicted_lower":  float(row['yhat_lower']),
                "predicted_upper":  float(row['yhat_upper']),
                "is_high_risk":     bool(row['is_high_risk']),
            })

        return predictions, risk_score, (model, forecast)

    def validate_forecast(self, df_monthly):
        """Step 7: Prophet cross-validation — returns MAE, MAPE, RMSE."""
        from prophet.diagnostics import cross_validation, performance_metrics
        import warnings
        warnings.filterwarnings('ignore')

        if len(df_monthly) < 6:
            return None, "Need >= 6 months of data."

        df_p = df_monthly.copy()
        df_p['ds'] = pd.to_datetime(df_p['month'])
        df_p = df_p.rename(columns={'Total Income': 'y'})
        n = len(df_p)

        model = Prophet(
            yearly_seasonality=n >= 24, weekly_seasonality=False, daily_seasonality=False,
            seasonality_mode='multiplicative', changepoint_prior_scale=0.15, interval_width=0.80,
            holidays=self._kenyan_holidays(),
        )
        model.fit(df_p[['ds', 'y']])
        initial = str(max(90, int(n * 0.6 * 30))) + ' days'
        df_cv   = cross_validation(model, initial=initial, period='30 days', horizon='180 days')
        metrics = performance_metrics(df_cv)
        return metrics[['horizon', 'mae', 'mape', 'rmse', 'coverage']].to_dict(orient='records'), None

    def tune_hyperparameters(self, df_monthly):
        """Step 8: Grid search over changepoint + seasonality priors. Returns best params by MAPE."""
        from prophet.diagnostics import cross_validation, performance_metrics
        from itertools import product
        import warnings
        warnings.filterwarnings('ignore')

        if len(df_monthly) < 6:
            return None, "Need >= 6 months."

        df_p = df_monthly.copy()
        df_p['ds'] = pd.to_datetime(df_p['month'])
        df_p = df_p.rename(columns={'Total Income': 'y'})
        n       = len(df_p)
        initial = str(max(90, int(n * 0.6 * 30))) + ' days'

        grid = list(product([0.05, 0.10, 0.15, 0.25], [5.0, 10.0, 20.0]))
        best_mape, best_params, results = float('inf'), None, []

        for cp, sp in grid:
            try:
                m = Prophet(
                    yearly_seasonality=n >= 24, weekly_seasonality=False, daily_seasonality=False,
                    seasonality_mode='multiplicative', changepoint_prior_scale=cp,
                    seasonality_prior_scale=sp, interval_width=0.80,
                )
                m.fit(df_p[['ds', 'y']])
                df_cv = cross_validation(m, initial=initial, period='30 days', horizon='90 days')
                perf  = performance_metrics(df_cv)
                mape  = float(perf['mape'].mean())
                results.append({'changepoint_prior_scale': cp, 'seasonality_prior_scale': sp, 'mape': round(mape, 4)})
                if mape < best_mape:
                    best_mape   = mape
                    best_params = {'changepoint_prior_scale': cp, 'seasonality_prior_scale': sp}
            except Exception:
                continue

        return best_params, sorted(results, key=lambda x: x['mape'])

    def calculate_metrics(self, income_history, src_cap, current_income, w_emp=1.0, transaction_count=15, sector_dip=0.0, squad_no_claim_bonus=False, severe_weather_event=False):
        """
        income_history: list of dicts with 'amount', 'status', and optionally 'category'
        Filters out irregular inflows (Loans, P2P, Chamas) before calculation.
        """
        # 1. Filter Irregular Inflows (Transaction Metadata Isolation)
        valid_history = [r for r in income_history if r.get('category', 'Revenue') not in ['Loan', 'Chama', 'P2P_Transfer']]
        amounts = [record['amount'] for record in valid_history]
        statuses = [record['status'] for record in valid_history]

        # 1. Mean Income (mu)
        mu = np.mean(amounts) if len(amounts) > 0 else 0

        # 2. Standard Deviation (sigma)
        sigma = np.std(amounts, ddof=0) if len(amounts) > 0 else 0

        # Pattern Analysis (The Dip Predictor)
        total_months = len(amounts)
        dip_threshold = 0.8 * mu
        dips = [i for i, amt in enumerate(amounts) if amt < dip_threshold]
        dip_count = len(dips)
        
        # Risk & Probability Assessment
        dip_probability = (dip_count / total_months * 100) if total_months > 0 else 0
        
        pattern_detected = False
        predicted_dip_month = None
        risk_level = "LOW"
        next_dip_idx = None
        
        if dip_count > 1:
            intervals = [dips[j] - dips[j-1] for j in range(1, dip_count)]
            if len(set(intervals)) == 1:
                pattern_interval = intervals[0]
                pattern_detected = True
                last_dip_idx = dips[-1]
                next_dip_idx = last_dip_idx + pattern_interval
                
                months_until_next = next_dip_idx - total_months
                import datetime
                import calendar
                current_month_num = datetime.datetime.now().month
                future_month_num = (current_month_num + months_until_next - 1) % 12 + 1
                future_month_name = calendar.month_name[future_month_num]
                
                predicted_dip_month = f"{future_month_name} (M-{pattern_interval})"
                
                if months_until_next <= 1:
                    risk_level = "CRITICAL"
                elif months_until_next <= 2:
                    risk_level = "HIGH"
                else:
                    risk_level = "MEDIUM"
        elif dip_probability >= 50:
            risk_level = "HIGH"
        elif dip_probability > 0:
            risk_level = "MEDIUM"

        current_dip_detected = bool(current_income < dip_threshold)

        # 3. Stability Score (S) heavily weighted by Transaction Velocity
        velocity_score = min(100.0, (transaction_count / 30.0) * 100.0)
        unpaid_months = statuses.count("Unpaid")
        p_unpaid = 5 * unpaid_months
        
        if mu > 0:
            # 60% based on variance, 40% based on velocity
            s_base = 100 * (1 - (sigma / mu)) * w_emp
            blended_s_base = (s_base * 0.6) + (velocity_score * 0.4)
            stability_score = max(0.0, blended_s_base - p_unpaid)
        else:
            stability_score = 0.0

        # Activity Verification (Moral Hazard Prevention)
        is_active_business = transaction_count > 0

        # Sector-Level Corroboration & Weather Oracle
        personal_dip_pct = ((mu - current_income) / mu) if mu > 0 else 0
        needs_manual_audit = False
        if personal_dip_pct > 0.3 and sector_dip < 0.05:
            if not severe_weather_event:
                # High personal dip, no macro dip, no extreme weather -> flag for audit
                needs_manual_audit = True
            # If there IS a severe weather event, bypass audit (Parametric Oracle)

        # Gamification Level
        financial_level = 1
        if velocity_score > 90:
            financial_level = 3
        elif velocity_score > 50:
            financial_level = 2

        # Eligibility
        paid_months = statuses.count("Paid")
        eligible = bool(current_dip_detected and paid_months >= 3 and stability_score >= 50 and is_active_business and not needs_manual_audit)
        
        # Auto-Disbursement Trigger
        auto_disburse = False
        if eligible and (sector_dip > 0.2 or severe_weather_event) and velocity_score > 80:
            auto_disburse = True

        # Predicted Compensation (Partial Indemnity / Co-insurance)
        predicted_compensation = 0.0
        if eligible:
            verified_dip = max(0.0, float(mu - current_income))
            co_insurance_cap = 0.70  # Pool pays max 70% of the loss to retain worker incentive
            payout = min(src_cap, verified_dip * co_insurance_cap)
            predicted_compensation = max(0.0, payout)

        # Embedded Micro-Premium Rate
        base_rate = 0.015 if stability_score > 70 else 0.025
        
        # Gamification & Squad Discounts
        if financial_level == 3:
            base_rate -= 0.002  # Level 3 discount
        if squad_no_claim_bonus:
            base_rate -= 0.003  # Trust Squad Dividend
            
        micro_deduction_rate = max(0.005, base_rate)

        return {
            "mu": float(mu),
            "sigma": float(sigma),
            "stability_score": float(stability_score),
            "velocity_score": float(velocity_score),
            "financial_level": int(financial_level),
            "micro_deduction_rate": float(micro_deduction_rate),
            "auto_disburse": auto_disburse,
            "dip_detected": current_dip_detected,
            "eligible": eligible,
            "payout": float(predicted_compensation),
            "needs_manual_audit": needs_manual_audit,
            "is_active_business": is_active_business,
            "paid_months": paid_months,
            "unpaid_months": unpaid_months,
            "dip_probability": float(dip_probability),
            "risk_level": risk_level,
            "pattern_detected": pattern_detected,
            "predicted_dip_month": predicted_dip_month,
            "next_dip_idx": next_dip_idx
        }

def calculate_custom_premium(mean, dip_probability, age, dependencies, employment_status, risk_score=0):
    """
    Calculate IDCS custom premium based on deterministic Actuarial Formula.
    Premium = Base + (Dip_Probability_Loading * Risk_Score_Factor)
    """
    if mean <= 0:
        return 0.0, 0.0

    # Calculate 70% cap
    max_comp = mean * 0.7
    
    # Base premium logic (2% of mean)
    base = mean * 0.02
    
    # Risk loading logic (incorporating Prophet risk score)
    # risk_score is 0-100, normalize as a multiplier (1.0 to 2.5)
    r_multiplier = 1.0 + (risk_score / 100 * 1.5)
    
    # Historical dip probability adds a secondary load
    prob_load = (dip_probability / 100) * (mean * 0.01)
    
    premium = (base + prob_load) * r_multiplier
    
    return round(float(premium), 2), round(float(max_comp), 2)


INSURANCE_SCHEMES = {
    "Britam Family Income Protection": {
        "description": "Monthly payout for 3-10 years, 10% annual inflation adjustment. Premium ~3,000 KES/mo.",
        "premium": 3000,
        "key_benefit": "Monthly Cash Replacement"
    },
    "Liberty Combined Solution": {
        "description": "Temporary disability weekly wages + 96 months salary replacement. Best for formal employees.",
        "premium": 2000,
        "key_benefit": "Weekly Wages + Salary Replacement"
    },
    "Jubilee Bima Ya Mwananchi": {
        "description": "Micro-insurance for informal workers (Jua Kali). Low entry, daily hospital cash.",
        "premium": 500,
        "key_benefit": "Daily Hospital Cash"
    },
    "SHIF (Social Health Insurance Fund)": {
        "description": "2.75% of gross income. Mandatory baseline health cover.",
        "premium": None,
        "key_benefit": "Baseline Health Cover"
    }
}

def calculate_match_score(user_profile, scheme_name):
    score = 0
    scheme = INSURANCE_SCHEMES.get(scheme_name)
    if not scheme:
        return 0
        
    employment = str(user_profile.get('employment_status', '')).lower()
    is_formal = 'formal' in employment or 'public' in employment or 'private' in employment
    is_informal = 'informal' in employment or 'jua kali' in employment or 'self-employed' in employment
    
    dependants = int(user_profile.get('dependants', 0))
    mu = float(user_profile.get('mu', 0))
    sigma = float(user_profile.get('sigma', 0))
    
    # Base match scores logic
    volatility_high = (sigma > 0.15 * mu) if mu > 0 else False
    
    # Employment Match (+40)
    if 'liberty' in scheme_name.lower() and is_formal:
        score += 40
    elif 'jubilee' in scheme_name.lower() and is_informal:
        score += 40
        
    # Volatility Match (+30)
    desc_lower = scheme['description'].lower()
    if volatility_high and ('monthly' in desc_lower or 'weekly' in desc_lower):
        score += 30
        
    # Dependant Weight (+20)
    if dependants > 2 and 'family' in scheme_name.lower():
        score += 20
        
    # Affordability Deduction
    premium = scheme.get('premium')
    if premium is None: # for SHIF
        premium = mu * 0.0275 if mu else 0
        
    if mu > 0 and premium > (0.10 * mu):
        score -= 20
        
    return max(0, min(100, score))
