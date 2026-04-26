/**
 * 🛠️ FanFever - Centralized Deployment Configuration
 * 
 * All environment variables MUST be accessed through this module.
 * Direct use of `import.meta.env` is prohibited in components/services.
 */

const requiredEnvVars = [
  'VITE_API_BASE_URL',
  'VITE_WS_URL',
  'VITE_APP_ENV'
];

// Validate required environment variables at startup
const missingVars = requiredEnvVars.filter(key => !import.meta.env[key]);

if (missingVars.length > 0) {
  const errorMsg = `❌ [Config Error] Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file.`;
  console.error(errorMsg);
  // In development, throw an error to fail fast. In production, this will crash the app on boot.
  throw new Error(errorMsg);
}

const config = {
  // API & WebSockets
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  wsUrl: import.meta.env.VITE_WS_URL,
  
  // Environment
  appEnv: import.meta.env.VITE_APP_ENV || import.meta.env.MODE,
  isProd: import.meta.env.VITE_APP_ENV === 'production' || import.meta.env.PROD,
  isDev: import.meta.env.VITE_APP_ENV === 'development' || import.meta.env.DEV,
  
  // Feature Flags
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  
  // App Metadata
  version: '1.0.0-PROD-READY',
};

// Freeze the config object to prevent accidental runtime mutations
Object.freeze(config);

export default config;
