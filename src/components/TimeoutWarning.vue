<template>
  <div v-if="show" class="fixed top-0 left-0 right-0 bg-amber-500 text-white z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between py-3">
        <div class="flex items-center space-x-3">
          <svg class="h-5 w-5 text-amber-100" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div>
            <div class="font-medium">セッション期限切れまで {{ sessionStore.remainingDisplay }}</div>
            <div class="text-sm text-amber-100">
              操作がない場合、自動的にログアウトされます
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <button
            @click="extendSession"
            class="bg-white text-amber-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-50 transition-colors"
          >
            セッション延長
          </button>
          <button
            @click="logout"
            class="bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-700 transition-colors border border-amber-400"
          >
            今すぐログアウト
          </button>
          <button
            @click="dismissWarning"
            class="text-amber-100 hover:text-white p-1"
          >
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Logout Confirmation Modal -->
    <LogoutConfirmModal
      v-if="showLogoutModal"
      :unsynced-count="unsyncedCount"
      :is-syncing="syncService.status.value.isSyncing"
      @close="showLogoutModal = false"
      @confirm="confirmLogout"
      @confirm-discard="confirmDiscardLogout"
      @manual-sync="handleManualSyncBeforeLogout"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '@/stores/session.store'
import { syncService } from '@/services/sync.service'
import LogoutConfirmModal from '@/components/LogoutConfirmModal.vue'

const sessionStore = useSessionStore()
const showLogoutModal = ref(false)
const unsyncedCount = ref(0)

const show = computed(() => sessionStore.showWarning)
const remainingMinutes = computed(() => Math.max(1, sessionStore.remainingMinutes))

// 未同期件数を更新する関数
async function refreshUnsyncedCount() {
  try {
    // 同期状態を取得
    const { syncService } = await import('@/services/sync.service')
    const isSyncEnabled = syncService.isEnabled.value
    
    // メタデータサービスから未同期件数を取得
    const { metadataService } = await import('@/services/metadata.service')
    const unsyncedData = await metadataService.getUnsyncedDataCount(isSyncEnabled)
    unsyncedCount.value = unsyncedData.total
    
    console.log('[DEBUG] TimeoutWarning.refreshUnsyncedCount - updated count:', unsyncedCount.value)
  } catch (error) {
    console.error('Failed to refresh unsynced data count:', error)
    unsyncedCount.value = 0
  }
}

function extendSession() {
  sessionStore.extendSession()
}

async function logout() {
  try {
    // Check for unsynced data and conflicts
    unsyncedCount.value = await syncService.getUnsyncedDataCount()
    
    // Also check for conflicts
    if (syncService.status.value.conflictDetected) {
      // If there's a conflict, count it as unsynced data
      const localData = await syncService.getLocalData()
      const localDataCount = (localData.holdings?.length || 0) + 
                            (localData.locations?.length || 0) + 
                            (localData.tokens?.length || 0)
      unsyncedCount.value = Math.max(unsyncedCount.value, localDataCount)
    }
    
    showLogoutModal.value = true
  } catch (error) {
    // If checking unsynced data fails, show modal with 0 count
    unsyncedCount.value = 0
    showLogoutModal.value = true
  }
}

function confirmLogout() {
  showLogoutModal.value = false
  sessionStore.logout()
}

function confirmDiscardLogout() {
  showLogoutModal.value = false
  sessionStore.logoutAndDiscardChanges()
}

async function handleManualSyncBeforeLogout() {
  try {
    // Check if cloud password is set
    if (!syncService.hasCloudPassword.value) {
      // Show password prompt or error
      if (window.showToast) {
        window.showToast.error('同期エラー', 'クラウドパスワードが設定されていません。先に同期設定から自動同期を有効にしてください。')
      }
      return
    }
    
    // Perform manual sync
    const result = await syncService.performSync()
    if (result.success) {
      // Sync successful, update unsynced count and close modal (don't logout)
      unsyncedCount.value = 0
      showLogoutModal.value = false
      if (window.showToast) {
        window.showToast.success('同期完了', '同期が正常に完了しました')
      }
    } else {
      // Sync failed, show error but keep modal open
      if (window.showToast) {
        window.showToast.error('同期エラー', result.message || '同期に失敗しました')
      }
    }
  } catch (error) {
    console.error('Manual sync failed:', error)
    if (window.showToast) {
      window.showToast.error('同期エラー', '同期中にエラーが発生しました')
    }
  }
}

function dismissWarning() {
  // Note: This is a temporary dismissal, warning will reappear
  sessionStore.showWarning = false
}

onMounted(() => {
  // 同期完了イベントを監視
  syncService.onSyncComplete(refreshUnsyncedCount)
  syncService.onConflictResolved(refreshUnsyncedCount)
})

onUnmounted(() => {
  // イベントリスナーを解除
  syncService.offSyncComplete(refreshUnsyncedCount)
  syncService.offConflictResolved(refreshUnsyncedCount)
})
</script>