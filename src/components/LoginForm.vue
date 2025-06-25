<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <div class="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
          <svg class="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          暗号資産ポートフォリオ
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Google アカウントでログインしてください
        </p>
      </div>
      
      <!-- Google認証ボタン -->
      <div class="mt-8 space-y-6">
        <div>
          <button
            @click="handleGoogleAuth"
            :disabled="isLoading"
            class="group relative w-full flex justify-center items-center py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="isLoading" class="absolute left-0 inset-y-0 flex items-center pl-3">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
            </span>
            
            <!-- Google Icon -->
            <svg v-if="!isLoading" class="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            
            {{ isLoading ? '認証中...' : 'Google Drive と連携' }}
          </button>
        </div>

        <div v-if="error" class="text-sm text-red-600 dark:text-red-400 text-center whitespace-pre-line">
          {{ error }}
        </div>

        <div class="text-center">
          <button
            type="button"
            @click="showResetConfirm = true"
            class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            すべてのデータをリセット
          </button>
        </div>
      </div>
    </div>
    
    <!-- Reset Confirmation Modal -->
    <div v-if="showResetConfirm" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full">
          <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white text-center mb-2">
          データリセットの確認
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
          すべてのポートフォリオデータと設定が削除されます。Google Driveのバックアップファイルも削除されます。この操作は取り消せません。
        </p>
        <div class="flex space-x-3">
          <button
            @click="showResetConfirm = false"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            キャンセル
          </button>
          <button
            @click="handleReset"
            class="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            削除する
          </button>
        </div>
      </div>
    </div>

          <!-- Password Setup Modal -->
      <CloudPasswordSetup
        v-if="showPasswordSetup"
        @setupComplete="handlePasswordSetup"
        @close="handlePasswordSetupClose"
      />
  
      <!-- Password Prompt Modal -->
      <CloudPasswordPrompt
        v-if="showPasswordPrompt"
        @passwordProvided="handlePasswordAuth"
        @close="handlePasswordPromptClose"
        @forgotPassword="handleForgotPassword"
      />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { googleAuthService } from '@/services/google-auth.service'
import { authService } from '@/services/auth.service'
import CloudPasswordSetup from '@/components/CloudPasswordSetup.vue'
import CloudPasswordPrompt from '@/components/CloudPasswordPrompt.vue'
import { syncService } from '@/services/sync.service'
import { dbServiceV2, dbV2 } from '@/services/db-v2'

const emit = defineEmits<{
  loginSuccess: []
}>()

const isLoading = ref(false)
const error = ref('')
const showResetConfirm = ref(false)
const showPasswordSetup = ref(false)
const showPasswordPrompt = ref(false)

async function handleGoogleAuth() {
  if (isLoading.value) return
  
  error.value = ''
  isLoading.value = true
  
  try {
    // 統合認証フローを実行
    const userType = await googleAuthService.authenticateAndInitialize()
    
    if (userType === 'existing_user') {
      // 既存ユーザー: パスワード入力画面を表示
      showPasswordPrompt.value = true
    } else {
      // 新規ユーザー: パスワード設定画面を表示
      showPasswordSetup.value = true
    }
  } catch (err: any) {
    console.error('Google authentication failed:', err)
    error.value = googleAuthService.error.value || '認証に失敗しました'
  } finally {
    isLoading.value = false
  }
}

async function handlePasswordSetup(password: string) {
  try {
    isLoading.value = true
    error.value = ''

    // Enable sync for new user (without trying to read encrypted data)
    const syncResult = await syncService.enableSyncForNewUser(password)
    if (!syncResult.success) {
      throw new Error(syncResult.message)
    }

    // Initialize the app session with the password for new users
    await initializeAppSession(password, true)
    
    showPasswordSetup.value = false
    console.log('[DEBUG] Emitting loginSuccess from handlePasswordSetup')
    emit('loginSuccess')
  } catch (err) {
    console.error('Password setup failed:', err)
    error.value = err instanceof Error ? err.message : 'パスワードの設定に失敗しました'
  } finally {
    isLoading.value = false
  }
}

