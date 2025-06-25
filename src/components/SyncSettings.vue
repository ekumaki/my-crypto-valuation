<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
    <!-- ヘッダー -->
    <div class="text-center">
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        同期設定
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Google Driveとの同期設定を管理します
      </p>
    </div>

    <!-- Google認証カード -->
    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
        <svg class="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google Drive連携
      </h4>
      
      <!-- Connection Status -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
          <div 
            :class="[
              'w-3 h-3 rounded-full',
              authStatus.isAuthenticated ? 'bg-green-500' : 'bg-gray-400'
            ]"
          ></div>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            接続状況
          </span>
        </div>
        <span 
          :class="[
            'text-sm font-semibold px-2 py-1 rounded-full',
            authStatus.isAuthenticated 
              ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' 
              : 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-600/30'
          ]"
        >
          {{ authStatus.isAuthenticated ? '接続済み' : '未接続' }}
        </span>
      </div>

      <div v-if="authStatus.isAuthenticated && authStatus.user" class="bg-white dark:bg-gray-600 rounded-md p-3 mb-4">
        <div class="flex items-center space-x-3">
          <img 
            v-if="authStatus.user.picture" 
            :src="authStatus.user.picture" 
            :alt="authStatus.user.name"
            class="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-500"
          >
          <div class="flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ authStatus.user.name }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ authStatus.user.email }}
            </p>
          </div>
          <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>

      <!-- Google Sign In -->
      <button
        v-if="!authStatus.isAuthenticated"
        @click="signInToGoogle"
        :disabled="authStatus.isLoading"
        class="w-full flex items-center justify-center space-x-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>{{ authStatus.isLoading ? '接続中...' : 'Googleでサインイン' }}</span>
      </button>
    </div>

    <!-- 自動同期カード -->
    <div v-if="authStatus.isAuthenticated" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
        <svg class="w-5 h-5 mr-2 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
        </svg>
        自動同期設定
      </h4>
      
      <!-- 同期状況表示 -->
      <div class="bg-white dark:bg-gray-600 rounded-md p-3 mb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div 
              :class="[
                'w-4 h-4 rounded-full',
                syncStatus.isEnabled ? 'bg-green-500' : 'bg-red-500'
              ]"
            ></div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              自動同期
            </span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              :checked="syncStatus.isEnabled"
              @change="handleSyncToggle"
              class="sr-only peer"
            >
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      <!-- 同期無効時の警告 -->
      <div v-if="!syncStatus.isEnabled" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3 mb-4">
        <div class="flex items-start space-x-2">
          <svg class="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div>
            <p class="text-sm font-medium text-red-800 dark:text-red-400">
              自動同期が無効です
            </p>
            <p class="text-xs text-red-700 dark:text-red-300">
              データの自動バックアップと同期が行われません
            </p>
          </div>
        </div>
      </div>

      <!-- Last Sync Info -->
      <div v-if="syncStatus.lastSyncTime && syncStatus.isEnabled" class="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">最終同期:</span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            {{ formatLastSyncTime(syncStatus.lastSyncTime) }}
          </span>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="syncStatus.lastSyncError && syncStatus.isEnabled" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
        <div class="flex items-start space-x-2">
          <svg class="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div>
            <p class="text-sm font-medium text-red-800 dark:text-red-400">
              同期エラー
            </p>
            <p class="text-sm text-red-700 dark:text-red-300">
              {{ syncStatus.lastSyncError }}
            </p>
          </div>
        </div>
      </div>

    </div>

    <!-- 手動同期カード -->
    <div v-if="authStatus.isAuthenticated" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
        <svg class="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
        </svg>
        手動同期
      </h4>
      
      <button
        @click="performManualSync"
        :disabled="syncStatus.isSyncing || !authStatus.isAuthenticated"
        :class="[
          'w-full font-medium py-3 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
          authStatus.isAuthenticated && !syncStatus.isSyncing
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 disabled:bg-indigo-400' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        ]"
      >
        {{ syncStatus.isSyncing ? '同期中...' : '今すぐ同期' }}
      </button>
      
      <p v-if="!authStatus.isAuthenticated" class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        手動同期にはGoogle認証が必要です
      </p>
      <p v-else-if="!syncStatus.isEnabled" class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        自動同期は無効ですが、手動同期は利用可能です
      </p>
    </div>

    <!-- セキュリティカード -->
    <div v-if="authStatus.isAuthenticated" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
        <svg class="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
        </svg>
        セキュリティ
      </h4>
      
      <button
        @click="showPasswordChange = true"
        :disabled="!syncStatus.isEnabled"
        :class="[
          'w-full font-medium py-3 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
          syncStatus.isEnabled 
            ? 'bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        ]"
      >
        パスワード変更
      </button>
      
      <p v-if="!syncStatus.isEnabled" class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        パスワード変更には自動同期が必要です
      </p>
    </div>



    <!-- Conflict Alert -->
    <div v-if="syncStatus.conflictDetected" class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
      <div class="flex items-start space-x-2">
        <svg class="w-5 h-5 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div>
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-400">
            同期競合が検出されました
          </p>
          <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
            ローカルデータとクラウドデータに違いがあります
          </p>
          <button
            @click="showConflictResolver = true"
            class="text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded transition-colors"
          >
            競合を解決
          </button>
        </div>
      </div>
    </div>

    <!-- Password Change Modal -->
    <CloudPasswordChange
      v-if="showPasswordChange"
      @close="showPasswordChange = false"
      @success="handlePasswordChangeSuccess"
    />

    <!-- Cloud Password Setup Modal (for enabling sync) -->
    <CloudPasswordSetup
      v-if="showPasswordSetup"
      @close="showPasswordSetup = false"
      @password-set="handlePasswordSetup"
    />

    <!-- Cloud Password Prompt Modal (for existing users) -->
    <CloudPasswordPrompt
      v-if="showPasswordPrompt"
      @close="showPasswordPrompt = false"
      @password-provided="handlePasswordProvided"
    />

    <!-- Conflict Resolver Modal -->
    <ConflictResolver
      v-if="showConflictResolver"
      :conflict-data="conflictData"
      @close="showConflictResolver = false"
      @resolved="handleConflictResolved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { googleAuthService } from '@/services/google-auth.service'
