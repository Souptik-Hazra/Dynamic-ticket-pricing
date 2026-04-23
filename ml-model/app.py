import logging
from logging.config import dictConfig
import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
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
        import tensorflow as tf
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
        
        features = [
            float(data.get('capacity', 1000)),
            float(data.get('tickets_sold', 0)),
            float(data.get('base_price', 500)),
            float(data.get('days_until_event', 30)),
            float(data.get('event_popularity', 0.5)),
            float(data.get('venue_tier', 2)),
            float(data.get('artist_tier', 3)),
            cognitive_score
        ]

        try:
            scaled = app.ml_scaler.transform([features])
            prediction = app.ml_model.predict(scaled)[0][0]
            logger.info(f"Inference: Market={prediction}, Cognitive={cognitive_score}")
            
            return jsonify({
                'predicted_price': float(round(prediction, 2)),
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
            new_weights = []
            model_weights = app.ml_model.get_weights()
            
            # Simple mapping: assume the weights_list matches the order and shape of get_weights()
            # In production, we would use layer names for robust mapping.
            for i, w_data in enumerate(weights_list):
                if i < len(model_weights):
                    arr = np.array(w_data['data']).reshape(model_weights[i].shape)
                    new_weights.append(arr)
                else:
                    logger.warning(f"Extra weights provided at index {i}")

            if len(new_weights) != len(model_weights):
                return jsonify({'error': 'Weight count mismatch', 'expected': len(model_weights), 'received': len(new_weights)}), 400

            # Apply to live model
            app.ml_model.set_weights(new_weights)
            
            # Persist to disk
            save_path = os.path.join(BASE_DIR, f'unified_model_{version}.h5')
            app.ml_model.save(save_path)
            # Also update the primary model file
            app.ml_model.save(os.path.join(BASE_DIR, 'unified_model.h5'))

            logger.info(f"✅ Federated update applied successfully: Version {version}")
            return jsonify({
                'success': True,
                'version': version,
                'message': f"Model updated and saved to unified_model_{version}.h5"
            })

        except Exception as e:
            logger.error(f"Failed to apply federated update: {e}")
            return jsonify({'error': 'Update application failed', 'message': str(e)}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('ML_PORT', 5000))
    app.run(host='0.0.0.0', port=port, threaded=True)
