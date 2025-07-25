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
  const storageUnlocked = ref(false)
  
  const isLocked = computed(() => !isAuthenticated.value)
  
  const remainingMinutes = computed(() => Math.ceil(remainingTime.value / 60000))
  const remainingSeconds = computed(() => Math.ceil(remainingTime.value / 1000))
  const remainingDisplay = computed(() => {
    const totalSeconds = Math.ceil(remainingTime.value / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  })

  // Google認証情報を使用してストレージをアンロック
  async function attemptAutoUnlock(): Promise<boolean> {
    try {
      const { secureStorage } = await import('@/services/storage.service')
      
      if (secureStorage.isUnlocked()) {
        return true
      }

      // Google認証状態をチェック
      const { googleAuthService } = await import('@/services/google-auth.service')
      if (!googleAuthService.isAuthenticated.value || !googleAuthService.user.value) {
        return false
      }

      // Google認証情報から暗号化キーを復元
      const unlockResult = await authService.unlockWithGoogleAuth()
      if (unlockResult.success) {
        return true
      } else {
        return false
      }
    } catch (error) {
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
      } else {
      }
      if (isAuthenticated.value) {
        // セッション開始時間を復元
        const savedStartTime = loadSessionStartTime()
        if (savedStartTime > 0) {
          const totalSessionTime = 30 * 60 * 1000 // 30 minutes
          const elapsedTime = Date.now() - savedStartTime
          const newRemainingTime = Math.max(0, totalSessionTime - elapsedTime)
          
          
          // セッションが期限切れの場合は新しいセッションを開始
          if (newRemainingTime <= 0) {
            clearSessionStartTime()
            sessionStartTime.value = Date.now()
            saveSessionStartTime(sessionStartTime.value)
            remainingTime.value = totalSessionTime
          } else {
            sessionStartTime.value = savedStartTime
            remainingTime.value = newRemainingTime
          }
        }
        
        // Check if encryption key is in session storage (page refresh case)
        const { secureStorage } = await import('@/services/storage.service')
        const autoUnlockSuccess = await attemptAutoUnlock()

        if (!secureStorage.isUnlocked() && !autoUnlockSuccess) {
          showUnlockPrompt.value = true
          storageUnlocked.value = false
        } else {
          showUnlockPrompt.value = false
          storageUnlocked.value = true
        }
        
        // セッションタイマーを開始
        // 復元された時間がない場合でも、認証済みの場合はタイマーを開始
        if (sessionStartTime.value === 0) {
          // セッション開始時間が保存されていない場合は新しく設定
          sessionStartTime.value = Date.now()
          saveSessionStartTime(sessionStartTime.value)
        }
        startWarningCountdown()
        
        setupActivityListeners()
      }
    } finally {
      isLoading.value = false
    }
  }
  
  async function login(authType: string = 'password') {
    isAuthenticated.value = true
    
    // ログイン時にセッション開始時間を設定
    sessionStartTime.value = Date.now()
    saveSessionStartTime(sessionStartTime.value)
    
    // Google認証情報から暗号化キーが設定されていることを確認
    try {
      const { secureStorage } = await import('@/services/storage.service')
      if (secureStorage.isUnlocked()) {
        storageUnlocked.value = true
      } else {
        const unlockSuccess = await attemptAutoUnlock()
        storageUnlocked.value = unlockSuccess
      }
    } catch (error) {
      storageUnlocked.value = false
    }
    
    setupActivityListeners()
    startWarningCountdown()
  }
  
  async function logout() {
    console.trace()
    clearWarningTimer()
    removeActivityListeners()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    showWarning.value = false
    isAuthenticated.value = false
    sessionStartTime.value = 0
    storageUnlocked.value = false
    clearSessionStartTime() // ローカルストレージからも削除

    await authService.logout()
  }

  async function logoutAndDiscardChanges() {
    try {
      // 1. 競合状態をクリア
      const { syncService } = await import('@/services/sync.service')
      syncService.clearConflictState()
      
      // 2. 未同期データを完全に破棄
      await discardUnsyncedData()
      
      // 3. 追加のクリーンアップ処理
      await performAdditionalCleanup()
      
    } catch (error) {
    }
    
    // 通常のログアウト処理を実行
    await logout()
  }
  
  async function performAdditionalCleanup() {
    
    try {
      // 同期関連のlocalStorageキーをクリア
      const syncKeys = [
        'lastDataModified',
        'syncStatus',
        'globalSyncTime',
        'cloudPassword',
        'encryptionKey'  // 暗号化キーもクリア
      ]
      
      for (const key of syncKeys) {
        localStorage.removeItem(key)
      }
      
      // セッションストレージもクリア
      sessionStorage.removeItem('encryptionKey')
      
      // メタデータサービスの状態を完全にリセット
      const { metadataService } = await import('@/services/metadata.service')
      metadataService.clearMetadataCache()
      await metadataService.forceResetAllMetadata()
      
    } catch (error) {
    }
  }
  
  async function discardUnsyncedData() {
    
    try {
      const { metadataService } = await import('@/services/metadata.service')
      const { syncService } = await import('@/services/sync.service')
      const { dbV2 } = await import('@/services/db-v2')
      
      
      // 1. すべての保有データを削除
      const allHoldings = await dbV2.holdings.toArray()
      await dbV2.holdings.clear()
      
      // 2. カスタムロケーションを削除（プリセットは保持）
      const allLocations = await dbV2.locations.toArray()
      const customLocations = allLocations.filter(location => location.isCustom)
      for (const location of customLocations) {
        await dbV2.locations.delete(location.id)
      }
      
      // 3. 追加されたトークンを削除（プリセットは保持）
      const presetTokenSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'SHIB', 'MATIC', 'LTC', 'ATOM', 'LINK', 'UNI']
      const allTokens = await dbV2.tokens.toArray()
      const customTokens = allTokens.filter(token => !presetTokenSymbols.includes(token.symbol))
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
      
      
    } catch (error) {
    }
  }
  
  function extendSession() {
    // 明示的なセッション延長時のみ警告をクリアして時間をリセット
    authService.extendSession()
    showWarning.value = false
    
    // セッション延長時は新しい開始時間を設定
    sessionStartTime.value = Date.now()
    saveSessionStartTime(sessionStartTime.value)
    
    startWarningCountdown()
  }
  
  function startWarningCountdown() {
    clearWarningTimer()
    const totalSessionTime = 30 * 60 * 1000 // 30 minutes
    
    // セッション開始時間が設定されていない場合は現在時刻を設定
    if (sessionStartTime.value === 0) {
      sessionStartTime.value = Date.now()
      saveSessionStartTime(sessionStartTime.value)
    } else {
      // 既存のセッション開始時間を使用（復元後の場合）
    }
    
    remainingTime.value = Math.max(0, totalSessionTime - (Date.now() - sessionStartTime.value))
    
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
    
    // アンロック成功時にキーをセッションストレージとローカルストレージに保存
    try {
      const { secureStorage } = await import('@/services/storage.service')
      const key = secureStorage.getEncryptionKey()
      if (key) {
        const { CryptoService } = await import('@/services/crypto.service')
        const exportedKey = await CryptoService.exportKey(key)
        sessionStorage.setItem('encryptionKey', exportedKey)
        localStorage.setItem('encryptionKey', exportedKey)
      }
    } catch (error) {
    }
    
    // Refresh all stores after unlock BEFORE closing prompt
    try {
      const { secureStorage } = await import('@/services/storage.service')
      
      // Test basic database access with detailed error info
      try {
        const testHoldings = await secureStorage.getHoldings()
      } catch (testError) {
        
        // Try alternative database access
        try {
          const { dbV2 } = await import('@/services/db-v2')
          const rawHoldings = await dbV2.holdings.toArray()
        } catch (rawError) {
        }
      }
      
      const { useTokensStore } = await import('@/stores/useTokens')
      const { useHoldingsStoreV2 } = await import('@/stores/useHoldingsV2')
      const { useLocationsStore } = await import('@/stores/useLocations')
      
      const tokensStore = useTokensStore()
      const holdingsStore = useHoldingsStoreV2()
      const locationsStore = useLocationsStore()
      
      
      // Refresh stores individually with error handling
      try {
        await tokensStore.loadTokens()
      } catch (error) {
      }
      
      try {
        await holdingsStore.loadHoldings()
      } catch (error) {
      }
      
      try {
        await holdingsStore.loadAggregatedHoldings()
      } catch (error) {
      }
      
      try {
        await locationsStore.loadLocations()
      } catch (error) {
      }
      
    } catch (error) {
    }
    
    // Wait a bit for all reactive updates to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Close unlock prompt AFTER stores are refreshed
    showUnlockPrompt.value = false
    
    // Trigger a final reactive update
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // アンロック成功後にセッションタイマーを再開
    if (sessionStartTime.value > 0) {
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
    storageUnlocked,
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
