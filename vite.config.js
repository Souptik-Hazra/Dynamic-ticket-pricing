import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: true // Fail if port is taken, don't increment
  },
  build: {
    sourcemap: false
  }
})
