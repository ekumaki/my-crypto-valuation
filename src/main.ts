import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

// データベースの強制アップグレードを実行
import { dbServiceV2 } from '@/services/db-v2'

async function initializeApp() {
  // データベースの強制アップグレードを実行
  await dbServiceV2.forceUpgrade()
  
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

initializeApp().catch(console.error)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration)
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError)
      })
  })
}