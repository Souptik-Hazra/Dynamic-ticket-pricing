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
            'demand', 'capacity', 'days_until_event', 'event_duration_days', 'event_popularity',
            'competitor_price', 'historical_sales', 'season', 'day_of_week',
            'hour_of_day', 'is_weekend', 'is_holiday',
            'venue_tier', 'artist_tier'
        ]
        
    def generate_enhanced_synthetic_data(self, n_samples=15000):
        """Generate highly realistic synthetic training data for Indian market"""
        np.random.seed(42)
        
        # Core features with realistic distributions
        demand = np.random.randint(10, 3000, n_samples)
        capacity = np.random.randint(100, 10000, n_samples)
        days_until_event = np.random.randint(1, 180, n_samples)
        event_duration_days = np.random.randint(1, 30, n_samples)  # Duration from 1 to 30 days
        event_popularity = np.random.beta(2, 3, n_samples)  # Skewed toward lower popularity
        
        # Indian market competitor prices (INR)
        competitor_price = np.random.lognormal(5.5, 0.8, n_samples)
        competitor_price = np.clip(competitor_price, 100, 5000)
        
        historical_sales = np.random.randint(0, 2000, n_samples)
        season = np.random.randint(1, 5, n_samples)  # 1=Winter, 2=Spring, 3=Summer, 4=Monsoon
        day_of_week = np.random.randint(1, 8, n_samples)
        hour_of_day = np.random.randint(0, 24, n_samples)
        
        # New enhanced features
        is_weekend = (day_of_week >= 6).astype(int)
        is_holiday = np.random.choice([0, 1], n_samples, p=[0.85, 0.15])
        venue_tier = np.random.randint(1, 4, n_samples)  # 1=Small, 2=Medium, 3=Large/Stadium
        artist_tier = np.random.randint(1, 6, n_samples)  # 1=Local, 5=International Star
        
        # Calculate derived factors for pricing
        occupancy_rate = np.clip(demand / capacity, 0, 1.5)
        urgency_factor = np.exp(-days_until_event / 30)  # Exponential urgency
        event_duration_factor = 1 + (event_duration_days / 10) * 0.1  # Multi-day events get premium
        
        # Base price varies by venue and artist tier
        base_price = 150 + (venue_tier * 50) + (artist_tier * 100)
        
        # Dynamic pricing formula - Indian market calibrated
        price = base_price * (
            (1 + occupancy_rate * 0.6) *  # Demand factor
            (1 + urgency_factor * 0.5) *  # Urgency factor
            event_duration_factor *  # Event duration factor
            (1 + event_popularity * 0.7) *  # Popularity premium
            (1 + is_weekend * 0.12) *  # Weekend premium
            (1 + is_holiday * 0.25) *  # Holiday premium
            (0.9 + (competitor_price / 1000) * 0.2) *  # Market alignment
            (1 + (historical_sales / 2000) * 0.15)  # Historical demand
        )
        
        # Time-based adjustments
        peak_hours = ((hour_of_day >= 18) & (hour_of_day <= 22)).astype(int)
        price = price * (1 + peak_hours * 0.08)
        
        # Season adjustments (festive season premium in India)
        festive_season = ((season == 4) | (season == 1)).astype(int)
        price = price * (1 + festive_season * 0.15)
        
        # Add controlled noise
        noise = np.random.normal(1, 0.03, n_samples)
        price = price * noise
        
        # Apply realistic price bounds (₹50 to ₹50,000 for premium events)
        price = np.clip(price, 50, 50000)
        
        df = pd.DataFrame({
            'demand': demand,
            'capacity': capacity,
            'days_until_event': days_until_event,
            'event_duration_days': event_duration_days,
            'event_popularity': event_popularity,
            'competitor_price': competitor_price,
            'historical_sales': historical_sales,
            'season': season,
            'day_of_week': day_of_week,
            'hour_of_day': hour_of_day,
            'is_weekend': is_weekend,
            'is_holiday': is_holiday,
            'venue_tier': venue_tier,
            'artist_tier': artist_tier,
            'price': price
        })
        
        return df
    
    def create_model(self):
        """Create a high-performance XGBoost model"""
        print("Initializing XGBRegressor (XGBoost)...")
        if not HAS_XGBOOST:
            print("⚠️ XGBoost not found! Falling back to GradientBoostingRegressor.")
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
            print(f"XGBoost CV R² Score: {cv_mean:.4f} (+/- {cv_std * 2:.4f})")
        
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
        
        print(f"\n📊 Performance Metrics:")
        print(f"   Training R² Score: {metrics['train_r2']:.4f}")
        print(f"   Testing R² Score:  {metrics['test_r2']:.4f}")
        print(f"   Training MAE:      ₹{metrics['train_mae']:.2f}")
        print(f"   Testing MAE:       ₹{metrics['test_mae']:.2f}")
        print(f"   Training RMSE:     ₹{metrics['train_rmse']:.2f}")
        print(f"   Testing RMSE:      ₹{metrics['test_rmse']:.2f}")
        
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
        print(f"✅ Model saved to {model_path}")
        print(f"✅ Scaler saved to {scaler_path}")
    
    def load_model(self, model_path='model_enhanced.pkl', scaler_path='scaler_enhanced.pkl'):
        """Load trained model and scaler"""
        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path)
        print("✅ Model and scaler loaded successfully")


