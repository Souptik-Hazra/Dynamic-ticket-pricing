def insert_test_users():
    """Insert sample users for testing if users collection is empty."""
    db = get_db()
    if db["users"].count_documents({}) == 0:
        now = datetime.now()
        users = [
            {"_id": 1, "email": "alice@example.com", "createdAt": now},
            {"_id": 2, "email": "bob@example.com", "createdAt": now},
            {"_id": 3, "email": "carol@example.com", "createdAt": now}
        ]
        db["users"].insert_many(users)
        print("Inserted test users.")
    else:
        print("Users already exist in the database.")
from pymongo import MongoClient
import os
from datetime import datetime
import numpy as np

def get_mongo_client():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    return MongoClient(mongo_uri)

def get_db():
    client = get_mongo_client()
    return client["dynamic_ticket_pricing"]

def get_user_tickets(user_id):
    db = get_db()
    return list(db["tickets"].find({"userId": user_id}))

def update_user_fraud_stats(user_id, stats):
    db = get_db()
    db["userfraudstats"].update_one(
        {"userId": user_id},
        {"$set": stats},
        upsert=True
    )

def get_all_users():
    db = get_db()
    return list(db["users"].find({}))

def aggregate_user_stats(tickets):
    total_purchases = len(tickets)
    total_tickets = sum(t.get('quantity', 1) for t in tickets)
    total_spent = sum(t.get('totalAmount', 0) for t in tickets)
    avg_qty = (total_tickets / total_purchases) if total_purchases > 0 else 0
    return total_purchases, total_tickets, avg_qty, total_spent

from sklearn.ensemble import IsolationForest

class FraudDetector:
    """
    Detects fraudulent ticket purchase patterns using both rules and Isolation Forest
    """
    def __init__(self):
        self.model = IsolationForest(
            contamination=0.1,
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
        self.is_trained = False
        self._fit_model()

    def _fit_model(self):
        # Fit the Isolation Forest on historical data (all tickets)
        db = get_db()
        tickets = list(db["tickets"].find({}))
        X = []
        for t in tickets:
            user_id = t.get('userId')
            user = db["users"].find_one({'_id': user_id}) or {}
            total_purchases = db["tickets"].count_documents({'userId': user_id})
            features = [
                t.get('quantity', 1),
                t.get('totalAmount', 0),
                total_purchases - 1,
                t.get('purchaseDate', datetime.now()).hour if t.get('purchaseDate') else 12,
                t.get('purchaseDate', datetime.now()).weekday() if t.get('purchaseDate') else 0,
                (datetime.now() - user.get('createdAt', datetime.now())).days if user.get('createdAt') else 365
            ]
            X.append(features)
        if X:
            self.model.fit(np.array(X))
            self.is_trained = True

    def detect_fraud(self, transaction_data):
        # --- Rule-based scoring ---
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

        # --- Isolation Forest anomaly score ---
        anomaly_score = None
        if self.is_trained:
            X = np.array([[quantity, amount, purchase_frequency, time_of_day, day_of_week, account_age_days]])
            anomaly_score = -self.model.decision_function(X)[0]  # Higher = more anomalous
            if anomaly_score > 0.2:
                reasons.append(f"IsolationForest: Anomalous transaction (score={anomaly_score:.2f})")
                fraud_score = max(fraud_score, 60)  # Escalate to high risk if anomaly is strong

        return {
            'is_fraud': is_fraud or (anomaly_score is not None and anomaly_score > 0.2),
            'fraud_score': fraud_score,
            'risk_level': risk_level,
            'reasons': reasons,
            'anomaly_score': anomaly_score if anomaly_score is not None else fraud_score / 100.0
        }

    def batch_check(self, transactions_list):
        results = []
        for transaction in transactions_list:
            results.append(self.detect_fraud(transaction))
        return results

def batch_update_all_user_fraud_stats():
    detector = FraudDetector()
    users = get_all_users()
    print(f"Found {len(users)} users.")
    for user in users:
        user_id = user['_id']
        tickets = get_user_tickets(user_id)
        total_purchases, total_tickets, avg_qty, total_spent = aggregate_user_stats(tickets)
        fraud_scores = []
        all_reasons = set()
        last_flagged = None
        for t in tickets:
            tx = {
                'quantity': t.get('quantity', 1),
                'amount': t.get('totalAmount', 0),
                'user_purchase_frequency': total_purchases - 1,
                'time_of_day': t.get('purchaseDate', datetime.now()).hour if t.get('purchaseDate') else 12,
                'day_of_week': t.get('purchaseDate', datetime.now()).weekday() if t.get('purchaseDate') else 0,
                'account_age_days': (datetime.now() - user.get('createdAt', datetime.now())).days if user.get('createdAt') else 365
            }
            result = detector.detect_fraud(tx)
            fraud_scores.append(result['fraud_score'])
            all_reasons.update(result['reasons'])
            if result['fraud_score'] >= 60 or (result.get('anomaly_score', 0) > 0.2):
                last_flagged = t.get('purchaseDate', datetime.now())
        avg_fraud_score = sum(fraud_scores) / len(fraud_scores) if fraud_scores else 0
        if avg_fraud_score >= 60:
            risk_level = 'HIGH'
        elif avg_fraud_score >= 35:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
        stats = {
            'fraudScore': avg_fraud_score,
            'riskLevel': risk_level,
            'totalPurchases': total_purchases,
            'totalTickets': total_tickets,
            'avgQtyPerPurchase': avg_qty,
            'totalSpent': total_spent,
            'flaggedReasons': list(all_reasons),
            'lastFlaggedAt': last_flagged,
            'updatedAt': datetime.now()
        }
        update_user_fraud_stats(user_id, stats)
        print(f"Updated fraud stats for user {user.get('email', user_id)}: {stats}")


# Global instance for quick checks
fraud_detector = FraudDetector()

def check_fraud(transaction_data):
    """
    Check a single transaction for fraud using both rules and Isolation Forest.
    Returns a dict with is_fraud, fraud_score, risk_level, reasons, anomaly_score.
    """
    return fraud_detector.detect_fraud(transaction_data)

if __name__ == "__main__":
    insert_test_users()
    batch_update_all_user_fraud_stats()
