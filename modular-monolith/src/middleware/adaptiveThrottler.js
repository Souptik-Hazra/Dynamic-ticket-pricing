import os from 'os';
import config from '../shared/config/index.js';
import { logWarn } from '../shared/utils/logger.js';

/**
 * 📉 Adaptive Throttler
 * OS Concept: Resource-Aware Admission Control
 * 
 * Monitors system load and signals other middleware to tighten limits
 * if the server is under extreme stress.
 */

let systemStressFactor = 1.0;

export const monitorSystemHealth = () => {
  setInterval(() => {
    const loadAvg = os.loadavg()[0]; // 1-minute load average
    const cpuCount = os.cpus().length;
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    const memLimit = config.clustering.maxWorkerMemoryMb || 512;

    // If load avg > CPU count, the system is saturated
    const cpuStress = loadAvg / cpuCount;
    const memStress = memUsage / memLimit;

    // Calculate a stress factor between 0.2 (extreme stress) and 1.0 (healthy)
    const maxStress = Math.max(cpuStress, memStress);
    
    if (maxStress > 0.9) {
      systemStressFactor = 0.2; // Critical: Allow only 20% of normal traffic
    } else if (maxStress > 0.7) {
      systemStressFactor = 0.5; // High: Allow 50%
    } else {
      systemStressFactor = 1.0; // Healthy
    }

    if (systemStressFactor < 1.0) {
      logWarn('AdaptiveThrottler', `System stress detected (Stress: ${maxStress.toFixed(2)}). Scaling limits to ${systemStressFactor * 100}%`, { stress: maxStress, factor: systemStressFactor });
    }
  }, 10000).unref();
};

export const getStressFactor = () => systemStressFactor;

export const adaptiveThrottler = (req, res, next) => {
  req.systemStressFactor = systemStressFactor;
  next();
};

export default adaptiveThrottler;
