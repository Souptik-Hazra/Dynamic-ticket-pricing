import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

/**
 * 🛠️ FanFever - Centralized Backend Configuration
 * 
 * Strict validation at startup ensures the monolith never runs in an invalid state.
 */

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'REDIS_HOST',
  'REDIS_PORT'
];

const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  const errorMsg = `❌ [Backend Config Error] Missing required environment variables: ${missingVars.join(', ')}. Please check your root .env file.`;
  console.error(errorMsg);
  process.exit(1);
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '4000', 10),
  
  // Database: MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI
  },

  // Database: Redis (construct URI if needed)
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_PASSWORD || '',
    uri: process.env.REDIS_URI || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
  },

  // Database: Neo4j
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password'
  },

  // Authentication
  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRE || '7d'
  },

  // AI & ML
  ml: {
    serviceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000',
    pythonPath: process.env.PYTHON_PATH || 'python',
    clipNorm: parseFloat(process.env.ML_CLIP_NORM || '15.0'),
    dpEpsilon: parseFloat(process.env.ML_DP_EPSILON || '0.05'),
    aggregationThreshold: parseInt(process.env.ML_AGGREGATION_THRESHOLD || '3', 10)
  },

  // Communication (SMTP)
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },

  // Infrastructure & Scaling
  clustering: {
    enabled: process.env.NODE_ENV === 'production' || process.env.CLUSTER_DEV === 'true',
    maxWorkerMemoryMb: parseInt(process.env.MAX_WORKER_MEMORY_MB || '1024', 10)
  },

  // Security
  security: {
    allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    trustProxy: process.env.TRUST_PROXY || '1',
    rateLimitAuth: parseInt(process.env.RATE_LIMIT_AUTH || '20', 10),
    rateLimitPurchase: parseInt(process.env.RATE_LIMIT_PURCHASE || '10', 10),
    rateLimitGeneral: parseInt(process.env.RATE_LIMIT_GENERAL || '120', 10)

  }
};

// Freeze the config object
Object.freeze(config);

export default config;
