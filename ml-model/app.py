from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os
import json
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv


# Load environment variables from root .env
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load the trained model and scaler

# Use path relative to this script for reliability
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'model.pkl')
SCALER_PATH = os.path.join(BASE_DIR, 'scaler.pkl')
MODEL_INFO_PATH = os.path.join(BASE_DIR, 'model_info.json')

# Load model version info
model_version = 'v1.0'  # Default version
try:
    if os.path.exists(MODEL_INFO_PATH):
        with open(MODEL_INFO_PATH, 'r') as f:
            model_info = json.load(f)
            model_version = model_info.get('modelVersion', 'v1.0')
except Exception as e:
    print(f"Could not load model info: {e}")

try:
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    print(f"Model {model_version} and scaler loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None
    scaler = None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'model_version': model_version,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict_price():
    """Predict ticket price based on strict DB features"""
    try:
        if model is None or scaler is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No input data provided'}), 400
        
        # Extract features (Strict DB Alignment)
        try:
            capacity = float(data.get('capacity', 1000))
            tickets_sold = float(data.get('tickets_sold', 0))
            base_price = float(data.get('base_price', 500))
            days_until = float(data.get('days_until_event', 30))
            duration = float(data.get('event_duration', 1))
            popularity = float(data.get('event_popularity', 0.5))
            venue_tier = int(data.get('venue_tier', 2))
            artist_tier = int(data.get('artist_tier', 3))
            is_holiday = int(data.get('is_holiday', 0))
            category = data.get('category', 'other').lower()
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid numeric input'}), 400
        
        # Build 15-feature vector (9 numeric + 6 categorical)
        features = [
            capacity, tickets_sold, base_price, days_until, duration,
            popularity, venue_tier, artist_tier, is_holiday
        ]
        
        # One-hot encoding for category
        categories = ['concert', 'sports', 'theater', 'conference', 'festival', 'other']
        for cat in categories:
            features.append(1 if category == cat else 0)
        
        # Build feature DataFrame with names to avoid warnings and ensure alignment
        cols = [
            'capacity', 'tickets_sold', 'base_price', 'days_until_event', 'event_duration',
            'event_popularity', 'venue_tier', 'artist_tier', 'is_holiday'
        ]
        # Append one-hot categories in SAME ORDER as training
        for cat in categories:
            cols.append(f'cat_{cat}')
            
        df_features = pd.DataFrame([features], columns=cols)
        
        # Scale and predict
        features_scaled = scaler.transform(df_features)
        pred = model.predict(features_scaled)[0]
        
        # ── Refined Bounds & Surge Protection ────────────────────────────────
        # Minimum: 80% of base
        # Maximum: 2.5x of base (Production safety cap)
        final_price = max(base_price * 0.8, min(pred, base_price * 2.5))
        
        # ── Shadow Model Simulation ──────────────────────────────────────────
        # In a real environment, this would call a different experimental model.
        # We simulate a "Challenger" model that tests a 15% more aggressive surge.
        shadow_price = final_price * 1.15
        
        return jsonify({
            'predicted_price': float(round(final_price, 2)),
            'shadow_price': float(round(shadow_price, 2)),
            'currency': 'INR',
            'model_version': model_version,
            'features_used': {
                'capacity': capacity,
                'tickets_sold': tickets_sold,
                'base_price': base_price,
                'days_until': days_until,
                'category': category
            },
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """Predict prices for multiple event scenarios"""
    try:
        data = request.get_json()
        scenarios = data.get('scenarios', [])
        
        if len(scenarios) > 100:
            return jsonify({'error': 'Maximum 100 scenarios allowed'}), 400
        
        predictions = []
        
        for scenario in scenarios:
            capacity = float(data.get('capacity', 1000))
            tickets_sold = float(data.get('tickets_sold', 0))
            base_price = float(data.get('base_price', 500))
            days_until = float(data.get('days_until_event', 30))
            duration = float(data.get('event_duration', 1))
            popularity = float(data.get('event_popularity', 0.5))
            venue_tier = int(data.get('venue_tier', 2))
            artist_tier = int(data.get('artist_tier', 3))
            is_holiday = int(data.get('is_holiday', 0))
            category = data.get('category', 'other').lower()
            
            # Numeric features
            features = [
                capacity, tickets_sold, base_price, days_until, duration,
                popularity, venue_tier, artist_tier, is_holiday
            ]
            
            # One-hot encoding for category
            categories = ['concert', 'sports', 'theater', 'conference', 'festival', 'other']
            for cat in categories:
                features.append(1 if category == cat else 0)
            
            features_scaled = scaler.transform([features])
            predicted_price = max(base_price * 0.7, min(model.predict(features_scaled)[0], base_price * 10))
            
            return jsonify({
                'predicted_price': float(round(predicted_price, 2)),
                'currency': 'INR',
                'model_version': model_version,
                'features_used': {k: v for k, v in {
                    'capacity': capacity,
                    'tickets_sold': tickets_sold,
                    'base_price': base_price,
                    'days_until': days_until,
                    'category': category
                }.items()},
                'timestamp': datetime.now().isoformat()
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/model-info', methods=['GET'])
def model_info():
    """Get information about the enhanced model v2.1 with event duration"""
    info = {
        'model_type': 'VotingRegressor Ensemble (RF + GradientBoosting + ExtraTrees + Ridge + XGBoost)',
        'version': model_version,
        'features': [
            'capacity', 'tickets_sold', 'base_price', 'days_until_event', 'event_duration', 
            'event_popularity', 'venue_tier', 'artist_tier', 'is_holiday',
            'cat_concert', 'cat_sports', 'cat_theater', 'cat_conference', 'cat_festival', 'cat_other'
        ],
        'feature_descriptions': {
            'capacity': 'Venue capacity (total seats)',
            'tickets_sold': 'Number of tickets already sold',
            'base_price': 'The original/starting price per ticket',
            'days_until_event': 'Days remaining until event',
            'event_duration': 'Total duration of event in days',
            'event_popularity': 'Event popularity score (0-1)',
            'venue_tier': 'Venue tier (1=Small, 2=Medium, 3=Large)',
            'artist_tier': 'Artist/Event tier (1-5, 5=Superstar)',
            'is_holiday': 'Holiday indicator (0/1)',
            'category': 'Event category (concert, sports, etc.)'
        },
        'currency': 'INR',
        'price_range': {'min': 50, 'max': 50000},
        'model_loaded': model is not None
    }
    
    # Add model_info.json data if available
    try:
        if os.path.exists(MODEL_INFO_PATH):
            with open(MODEL_INFO_PATH, 'r') as f:
                saved_info = json.load(f)
                info['train_score'] = float(saved_info.get('trainScore')) if saved_info.get('trainScore') is not None else None
                info['test_score'] = float(saved_info.get('testScore')) if saved_info.get('testScore') is not None else None
                info['feature_importance'] = saved_info.get('featureImportance')
                info['trained_at'] = saved_info.get('metadata', {}).get('trainedAt')
    except:
        pass
    
    return jsonify(info)




if __name__ == '__main__':
    # Use ML_PORT for Flask, fall back to 5000 (PORT is reserved for Express backend)
    port = int(os.environ.get('ML_PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
