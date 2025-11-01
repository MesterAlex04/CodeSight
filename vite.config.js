// filepath: c:\Users\alexm\Desktop\CodeSight\vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002', // <--- CHANGE THIS LINE
        changeOrigin: true,
      },
    }
  }
})