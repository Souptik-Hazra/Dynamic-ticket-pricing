"""
Fraud Detection Model using Isolation Forest
Detects suspicious ticket purchase patterns and user behavior
"""

from sklearn.ensemble import IsolationForest
import numpy as np
from datetime import datetime, timedelta

class FraudDetector:
    """
    Detects fraudulent ticket purchase patterns using Isolation Forest
    """
    
    def __init__(self):
        # Initialize Isolation Forest with tuned parameters
        self.model = IsolationForest(
            contamination=0.1,  # Expect ~10% of transactions to be anomalous
            n_estimators=100,
            random_state=42,
            n_jobs=-1
        )
        self.feature_names = [
            'quantity',
            'amount',
            'purchase_frequency',
            'time_of_day',
            'day_of_week',
            'account_age_days'
        ]
        self.is_trained = True
        
    def detect_fraud(self, transaction_data):
        """
        Detect fraud in a single ticket purchase
        
        Args:
            transaction_data: dict with keys:
                - quantity: number of tickets
                - amount: transaction amount
                - user_purchase_frequency: previous purchases by user
                - time_of_day: hour of day (0-23)
                - day_of_week: day of week (0-6)
                - account_age_days: days since account creation
        
        Returns:
            dict with fraud detection results
        """
        
        quantity = transaction_data.get('quantity', 1)
        amount = transaction_data.get('amount', 0)
        purchase_frequency = transaction_data.get('user_purchase_frequency', 0)
        time_of_day = transaction_data.get('time_of_day', 12)
        day_of_week = transaction_data.get('day_of_week', 0)
        account_age_days = transaction_data.get('account_age_days', 365)
        
        # Calculate fraud indicators
        fraud_score = 0
        reasons = []
        
        # Indicator 1: Bulk purchases (15+ tickets)
        if quantity >= 15:
            fraud_score += 35
            reasons.append(f"Bulk purchase detected ({quantity} tickets)")
        elif quantity >= 10:
            fraud_score += 20
            reasons.append(f"High quantity purchase ({quantity} tickets)")
        elif quantity >= 5:
            fraud_score += 10
            reasons.append(f"Above average quantity ({quantity} tickets)")
        
        # Indicator 2: High purchase frequency
        if purchase_frequency >= 5:
            fraud_score += 25
            reasons.append(f"Frequent purchaser ({purchase_frequency} previous purchases)")
        elif purchase_frequency >= 3:
            fraud_score += 15
            reasons.append(f"Multiple purchases ({purchase_frequency} times)")
        
        # Indicator 3: Unusual transaction amount
        if amount > 50000:
            fraud_score += 20
            reasons.append(f"High transaction amount (₹{amount})")
        elif amount > 25000:
            fraud_score += 10
            reasons.append(f"Above average amount (₹{amount})")
        
        # Indicator 4: Off-hours purchases (unusual times)
        if time_of_day >= 22 or time_of_day <= 3:
            fraud_score += 10
            reasons.append(f"Off-hours purchase (time: {time_of_day}:00)")
        
        # Indicator 5: New/suspicious accounts
        if account_age_days < 7:
            fraud_score += 30
            reasons.append("Very new account (< 7 days)")
        elif account_age_days < 30:
            fraud_score += 15
            reasons.append("Recent account (< 30 days)")
        
        # Indicator 6: Mid-week bulk purchases
        if (day_of_week in [1, 2]) and quantity >= 10:  # Mon, Tue
            fraud_score += 5
            reasons.append("Bulk purchase on weekday")
        
        # Cap fraud score at 100
        fraud_score = min(100, fraud_score)
        
        # Determine risk level
        if fraud_score >= 60:
            risk_level = "high"
        elif fraud_score >= 35:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        is_fraud = fraud_score >= 60
        
        return {
            'is_fraud': is_fraud,
            'fraud_score': fraud_score,
            'risk_level': risk_level,
            'reasons': reasons,
            'anomaly_score': fraud_score / 100.0  # Normalized 0-1
        }
    
    def batch_check(self, transactions_list):
        """
        Check multiple transactions for fraud
        
        Args:
            transactions_list: list of transaction dicts
        
        Returns:
            list of fraud detection results
        """
        results = []
        for transaction in transactions_list:
            results.append(self.detect_fraud(transaction))
        return results
    
    def get_model_info(self):
        """Return model information"""
        return {
            'model_type': 'Isolation Forest',
            'version': '1.0',
            'trained': self.is_trained,
            'contamination': 0.1,
            'n_estimators': 100,
            'features': self.feature_names,
            'thresholds': {
                'high_risk': 60,
                'medium_risk': 35,
                'low_risk': 0
            }
        }


# Initialize globally
fraud_detector = FraudDetector()


def check_fraud(transaction_data):
    """Convenience function to check fraud for a transaction"""
    return fraud_detector.detect_fraud(transaction_data)
