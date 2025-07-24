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
        {{ syncStatus.isSyncing ? '同期中...' : `今すぐ同期${unsyncedDataCount.total > 0 ? ` (${unsyncedDataCount.total})` : ''}` }}
      </button>
      
      <!-- Unsynced data details -->
      <div v-if="unsyncedDataCount.total > 0" class="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
        未同期: 
        <span v-if="unsyncedDataCount.holdings > 0">保有数量 {{ unsyncedDataCount.holdings }}件</span>
        <span v-if="unsyncedDataCount.holdings > 0 && (unsyncedDataCount.locations > 0 || unsyncedDataCount.tokens > 0)">, </span>
        <span v-if="unsyncedDataCount.locations > 0">場所 {{ unsyncedDataCount.locations }}件</span>
        <span v-if="unsyncedDataCount.locations > 0 && unsyncedDataCount.tokens > 0">, </span>
        <span v-if="unsyncedDataCount.tokens > 0">銘柄 {{ unsyncedDataCount.tokens }}件</span>
      </div>
      
      <p v-if="!authStatus.isAuthenticated" class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        手動同期にはGoogle認証が必要です
      </p>
      <p v-else-if="!syncStatus.isEnabled" class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        自動同期は無効ですが、手動同期は利用可能です
      </p>
    </div>

    <!-- 未同期データ管理カード -->
    <div v-if="authStatus.isAuthenticated && unsyncedDataCount.total > 0" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
        <svg class="w-5 h-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd" />
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L9 11.414l2.293 2.293a1 1 0 001.414-1.414L10.414 10l2.293-2.293z" clip-rule="evenodd" />
        </svg>
        未同期データ管理
      </h4>
      
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3 mb-4">
        <div class="flex items-start space-x-2">
          <svg class="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div>
            <p class="text-sm font-medium text-red-800 dark:text-red-400">
              未同期データが {{ unsyncedDataCount.total }}件 あります
            </p>
            <p class="text-xs text-red-700 dark:text-red-300">
              これらのデータはクラウドに保存されていません。一括削除すると復元できません。
            </p>
          </div>
        </div>
      </div>

      <button
        @click="showDeleteConfirmModal = true"
        :disabled="isDeletingUnsyncedData"
        class="w-full font-medium py-3 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 disabled:bg-red-400 disabled:cursor-not-allowed"
      >
        <div class="flex items-center justify-center space-x-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd" />
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L9 11.414l2.293 2.293a1 1 0 001.414-1.414L10.414 10l2.293-2.293z" clip-rule="evenodd" />
          </svg>
          <span>{{ isDeletingUnsyncedData ? '削除中...' : '未同期データを一括削除' }}</span>
        </div>
      </button>
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





    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirmModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center mb-4">
          <svg class="w-6 h-6 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            未同期データの一括削除
          </h3>
        </div>
        
        <div class="mb-6">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
            以下の未同期データをすべて削除します：
          </p>
          <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li v-if="unsyncedDataCount.holdings > 0" class="flex items-center">
              <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              保有数量: {{ unsyncedDataCount.holdings }}件
            </li>
            <li v-if="unsyncedDataCount.locations > 0" class="flex items-center">
              <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              保管場所: {{ unsyncedDataCount.locations }}件
            </li>
            <li v-if="unsyncedDataCount.tokens > 0" class="flex items-center">
              <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              トークン: {{ unsyncedDataCount.tokens }}件
            </li>
          </ul>
          <p class="text-sm text-red-600 dark:text-red-400 mt-3 font-medium">
            ⚠️ この操作は取り消せません。削除されたデータは復元できません。
          </p>
        </div>
        
        <div class="flex space-x-3">
          <button
            @click="showDeleteConfirmModal = false"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            キャンセル
          </button>
          <button
            @click="handleDeleteUnsyncedData"
            :disabled="isDeletingUnsyncedData"
            class="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-red-400 disabled:cursor-not-allowed"
          >
            {{ isDeletingUnsyncedData ? '削除中...' : '削除する' }}
          </button>
        </div>
      </div>
    </div>

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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { googleAuthService } from '@/services/google-auth.service'
import { syncService } from '@/services/sync.service'
import { errorHandlerService } from '@/services/error-handler.service'


import ConflictResolver from '@/components/ConflictResolver.vue'
import { useTokensStore } from '@/stores/useTokens'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import { useLocationsStore } from '@/stores/useLocations'

// Reactive refs
const showConflictResolver = ref(false)
const conflictData = ref<any>(null)
const unsyncedDataCount = ref<any>({ holdings: 0, locations: 0, tokens: 0, total: 0 })
const showDeleteConfirmModal = ref(false)
const isDeletingUnsyncedData = ref(false)

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
    // 同期を有効にする（パスワード不要）
    await enableAutoSync()
  }
}

async function enableAutoSync() {
  try {
    console.log('enableAutoSync called')
    
    // Google認証チェック
    if (!authStatus.value.isAuthenticated) {
      errorHandlerService.handleError(new Error('Google認証が必要です'), 'Enable Sync', 'error')
      return
    }
    
    // クラウドファイルの存在確認
    await syncService.checkCloudFileExists()
    const cloudFileExists = syncStatus.value.cloudFileExists
    console.log('Cloud file exists:', cloudFileExists)
    
    let result
    if (cloudFileExists) {
      // 既存ユーザー
      result = await syncService.enableSync()
    } else {
      // 新規ユーザー
      result = await syncService.enableSyncForNewUser()
    }
    
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
    }
  } catch (error) {
    console.error('Enable sync error:', error)
    errorHandlerService.handleError(error, 'Enable Sync', 'error')
  }
}