import { syncService } from '@/services/sync.service'
import { errorHandlerService } from '@/services/error-handler.service'
import CloudPasswordChange from '@/components/CloudPasswordChange.vue'
import CloudPasswordSetup from '@/components/CloudPasswordSetup.vue'
import CloudPasswordPrompt from '@/components/CloudPasswordPrompt.vue'
import ConflictResolver from '@/components/ConflictResolver.vue'
import { useTokensStore } from '@/stores/useTokens'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import { useLocationsStore } from '@/stores/useLocations'

// Reactive refs
const showPasswordChange = ref(false)
const showPasswordSetup = ref(false)
const showPasswordPrompt = ref(false)
const showConflictResolver = ref(false)
const conflictData = ref<any>(null)
const passwordPromptPurpose = ref<'enable_sync' | 'manual_sync'>('enable_sync')

// Store instances for refreshing after sync
const tokensStore = useTokensStore()
const holdingsStore = useHoldingsStoreV2()
const locationsStore = useLocationsStore()

// Computed reactive states
const authStatus = computed(() => ({
  isAuthenticated: googleAuthService.isAuthenticated.value,
  isLoading: googleAuthService.isLoading.value,
  user: googleAuthService.user.value,
  error: googleAuthService.error.value
}))

const syncStatus = computed(() => syncService.status.value)

// Methods
async function signInToGoogle() {
  try {
    await googleAuthService.signIn()
  } catch (error) {
    errorHandlerService.handleError(error, 'Google Sign In', 'error')
  }
}

async function handleSyncToggle() {
  if (syncStatus.value.isEnabled) {
    // 同期を無効にする
    try {
      await syncService.disableSync()
    } catch (error) {
      errorHandlerService.handleError(error, 'Disable Sync', 'error')
    }
  } else {
    // 同期を有効にする
    await enableAutoSync()
  }
}

async function enableAutoSync() {
  try {
    console.log('enableAutoSync called')
    console.log('Current cloudFileExists:', syncStatus.value.cloudFileExists)
    
    // Force check for cloud file existence
    await syncService.checkCloudFileExists()
    
    const cloudFileExists = syncStatus.value.cloudFileExists
    console.log('After force check, cloudFileExists:', cloudFileExists)
    
    if (cloudFileExists) {
      console.log('Cloud file exists - showing password prompt for sync enable')
      passwordPromptPurpose.value = 'enable_sync'
      showPasswordPrompt.value = true
    } else {
      console.log('No cloud file - showing password setup')
      showPasswordSetup.value = true
    }
  } catch (error) {
    console.error('Enable sync check error:', error)
    errorHandlerService.handleError(error, 'Enable Sync Check', 'error')
  }
}

async function handlePasswordSetup(password: string) {
  showPasswordSetup.value = false
  
  try {
    console.log('Enabling sync with password...')
    const result = await syncService.enableSync(password)
    console.log('Enable sync result:', result)
    
    if (!result.success) {
      console.error('Enable sync failed:', result.message)
      if (result.conflictData) {
        conflictData.value = result.conflictData
        showConflictResolver.value = true
      } else {
        errorHandlerService.handleError(new Error(result.message), 'Enable Sync', 'error')
      }
    } else {
      console.log('Sync enabled successfully')
      await refreshStores()
      console.log('Enable sync completed and stores refreshed')
    }
  } catch (error) {
    console.error('Enable sync error:', error)
    errorHandlerService.handleError(error, 'Enable Sync', 'error')
  }
}