async function handlePasswordAuth(password: string) {
  try {
    isLoading.value = true
    error.value = ''

    // Test the cloud password
    const isValidPassword = await syncService.testCloudPassword(password)
    if (!isValidPassword) {
      throw new Error('パスワードが正しくありません')
    }

    // Initialize the app session with the password for existing users FIRST
    // This will unlock the storage before we try to sync
    await initializeAppSession(password, false)

    // Enable sync with the authenticated password AFTER storage is unlocked
    const syncResult = await syncService.enableSync(password)
    if (!syncResult.success) {
      // Check if this is a conflict error
      if (syncResult.message === '同期競合が検出されました' && syncResult.conflictData) {
        // Show conflict resolver instead of throwing error
        showPasswordPrompt.value = false
        // Store conflict data for potential future use
        console.log('[DEBUG] Sync conflict detected, conflict data:', syncResult.conflictData)
        // For now, we'll continue with the login and let the user handle the conflict later
        // The conflict will be available in the sync service status
      } else {
        throw new Error(syncResult.message)
      }
    }
    
    showPasswordPrompt.value = false
    console.log('[DEBUG] Emitting loginSuccess from handlePasswordAuth')
    emit('loginSuccess')
  } catch (err) {
    console.error('Password authentication failed:', err)
    error.value = err instanceof Error ? err.message : 'パスワードの認証に失敗しました'
  } finally {
    isLoading.value = false
  }
}

async function initializeAppSession(password?: string, isNewUser: boolean = false) {
  try {
    // Import required services
    const { useSessionStore } = await import('@/stores/session.store')
    const { secureStorage } = await import('@/services/storage.service')
    const { authService } = await import('@/services/auth.service')
    const { nextTick } = await import('vue')

    // Get the session store instance
    const sessionStore = useSessionStore()

    // Set up encryption key based on user type
    if (password && !secureStorage.isUnlocked()) {
      if (isNewUser) {
        console.log('Setting up encryption key for new user')
        const setupResult = await authService.setupPassword(password)
        if (!setupResult.success) {
          throw new Error(setupResult.error || 'パスワード設定に失敗しました')
        }
        console.log('[DEBUG] New user password setup completed, storage unlocked:', secureStorage.isUnlocked())
      } else {
        console.log('Unlocking storage for existing user')
        const unlockResult = await authService.unlockWithPassword(password)
        if (!unlockResult.success) {
          throw new Error(unlockResult.error || 'パスワードでのロック解除に失敗しました')
        }
        console.log('[DEBUG] Existing user unlock completed, storage unlocked:', secureStorage.isUnlocked())
      }
    } else if (secureStorage.isUnlocked()) {
      console.log('[DEBUG] Storage is already unlocked')
    } else {
      console.log('[DEBUG] No password provided or other condition not met')
    }

    // Start session with Google Drive authentication
    await sessionStore.login('google-drive')
    
    // Ensure secure storage is unlocked
    if (!secureStorage.isUnlocked()) {
      throw new Error('セキュアストレージのロックが解除されていません')
    }

    // For new users, ensure database is properly initialized
    if (isNewUser) {
      console.log('Initializing database for new user...')
      console.log('[DEBUG] Storage unlocked status before DB test:', secureStorage.isUnlocked())
      
      try {
        // Clear existing encrypted data for new user to prevent key conflicts
        console.log('[DEBUG] Clearing existing encrypted data for new user...')
        await secureStorage.clearAllDataForNewUser()
        console.log('[DEBUG] Existing data cleared successfully')
        
        // Test basic database connectivity
        console.log('[DEBUG] Testing basic database connectivity...')
        // Test database connectivity by accessing tables
        console.log('[DEBUG] Database opened successfully')
        
        // Check table counts
        const locationCount = await dbV2.locations.count()
        const holdingCount = await dbV2.holdings.count()
        console.log('[DEBUG] Database table counts - locations:', locationCount, 'holdings:', holdingCount)
        
        // Test data access with new encryption key
        const testHoldings = await secureStorage.getHoldings()
        console.log('[DEBUG] Successfully accessed holdings with new key, count:', testHoldings.length)
        
      } catch (error) {
        console.log('Database initialization failed:', error)
        console.log('Error name:', error.name)
        console.log('Error message:', error.message)
        console.log('Error stack:', error.stack)
        
        // Try to close and reopen database
        try {
          console.log('[DEBUG] Attempting to close and reopen database...')
          await dbV2.close()
          await dbV2.open()
          console.log('[DEBUG] Database reopened successfully')
          
          // Clear all data after reopening
          await secureStorage.clearAllDataForNewUser()
          const testHoldings = await secureStorage.getHoldings()
          console.log('[DEBUG] Data cleared and tested successfully')
          
        } catch (reopenError) {
          console.log('Database reopen failed:', reopenError)
          
          // Try clearing data as last resort
          try {
            await secureStorage.clearAllDataForNewUser()
            console.log('Database clear completed')
            const testHoldings = await secureStorage.getHoldings()
            console.log('[DEBUG] Clear completed successfully')
            
          } catch (clearError) {
            console.log('Database clear failed:', clearError)
          }
        }
      }
    }

    console.log('App session initialized successfully')
    console.log('[DEBUG] sessionStore.isAuthenticated after login:', sessionStore.isAuthenticated)
    console.log('[DEBUG] About to emit loginSuccess')
    
    // Ensure Vue reactivity system has processed the changes
    await nextTick()
  } catch (err) {
    console.error('Failed to initialize app session:', err)
    throw new Error('アプリセッションの初期化に失敗しました')
  }
}

