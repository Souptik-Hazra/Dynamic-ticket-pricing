import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np
import pandas as pd
import joblib
import json
import os

# Unified Cognitive-Economic Neural Network (MCENN)
# 
# This model replaces the traditional XGBoost with a Deep Learning architecture
# that fuses Market Economics with Behavioral Cognitive scores.

class UnifiedPricingModel:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = [
            'capacity', 'tickets_sold', 'base_price', 'days_until_event', 
            'event_popularity', 'venue_tier', 'artist_tier', 'cognitive_score'
        ]

    def build_model(self):
        # Multi-Input Style Architecture
        model = keras.Sequential([
            layers.Input(shape=(len(self.feature_names),)),
            layers.Dense(64, activation='relu'),
            layers.Dropout(0.2),
            layers.Dense(32, activation='relu'),
            layers.Dense(16, activation='relu'),
            layers.Dense(1, activation='linear') # Output: Final Fair Price
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
        days_until_event = np.random.randint(0, 60, n_samples)
        
        # Cognitive Data (The Secret Sauce)
        # Humans have high cognitive scores (0.7-1.0), Bots have low (0.0-0.3)
        cognitive_score = np.random.uniform(0, 1, n_samples)
        
        # The Unified Pricing Logic
        # Price increases with occupancy but spikes exponentially as cognitive score drops (Bot Fine)
        occupancy = tickets_sold / capacity
        economic_factor = (1 + occupancy * 0.5) * (1 + (1 - days_until_event/60) * 0.3)
        
        # The "Bot Penalty" is baked into the training data logic
        bot_penalty = np.where(cognitive_score < 0.4, 5.0 / (cognitive_score + 0.1), 1.0)
        
        price = base_price * economic_factor * bot_penalty
        
        return pd.DataFrame({
            'capacity': capacity,
            'tickets_sold': tickets_sold,
            'base_price': base_price,
            'days_until_event': days_until_event,
            'event_popularity': np.random.random(n_samples),
            'venue_tier': np.random.randint(1, 4, n_samples),
            'artist_tier': np.random.randint(1, 6, n_samples),
            'cognitive_score': cognitive_score,
            'price': price
        })

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
        
        # Save artifacts
        self.model.save('unified_model.h5')
        joblib.dump(self.scaler, 'unified_scaler.pkl')
        print("Unified Model Saved as 'unified_model.h5'")

if __name__ == "__main__":
    upm = UnifiedPricingModel()
    upm.train()
