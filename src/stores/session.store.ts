import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth.service'

export const useSessionStore = defineStore('session', () => {
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const showWarning = ref(false)
  const remainingTime = ref(0)
  const warningTimer = ref<number | null>(null)
  
  const isLocked = computed(() => !isAuthenticated.value)
  
  const remainingMinutes = computed(() => Math.ceil(remainingTime.value / 60000))
  
  async function initialize() {
    isLoading.value = true
    try {
      isAuthenticated.value = await authService.isAuthenticated()
      if (isAuthenticated.value) {
        setupActivityListeners()
        startWarningCountdown()
      }
    } finally {
      isLoading.value = false
    }
  }
  
  async function login() {
    isAuthenticated.value = true
    setupActivityListeners()
    startWarningCountdown()
  }
  
  async function logout() {
    clearWarningTimer()
    removeActivityListeners()
    showWarning.value = false
    isAuthenticated.value = false
    await authService.logout()
  }
  
  function extendSession() {
    authService.extendSession()
    showWarning.value = false
    startWarningCountdown()
  }
  
  function startWarningCountdown() {
    clearWarningTimer()
    remainingTime.value = 30 * 60 * 1000 // 30 minutes
    
    const updateCountdown = () => {
      remainingTime.value -= 1000
      
      if (remainingTime.value <= 5 * 60 * 1000 && !showWarning.value) {
        showWarning.value = true
      }
      
      if (remainingTime.value > 0) {
        warningTimer.value = window.setTimeout(updateCountdown, 1000)
      }
    }
    
    warningTimer.value = window.setTimeout(updateCountdown, 1000)
  }
  
  function clearWarningTimer() {
    if (warningTimer.value) {
      clearTimeout(warningTimer.value)
      warningTimer.value = null
    }
  }
  
  function handleActivity() {
    if (isAuthenticated.value) {
      authService.resetIdleTimer()
      if (showWarning.value) {
        showWarning.value = false
        startWarningCountdown()
      }
    }
  }
  
  function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })
  }
  
  function removeActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.removeEventListener(event, handleActivity)
    })
  }
  
  authService.onWarning(() => {
    showWarning.value = true
  })
  
  authService.onTimeout(() => {
    logout()
  })
  
  window.addEventListener('beforeunload', () => {
    if (isAuthenticated.value) {
      authService.logout()
    }
  })
  
  return {
    isAuthenticated,
    isLoading,
    isLocked,
    showWarning,
    remainingTime,
    remainingMinutes,
    initialize,
    login,
    logout,
    extendSession
  }
})