def main():
    """Main training pipeline for XGBoost model v2.0"""
    print("=" * 70)
    print("   🎫 Dynamic Ticket Pricing Model (XGBoost) v2.0")
    print("=" * 70)
    
    # Initialize model
    pricing_model = EnhancedTicketPricingModel()
    
    # Generate synthetic data
    print("\n📦 Generating training data...")
    df = pricing_model.generate_enhanced_synthetic_data(n_samples=15000)
    print(f"   Generated {len(df)} training samples")
    
    # Train model
    print("\n🚀 Training XGBoost model...")
    metrics = pricing_model.train(df)
    
    # Feature importance
    print("\n📈 Top Feature Importance:")
    importance = pricing_model.get_feature_importance()
    for i, (feature, imp) in enumerate(list(importance.items())[:10], 1):
        bar = "█" * int(imp * 50)
        print(f"   {i:2d}. {feature:25s} {bar} {imp:.4f}")
    
    # Save model
    print("\n💾 Saving model...")
    pricing_model.save_model(
        model_path='model.pkl',
        scaler_path='scaler.pkl'
    )
    
    # Test predictions with various scenarios
    print("\n🧪 Testing predictions with real-world scenarios...")
    test_cases = [
        ("Budget Event (Low Demand)", [100, 1000, 60, 1, 0.3, 200, 50, 2, 3, 14, 0, 0, 1, 2]),
        ("Premium Concert (3-day)", [2500, 3000, 3, 3, 0.9, 2000, 1500, 4, 6, 20, 1, 0, 3, 5]),
        ("Weekend Holiday Show (2-days)", [800, 1500, 15, 2, 0.6, 800, 400, 1, 7, 19, 1, 1, 2, 3]),
        ("Last Minute Hot Event (1-day)", [1200, 2000, 1, 1, 0.85, 1500, 800, 3, 5, 21, 0, 0, 2, 4]),
    ]
    
    for name, features in test_cases:
        result = pricing_model.predict(features)
        print(f"\n   📌 {name}:")
        print(f"      Predicted Price: ₹{result['price']:.2f}")
    
    # Save model info
    model_version = f"v2.0.{datetime.now().strftime('%Y%m%d')}"
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
    print("\n🔗 Attempting to sync model metadata with MongoDB...")
    # Use environment variable for backend URL if available
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001')
    try:
        response = requests.post(
            f'{backend_url}/api/ml-model/update-metadata',
            json=model_info,
            timeout=5
        )
        if response.status_code == 200:
            print(f"   ✅ Successfully synced Version {model_version} to MongoDB")
        else:
            print(f"   ⚠️ Sync skipped (backend returned status: {response.status_code})")
    except requests.exceptions.ConnectionError:
        print(f"   ⚠️ Backend not running - skipping MongoDB sync (this is OK)")
    except Exception as e:
        print(f"   ⚠️ Could not sync (this is OK): {type(e).__name__}")
    
    print("\n" + "=" * 70)
    print("   ✅ Enhanced Model v2.0 Training Complete!")
    print("=" * 70)
    print(f"\n   📊 Model Version: {model_version}")
    print(f"   🎯 Test R² Score: {metrics['test_r2']:.4f} ({metrics['test_r2']*100:.2f}%)")
    print(f"   📉 Test MAE: ₹{metrics['test_mae']:.2f}")
    print(f"   📁 Files: model.pkl, scaler.pkl, model_info.json")
    print("")


if __name__ == "__main__":
    main()
