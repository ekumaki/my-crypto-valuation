import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

async function initializeApp() {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

initializeApp().catch(console.error)

// Register service worker for PWA (temporarily disabled for development)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
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