function handlePasswordSetupClose() {
  showPasswordSetup.value = false
  error.value = ''
  // Allow user to retry Google authentication if needed
}

function handlePasswordPromptClose() {
  showPasswordPrompt.value = false
  error.value = ''
  // Allow user to retry Google authentication if needed
}

function handleForgotPassword() {
  showPasswordPrompt.value = false
  showPasswordSetup.value = true
  // Switch to password setup for resetting cloud password
}

async function handleReset() {
  try {
    // Google Driveのバックアップファイルを削除
    try {
      if (googleAuthService.isAuthenticated.value) {
        const { googleDriveApiService } = await import('@/services/google-drive-api.service')
        
        // 複数回試行してファイルを見つけて削除
        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries) {
          try {
            const backupFile = await googleDriveApiService.findBackupFile()
            if (backupFile) {
              console.log('Deleting Google Drive backup file:', backupFile.name, 'ID:', backupFile.id)
              await googleDriveApiService.deleteFile(backupFile.id)
              console.log('Google Drive backup file deleted successfully')
              break
            } else {
              console.log(`No Google Drive backup file found (attempt ${retryCount + 1}/${maxRetries})`)
              
              // ファイルが見つからない場合、アプリフォルダ内の全ファイルをチェック
              const allFiles = await googleDriveApiService.listFiles()
              console.log('All files in app folder:', allFiles.map(f => ({ name: f.name, id: f.id })))
              
              // JSONファイルを探して削除
              const jsonFiles = allFiles.filter(f => f.name.endsWith('.json'))
              if (jsonFiles.length > 0) {
                for (const file of jsonFiles) {
                  console.log('Deleting JSON file:', file.name, 'ID:', file.id)
                  await googleDriveApiService.deleteFile(file.id)
                  console.log('JSON file deleted successfully')
                }
                break
              } else {
                console.log('No JSON files found in app folder')
                break
              }
            }
          } catch (retryError) {
            console.warn(`Google Drive file deletion attempt ${retryCount + 1} failed:`, retryError)
            retryCount++
            if (retryCount >= maxRetries) {
              throw retryError
            }
            // 少し待ってからリトライ
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }
    } catch (error) {
      console.warn('Google Drive file deletion failed:', error)
      // Continue with local reset even if cloud deletion fails
    }
    
    // Google認証状態をクリア
    try {
      await googleAuthService.signOut()
    } catch (error) {
      console.warn('Google sign out failed:', error)
    }
    
    // ローカルストレージを完全クリア
    localStorage.clear()
    sessionStorage.clear()
    
    // IndexedDBを削除
    try {
      await deleteDatabase('CryptoPortfolioDB')
      await deleteDatabase('CryptoPortfolioDBV2')
    } catch (error) {
      console.warn('IndexedDB deletion failed:', error)
    }
    
    showResetConfirm.value = false
    error.value = ''
    
    console.log('Reset completed successfully')
    
    // ページをリロードして初期状態に戻す
    window.location.reload()
  } catch (error: any) {
    console.error('Reset failed:', error)
    error.value = 'リセットに失敗しました'
  }
}

function deleteDatabase(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deleteReq = indexedDB.deleteDatabase(dbName)
    deleteReq.onsuccess = () => resolve()
    deleteReq.onerror = () => reject(deleteReq.error)
    deleteReq.onblocked = () => {
      console.warn(`IndexedDB ${dbName} deletion blocked`)
      resolve() // Continue anyway
    }
  })
}
</script>