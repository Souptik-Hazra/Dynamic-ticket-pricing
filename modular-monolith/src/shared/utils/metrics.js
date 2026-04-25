import os from 'os';

/**
 * ⚙️ System Metrics Utility (SRE Tooling)
 * 
 * Provides real-time telemetry of the Node.js process health.
 * Can be scraped by Prometheus or viewed in the Admin Dashboard.
 */

export const getSystemMetrics = () => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    uptime_seconds: Math.floor(uptime),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    system: {
      load_avg: os.loadavg(),
      free_mem_gb: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100,
      total_mem_gb: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100,
    },
    process: {
      pid: process.pid,
      node_version: process.version,
      platform: process.platform
    }
  };
};

export default { getSystemMetrics };
