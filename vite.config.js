import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 開發時把 /api 轉給 Power API Server（server/，預設 :8000）
      '/api': process.env.POWER_API_PROXY || 'http://127.0.0.1:8000',
    },
  },
})
