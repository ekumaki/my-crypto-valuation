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
            
            {{ isLoading ? '認証中...' : 'Googleでログイン' }}
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { googleAuthService } from '@/services/google-auth.service'
import { authService } from '@/services/auth.service'
import { syncService } from '@/services/sync'

const emit = defineEmits<{
  loginSuccess: []
}>()

const isLoading = ref(false)
const error = ref('')
const showResetConfirm = ref(false)

async function handleGoogleAuth() {
  if (isLoading.value) return
  
  error.value = ''
  isLoading.value = true
  
  try {
    // Google認証を実行
    const userType = await googleAuthService.authenticateAndInitialize()
    
    // Google認証情報から暗号化キーを設定
    const setupResult = await authService.setupEncryptionFromGoogleAuth()
    if (!setupResult.success) {
      throw new Error(setupResult.error || '暗号化キーの設定に失敗しました')
    }

    // セッションストアを手動で更新
    const { useSessionStore } = await import('@/stores/session.store')
    const sessionStore = useSessionStore()
    await sessionStore.login('google')
    console.log('[DEBUG] Session started, isAuthenticated:', sessionStore.isAuthenticated)

    // 同期を有効化
    let syncResult
    if (userType === 'existing_user') {
      syncResult = await syncService.enableSync()
    } else {
      syncResult = await syncService.enableSyncForNewUser()
    }
    
    if (!syncResult.success) {
      console.warn('Sync enablement failed:', syncResult.message)
      // 同期失敗でもログインは継続
    }

    // ログイン成功
    console.log('[DEBUG] Emitting loginSuccess from handleGoogleAuth')
    emit('loginSuccess')
  } catch (err: any) {
    console.error('Google authentication failed:', err)
    error.value = err.message || googleAuthService.error.value || '認証に失敗しました'
  } finally {
    isLoading.value = false
  }
}


async function handleReset() {
  try {
    console.log('[RESET] Starting reset process...')
    
    // Google Driveのバックアップファイルを削除
    try {
      console.log('[RESET] Google auth status:', googleAuthService.isAuthenticated.value)
      
      if (googleAuthService.isAuthenticated.value) {
        const { googleDriveApiService } = await import('@/services/google-drive-api.service')
        console.log('[RESET] Google Drive API service imported')
        
        // バックアップファイルを削除
        const backupFile = await googleDriveApiService.findBackupFile()
        if (backupFile) {
          console.log('[RESET] Found backup file:', backupFile.name, 'ID:', backupFile.id)
          await googleDriveApiService.deleteFile(backupFile.id)
          console.log('[RESET] Backup file deleted successfully')
        } else {
          console.log('[RESET] No backup file found')
        }
      } else {
        console.log('[RESET] Not authenticated with Google, skipping Google Drive cleanup')
      }
    } catch (error) {
      console.warn('[RESET] Failed to delete Google Drive files:', error)
      // Continue with local cleanup even if Google Drive cleanup fails
    }
    
    // 同期サービスを無効化
    try {
      await syncService.disableSync()
      console.log('[RESET] Sync service disabled')
    } catch (error) {
      console.warn('[RESET] Failed to disable sync service:', error)
    }
    
    // Google認証をクリア
    try {
      await googleAuthService.signOut()
      console.log('[RESET] Google authentication cleared')
    } catch (error) {
      console.warn('[RESET] Failed to clear Google authentication:', error)
    }
    
    // 全データをクリア
    try {
      await authService.resetAndClearData()
      console.log('[RESET] All local data cleared')
    } catch (error) {
      console.warn('[RESET] Failed to clear some data:', error)
      // Continue anyway - the force reset should have handled most cases
    }
    
    // モーダルを閉じる
    showResetConfirm.value = false
    
    // ページをリロード
    window.location.reload()
  } catch (error) {
    console.error('[RESET] Reset failed:', error)
    error.value = 'リセットに失敗しました: ' + (error instanceof Error ? error.message : 'Unknown error')
    showResetConfirm.value = false
  }
}
</script>