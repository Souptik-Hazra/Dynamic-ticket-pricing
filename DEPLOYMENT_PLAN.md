# 🚢 Deployment Plan: Federated AI Grid

This project requires a multi-stage deployment to synchronize the ML inference and Federated Aggregation layers.

## 1. Environment Configuration
Ensure the following variables are set in your `.env`:
- `ML_SERVICE_URL`: URL of the Python Neural Engine (default: `http://localhost:5000`).
- `ML_PORT`: Port for the ML API.
- `ALLOWED_ORIGINS`: Domains allowed to sync federated weights.

## 2. ML Engine Initialization
Before launching the services, the **Unified Neural Engine** must be trained:
```bash
cd ml-model
python unified_model.py  # Generates unified_model.h5 and unified_scaler.pkl
```

## 3. Microservices Orchestration
The services should be started in this order:
1.  **Shared Database (MongoDB/Redis)**
2.  **ML Service (Python/Flask)**: Must be up for price calculations.
3.  **Organizer Service**: Acts as the Federated Aggregator.
4.  **Auth & Analytics Services**
5.  **Frontend (Vite)**: Deploys the Edge-AI Sentinel.

## 4. Federated Node Warm-up
Upon initial deployment, the Federated Global Model is in "Cold Start" mode. 
- The system will rely on pre-trained "Human DNA" weights until the first 1,000 Edge-Nodes complete their first **Cognitive Sync**.
- The **Gradient Auditor** should be monitored during this phase to ensure the Z-Score baseline calibrates correctly.

## 5. Security Hardening
- Enable **VDF Temporal Proofs** on all high-demand ticket categories.
- Ensure the `organizer-service` has sufficient CPU for weight auditing under high-concurrency sync events.

## 6. Docker Deployment (Containerized AI)
For production environments, it is recommended to run the ML Service in a container to isolate the TensorFlow environment.

### Build the Image
```bash
cd ml-model
docker build -t mcenn-neural-engine .
```

### Run the Container
```bash
docker run -d \
  -p 5000:5000 \
  --name mcenn-inference \
  -e ML_PORT=5000 \
  mcenn-neural-engine
```

**Note**: If you have a GPU, use `tensorflow/tensorflow:2.15.0-gpu` and the `--gpus all` flag for 10x faster inference.
