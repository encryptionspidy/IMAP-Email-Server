import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev',
        changeOrigin: true,
        secure: true,
        // Don't rewrite the path - keep /api prefix as the AWS API expects it
      },
    },
  },
})
