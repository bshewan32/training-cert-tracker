import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // dev only: proxies /api to your Render backend
      '/api': {
        target: 'https://training-cert-tracker.onrender.com',
        changeOrigin: true,
        secure: true
      }
    }
  }
})
