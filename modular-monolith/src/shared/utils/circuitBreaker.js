/**
 * 🛡️ Adaptive Circuit Breaker (Phase 8: Legendary Tier)
 * 
 * Self-healing resilience layer that dynamically adjusts its own thresholds
 * based on real-time performance and error patterns.
 */
class CircuitBreaker {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000; 

    this.state = 'CLOSED'; 
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    
    // Adaptive Metrics
    this.latencies = [];
    this.adaptiveTimeout = this.timeout;
  }

  async execute(fn, fallback) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.adaptiveTimeout) {
        this.state = 'HALF-OPEN';
        console.warn(`[CircuitBreaker] ${this.serviceName} entering HALF-OPEN state.`);
      } else {
        return fallback ? fallback() : Promise.reject(new Error(`CIRCUIT_OPEN: ${this.serviceName}`));
      }
    }

    const start = Date.now();
    try {
      const result = await fn();
      
      // Track Latency for Adaptation
      const duration = Date.now() - start;
      this.updateAdaptiveMetrics(duration);

      if (this.state === 'HALF-OPEN') {
        this.successes++;
        if (this.successes >= this.successThreshold) {
          this.reset();
        }
      }
      return result;
    } catch (err) {
      this.handleFailure(err);
      return fallback ? fallback() : Promise.reject(err);
    }
  }

  updateAdaptiveMetrics(duration) {
    this.latencies.push(duration);
    if (this.latencies.length > 20) this.latencies.shift();

    const avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    
    // If system is slow, we slightly increase the timeout to avoid eager tripping
    // If system is fast, we decrease it to fail fast.
    if (avgLatency > 1000) {
       this.adaptiveTimeout = Math.min(this.timeout * 2, this.adaptiveTimeout + 5000);
    } else {
       this.adaptiveTimeout = Math.max(5000, this.adaptiveTimeout - 1000);
    }
  }

  handleFailure(err) {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    // If failures are "Timeout" errors, we are more aggressive in opening
    const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
    const multiplier = isTimeout ? 1.5 : 1.0;

    if (this.failures * multiplier >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error(`🚩 [CircuitBreaker] ${this.serviceName} state is now OPEN. Adaptive Timeout: ${this.adaptiveTimeout}ms`);
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    console.log(`✅ [CircuitBreaker] ${this.serviceName} state is now CLOSED (Recovered).`);
  }
}

export const aiCircuit = new CircuitBreaker('ML-Sidecar', { 
  failureThreshold: 3, 
  timeout: 60000 
});

export default CircuitBreaker;
