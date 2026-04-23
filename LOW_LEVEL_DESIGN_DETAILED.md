# 📐 Low-Level Design: DECPG & MCENN Specification

This document provides a technical deep-dive into the mathematical and architectural components of the **Decentralized Edge-Cognitive Pricing Governance** system.

---

## 1. Edge-AI: Residual Temporal Engine
The system utilizes a 1D-CNN (Convolutional Neural Network) architecture optimized for temporal signal analysis of human-computer interaction (HCI).

### Architecture
- **Input Tensor**: `[50, 3]` (representing 50 samples of `[dx, dy, dt]`).
- **Residual Block**: 
    - `Layer_A`: Conv1D (Kernel=3, Filters=16, Padding='same')
    - `Layer_B`: Conv1D (Kernel=5, Filters=16, Padding='same')
    - `Fusion`: $Output = ReLU(Layer\_A + Layer\_B)$
- **Inference Cycle**: 2000ms.
- **Goal**: Identification of non-linear jitter and velocity curvature characteristic of mammalian muscle movement.

## 2. Federated Aggregation & Neural Auditing
The platform implements a "Privacy-Preserving Federated Update" protocol.

### Weight Export
Local weights $W_{local}$ are extracted via `tf.Model.getWeights()`. The data is serialized into a JSON-compatible format containing:
- `Layer Name`
- `Shape`
- `Flattened Data Array`

### Neural Audit Logic (Centralized)
Incoming weights are passed through a **Statistical Gate**:
1. **Magnitude Audit**: $Avg(|W_{node}|) < \tau$ (where $\tau = 5.0$). Prevents exploding gradient attacks.
2. **Finiteness Audit**: Rejection of any update containing $NaN$ or $Inf$.
3. **Z-Score Audit**: Rejection of updates that deviate by $> 3\sigma$ from the historical federated mean.

## 3. MCENN: Neural Pricing Fusion
The pricing engine replaces traditional heuristics with a Deep Learning Multi-Layer Perceptron (MLP).

### Input Feature Vector $F$
$F = [C, S, B, D, P, T_v, T_a, \alpha]$
- $C$: Venue Capacity
- $S$: Tickets Sold
- $B$: Base Price
- $D$: Days until Event
- $P$: Event Popularity (0-1)
- $T_v, T_a$: Venue/Artist Tiering
- $\alpha$: **Cognitive Confidence Score** (The behavioral entropy weight)

### The Bot Penalty Function (Baked-in)
During training, the "Bot Fine" is enforced via a non-linear penalty function:
$Price = EconomicValue * \Phi(\alpha)$
Where $\Phi(\alpha) = 1$ if $\alpha > 0.8$, and $\Phi(\alpha)$ increases exponentially as $\alpha \to 0$.

---

## 4. Cryptographic Temporal Auth (VDF)
To prevent "Flash Bot" attacks, a Verifiable Delay Function (VDF) inspired "Temporal Puzzle" is enforced.
- **Logic**: $h = SHA256(Entropy + Timestamp)$ iterated $N$ times.
- **Properties**: Sequential, non-parallelizable, verifiable in $O(1)$.

## 5. Federated Brain Aggregator (Service)
Implemented in the `organizer-service`, the aggregator acts as the central coordinator for the decentralized nodes.
- **Endpoint**: `/api/security/federated-sync`
- **Responsibility**: Validation, Auditing, and Global Model Synthesis.
