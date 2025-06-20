<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        Google Drive同期
      </h3>
      <div class="flex items-center space-x-2">
        <div 
          v-if="syncStatus.isEnabled"
          class="flex items-center space-x-2"
        >
          <div 
            :class="[
              'w-2 h-2 rounded-full',
              syncStatus.isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
            ]"
          ></div>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ syncStatus.isSyncing ? '同期中...' : '同期有効' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="mb-6">
      <div class="flex items-center space-x-3 mb-3">
        <div class="flex items-center space-x-2">
          <svg 
            :class="[
              'w-5 h-5',
              authStatus.isAuthenticated ? 'text-green-500' : 'text-gray-400'
            ]" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            Google認証
          </span>
        </div>
        <span 
          :class="[
            'text-sm',
            authStatus.isAuthenticated ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
          ]"
        >
          {{ authStatus.isAuthenticated ? '接続済み' : '未接続' }}
        </span>
      </div>

      <div v-if="authStatus.isAuthenticated && authStatus.user" class="flex items-center space-x-3 mb-3">
        <img 
          v-if="authStatus.user.picture" 
          :src="authStatus.user.picture" 
          :alt="authStatus.user.name"
          class="w-6 h-6 rounded-full"
        >
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ authStatus.user.name }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ authStatus.user.email }}
          </p>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <svg 
            :class="[
              'w-5 h-5',
              syncStatus.isEnabled ? 'text-green-500' : 'text-gray-400'
            ]" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            クラウド同期
          </span>
        </div>
        <span 
          :class="[
            'text-sm',
            syncStatus.isEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
          ]"
        >
          {{ syncStatus.isEnabled ? '有効' : '無効' }}
        </span>
      </div>
    </div>

    <!-- Last Sync Info -->
    <div v-if="syncStatus.lastSyncTime" class="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600 dark:text-gray-400">最終同期:</span>
        <span class="text-sm font-medium text-gray-900 dark:text-white">
          {{ formatLastSyncTime(syncStatus.lastSyncTime) }}
        </span>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="syncStatus.lastSyncError" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
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

    <!-- Action Buttons -->
    <div class="space-y-3">
      <!-- Debug Info -->
      <div class="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-xs">
        <p>Debug: isAuthenticated = {{ authStatus.isAuthenticated }}</p>
        <p>Debug: isLoading = {{ authStatus.isLoading }}</p>
        <p>Debug: Client ID = {{ clientId ? 'Set' : 'Not Set' }}</p>
        <p>Debug: isInitialized = {{ googleAuthService.isInitialized.value }}</p>
        <p>Debug: Error = {{ authStatus.error || 'None' }}</p>
        <p>Debug: Sync Enabled = {{ syncStatus.isEnabled }}</p>
        <p>Debug: Cloud File Exists = {{ syncStatus.cloudFileExists }}</p>
        <p>Debug: Sync State = {{ JSON.stringify(syncStatus) }}</p>
      </div>

      <!-- Google Sign In -->
      <button
        v-if="!authStatus.isAuthenticated"
        @click="signInToGoogle"
        :disabled="authStatus.isLoading"
        class="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>{{ authStatus.isLoading ? '接続中...' : 'Googleでサインイン' }}</span>
      </button>

      <!-- Enable Sync -->
      <button
        v-if="authStatus.isAuthenticated && !syncStatus.isEnabled"
        @click="handleEnableSyncClick"
        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        クラウド同期を有効にする
      </button>

      <!-- Sync Actions -->
      <div v-if="authStatus.isAuthenticated && syncStatus.isEnabled" class="flex space-x-3">
        <button
          @click="performManualSync"
          :disabled="syncStatus.isSyncing"
          class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed"
        >
          {{ syncStatus.isSyncing ? '同期中...' : '今すぐ同期' }}
        </button>
        <button
          @click="disableSync"
          class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          同期を無効にする
        </button>
      </div>

      <!-- Sign Out -->
      <button
        v-if="authStatus.isAuthenticated"
        @click="signOutFromGoogle"
        class="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        Googleサインアウト
      </button>
    </div>

    <!-- Password Setup Modal -->
    <CloudPasswordSetup
      v-if="showPasswordSetup"
      @close="showPasswordSetup = false"
      @setup-complete="handlePasswordSetup"
    />

    <!-- Password Prompt Modal -->
    <CloudPasswordPrompt
      v-if="showPasswordPrompt"
      @close="showPasswordPrompt = false"
      @password-provided="handlePasswordProvided"
    />

    <!-- Conflict Resolver Modal -->
    <ConflictResolver
      v-if="showConflictResolver && conflictData"
      :conflict-data="conflictData"
      @close="showConflictResolver = false"
      @conflict-resolved="handleConflictResolved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { googleAuthService } from '@/services/google-auth.service'
