# FedAvg Federated Pipeline — Implementation Plan

## Goal
Implement a practical, auditable, privacy-preserving FedAvg pipeline for the DECPG system: client deltas, server aggregation with reputation weighting, clipping, optional DP placeholder, model versioning, validation, and deployment hooks. Produce tests and artifacts suitable for technical evidence in patent drafting.

## High-level Components
- Federated Aggregator service (`microservices/federated-aggregator` or add to `organizer-service`)
- Client changes in `src/hooks/useBehavioralSentinel.js`
- Model artifact/version storage and fetch endpoints (model manifest)
- ML service (`ml-model`) admin endpoint to accept validated aggregated updates
- Logging/audit model: `FLRoundLog` + reuse `PriceLog` for linkage

## Client-side (Edge) Changes
- Fetch current `model_version` and metadata before sync.
- Compute `delta = local_weights - global_weights` (same shapes).
- L2 clip delta to `CLIP_NORM` (configurable). Normalize if needed.
- Compress/quantize delta (optional) — add `sparsify/top-k` later.
- Attach metadata: `nodeId`, `model_version`, `reputation`, `delta_norm`, `signature` (JWT).
- POST to `/api/federated/submit` (or `/api/security/federated-sync` if reused).
- Add fallbacks: if model mismatch (version), auto-fetch latest and recompute or abort.

## Server-side Aggregator
- Endpoints:
  - `GET /api/federated/model/version` → returns manifest {version, sha256, shapes}
  - `POST /api/federated/submit` → accept client submission for current round
  - `POST /api/federated/aggregate` → admin-triggered to perform aggregation for the round
  - `GET /api/federated/round/:id` → round report
- Aggregation algorithm (per round):
  1. Validate submissions (shapes, numeric sanity, version match).
  2. Clip each delta to `CLIP_NORM` (L2) and compute per-client weight = reputation_score (>=0).
  3. Aggregate: aggregated_delta = sum(w_i * delta_i) / sum(w_i).
  4. Optionally apply robust aggregator (coordinate-wise median or trimmed mean) if anomaly detected.
  5. Optionally add DP Gaussian noise scaled to `CLIP_NORM` and `DP_EPSILON` placeholder.
  6. Compute new_weights = global_weights + aggregated_delta.
  7. Validate new model on server-held validation set (smoke inference metrics), store metrics.
  8. If validation passes, increment `model_version` and push snapshot to `ml-model` via admin endpoint.
  9. Persist `FLRoundLog` with participants, weights, anomalies, metrics, and published version.

## Security & Privacy
- Default: do server-side aggregation only — do NOT persist individual client raw weights.
- Add placeholder hooks for Secure Aggregation (Bonawitz et al.) to be integrated later.
- Differential Privacy placeholder: add Gaussian noise step before publishing new model; document parameters for attorney review.
- Use JWT authentication and optional message signing for submissions.

## Model Versioning & Artifacts
- Model manifest file: `model_manifest.json` with {version, sha256, shapes, timestamp, validation_score}
- Artifacts stored under `ml-model/artifacts/v{version}/` (model.h5, scaler.pkl, manifest.json)
- Clients cache manifest and model metadata only; do not download full global weights unless necessary for delta computation (opt: supply compressed global snapshot endpoint).

## Testing
- Unit tests for delta clipper, aggregator (small synthetic clients). Add tests under `tests/federated/*`.
- Integration: simulate 5 clients producing deltas, run aggregator, validate model version bump and `FLRoundLog` entries.
- CI: create `npm run test:fed-sim` that runs lightweight Node/Python harness.

## Deployment Considerations
- Run aggregator as a separate service or as an isolated module in `organizer-service` with its own DB collections.
- Resource: aggregation can be CPU-bound; schedule off-peak or make it event-driven.

## Files to Create / Modify (implementation checklist)
- Add: `microservices/federated-aggregator/index.js` (primary service) or extend `microservices/organizer-service/index.js`
- Modify: `src/hooks/useBehavioralSentinel.js` → `syncFederatedWeights()` to send deltas + metadata
- Add: `microservices/shared/models/FLRoundLog.js`
- Add tests: `tests/federated/aggregation_unit_test.js`, `tests/federated/integration_round_test.js`
- Add endpoint in `ml-model/app.py`: `POST /admin/apply-update` (protected) to accept validated aggregated delta and save new artifact
- Add `docs/FEDAVG_Federated_Pipeline_Plan.md` (this file)

## Patent Checklist (to support filing)
- Record exact data transformations and formats for: spectral-density proof, nonce binding, VDF puzzle parameters, delta clipping formula, reputation formula (exact weighting), validation metric and threshold.
- Keep artifacted evidence: test logs, round reports, validation metrics, and sample anonymized client deltas (for disclosure if needed).
- Prepare claim drafts describing the ordered combination (edge-proof → nonce+VDF → server gate → reputation-weighted FedAvg with clipping & audit) and multiple dependent claims narrowing to specific numeric ranges and algorithms.

## Timeline (suggested)
- Week 1: Add aggregator skeleton, model manifest, client delta producer changes, unit tests.
- Week 2: Implement aggregation logic, clipping, reputation weighting, DP placeholder, and round logging. Create integration tests.
- Week 3: Add ML service admin endpoint, validation harness, and end-to-end test. Collect artifacts for patent draft.

## Acceptance Criteria
- Clients produce deltas and successfully submit (unit tests pass).
- Aggregator produces an updated model snapshot and increments `model_version` when validation passes.
- `FLRoundLog` saved with participant list and metrics.
- Integration test `tests/federated/integration_round_test.js` passes locally.

## Next Steps
1. Confirm whether to implement aggregator inside `organizer-service` or as a new microservice.
2. I will scaffold the aggregator and the test harness if you confirm — then iterate on robust aggregation (Krum / trimmed mean) and DP integration.

---
Generated on: 2026-04-23
