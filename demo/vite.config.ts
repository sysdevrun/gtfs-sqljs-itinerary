import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/gtfs-sqljs-itinerary/',
  plugins: [react()],
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['gtfs-sqljs']
  }
})
