import logging
from logging.config import dictConfig
import os
import joblib
import numpy as np
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# 1. Expert Logging
dictConfig({
    'version': 1,
    'formatters': {'default': {'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'stream': 'ext://sys.stdout', 'formatter': 'default'}},
    'root': {'level': 'INFO', 'handlers': ['console']}
})
logger = logging.getLogger(__name__)

# 2. Global Setup
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def create_app():
    app = Flask(__name__)
    CORS(app)

    # Load Unified Neural Engine
    try:
        from tensorflow import keras
        # Use compile=False to avoid issues with custom metrics during loading
        app.ml_model = keras.models.load_model(os.path.join(BASE_DIR, 'unified_model.h5'), compile=False)
        app.ml_scaler = joblib.load(os.path.join(BASE_DIR, 'unified_scaler.pkl'))
        logger.info("Unified Neural Engine (MCENN) loaded successfully (Inference Only)!")
    except Exception as e:
        logger.error(f"Critical error loading Unified model: {e}")
        app.ml_model = None

    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'healthy', 'model_loaded': app.ml_model is not None}), 200

    @app.route('/predict', methods=['POST'])
    def predict_price():
        if not app.ml_model:
            return jsonify({'error': 'Unified Prediction engine offline'}), 503
            
        data = request.get_json() or {}
        cognitive_score = float(data.get('cognitive_score', 1.0))
        base_price = float(data.get('base_price', 500))
        max_price = float(data.get('max_price', base_price * 3))
        is_holiday = float(data.get('is_holiday', 0))
        category = data.get('category', 'other')
        
        # One-hot encoding for categories
        categories = ['concert', 'sports', 'theater', 'conference', 'festival', 'other']
        cat_features = [1.0 if category == c else 0.0 for c in categories]
        
        features = [
            float(data.get('capacity', 1000)),
            float(data.get('tickets_sold', 0)),
            base_price,
            max_price,
            float(data.get('days_until_event', 30)),
            float(data.get('event_popularity', 0.5)),
            float(data.get('venue_tier', 2)),
            float(data.get('artist_tier', 3)),
            cognitive_score,
            is_holiday
        ] + cat_features

        try:
            scaled = app.ml_scaler.transform([features])
            prediction = app.ml_model.predict(scaled)[0][0]
            
            # Apply strict safety clamps: [Floor, Ceiling]
            final_price = max(base_price, min(prediction, max_price))
            
            logger.info(f"Inference: Market={prediction}, Final={final_price}, Cognitive={cognitive_score}")
            
            return jsonify({
                'predicted_price': float(round(final_price, 2)),
                'raw_prediction': float(round(prediction, 2)),
                'currency': 'INR',
                'cognitive_confidence': cognitive_score,
                'timestamp': datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"MCENN Runtime Error: {str(e)}")
            return jsonify({'error': 'Neural Inference Error', 'message': str(e)}), 500

    @app.route('/admin/apply-update', methods=['POST'])
    def apply_federated_update():
        """
        Receives aggregated model weights and updates the live unified model.
        Persists the updated model to disk as a new version.
        """
        if not app.ml_model:
            return jsonify({'error': 'Model not loaded'}), 503

        try:
            data = request.get_json()
            weights_list = data.get('weights')
            version = data.get('version', 'unknown')

            if not weights_list:
                return jsonify({'error': 'No weights provided'}), 400

            # Map the incoming weight data to the model's layers
            # The weights_list is expected to be a list of {name, shape, data}
            for layer in app.ml_model.layers:
                layer_weights = []
                # Find matching weights in the list
                # (Simplified implementation - in production this would be more robust)
                for w in weights_list:
                    if w['name'].startswith(layer.name):
                        layer_weights.append(np.array(w['data']).reshape(w['shape']))
                
                if layer_weights:
                    layer.set_weights(layer_weights)

            # Save the updated model
            app.ml_model.save(os.path.join(BASE_DIR, 'unified_model.h5'))
            logger.info(f"Federated update applied: Version {version}")
            
            return jsonify({'status': 'success', 'version': version}), 200
        except Exception as e:
            logger.error(f"Federated Update Error: {str(e)}")
            return jsonify({'error': 'Update failed', 'message': str(e)}), 500

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=False)