import { syncService, type SyncConflict } from '@/services/sync.service'
import { errorHandlerService } from '@/services/error-handler.service'
import { useTokensStore } from '@/stores/useTokens'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import { useLocationsStore } from '@/stores/useLocations'
import CloudPasswordSetup from './CloudPasswordSetup.vue'
import CloudPasswordPrompt from './CloudPasswordPrompt.vue'
import ConflictResolver from './ConflictResolver.vue'

const showPasswordSetup = ref(false)
const showPasswordPrompt = ref(false)
const showConflictResolver = ref(false)
const conflictData = ref<SyncConflict | null>(null)

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

// Environment variables
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Debug logging
onMounted(async () => {
  console.log('GoogleDriveConnection mounted')
  console.log('Auth status:', authStatus.value)
  console.log('Sync status:', syncStatus.value)
  console.log('Client ID:', clientId)
  
  // Force Google Auth initialization
  console.log('Force initializing Google Auth...')
  await googleAuthService.forceInitialize()
  console.log('Google Auth initialized:', googleAuthService.isInitialized.value)
})

// Methods
async function signInToGoogle() {
  try {
    await googleAuthService.signIn()
  } catch (error) {
    errorHandlerService.handleError(error, 'Google Sign In', 'error')
  }
}

async function handleEnableSyncClick() {
  try {
    console.log('handleEnableSyncClick called')
    console.log('Current cloudFileExists:', syncStatus.value.cloudFileExists)
    
    // Force check for cloud file existence
    await syncService.checkCloudFileExists()
    
    const cloudFileExists = syncStatus.value.cloudFileExists
    console.log('After force check, cloudFileExists:', cloudFileExists)
    
    if (cloudFileExists) {
      console.log('Cloud file exists - showing password prompt')
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

async function signOutFromGoogle() {
  try {
    await syncService.disableSync()
    await googleAuthService.signOut()
  } catch (error) {
    errorHandlerService.handleError(error, 'Google Sign Out', 'error')
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
      // Refresh all stores after successful sync enable to update UI
      await Promise.all([
        tokensStore.loadTokens(),
        holdingsStore.loadHoldings(),
        holdingsStore.loadAggregatedHoldings(),
        locationsStore.loadLocations()
      ])
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
    console.log('Testing cloud password for existing data...')
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
      // Refresh all stores after successful sync enable to update UI
      await Promise.all([
        tokensStore.loadTokens(),
        holdingsStore.loadHoldings(),
        holdingsStore.loadAggregatedHoldings(),
        locationsStore.loadLocations()
      ])
      console.log('Enable sync completed and stores refreshed')
    }
  } catch (error) {
    console.error('Enable sync error:', error)
    errorHandlerService.handleError(error, 'Enable Sync', 'error')
  }
}

async function performManualSync() {
  try {
    const result = await syncService.performSync()
    if (!result.success) {
      if (result.conflictData) {
        conflictData.value = result.conflictData
        showConflictResolver.value = true
      } else {
        errorHandlerService.handleError(new Error(result.message), 'Manual Sync', 'error')
      }
    } else {
      // Refresh all stores after successful sync to update UI
      await Promise.all([
        tokensStore.loadTokens(),
        holdingsStore.loadHoldings(),
        holdingsStore.loadAggregatedHoldings(),
        locationsStore.loadLocations()
      ])
      console.log('Manual sync completed and stores refreshed')
    }
  } catch (error) {
    errorHandlerService.handleError(error, 'Manual Sync', 'error')
  }
}

async function disableSync() {
  try {
    await syncService.disableSync()
  } catch (error) {
    errorHandlerService.handleError(error, 'Disable Sync', 'error')
  }
}

async function handleConflictResolved() {
  showConflictResolver.value = false
  conflictData.value = null
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

onUnmounted(() => {
  // Cleanup if needed
})
</script>