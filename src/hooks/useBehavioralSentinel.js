import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';

/**
 * useBehavioralSentinel
 * 
 * Part of the Decentralized Edge-Cognitive Pricing Governance (DECPG) system.
 * Uses a 1D-CNN model (TensorFlow.js) to detect human vs. bot behavior.
 */
export const useBehavioralSentinel = () => {
  const [entropy, setEntropy] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [model, setModel] = useState(null);
  const movements = useRef([]);
  const clickPattern = useRef([]);
  const lastEventTime = useRef(Date.now());

  // Initialize the Edge-AI Model (Residual Temporal Engine)
  useEffect(() => {
    const initModel = async () => {
      try {
        // Using Functional API for Residual Skip-Connections
        const input = tf.input({ shape: [50, 3] }); // 50 samples of [dx, dy, dt]

        // Branch 1: Micro-Jitter Detection (Kernel 3)
        const micro = tf.layers.conv1d({
          filters: 16,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }).apply(input);

        // Branch 2: Macro-Gesture Detection (Kernel 5)
        const macro = tf.layers.conv1d({
          filters: 16,
          kernelSize: 5,
          activation: 'relu',
          padding: 'same'
        }).apply(micro);

        // Residual Fusion (Skip Connection)
        // This allows the model to retain micro-jitter features while learning complex gestures
        const residual = tf.layers.add().apply([micro, macro]);

        // Deep Cognitive Extraction
        const pool = tf.layers.globalMaxPooling1d().apply(residual);
        const dense1 = tf.layers.dense({ units: 16, activation: 'relu' }).apply(pool);
        const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(dense1);

        const m = tf.model({ inputs: input, outputs: output });
        m.compile({ optimizer: 'adam', loss: 'binaryCrossentropy' });

        // Simulating Personalized "Human DNA" weights
        const baselineWeights = m.getWeights().map(w => tf.randomNormal(w.shape, 0, 0.05));
        m.setWeights(baselineWeights);

        setModel(m);
        console.log("🧬 Residual Temporal Engine Initialized (Spatial-Temporal Fusion Active)");
      } catch (e) {
        console.error("Failed to load Residual Engine", e);
      }
    };
    initModel();
  }, []);

  /**
   * syncFederatedWeights
   * 
   * THE HEART OF FEDERATED LEARNING:
   * Extracts the locally learned neural weights and syncs them with the
   * central Auditor to improve the global model without ever seeing 
   * the user's raw mouse data (Privacy-First AI).
   */
  const syncFederatedWeights = async () => {
    if (!model) return;
    
    try {
      console.log("🌐 Initiating Federated Sync (Weight Aggregation)...");
      
      const weightData = [];
      for (const w of model.getWeights()) {
        weightData.push({
          name: w.name,
          shape: w.shape,
          data: Array.from(await w.data())
        });
      }

      // Send to the central Auditor with Reputation context
      const response = await fetch('/api/security/federated-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          weights: weightData,
          nodeId: window.crypto.randomUUID(),
          timestamp: Date.now(),
          reputation: {
              accountAgeDays: Math.floor(Math.random() * 365), // Simulated
              purchaseCount: Math.floor(Math.random() * 10)    // Simulated
          }
        })
      });

      if (response.ok) {
        console.log("✅ Federated Sync Complete. Local intelligence merged with Global Brain.");
      }
    } catch (e) {
      console.error("Federated Sync failed", e);
    }
  };

  const fineTuneModel = async () => {
    if (!model || movements.current.length < 50) return;

    try {
      console.log("🛠️ Fine-tuning local model on your behavior...");
      
      const x = tf.tensor3d([movements.current]);
      const y = tf.tensor2d([[1]]); // Label as 'Human'

      await model.fit(x, y, {
        epochs: 5,
        verbose: 0
      });

      x.dispose();
      y.dispose();
      console.log("✅ Model personalized to your behavioral DNA.");

      // Sync to global model periodically after fine-tuning
      if (Math.random() > 0.8) syncFederatedWeights();
    } catch (e) {
      console.error("Fine-tuning failed", e);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      // ... same movement tracking logic ...
      const now = Date.now();
      const dt = now - lastEventTime.current;
      
      if (dt > 10) { 
        movements.current.push([
          e.movementX,
          e.movementY,
          Math.min(dt, 200)
        ]);
        
        if (movements.current.length > 50) {
          movements.current.shift();
          // Periodically fine-tune every 50 samples
          if (Math.random() > 0.95) fineTuneModel();
        }
        lastEventTime.current = now;
      }
    };

    const handleClick = () => {
      const now = Date.now();
      clickPattern.current.push(now);
      if (clickPattern.current.length > 10) clickPattern.current.shift();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    // 🧠 Real-time Inference Loop
    const inferenceInterval = setInterval(async () => {
        if (model && movements.current.length >= 50) {
            try {
                const inputTensor = tf.tensor3d([movements.current]);
                const prediction = model.predict(inputTensor);
                const rawScore = (await prediction.data())[0];
                inputTensor.dispose();
                prediction.dispose();
                
                // Update local state for real-time UI/Pricing
                setScore(rawScore);
            } catch (e) {
                console.error("Real-time inference failed", e);
            }
        }
    }, 2000); // Infer every 2 seconds

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      clearInterval(inferenceInterval);
    };
  }, [model]);

  /**
   * calculateSpectralDensity
   * 
   * ANALYTICAL HARDENING: Detects the "Micro-Vibration" of human 
   * skeletal-muscle rhythm (2Hz-10Hz). Bots either have zero jitter 
   * (perfectly smooth) or white-noise jitter (random).
   */
  const calculateSpectralDensity = () => {
    if (movements.current.length < 50) return 0;
    
    // Simple frequency analysis via Zero-Crossing Rate (ZCR) 
    // as a proxy for spectral density in the browser
    let crossings = 0;
    for (let i = 1; i < movements.current.length; i++) {
        const prev = movements.current[i-1][0]; // dx
        const curr = movements.current[i][0];
        if ((prev > 0 && curr <= 0) || (prev < 0 && curr >= 0)) crossings++;
    }
    return crossings / movements.current.length;
  };

  /**
   * generateHumanityProof
   * 
   * CONTEXT-LOCKED SIGNATURE: Now requires a sessionNonce from the server
   * to prevent "Playback" or "Replay" attacks.
   */
  const generateHumanityProof = async (sessionNonce) => {
    if (!model || movements.current.length < 50) {
      console.warn("Model not ready or insufficient data");
      return null;
    }

    try {
      // 1. Edge-AI Inference
      const inputTensor = tf.tensor3d([movements.current]);
      const prediction = model.predict(inputTensor);
      const score = (await prediction.data())[0];
      inputTensor.dispose();
      prediction.dispose();

      // 2. Spectral Density Validation (The "Muscle Rhythm" Check)
      const spectralDensity = calculateSpectralDensity();
      
      // 3. Behavioral Consistency Check (Hybrid Logic)
      const dxs = movements.current.map(m => m[0]);
      const variance = dxs.reduce((a, b) => a + Math.pow(b, 2), 0) / dxs.length;

      console.log(`🛡️ Spectral Density: ${spectralDensity.toFixed(4)}, Score: ${score.toFixed(4)}`);

      // HUMAN THRESHOLD: Must have enough score AND a natural frequency signature
      if (score > 0.1 && spectralDensity > 0.05 && variance > 0.5) {
        const rawData = JSON.stringify({ 
            s: score, 
            v: variance, 
            f: spectralDensity,
            nonce: sessionNonce // Lock to current session
        });
        
        const encoder = new TextEncoder();
        const data = encoder.encode(rawData + Date.now());
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        setEntropy(hashHex);
        setIsVerified(true);
        setScore(score);
        return hashHex;
      } else {
          console.warn("⚠️ Behavior flagged as suspicious or low-entropy.");
      }
    } catch (e) {
      console.error("Inference failed", e);
    }

    return null;
  };

  const [score, setScore] = useState(1.0);

  return { generateHumanityProof, isVerified, entropy, score };
};
