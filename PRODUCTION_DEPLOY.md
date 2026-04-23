# 🚀 Production Deployment Guide: DECPG Architecture

## Infrastructure Requirements
- **ML Node**: CPU-optimized (4+ Cores) for high-frequency Neural Inference.
- **Aggregator Node**: High I/O for processing federated weight syncs.
- **Edge Assets**: CDN distribution for the TensorFlow.js models.

## Deployment Checklist
1.  **Build Model Artifacts**: Run `unified_model.py` and upload `.h5`/`.pkl` to the ML server.
2.  **Verify Inter-Service Comms**: Ensure the Organizer Service can reach the ML Service at the configured `ML_SERVICE_URL`.
3.  **Audit Baseline**: Initialize the `GradientAuditor` with known honest data to prevent day-zero poisoning.
4.  **SSL/TLS**: Mandatory for Federated Sync (Secure Context required for `crypto.subtle`).

## Monitoring
- Track **Cognitive Pulse** in the Admin Dashboard.
- Monitor **Z-Score rejection rates** in the Organizer Service logs to detect organized bot-swarm attacks.
- Alert on any **MCENN Runtime Errors** in the ML container.