async function performManualSync() {
  try {
    // Google認証が必要
    if (!authStatus.value.isAuthenticated) {
      errorHandlerService.handleError(new Error('Google認証が必要です'), 'Manual Sync', 'error')
      return
    }

    // 手動同期を実行（パスワード不要）
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
      
      // 自動同期が有効な場合のみタイマーをリセット
      if (syncStatus.value.isEnabled) {
        console.log('Resetting auto-sync timer after manual sync')
        await syncService.resetAutoSyncTimer()
      }
    }
  } catch (error) {
    console.error('Manual sync error:', error)
    errorHandlerService.handleError(error, 'Manual Sync', 'error')
  }
}






async function handleDeleteUnsyncedData() {
  try {
    isDeletingUnsyncedData.value = true
    console.log('[DEBUG] SyncSettings.handleDeleteUnsyncedData - starting bulk delete')
    
    // メタデータサービスから未同期データの詳細を取得
    const { metadataService } = await import('@/services/metadata.service')
    const unsyncedDetails = await metadataService.getUnsyncedDataDetails(syncStatus.value.isEnabled)
    
    console.log('[DEBUG] SyncSettings.handleDeleteUnsyncedData - found unsynced items:', unsyncedDetails.length)
    
    if (unsyncedDetails.length === 0) {
      console.log('[DEBUG] SyncSettings.handleDeleteUnsyncedData - no unsynced data found')
      showDeleteConfirmModal.value = false
      return
    }
    
    // データベースから未同期データを削除
    const { dbV2 } = await import('@/services/db-v2')
    
    let deletedCount = 0
    
    for (const item of unsyncedDetails) {
      try {
        console.log('[DEBUG] SyncSettings.handleDeleteUnsyncedData - deleting:', item.type, item.id)
        
        switch (item.type) {
          case 'holding':
            await dbV2.holdings.delete(item.id)
            break
          case 'location':
            // プリセット以外のカスタム場所のみ削除
            const location = await dbV2.locations.get(item.id)
            if (location && location.isCustom) {
              await dbV2.locations.delete(item.id)
            }
            break
          case 'token':
            // プリセット以外のカスタムトークンのみ削除
            const presetTokenSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'SHIB', 'MATIC', 'LTC', 'ATOM', 'LINK', 'UNI']
            if (!presetTokenSymbols.includes(item.id)) {
              await dbV2.tokens.delete(item.id)
            }
            break
        }
        
        deletedCount++
      } catch (error) {
        console.error('[DEBUG] SyncSettings.handleDeleteUnsyncedData - failed to delete item:', item, error)
      }
    }
    
    // メタデータキャッシュをクリア
    metadataService.clearMetadataCache()
    
    // ストアを更新
    await refreshStores()
    
    console.log('[DEBUG] SyncSettings.handleDeleteUnsyncedData - completed, deleted:', deletedCount, 'items')
    
    // 成功メッセージを表示
    if (window.showToast) {
      window.showToast.success('削除完了', `${deletedCount}件の未同期データを削除しました`)
    }
    
    showDeleteConfirmModal.value = false
  } catch (error) {
    console.error('[DEBUG] SyncSettings.handleDeleteUnsyncedData - error:', error)
    
    if (window.showToast) {
      window.showToast.error('削除エラー', '未同期データの削除中にエラーが発生しました')
    }
  } finally {
    isDeletingUnsyncedData.value = false
  }
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
  
  // Update unsynced data count after refresh
  await updateUnsyncedDataCount()
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

async function updateUnsyncedDataCount() {
  try {
    console.log('[DEBUG] SyncSettings.updateUnsyncedDataCount - starting update, sync enabled:', syncStatus.value.isEnabled)
    const { metadataService } = await import('@/services/metadata.service')
    unsyncedDataCount.value = await metadataService.getUnsyncedDataCount(syncStatus.value.isEnabled)
    console.log('[DEBUG] SyncSettings.updateUnsyncedDataCount - updated count:', unsyncedDataCount.value)
  } catch (error) {
    console.warn('Failed to update unsynced data count:', error)
  }
}

// Exposed method for external components to trigger update
function refreshUnsyncedCount() {
  updateUnsyncedDataCount()
}

onMounted(async () => {
  // Initialize services will be handled by their constructors
  await updateUnsyncedDataCount()
  
  // Update unsynced data count every 5 seconds
  const interval = setInterval(updateUnsyncedDataCount, 5000)
  
  // Listen for sync completion events to immediately update count
  syncService.onSyncComplete(updateUnsyncedDataCount)
  syncService.onConflictResolved(updateUnsyncedDataCount)
  
  // Cleanup on unmount
  onUnmounted(() => {
    clearInterval(interval)
    syncService.offSyncComplete(updateUnsyncedDataCount)
    syncService.offConflictResolved(updateUnsyncedDataCount)
  })
})
</script> 