async function handlePasswordProvided(password: string) {
  showPasswordPrompt.value = false
  
  try {
    console.log('Testing cloud password for existing data...', 'Purpose:', passwordPromptPurpose.value)
    
    if (passwordPromptPurpose.value === 'enable_sync') {
      // 自動同期を有効にする場合
      const result = await syncService.enableSync(password)
      console.log('Enable sync result:', result)
      
      if (!result.success) {
        console.error('Enable sync failed:', result.message)
        if (result.conflictData) {
          conflictData.value = result.conflictData
          showConflictResolver.value = true
        } else {
          errorHandlerService.handleError(new Error(result.message), 'Enable Sync', 'error')
        }
      } else {
        console.log('Sync enabled successfully from existing cloud data')
        await refreshStores()
        console.log('Enable sync completed and stores refreshed')
      }
    } else {
      // 手動同期の場合 - 自動同期は有効にしない
      syncService.setCloudPassword(password)
      
      // For manual sync, also ensure local encryption key is set
      const { authService } = await import('@/services/auth.service')
      const { secureStorage } = await import('@/services/storage.service')
      
      // Check if encryption is unlocked, if not unlock with the password
      if (!secureStorage.isUnlocked()) {
        const unlockResult = await authService.unlockWithPassword(password)
        if (!unlockResult.success) {
          // If unlock fails, clear incompatible data and setup new key
          await secureStorage.clearIncompatibleEncryptedData()
          const setupResult = await authService.setupPassword(password)
          if (!setupResult.success) {
            errorHandlerService.handleError(new Error('暗号化キーの設定に失敗しました'), 'Manual Sync Setup', 'error')
            return
          }
        }
      }
      
      const result = await syncService.performSync()
      if (!result.success) {
        if (result.conflictData) {
          conflictData.value = result.conflictData
          showConflictResolver.value = true
        } else {
          errorHandlerService.handleError(new Error(result.message), 'Manual Sync', 'error')
        }
      } else {
        await refreshStores()
        console.log('Manual sync completed and stores refreshed')
        
        // 重要: 手動同期後は自動同期を有効にしない
        // 自動同期が有効な場合のみタイマーをリセット
        if (syncStatus.value.isEnabled) {
          console.log('Resetting auto-sync timer after manual sync')
          await syncService.resetAutoSyncTimer()
        }
      }
    }
  } catch (error) {
    console.error('Password provided error:', error)
    errorHandlerService.handleError(error, 'Sync Operation', 'error')
  }
}

async function performManualSync() {
  try {
    // Google認証が必要
    if (!authStatus.value.isAuthenticated) {
      errorHandlerService.handleError(new Error('Google認証が必要です'), 'Manual Sync', 'error')
      return
    }

    // 手動同期は自動同期の状態に関係なく実行可能
    // ただし、クラウドパスワードが必要
    if (!syncService.hasCloudPassword.value) {
      // Force check for cloud file existence
      await syncService.checkCloudFileExists()
      
      // クラウドパスワードが設定されていない場合
      if (syncStatus.value.cloudFileExists) {
        passwordPromptPurpose.value = 'manual_sync'
        showPasswordPrompt.value = true
        return
      } else {
        showPasswordSetup.value = true
        return
      }
    }

    const result = await syncService.performSync()
    if (!result.success) {
      if (result.conflictData) {
        conflictData.value = result.conflictData
        showConflictResolver.value = true
      } else {
        errorHandlerService.handleError(new Error(result.message), 'Manual Sync', 'error')
      }
    } else {
      await refreshStores()
      console.log('Manual sync completed and stores refreshed')
      
      // 自動同期が有効な場合、タイマーをリセット/再開
      if (syncStatus.value.isEnabled) {
        console.log('Resetting auto-sync timer after manual sync')
        await syncService.resetAutoSyncTimer()
      }
    }
  } catch (error) {
    errorHandlerService.handleError(error, 'Manual Sync', 'error')
  }
}



async function handlePasswordChangeSuccess() {
  showPasswordChange.value = false
  // Refresh stores after password change
  await refreshStores()
}

async function handleConflictResolved() {
  showConflictResolver.value = false
  conflictData.value = null
  await refreshStores()
}

async function refreshStores() {
  await Promise.all([
    tokensStore.loadTokens(),
    holdingsStore.loadHoldings(),
    holdingsStore.loadAggregatedHoldings(),
    locationsStore.loadLocations()
  ])
}

function formatLastSyncTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  
  if (diffMinutes < 1) {
    return 'たった今'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分前`
  } else if (diffMinutes < 1440) {
    return `${Math.floor(diffMinutes / 60)}時間前`
  } else {
    return date.toLocaleString('ja-JP')
  }
}

onMounted(async () => {
  // Initialize services will be handled by their constructors
})
</script> 