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

  // 暗号化キーの自動復元を試行
  async function attemptAutoUnlock(): Promise<boolean> {
    try {
      const { secureStorage } = await import('@/services/storage.service')
      
      if (secureStorage.isUnlocked()) {
        console.log('[DEBUG] attemptAutoUnlock - storage already unlocked')
        return true
      }

      // セッションストレージから暗号化キーを取得
      let keyData = sessionStorage.getItem('encryptionKey')
      let keySource = 'session'
      
      // セッションストレージにない場合はローカルストレージから取得
      if (!keyData) {
        keyData = localStorage.getItem('encryptionKey')
        keySource = 'local'
      }
      
      if (keyData) {
        console.log(`[DEBUG] attemptAutoUnlock - found encryption key in ${keySource} storage, attempting to unlock`)
        
        try {
          const { CryptoService } = await import('@/services/crypto.service')
          const cryptoKey = await CryptoService.importKey(keyData)
          secureStorage.setEncryptionKey(cryptoKey)
          
          if (secureStorage.isUnlocked()) {
            console.log(`[DEBUG] attemptAutoUnlock - successfully unlocked with ${keySource} key`)
            
            // セッションストレージにキーがない場合は保存
            if (keySource === 'local' && !sessionStorage.getItem('encryptionKey')) {
              sessionStorage.setItem('encryptionKey', keyData)
              console.log('[DEBUG] attemptAutoUnlock - restored key to session storage')
            }
            
            return true
          } else {
            console.log(`[DEBUG] attemptAutoUnlock - ${keySource} key failed to unlock storage`)
          }
        } catch (keyError) {
          console.error(`[DEBUG] attemptAutoUnlock - failed to import key from ${keySource} storage:`, keyError)
          // Remove invalid key
          if (keySource === 'session') {
            sessionStorage.removeItem('encryptionKey')
          } else {
            localStorage.removeItem('encryptionKey')
          }
        }
      } else {
        console.log('[DEBUG] attemptAutoUnlock - no encryption key found in session or local storage')
      }

      return false
    } catch (error) {
      console.error('[DEBUG] attemptAutoUnlock - error during auto unlock:', error)
      return false
    }
  }
  
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
      // Don't override authentication state if already authenticated
      if (!isAuthenticated.value) {
        isAuthenticated.value = await authService.isAuthenticated()
        console.log('[DEBUG] Session initialize - isAuthenticated:', isAuthenticated.value)
      } else {
        console.log('[DEBUG] Session initialize - already authenticated, skipping authService check')
      }
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
        
        // Check if encryption key is in session storage (page refresh case)
        const { secureStorage } = await import('@/services/storage.service')
        const autoUnlockSuccess = await attemptAutoUnlock()

        if (!secureStorage.isUnlocked() && !autoUnlockSuccess) {
          console.log('[DEBUG] Authentication exists but storage is locked and auto unlock failed - showing unlock prompt')
          showUnlockPrompt.value = true
        } else {
          console.log('[DEBUG] Storage is already unlocked or auto unlock succeeded')
          showUnlockPrompt.value = false
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
  
  async function login(authType: string = 'password') {
    console.log('[DEBUG] sessionStore.login() called - before setting isAuthenticated:', isAuthenticated.value)
    isAuthenticated.value = true
    console.log('[DEBUG] sessionStore.login() called - after setting isAuthenticated:', isAuthenticated.value)
    
    // ログイン時にセッション開始時間を設定
    sessionStartTime.value = Date.now()
    saveSessionStartTime(sessionStartTime.value)
    console.log('[DEBUG] login - new session start time:', new Date(sessionStartTime.value), 'auth type:', authType)
    
    // ログイン時に暗号化キーをセッションストレージとローカルストレージに保存
    try {
      const { secureStorage } = await import('@/services/storage.service')
      const key = secureStorage.getEncryptionKey()
      if (key) {
        const { CryptoService } = await import('@/services/crypto.service')
        const exportedKey = await CryptoService.exportKey(key)
        sessionStorage.setItem('encryptionKey', exportedKey)
        localStorage.setItem('encryptionKey', exportedKey)
        console.log('[DEBUG] login - encryption key exported and saved to session and local storage')
      }
    } catch (error) {
      console.warn('[DEBUG] login - failed to save encryption key to storage:', error)
    }
    
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
    sessionStorage.removeItem('encryptionKey') // セッションストレージからキーを削除
    localStorage.removeItem('encryptionKey') // ローカルストレージからキーを削除
    await authService.logout()
  }

  async function logoutAndDiscardChanges() {
    console.log('[DEBUG] sessionStore.logoutAndDiscardChanges() called')
    try {
      // 1. 競合状態をクリア
      const { syncService } = await import('@/services/sync.service')
      syncService.clearConflictState()
      console.log('[DEBUG] logoutAndDiscardChanges - cleared conflict state')
      
      // 2. 未同期データを完全に破棄
      await discardUnsyncedData()
      
      // 3. 追加のクリーンアップ処理
      await performAdditionalCleanup()
      
      console.log('[DEBUG] logoutAndDiscardChanges - all cleanup completed')
    } catch (error) {
      console.warn('[DEBUG] logoutAndDiscardChanges - failed to clear sync state:', error)
    }
    
    // 通常のログアウト処理を実行
    await logout()
  }
  
  async function performAdditionalCleanup() {
    console.log('[DEBUG] performAdditionalCleanup - starting')
    
    try {
      // 同期関連のlocalStorageキーをクリア
      const syncKeys = [
        'lastDataModified',
        'syncStatus',
        'globalSyncTime',
        'cloudPassword'
      ]
      
      for (const key of syncKeys) {
        localStorage.removeItem(key)
        console.log('[DEBUG] performAdditionalCleanup - removed localStorage key:', key)
      }
      
      // メタデータサービスの状態をリセット
      const { metadataService } = await import('@/services/metadata.service')
      metadataService.clearMetadataCache()
      
      console.log('[DEBUG] performAdditionalCleanup - completed')
    } catch (error) {
      console.error('[DEBUG] performAdditionalCleanup - error:', error)
    }
  }
  
  async function discardUnsyncedData() {
    console.log('[DEBUG] discardUnsyncedData - starting complete cleanup')
    
    try {
      const { metadataService } = await import('@/services/metadata.service')
      const { syncService } = await import('@/services/sync.service')
      const { dbV2 } = await import('@/services/db-v2')
      
      console.log('[DEBUG] discardUnsyncedData - clearing all user data')
      
      // 1. すべての保有データを削除
      const allHoldings = await dbV2.holdings.toArray()
      console.log('[DEBUG] discardUnsyncedData - found holdings to delete:', allHoldings.length)
      await dbV2.holdings.clear()
      
      // 2. カスタムロケーションを削除（プリセットは保持）
      const allLocations = await dbV2.locations.toArray()
      const customLocations = allLocations.filter(location => location.isCustom)
      console.log('[DEBUG] discardUnsyncedData - found custom locations to delete:', customLocations.length)
      for (const location of customLocations) {
        await dbV2.locations.delete(location.id)
      }
      
      // 3. 追加されたトークンを削除（プリセットは保持）
      const presetTokenSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'SHIB', 'MATIC', 'LTC', 'ATOM', 'LINK', 'UNI']
      const allTokens = await dbV2.tokens.toArray()
      const customTokens = allTokens.filter(token => !presetTokenSymbols.includes(token.symbol))
      console.log('[DEBUG] discardUnsyncedData - found custom tokens to delete:', customTokens.length)
      for (const token of customTokens) {
        await dbV2.tokens.delete(token.symbol)
      }
      
      // 4. 残存するプリセットデータのメタデータを同期済みに更新
      const now = new Date()
      const syncedMetadata = {
        isNew: false,
        isModified: false,
        isDeleted: false,
        isSynced: true,
        lastModified: now,
        lastSyncTime: now,
        version: 1
      }
      
      // プリセットロケーションのメタデータを更新
      const remainingLocations = await dbV2.locations.toArray()
      for (const location of remainingLocations) {
        await dbV2.locations.update(location.id, { metadata: syncedMetadata })
      }
      
      // プリセットトークンのメタデータを更新
      const remainingTokens = await dbV2.tokens.toArray()
      for (const token of remainingTokens) {
        await dbV2.tokens.update(token.symbol, { metadata: syncedMetadata })
      }
      
      // 5. メタデータキャッシュを完全にクリア
      metadataService.clearMetadataCache()
      
      // 6. グローバル同期時刻を設定
      metadataService.setGlobalSyncTime(now)
      
      console.log('[DEBUG] discardUnsyncedData - complete cleanup finished')
      
    } catch (error) {
      console.error('[DEBUG] discardUnsyncedData - error during cleanup:', error)
    }
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
    
    // アンロック成功時にキーをセッションストレージとローカルストレージに保存
    try {
      const { secureStorage } = await import('@/services/storage.service')
      const key = secureStorage.getEncryptionKey()
      if (key) {
        const { CryptoService } = await import('@/services/crypto.service')
        const exportedKey = await CryptoService.exportKey(key)
        sessionStorage.setItem('encryptionKey', exportedKey)
        localStorage.setItem('encryptionKey', exportedKey)
        console.log('[DEBUG] Encryption key exported and saved to session and local storage')
      }
    } catch (error) {
      console.warn('[DEBUG] Failed to save encryption key to storage:', error)
    }
    
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
    logoutAndDiscardChanges,
    extendSession,
    requestUnlock,
    handleUnlockSuccess,
    handleUnlockCancel,
    attemptAutoUnlock
  }
})