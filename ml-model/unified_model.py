import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np
import pandas as pd
import joblib
import json
import os
from datetime import datetime

# Unified Cognitive-Economic Neural Network (MCENN)
# 
# This model replaces the traditional XGBoost with a Deep Learning architecture
# that fuses Market Economics with Behavioral Cognitive scores.

class UnifiedPricingModel:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = [
            'capacity', 'tickets_sold', 'base_price', 'max_price', 'days_until_event', 
            'event_popularity', 'venue_tier', 'artist_tier', 'cognitive_score', 'is_holiday',
            'cat_concert', 'cat_sports', 'cat_theater', 'cat_conference', 'cat_festival', 'cat_other'
        ]

    def build_model(self):
        # Multi-Input Style Architecture
        model = keras.Sequential([
            layers.Input(shape=(len(self.feature_names),)),
            layers.Dense(128, activation='relu'),
            layers.Dropout(0.2),
            layers.Dense(64, activation='relu'),
            layers.Dense(32, activation='relu'),
            layers.Dense(1, activation='linear') 
        ])

        model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        self.model = model
        return model

    def generate_unified_data(self, n_samples=10000):
        np.random.seed(42)
        
        # Economic Data
        capacity = np.random.randint(500, 5000, n_samples)
        tickets_sold = (capacity * np.random.random(n_samples)).astype(int)
        base_price = np.random.randint(500, 5000, n_samples)
        max_price = base_price * np.random.uniform(1.5, 5.0, n_samples)
        days_until_event = np.random.randint(0, 60, n_samples)
        
        # Cognitive & Tier Data
        cognitive_score = np.random.uniform(0, 1, n_samples)
        event_popularity = np.random.random(n_samples)
        venue_tier = np.random.randint(1, 4, n_samples)
        artist_tier = np.random.randint(1, 6, n_samples)
        is_holiday = np.random.choice([0, 1], n_samples, p=[0.9, 0.1])
        
        # Categories
        categories = ['concert', 'sports', 'theater', 'conference', 'festival', 'other']
        cat_choice = np.random.choice(categories, n_samples)
        cat_premiums = {'concert': 1.3, 'sports': 1.5, 'theater': 1.2, 'conference': 2.0, 'festival': 1.4, 'other': 1.0}
        
        # The Unified Pricing Logic
        occupancy = tickets_sold / capacity
        economic_factor = (1 + occupancy * 0.4) * (1 + (1 - days_until_event/60) * 0.2)
        tier_factor = (1 + (venue_tier - 1) * 0.1) * (1 + artist_tier * 0.1)
        popularity_factor = (1 + event_popularity * 0.3) * (1 + is_holiday * 0.2)
        category_factor = np.array([cat_premiums[c] for c in cat_choice])
        
        # The "Bot Penalty"
        bot_penalty = np.where(cognitive_score < 0.4, 5.0 / (cognitive_score + 0.1), 1.0)
        
        # Calculate raw price with full schema-aligned fusion
        raw_price = base_price * economic_factor * tier_factor * popularity_factor * category_factor * bot_penalty
        price = np.clip(raw_price, base_price, max_price)
        
        df = pd.DataFrame({
            'capacity': capacity,
            'tickets_sold': tickets_sold,
            'base_price': base_price,
            'max_price': max_price,
            'days_until_event': days_until_event,
            'event_popularity': event_popularity,
            'venue_tier': venue_tier,
            'artist_tier': artist_tier,
            'cognitive_score': cognitive_score,
            'is_holiday': is_holiday,
            'price': price
        })

        # One-hot encoding
        for cat in categories:
            df[f'cat_{cat}'] = (cat_choice == cat).astype(int)
        
        return df

    def train(self):
        df = self.generate_unified_data()
        X = df.drop('price', axis=1)
        y = df['price']

        # Scale and Train
        from sklearn.preprocessing import StandardScaler
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.build_model()
        print("Training Unified Neural Engine...")
        self.model.fit(X_scaled, y, epochs=20, batch_size=32, validation_split=0.2, verbose=0)
        
        # Calculate final metrics for the info file
        from sklearn.metrics import mean_absolute_error, r2_score
        y_pred = self.model.predict(X_scaled)
        mae = mean_absolute_error(y, y_pred)
        r2 = r2_score(y, y_pred)
        
        # Save artifacts in the same directory as this script
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, 'unified_model.h5')
        scaler_path = os.path.join(base_dir, 'unified_scaler.pkl')
        info_path = os.path.join(base_dir, 'model_info.json')
        
        self.model.save(model_path)
        joblib.dump(self.scaler, scaler_path)
        
        model_info = {
            'model_type': 'MCENN (Neural Network)',
            'trained_at': datetime.now().isoformat(),
            'metrics': {
                'mae': float(mae),
                'r2_score': float(r2)
            },
            'features': self.feature_names,
            'num_samples': len(df)
        }
        
        with open(info_path, 'w') as f:
            json.dump(model_info, f, indent=4)
            
        print(f"Unified Model Saved at: {model_path}")
        print(f"Unified Scaler Saved at: {scaler_path}")
        print(f"Model Info Saved at: {info_path}")
        print(f"Final Metrics - R2: {r2:.4f}, MAE: {mae:.2f}")

if __name__ == "__main__":
    upm = UnifiedPricingModel()
    upm.train()
