import os
import json
from typing import List
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib

app = FastAPI(title="Dynamic Ticket Pricing ML API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")
MODEL_INFO_PATH = os.path.join(BASE_DIR, "model_info.json")

model_version = "v2.0.20260302"
model_type = "XGBoostRegressor"
model = None
scaler = None

try:
    if os.path.exists(MODEL_INFO_PATH):
        with open(MODEL_INFO_PATH, "r") as f:
            info = json.load(f)
            model_version = info.get("modelVersion", model_version)
            model_type = info.get("modelType", model_type)
except Exception as e:
    print(f"Model info warning: {e}")

try:
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    print(f"Model {model_version} and scaler loaded successfully!")
except Exception as e:
    print(f"Model load warning: {e}")


class PredictRequest(BaseModel):
    demand: float = 100.0
    capacity: float = 1000.0
    days_until_event: float = 30.0
    event_duration_days: float = 1.0
    event_popularity: float = 0.5
    competitor_price: float = 100.0
    historical_sales: float = 50.0
    season: int = 1
    day_of_week: int = 1
    hour_of_day: int = 12
    is_holiday: int = 0
    venue_tier: int = 2
    artist_tier: int = 3


class BatchPredictRequest(BaseModel):
    scenarios: List[PredictRequest]


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_version": model_version,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/predict")
def predict(req: PredictRequest):
    is_weekend = 1 if req.day_of_week >= 6 else 0
    features = [
        req.demand,
        req.capacity,
        req.days_until_event,
        req.event_duration_days,
        req.event_popularity,
        req.competitor_price,
        req.historical_sales,
        req.season,
        req.day_of_week,
        req.hour_of_day,
        is_weekend,
        req.is_holiday,
        req.venue_tier,
        req.artist_tier,
    ]

    if model and scaler:
        scaled = scaler.transform([features])
        pred = float(model.predict(scaled)[0])
    else:
        occ = (req.capacity - req.demand) / max(1.0, req.capacity)
        pred = max(
            50.0,
            req.competitor_price
            * (1.0 + req.event_popularity * 0.3 + (1.0 - occ) * 0.2),
        )

    pred = round(max(40.0, min(50000.0, pred)), 2)
    margin = round(pred * 0.06, 2)

    return {
        "predicted_price": pred,
        "price_range": {
            "min": round(max(40.0, pred - margin), 2),
            "max": round(pred + margin, 2),
        },
        "confidence": 0.95,
        "model_version": model_version,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/batch-predict")
def batch_predict(batch: BatchPredictRequest):
    results = [predict(scenario) for scenario in batch.scenarios]
    return {
        "predictions": results,
        "count": len(results),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/model-info")
def model_info():
    return {
        "model_type": model_type,
        "version": model_version,
        "features": [
            "demand",
            "capacity",
            "days_until_event",
            "event_duration_days",
            "event_popularity",
            "competitor_price",
            "historical_sales",
            "season",
            "day_of_week",
            "hour_of_day",
            "is_weekend",
            "is_holiday",
            "venue_tier",
            "artist_tier",
        ],
        "status": "active",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000)
