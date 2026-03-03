
# Only keep the core fraud detection logic for API use (used by app.py)
def check_fraud(transaction_data):
    """
    Detect fraud in a single ticket purchase using rule-based and/or ML logic.
    Args:
        transaction_data: dict with keys:
            - quantity
            - amount
            - user_purchase_frequency
            - time_of_day
            - day_of_week
            - account_age_days
    Returns:
        dict with fraud detection results
    """
    quantity = transaction_data.get('quantity', 1)
    amount = transaction_data.get('amount', 0)
    purchase_frequency = transaction_data.get('user_purchase_frequency', 0)
    time_of_day = transaction_data.get('time_of_day', 12)
    day_of_week = transaction_data.get('day_of_week', 0)
    account_age_days = transaction_data.get('account_age_days', 365)

    fraud_score = 0
    reasons = []
    if quantity >= 15:
        fraud_score += 35
        reasons.append(f"Bulk purchase detected ({quantity} tickets)")
    elif quantity >= 10:
        fraud_score += 20
        reasons.append(f"High quantity purchase ({quantity} tickets)")
    elif quantity >= 5:
        fraud_score += 10
        reasons.append(f"Above average quantity ({quantity} tickets)")
    if purchase_frequency >= 5:
        fraud_score += 25
        reasons.append(f"Frequent purchaser ({purchase_frequency} previous purchases)")
    elif purchase_frequency >= 3:
        fraud_score += 15
        reasons.append(f"Multiple purchases ({purchase_frequency} times)")
    if amount > 50000:
        fraud_score += 20
        reasons.append(f"High transaction amount (₹{amount})")
    elif amount > 25000:
        fraud_score += 10
        reasons.append(f"Above average amount (₹{amount})")
    if time_of_day >= 22 or time_of_day <= 3:
        fraud_score += 10
        reasons.append(f"Off-hours purchase (time: {time_of_day}:00)")
    if account_age_days < 7:
        fraud_score += 30
        reasons.append("Very new account (< 7 days)")
    elif account_age_days < 30:
        fraud_score += 15
        reasons.append("Recent account (< 30 days)")
    if (day_of_week in [1, 2]) and quantity >= 10:
        fraud_score += 5
        reasons.append("Bulk purchase on weekday")
    fraud_score = min(100, fraud_score)
    if fraud_score >= 60:
        risk_level = "HIGH"
    elif fraud_score >= 35:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"
    is_fraud = fraud_score >= 60
    return {
        'is_fraud': is_fraud,
        'fraud_score': fraud_score,
        'risk_level': risk_level,
        'reasons': reasons,
        'anomaly_score': fraud_score / 100.0
    }

