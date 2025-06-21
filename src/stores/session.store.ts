import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth.service'

export const useSessionStore = defineStore('session', () => {
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const showWarning = ref(false)
  const showUnlockPrompt = ref(false)
  const remainingTime = ref(0)
  const warningTimer = ref<number | null>(null)
  const sessionStartTime = ref<number>(0)
  
  const isLocked = computed(() => !isAuthenticated.value)
  
  const remainingMinutes = computed(() => Math.ceil(remainingTime.value / 60000))
  const remainingSeconds = computed(() => Math.ceil(remainingTime.value / 1000))
  const remainingDisplay = computed(() => {
    const totalSeconds = Math.ceil(remainingTime.value / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  })
  
  async function initialize() {
    isLoading.value = true
    try {
      isAuthenticated.value = await authService.isAuthenticated()
      console.log('[DEBUG] Session initialize - isAuthenticated:', isAuthenticated.value)
      if (isAuthenticated.value) {
        // Temporarily disable for debugging
        // setupActivityListeners()
        // startWarningCountdown()
        console.log('[DEBUG] Session initialized successfully, but timers disabled for debugging')
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
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    showWarning.value = false
    isAuthenticated.value = false
    sessionStartTime.value = 0
    await authService.logout()
  }
  
  function extendSession() {
    // 明示的なセッション延長時のみ警告をクリアして時間をリセット
    authService.extendSession()
    showWarning.value = false
    startWarningCountdown()
  }
  
  function startWarningCountdown() {
    clearWarningTimer()
    const totalSessionTime = 30 * 60 * 1000 // 30 minutes
    sessionStartTime.value = Date.now()
    remainingTime.value = totalSessionTime
    
    const updateCountdown = () => {
      // 実際の経過時間から残り時間を計算
      const elapsedTime = Date.now() - sessionStartTime.value
      const newRemainingTime = Math.max(0, totalSessionTime - elapsedTime)
      remainingTime.value = newRemainingTime
      
      if (remainingTime.value <= 5 * 60 * 1000 && !showWarning.value) {
        showWarning.value = true
      }
      
      if (remainingTime.value > 0) {
        warningTimer.value = window.setTimeout(updateCountdown, 1000)
      } else {
        // 時間切れの場合は自動ログアウト
        logout()
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
    if (isAuthenticated.value && !showWarning.value) {
      // 警告が表示されていない場合のみタイマーをリセット
      authService.resetIdleTimer()
    }
  }
  
  function setupActivityListeners() {
    // マウス移動を除外し、明示的な操作のみを監視
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })
  }
  
  function removeActivityListeners() {
    // setupActivityListenersと同じイベントリストを使用
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click']
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
  
  // Page Visibility API でタブの状態変化を監視
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && isAuthenticated.value && sessionStartTime.value > 0) {
      // タブがアクティブになった時に時間を再計算して即座に更新
      const totalSessionTime = 30 * 60 * 1000
      const elapsedTime = Date.now() - sessionStartTime.value
      const newRemainingTime = Math.max(0, totalSessionTime - elapsedTime)
      remainingTime.value = newRemainingTime
      
      // 警告状態も更新
      if (remainingTime.value <= 5 * 60 * 1000 && !showWarning.value) {
        showWarning.value = true
      }
      
      // 時間切れの場合は即座にログアウト
      if (remainingTime.value <= 0) {
        logout()
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // TEMPORARILY COMMENTED OUT - This was causing logout on page refresh
  // window.addEventListener('beforeunload', () => {
  //   if (isAuthenticated.value) {
  //     authService.logout()
  //   }
  // })
  
  async function requestUnlock(): Promise<boolean> {
    return new Promise((resolve) => {
      showUnlockPrompt.value = true
      
      const handleUnlock = () => {
        showUnlockPrompt.value = false
        resolve(true)
      }
      
      const handleCancel = () => {
        showUnlockPrompt.value = false
        resolve(false)
      }
      
      // Store these handlers for the component to use
      ;(window as any)._unlockHandlers = { handleUnlock, handleCancel }
    })
  }
  
  function handleUnlockSuccess() {
    showUnlockPrompt.value = false
    ;(window as any)._unlockHandlers?.handleUnlock()
  }
  
  function handleUnlockCancel() {
    showUnlockPrompt.value = false
    ;(window as any)._unlockHandlers?.handleCancel()
  }

  return {
    isAuthenticated,
    isLoading,
    isLocked,
    showWarning,
    showUnlockPrompt,
    remainingTime,
    remainingMinutes,
    remainingSeconds,
    remainingDisplay,
    initialize,
    login,
    logout,
    extendSession,
    requestUnlock,
    handleUnlockSuccess,
    handleUnlockCancel
  }
})