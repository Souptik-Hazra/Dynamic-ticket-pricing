import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from the current directory
  const env = loadEnv(mode, process.cwd());
  const backendUrl = env.VITE_WS_PROXY_TARGET
  return {
    base: './',
    plugins: [
      react(),
      mkcert()
    ],
    server: {
      https: true, // Force HTTPS
      port: Number(env.VITE_PORT) || 5173,
      strictPort: false, 
      proxy: {
        '/api/ws': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
      sourcemap: false
    }
  };
})
