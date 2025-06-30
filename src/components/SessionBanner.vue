<template>
  <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-12">
        <div class="flex items-center">
          <div class="flex items-center space-x-2">
            <svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm text-gray-600 dark:text-gray-400">
              認証済み
            </span>
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          <!-- Cloud Sync Status -->
          <div class="flex items-center space-x-2">
            <div 
              :class="[
                'w-2 h-2 rounded-full',
                !syncStatus.isEnabled ? 'bg-red-500' :
                syncStatus.isSyncing ? 'bg-yellow-500 animate-pulse' : 
                syncStatus.lastSyncError ? 'bg-red-500' : 'bg-green-500'
              ]"
            ></div>
            <span class="text-sm text-gray-600 dark:text-gray-400">
              <template v-if="!syncStatus.isEnabled">
                自動同期が無効です
                <span v-if="syncStatus.lastSyncTime" class="ml-1">
                  (最終同期: {{ formatSyncTime(syncStatus.lastSyncTime) }})
                </span>
              </template>
              <template v-else-if="syncStatus.isSyncing">
                同期中
              </template>
              <template v-else-if="syncStatus.lastSyncError">
                同期エラー: {{ syncStatus.lastSyncError }}
                <span v-if="syncStatus.lastSyncTime" class="ml-1">
                  (最終同期: {{ formatSyncTime(syncStatus.lastSyncTime) }})
                </span>
              </template>
              <template v-else-if="syncStatus.lastSyncTime">
                同期済み ({{ formatSyncTime(syncStatus.lastSyncTime) }})
              </template>
              <template v-else>
                同期準備完了
              </template>
            </span>
          </div>
          
          <div class="text-sm text-gray-600 dark:text-gray-400">
            残り時間: {{ remainingDisplay }}
          </div>
          
          <div class="relative" ref="dropdownRef">
            <button
              @click="showDropdown = !showDropdown"
              class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex items-center space-x-1"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
              </svg>
              <span>設定</span>
            </button>
            
            <div v-if="showDropdown" class="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div class="py-1">
                <button
                  @click="openSyncSettings"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  同期設定
                </button>
                <button
                  @click="openPasswordChange"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  パスワード変更
                </button>
                <button
                  @click="logout"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Logout Confirmation Modal -->
    <LogoutConfirmModal
      v-if="showLogoutModal"
      :unsynced-count="unsyncedCount"
      :is-syncing="syncStatus.isSyncing"
      @close="showLogoutModal = false"
      @confirm="confirmLogout"
      @confirm-discard="confirmDiscardLogout"
      @manual-sync="handleManualSyncBeforeLogout"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '@/stores/session.store'
import { syncService } from '@/services/sync.service'
import LogoutConfirmModal from '@/components/LogoutConfirmModal.vue'

const emit = defineEmits<{ (e: 'open-sync-settings'): void; (e: 'open-password-change'): void; (e: 'logout-discard'): void }>()

const sessionStore = useSessionStore()

// Sync status
const syncStatus = computed(() => syncService.status.value)

// Session display
const remainingDisplay = computed(() => sessionStore.remainingDisplay)

// UI state
const showDropdown = ref(false)
const showLogoutModal = ref(false)
const dropdownRef = ref<HTMLElement>()
const unsyncedCount = ref(0)

// Format sync time
function formatSyncTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  
  if (diffMins < 1) return 'たった今'
  if (diffMins < 60) return `${diffMins}分前`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}時間前`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}日前`
}

async function checkUnsyncedData() {
  try {
    // 同期状態を取得
    const { syncService } = await import('@/services/sync.service')
    const isSyncEnabled = syncService.isEnabled.value
    
    // メタデータサービスから未同期件数を取得
    const { metadataService } = await import('@/services/metadata.service')
    const unsyncedData = await metadataService.getUnsyncedDataCount(isSyncEnabled)
    unsyncedCount.value = unsyncedData.total
    
    console.log('[DEBUG] SessionBanner.checkUnsyncedData - updated count:', unsyncedCount.value)
  } catch (error) {
    console.error('Failed to check unsynced data:', error)
    unsyncedCount.value = 0
  }
}

function openSyncSettings() {
  showDropdown.value = false
  emit('open-sync-settings')
}

function openPasswordChange() {
  showDropdown.value = false
  emit('open-password-change')
}

function logout() {
  showDropdown.value = false
  // 常に確認モーダルを表示し、モーダル内で未同期データをチェック
  checkUnsyncedData().then(() => {
    showLogoutModal.value = true
  })
}

function confirmLogout() {
  sessionStore.logout()
  showLogoutModal.value = false
}

function confirmDiscardLogout() {
  // 未同期データを破棄してログアウト
  sessionStore.logoutAndDiscardChanges()
  showLogoutModal.value = false
}

async function handleManualSyncBeforeLogout() {
  try {
    const syncResult = await syncService.performSync()
    if (syncResult.success) {
      // 同期成功後に未同期カウントを再確認
      await checkUnsyncedData()
      if (unsyncedCount.value === 0) {
        // 未同期データがなくなったらログアウト
        sessionStore.logout()
        showLogoutModal.value = false
      }
    } else {
      console.error('Sync failed before logout:', syncResult.message)
      // 同期失敗でもユーザーの判断でログアウトする
      sessionStore.logout()
      showLogoutModal.value = false
    }
  } catch (error) {
    console.error('Sync failed before logout:', error)
    sessionStore.logout()
    showLogoutModal.value = false
  }
}

function handleClickOutside(event: Event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  checkUnsyncedData()
  
  // 同期完了イベントを監視
  syncService.onSyncComplete(checkUnsyncedData)
  syncService.onConflictResolved(checkUnsyncedData)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  
  // イベントリスナーを解除
  syncService.offSyncComplete(checkUnsyncedData)
  syncService.offConflictResolved(checkUnsyncedData)
})
</script>