"""
Dynamic Ticket Pricing Model v2.0
- Optimized XGBRegressor (XGBoost) for high-accuracy pricing
- Synthetic data generation for Indian market trends
- Cross-validation and performance evaluation
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import RobustScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import json
import os
from datetime import datetime
import warnings
import requests
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=dotenv_path)

warnings.filterwarnings('ignore')

# Try to import XGBoost
try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

class EnhancedTicketPricingModel:
    def __init__(self):
        self.scaler = RobustScaler()
        self.model = None
        self.feature_names = [
            'capacity', 'tickets_sold', 'base_price', 'days_until_event', 'event_duration', 
            'event_popularity', 'venue_tier', 'artist_tier', 'is_holiday',
            'cat_concert', 'cat_sports', 'cat_theater', 'cat_conference', 'cat_festival', 'cat_other'
        ]
        self.categories = ['concert', 'sports', 'theater', 'conference', 'festival', 'other']
        
    def generate_enhanced_synthetic_data(self, n_samples=15000):
        """Generate training data strictly aligned with Database fields"""
        np.random.seed(42)
        
        capacity = np.random.randint(100, 10000, n_samples)
        tickets_sold = (capacity * np.random.beta(0.5, 0.5, n_samples)).astype(int)
        base_price = np.random.randint(200, 5000, n_samples)
        days_until_event = np.random.randint(0, 180, n_samples)
        event_duration = np.random.randint(1, 14, n_samples)
        event_popularity = np.random.beta(2, 3, n_samples)
        venue_tier = np.random.randint(1, 4, n_samples)
        artist_tier = np.random.randint(0, 6, n_samples)
        is_holiday = np.random.choice([0, 1], n_samples, p=[0.9, 0.1])
        
        # Categorical data
        categories_data = np.random.choice(self.categories, n_samples)
        
        # Calculate Labels (Price)
        occupancy_rate = np.clip(tickets_sold / capacity, 0, 1.2)
        urgency = 1.0 + (1.0 - (days_until_event / 180)) * 0.4
        tier_multiplier = 1.0 + (venue_tier * 0.1) + (artist_tier * 0.15)
        
        # Category premiums
        cat_premiums = {'concert': 1.3, 'sports': 1.5, 'theater': 1.2, 'conference': 2.0, 'festival': 1.4, 'other': 1.0}
        category_factor = np.array([cat_premiums[c] for c in categories_data])

        # Dynamic Pricing Logic
        price = base_price * (
            (1 + occupancy_rate * 0.7) *
            urgency *
            tier_multiplier *
            category_factor *
            (1 + event_popularity * 0.5) *
            (1 + is_holiday * 0.3)
        )
        
        price = np.clip(price, base_price * 0.8, base_price * 5)
        
        # Create DataFrame
        df = pd.DataFrame({
            'capacity': capacity,
            'tickets_sold': tickets_sold,
            'base_price': base_price,
            'days_until_event': days_until_event,
            'event_duration': event_duration,
            'event_popularity': event_popularity,
            'venue_tier': venue_tier,
            'artist_tier': artist_tier,
            'is_holiday': is_holiday,
            'category': categories_data,
            'price': price
        })
        
        # One-Hot encoding for category
        for cat in self.categories:
            df[f'cat_{cat}'] = (df['category'] == cat).astype(int)
        
        df = df.drop('category', axis=1)
        return df
    
    def create_model(self):
        """Create a high-performance XGBoost model"""
        print("Initializing XGBRegressor (XGBoost)...")
        if not HAS_XGBOOST:
            print(" XGBoost not found! Falling back to GradientBoostingRegressor.")
            from sklearn.ensemble import GradientBoostingRegressor
            return GradientBoostingRegressor(
                n_estimators=300,
                max_depth=10,
                learning_rate=0.08,
                random_state=42
            )
            
        model = XGBRegressor(
            n_estimators=500,
            max_depth=10,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.8,
            random_state=42,
            verbosity=0,
            n_jobs=-1
        )
        return model
    
    def train(self, df, use_cross_validation=True):
        """Train the pricing model with cross-validation"""
        X = df.drop('price', axis=1)
        y = df['price']
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Create and train model
        self.model = self.create_model()
        
        # Cross-validation
        cv_mean = 0
        cv_std = 0
        if use_cross_validation:
            print(f"Running 5-fold cross-validation on XGBoost...")
            cv_scores = cross_val_score(self.model, X_train_scaled, y_train, cv=5, scoring='r2')
            cv_mean = cv_scores.mean()
            cv_std = cv_scores.std()
            print(f"XGBoost CV R Score: {cv_mean:.4f} (+/- {cv_std * 2:.4f})")
        
        # Train final model
        print("Training final XGBoost model...")
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_pred = self.model.predict(X_train_scaled)
        test_pred = self.model.predict(X_test_scaled)
        
        # Calculate metrics
        metrics = {
            'train_r2': r2_score(y_train, train_pred),
            'test_r2': r2_score(y_test, test_pred),
            'train_mae': mean_absolute_error(y_train, train_pred),
            'test_mae': mean_absolute_error(y_test, test_pred),
            'train_rmse': np.sqrt(mean_squared_error(y_train, train_pred)),
            'test_rmse': np.sqrt(mean_squared_error(y_test, test_pred)),
            'cv_mean': cv_mean if use_cross_validation else None,
            'cv_std': cv_std if use_cross_validation else None
        }
        
        print(f"\n Performance Metrics:")
        print(f"   Training R Score: {metrics['train_r2']:.4f}")
        print(f"   Testing R Score:  {metrics['test_r2']:.4f}")
        print(f"   Training MAE:      {metrics['train_mae']:.2f}")
        print(f"   Testing MAE:       {metrics['test_mae']:.2f}")
        print(f"   Training RMSE:     {metrics['train_rmse']:.2f}")
        print(f"   Testing RMSE:      {metrics['test_rmse']:.2f}")
        
        return metrics
    
    def predict(self, features):
        """Predict ticket price"""
        features_array = np.array(features).reshape(1, -1)
        features_scaled = self.scaler.transform(features_array)
        
        # Get XGBoost prediction
        pred = self.model.predict(features_scaled)[0]
        
        # Final prediction with bounds
        final_price = max(50, min(pred, 25000))
        
        return {
            'price': final_price,
            'confidence_low': max(50, final_price * 0.95),
            'confidence_high': min(25000, final_price * 1.05),
            'model_agreement': 1.0
        }
    
    def get_feature_importance(self):
        """Get feature importance"""
        importance = self.model.feature_importances_
        feature_importance = dict(zip(self.feature_names, importance))
        return dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
    
    def save_model(self, model_path='model.pkl', scaler_path='scaler.pkl'):
        """Save trained model and scaler"""
        joblib.dump(self.model, model_path)
        joblib.dump(self.scaler, scaler_path)
        print(f" Model saved to {model_path}")
        print(f" Scaler saved to {scaler_path}")
    
    def load_model(self, model_path='model_enhanced.pkl', scaler_path='scaler_enhanced.pkl'):
        """Load trained model and scaler"""
        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path)
        print(" Model and scaler loaded successfully")
        print(" Model and scaler loaded successfully")


def main():
    """Main training pipeline for XGBoost model v2.0"""
    print("=" * 70)
    print("   Dynamic Ticket Pricing Model (XGBoost) v2.0")
    print("=" * 70)
    
    # Initialize model
    pricing_model = EnhancedTicketPricingModel()
    
    # Generate synthetic data
    print("\nGenerating training data...")
    df = pricing_model.generate_enhanced_synthetic_data(n_samples=15000)
    print(f"   Generated {len(df)} training samples")
    
    # Train model
    print("\nTraining XGBoost model...")
    metrics = pricing_model.train(df)
    
    # Feature importance
    print("\n Top Feature Importance:")
    importance = pricing_model.get_feature_importance()
    for i, (feature, imp) in enumerate(list(importance.items())[:10], 1):
        bar = "#" * int(imp * 50)
        print(f"   {i:2d}. {feature:25s} {bar} {imp:.4f}")
    
    # Save model
    print("\n Saving model...")
    pricing_model.save_model(
        model_path='model.pkl',
        scaler_path='scaler.pkl'
    )
    
    # Test predictions with various scenarios
    print("\n Testing predictions with real-world scenarios...")
    test_cases = [
        ("Budget Concert", [500, 50, 1000, 30, 1, 0.3, 1, 1, 0, 1, 0, 0, 0, 0, 0]),
        ("Premium Conference", [2000, 1500, 5000, 5, 2, 0.9, 3, 4, 1, 0, 0, 0, 1, 0, 0]),
        ("Stadium Sports", [50000, 45000, 500, 2, 1, 0.95, 3, 5, 1, 0, 1, 0, 0, 0, 0]),
    ]
    
    for name, features in test_cases:
        result = pricing_model.predict(features)
        print(f"\n    {name}:")
        print(f"      Predicted Price: {result['price']:.2f}")
    
    # Save model info
    model_version = f"v2.1.{datetime.now().strftime('%Y%m%d')}"
    model_info = {
        'modelVersion': model_version,
        'modelType': "XGBRegressor (XGBoost)",
        'features': pricing_model.feature_names,
        'numFeatures': len(pricing_model.feature_names),
        'trainScore': float(metrics['train_r2']),
        'testScore': float(metrics['test_r2']),
        'trainMAE': float(metrics['train_mae']),
        'testMAE': float(metrics['test_mae']),
        'trainRMSE': float(metrics['train_rmse']),
        'testRMSE': float(metrics['test_rmse']),
        'parameters': {
            'n_estimators': 500,
            'max_depth': 10,
            'learning_rate': 0.08,
            'subsample': 0.9
        },
        'metadata': {
            'trainedAt': datetime.now().isoformat(),
            'currency': 'INR'
        }
    }
    
    with open('model_info.json', 'w') as f:
        json.dump(model_info, f, indent=2)

    # Sync with MongoDB if backend is running (optional - not required for model to work)
    print("\n Attempting to sync model metadata with MongoDB...")
    # Use environment variable for backend URL if available
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001')
    try:
        response = requests.post(
            f'{backend_url}/api/ml-model/update-metadata',
            json=model_info,
            timeout=5
        )
        if response.status_code == 200:
            print(f"    Successfully synced Version {model_version} to MongoDB")
        else:
            print(f"    Sync skipped (backend returned status: {response.status_code})")
    except requests.exceptions.ConnectionError:
        print(f"    Backend not running - skipping MongoDB sync (this is OK)")
    except Exception as e:
        print(f"    Could not sync (this is OK): {type(e).__name__}")
    
    print("\n" + "=" * 70)
    print("    Enhanced Model v2.0 Training Complete!")
    print("Summary:")
    print(f"   Model Version: {model_version}")
    print(f"   Test R2 Score: {metrics['test_r2']:.4f} ({metrics['test_r2']*100:.2f}%)")
    print(f"   Test MAE: INR {metrics['test_mae']:.2f}")
    print(f"   Files: model.pkl, scaler.pkl, model_info.json")
    print("")


if __name__ == "__main__":
    main()
