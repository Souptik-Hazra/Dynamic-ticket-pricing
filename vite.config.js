import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    mkcert()
  ],
  server: {
    https: true, // Force HTTPS
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: true, // Fail if port is taken, don't increment
    proxy: {
      // Ensure websocket path is proxied with Upgrade support before the generic /api proxy
      // In dev, proxy websocket connections directly to the websocket service
      '/api/ws': {
        target: process.env.VITE_WS_PROXY_TARGET || 'http://localhost:4010',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false, // Don't verify SSL for local proxy
      }
    }
  },
  build: {
    sourcemap: false
  }
})
