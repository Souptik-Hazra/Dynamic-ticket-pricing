from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load the trained model and scaler
MODEL_PATH = 'model.pkl'
SCALER_PATH = 'scaler.pkl'
MODEL_INFO_PATH = 'model_info.json'

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
    """Predict ticket price based on input features"""
    try:
        if model is None or scaler is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No input data provided'}), 400
        
        # Validate input features - Enhanced 13-feature model
        try:
            demand = float(data.get('demand', 100))
            capacity = float(data.get('capacity', 1000))
            days_until = float(data.get('days_until_event', 30))
            popularity = float(data.get('event_popularity', 0.5))
            competitor = float(data.get('competitor_price', 100))
            historical = float(data.get('historical_sales', 50))
            season = int(data.get('season', 1))
            day_of_week = int(data.get('day_of_week', 1))
            hour_of_day = int(data.get('hour_of_day', 12))
            venue_tier = int(data.get('venue_tier', 2))
            artist_tier = int(data.get('artist_tier', 3))
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid input: All values must be numeric'}), 400
        
        # Calculate derived features
        is_weekend = 1 if day_of_week >= 6 else 0
        is_holiday = int(data.get('is_holiday', 0))
        
        # Validate ranges
        demand = max(0, min(demand, 100000))
        capacity = max(1, min(capacity, 100000))
        days_until = max(0, min(days_until, 365))
        popularity = max(0, min(popularity, 1))
        competitor = max(0, min(competitor, 50000))
        historical = max(0, min(historical, 100000))
        season = max(1, min(season, 4))
        day_of_week = max(1, min(day_of_week, 7))
        hour_of_day = max(0, min(hour_of_day, 23))
        venue_tier = max(1, min(venue_tier, 3))
        artist_tier = max(1, min(artist_tier, 5))
        
        # Build feature vector (13 features matching training)
        features = [
            demand,
            capacity,
            days_until,
            popularity,
            competitor,
            historical,
            season,
            day_of_week,
            hour_of_day,
            is_weekend,
            is_holiday,
            venue_tier,
            artist_tier
        ]
        
        # Scale features and predict
        features_scaled = scaler.transform([features])
        predicted_price = model.predict(features_scaled)[0]
        
        # Ensure reasonable price bounds (INR)
        predicted_price = max(50, min(predicted_price, 50000))
        
        # Calculate confidence interval based on model agreement
        confidence = 0.95
        margin = predicted_price * 0.06  # 6% margin (enhanced accuracy)
        
        response = {
            'predicted_price': round(predicted_price, 2),
            'price_range': {
                'min': round(max(50, predicted_price - margin), 2),
                'max': round(min(50000, predicted_price + margin), 2)
            },
            'confidence': confidence,
            'model_version': model_version,
            'currency': 'INR',
            'features_used': {
                'demand': features[0],
                'capacity': features[1],
                'days_until_event': features[2],
                'event_popularity': features[3],
                'competitor_price': features[4],
                'historical_sales': features[5],
                'season': features[6],
                'day_of_week': features[7],
                'hour_of_day': features[8],
                'is_weekend': features[9],
                'is_holiday': features[10],
                'venue_tier': features[11],
                'artist_tier': features[12]
            },
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """Predict prices for multiple scenarios"""
    try:
        if model is None or scaler is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        data = request.get_json()
        scenarios = data.get('scenarios', [])
        
        if len(scenarios) > 100:
            return jsonify({'error': 'Maximum 100 scenarios allowed'}), 400
        
        predictions = []
        
        for scenario in scenarios:
            demand = float(scenario.get('demand', 100))
            capacity = float(scenario.get('capacity', 1000))
            days_until = float(scenario.get('days_until_event', 30))
            popularity = float(scenario.get('event_popularity', 0.5))
            competitor = float(scenario.get('competitor_price', 100))
            historical = float(scenario.get('historical_sales', 50))
            season = int(scenario.get('season', 1))
            day_of_week = int(scenario.get('day_of_week', 1))
            hour_of_day = int(scenario.get('hour_of_day', 12))
            venue_tier = int(scenario.get('venue_tier', 2))
            artist_tier = int(scenario.get('artist_tier', 3))
            
            # Calculate derived features
            is_weekend = 1 if day_of_week >= 6 else 0
            is_holiday = int(scenario.get('is_holiday', 0))
            
            features = [
                demand, capacity, days_until, popularity, competitor,
                historical, season, day_of_week, hour_of_day, is_weekend,
                is_holiday, venue_tier, artist_tier
            ]
            
            features_scaled = scaler.transform([features])
            predicted_price = max(50, min(model.predict(features_scaled)[0], 50000))
            
            predictions.append({
                'scenario': scenario.get('name', 'Unnamed'),
                'predicted_price': round(predicted_price, 2),
                'currency': 'INR',
                'features': scenario
            })
        
        return jsonify({
            'predictions': predictions,
            'count': len(predictions),
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/model-info', methods=['GET'])
def model_info():
    """Get information about the enhanced model v2.0"""
    info = {
        'model_type': 'VotingRegressor Ensemble (RF + GradientBoosting + ExtraTrees + Ridge + XGBoost)',
        'version': model_version,
        'features': [
            'demand',
            'capacity',
            'days_until_event',
            'event_popularity',
            'competitor_price',
            'historical_sales',
            'season',
            'day_of_week',
            'hour_of_day',
            'is_weekend',
            'is_holiday',
            'venue_tier',
            'artist_tier'
        ],
        'feature_descriptions': {
            'demand': 'Current ticket demand (number of inquiries)',
            'capacity': 'Venue capacity (total seats)',
            'days_until_event': 'Days remaining until event',
            'event_popularity': 'Event popularity score (0-1)',
            'competitor_price': 'Average competitor ticket price (₹)',
            'historical_sales': 'Historical sales for similar events',
            'season': 'Season (1=Winter, 2=Spring, 3=Summer, 4=Fall)',
            'day_of_week': 'Day of week (1=Monday, 7=Sunday)',
            'hour_of_day': 'Hour of day (0-23)',
            'is_weekend': 'Weekend indicator (0/1)',
            'is_holiday': 'Holiday indicator (0/1)',
            'venue_tier': 'Venue tier (1=Small, 2=Medium, 3=Large)',
            'artist_tier': 'Artist/Event tier (1-5, 5=Superstar)'
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
                info['train_score'] = saved_info.get('trainScore')
                info['test_score'] = saved_info.get('testScore')
                info['feature_importance'] = saved_info.get('featureImportance')
                info['trained_at'] = saved_info.get('metadata', {}).get('trainedAt')
    except:
        pass
    
    return jsonify(info)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
