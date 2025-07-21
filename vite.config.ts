import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: '仮想通貨資産価値計算アプリ',
        short_name: 'Crypto Valuation',
        description: '仮想通貨ポートフォリオの日本円評価額を計算するアプリ',
        theme_color: '#1f2937',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/'
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v3'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[PROXY] Error:', err)
          })
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[PROXY] Request:', req.method, req.url, '-> ', proxyReq.path)
          })
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[PROXY] Response:', proxyRes.statusCode, req.url)
          })
        }
      }
    }
  }
})