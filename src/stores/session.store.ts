import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth.service'

// ローカルストレージのキー
const SESSION_START_TIME_KEY = 'session_start_time'

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
  
  // セッション開始時間をローカルストレージに保存
  function saveSessionStartTime(time: number) {
    try {
      localStorage.setItem(SESSION_START_TIME_KEY, time.toString())
    } catch (error) {
      console.error('Failed to save session start time:', error)
    }
  }

  // セッション開始時間をローカルストレージから復元
  function loadSessionStartTime(): number {
    try {
      const saved = localStorage.getItem(SESSION_START_TIME_KEY)
      return saved ? parseInt(saved, 10) : 0
    } catch (error) {
      console.error('Failed to load session start time:', error)
      return 0
    }
  }

  // セッション開始時間をローカルストレージから削除
  function clearSessionStartTime() {
    try {
      localStorage.removeItem(SESSION_START_TIME_KEY)
    } catch (error) {
      console.error('Failed to clear session start time:', error)
    }
  }
  
  async function initialize() {
    isLoading.value = true
    try {
      isAuthenticated.value = await authService.isAuthenticated()
      console.log('[DEBUG] Session initialize - isAuthenticated:', isAuthenticated.value)
      if (isAuthenticated.value) {
        // セッション開始時間を復元
        const savedStartTime = loadSessionStartTime()
        if (savedStartTime > 0) {
          sessionStartTime.value = savedStartTime
          console.log('[DEBUG] Restored session start time:', new Date(savedStartTime))
          
          // 復元した時間を基に残り時間を計算
          const totalSessionTime = 30 * 60 * 1000 // 30 minutes
          const elapsedTime = Date.now() - savedStartTime
          const newRemainingTime = Math.max(0, totalSessionTime - elapsedTime)
          remainingTime.value = newRemainingTime
          
          console.log('[DEBUG] Calculated remaining time on restore:', newRemainingTime / 1000, 'seconds')
          
          // セッションが期限切れの場合はログアウト
          if (newRemainingTime <= 0) {
            console.log('[DEBUG] Session expired during restore, logging out')
            await logout()
            return
          }
        }
        
        // Check if encryption key is missing (page refresh case)
        const { secureStorage } = await import('@/services/storage.service')
        if (!secureStorage.isUnlocked()) {
          console.log('[DEBUG] Authentication exists but storage is locked - showing unlock prompt')
          showUnlockPrompt.value = true
        } else {
          console.log('[DEBUG] Storage is already unlocked')
        }
        
        // セッションタイマーを開始
        // 復元された時間がない場合でも、認証済みの場合はタイマーを開始
        if (sessionStartTime.value === 0) {
          // セッション開始時間が保存されていない場合は新しく設定
          sessionStartTime.value = Date.now()
          saveSessionStartTime(sessionStartTime.value)
          console.log('[DEBUG] Set new session start time for authenticated user:', new Date(sessionStartTime.value))
        }
        startWarningCountdown()
        
        setupActivityListeners()
        console.log('[DEBUG] Session initialized successfully')
      }
    } finally {
      isLoading.value = false
    }
  }
  
  async function login() {
    isAuthenticated.value = true
    
    // ログイン時にセッション開始時間を設定
    sessionStartTime.value = Date.now()
    saveSessionStartTime(sessionStartTime.value)
    console.log('[DEBUG] login - new session start time:', new Date(sessionStartTime.value))
    
    setupActivityListeners()
    startWarningCountdown()
  }
  
  async function logout() {
    console.log('[DEBUG] sessionStore.logout() called - Stack trace:')
    console.trace()
    clearWarningTimer()
    removeActivityListeners()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    showWarning.value = false
    isAuthenticated.value = false
    sessionStartTime.value = 0
    clearSessionStartTime() // ローカルストレージからも削除
    await authService.logout()
  }
  
  function extendSession() {
    // 明示的なセッション延長時のみ警告をクリアして時間をリセット
    console.log('[DEBUG] extendSession called - resetting session timer')
    authService.extendSession()
    showWarning.value = false
    
    // セッション延長時は新しい開始時間を設定
    sessionStartTime.value = Date.now()
    saveSessionStartTime(sessionStartTime.value)
    console.log('[DEBUG] extendSession - new session start time:', new Date(sessionStartTime.value))
    
    startWarningCountdown()
  }
  
  function startWarningCountdown() {
    clearWarningTimer()
    const totalSessionTime = 30 * 60 * 1000 // 30 minutes
    
    // セッション開始時間が設定されていない場合は現在時刻を設定
    if (sessionStartTime.value === 0) {
      sessionStartTime.value = Date.now()
      saveSessionStartTime(sessionStartTime.value)
      console.log('[DEBUG] Set new session start time:', new Date(sessionStartTime.value))
    } else {
      // 既存のセッション開始時間を使用（復元後の場合）
      console.log('[DEBUG] Using existing session start time:', new Date(sessionStartTime.value))
    }
    
    remainingTime.value = Math.max(0, totalSessionTime - (Date.now() - sessionStartTime.value))
    console.log('[DEBUG] startWarningCountdown - initial remainingTime:', remainingTime.value / 1000, 'seconds')
    
    const updateCountdown = () => {
      // 実際の経過時間から残り時間を計算
      const elapsedTime = Date.now() - sessionStartTime.value
      const newRemainingTime = Math.max(0, totalSessionTime - elapsedTime)
      remainingTime.value = newRemainingTime
      console.log('[DEBUG] updateCountdown - remainingTime:', remainingTime.value / 1000, 'seconds')
      
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
  
  // TEMPORARILY DISABLED FOR DEBUGGING
  // authService.onWarning(() => {
  //   showWarning.value = true
  // })
  
  // authService.onTimeout(() => {
  //   logout()
  // })
  
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
  
  async function handleUnlockSuccess() {
    console.log('[DEBUG] handleUnlockSuccess - refreshing stores')
    
    // Refresh all stores after unlock BEFORE closing prompt
    try {
      const { secureStorage } = await import('@/services/storage.service')
      console.log('[DEBUG] Before store refresh - storage unlocked:', secureStorage.isUnlocked())
      
      // Test basic database access with detailed error info
      try {
        console.log('[DEBUG] Testing database access...')
        const testHoldings = await secureStorage.getHoldings()
        console.log('[DEBUG] Direct getHoldings test successful, count:', testHoldings.length)
      } catch (testError) {
        console.error('[DEBUG] Direct getHoldings test failed:', testError)
        console.error('[DEBUG] Error name:', (testError as Error).name)
        console.error('[DEBUG] Error message:', (testError as Error).message)
        console.error('[DEBUG] Error stack:', (testError as Error).stack)
        
        // Try alternative database access
        try {
          const { dbV2 } = await import('@/services/db-v2')
          const rawHoldings = await dbV2.holdings.toArray()
          console.log('[DEBUG] Raw database access successful, count:', rawHoldings.length)
        } catch (rawError) {
          console.error('[DEBUG] Raw database access also failed:', rawError)
        }
      }
      
      const { useTokensStore } = await import('@/stores/useTokens')
      const { useHoldingsStoreV2 } = await import('@/stores/useHoldingsV2')
      const { useLocationsStore } = await import('@/stores/useLocations')
      
      const tokensStore = useTokensStore()
      const holdingsStore = useHoldingsStoreV2()
      const locationsStore = useLocationsStore()
      
      console.log('[DEBUG] Starting store refresh...')
      
      // Refresh stores individually with error handling
      try {
        await tokensStore.loadTokens()
        console.log('[DEBUG] Tokens loaded successfully')
      } catch (error) {
        console.error('[DEBUG] Failed to load tokens:', error)
      }
      
      try {
        await holdingsStore.loadHoldings()
        console.log('[DEBUG] Holdings loaded successfully')
      } catch (error) {
        console.error('[DEBUG] Failed to load holdings:', error)
      }
      
      try {
        await holdingsStore.loadAggregatedHoldings()
        console.log('[DEBUG] Aggregated holdings loaded successfully')
      } catch (error) {
        console.error('[DEBUG] Failed to load aggregated holdings:', error)
      }
      
      try {
        await locationsStore.loadLocations()
        console.log('[DEBUG] Locations loaded successfully')
      } catch (error) {
        console.error('[DEBUG] Failed to load locations:', error)
      }
      
      console.log('[DEBUG] All stores refresh completed')
    } catch (error) {
      console.error('[DEBUG] Error refreshing stores after unlock:', error)
    }
    
    // Wait a bit for all reactive updates to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Close unlock prompt AFTER stores are refreshed
    showUnlockPrompt.value = false
    
    // Trigger a final reactive update
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // アンロック成功後にセッションタイマーを再開
    if (sessionStartTime.value > 0) {
      console.log('[DEBUG] Restarting session timer after unlock')
      startWarningCountdown()
    }
    
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