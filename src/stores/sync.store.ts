// 同期専用ストア

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { syncCoreService } from '@/services/sync'
import { unsyncedDataTrackerService } from '@/services/metadata'
import type { SyncStatus, SyncConflict, UnsyncedDataCount } from '@/services/sync/types'

export const useSyncStore = defineStore('sync', () => {
  // リアクティブステート
  const isEnabled = ref(false)
  const isSyncing = ref(false)
  const lastSyncTime = ref<number | null>(null)
  const lastSyncError = ref<string | null>(null)
  const conflictData = ref<SyncConflict | null>(null)
  const unsyncedDataCount = ref<UnsyncedDataCount>({
    holdings: 0,
    locations: 0,
    tokens: 0,
    total: 0
  })

  // Computed getters
  const status = computed((): SyncStatus => ({
    isEnabled: isEnabled.value,
    isSyncing: isSyncing.value,
    lastSyncTime: lastSyncTime.value,
    lastSyncError: lastSyncError.value,
    cloudFileExists: false, // これはサービス側で管理
    localDataExists: false, // これはサービス側で管理
    conflictDetected: !!conflictData.value
  }))

  const hasUnsyncedData = computed(() => unsyncedDataCount.value.total > 0)
  const hasConflict = computed(() => !!conflictData.value)
  const canSync = computed(() => isEnabled.value && !isSyncing.value)

  // アクション
  async function enableSync() {
    try {
      const result = await syncCoreService.enableSync()
      if (result.success) {
        await refreshSyncStatus()
        await refreshUnsyncedDataCount()
      }
      return result
    } catch (error) {
      console.error('[SyncStore] Failed to enable sync:', error)
      return { success: false, message: '同期の有効化に失敗しました' }
    }
  }

  async function enableSyncForNewUser() {
    try {
      const result = await syncCoreService.enableSyncForNewUser()
      if (result.success) {
        await refreshSyncStatus()
        await refreshUnsyncedDataCount()
      }
      return result
    } catch (error) {
      console.error('[SyncStore] Failed to enable sync for new user:', error)
      return { success: false, message: '新規ユーザーの同期有効化に失敗しました' }
    }
  }

  async function disableSync() {
    try {
      const result = await syncCoreService.disableSync()
      if (result.success) {
        await refreshSyncStatus()
        conflictData.value = null
        unsyncedDataCount.value = { holdings: 0, locations: 0, tokens: 0, total: 0 }
      }
      return result
    } catch (error) {
      console.error('[SyncStore] Failed to disable sync:', error)
      return { success: false, message: '同期の無効化に失敗しました' }
    }
  }

  async function performManualSync() {
    try {
      isSyncing.value = true
      lastSyncError.value = null
      
      const result = await syncCoreService.performManualSync()
      
      if (result.success) {
        lastSyncTime.value = Date.now()
        await refreshUnsyncedDataCount()
      } else {
        lastSyncError.value = result.message
      }
      
      return result
    } catch (error: any) {
      const errorMessage = error.message || '手動同期に失敗しました'
      lastSyncError.value = errorMessage
      console.error('[SyncStore] Manual sync failed:', error)
      return { success: false, message: errorMessage }
    } finally {
      isSyncing.value = false
    }
  }

  async function refreshSyncStatus() {
    try {
      const serviceStatus = syncCoreService.status.value
      isEnabled.value = serviceStatus.isEnabled
      isSyncing.value = serviceStatus.isSyncing
      lastSyncTime.value = serviceStatus.lastSyncTime
      lastSyncError.value = serviceStatus.lastSyncError
      
      const serviceConflict = syncCoreService.conflictData.value
      conflictData.value = serviceConflict
      
      console.log('[SyncStore] Sync status refreshed')
    } catch (error) {
      console.error('[SyncStore] Failed to refresh sync status:', error)
    }
  }

  async function refreshUnsyncedDataCount() {
    try {
      const count = await unsyncedDataTrackerService.getUnsyncedDataCount()
      unsyncedDataCount.value = count
      console.log('[SyncStore] Unsynced data count refreshed:', count)
    } catch (error) {
      console.error('[SyncStore] Failed to refresh unsynced data count:', error)
    }
  }

  function clearError() {
    lastSyncError.value = null
  }

  function clearConflict() {
    conflictData.value = null
  }

  // 初期化
  async function initialize() {
    try {
      await Promise.all([
        refreshSyncStatus(),
        refreshUnsyncedDataCount()
      ])
      console.log('[SyncStore] Initialized successfully')
    } catch (error) {
      console.error('[SyncStore] Failed to initialize:', error)
    }
  }

  // 統計情報の取得
  async function getSyncStats() {
    try {
      const [unsyncedStats, serviceStatus] = await Promise.all([
        unsyncedDataTrackerService.getUnsyncedStats(),
        Promise.resolve(syncCoreService.status.value)
      ])

      return {
        status: serviceStatus,
        unsynced: unsyncedStats,
        performance: {
          lastSyncDuration: 0, // TODO: implement tracking
          averageSyncTime: 0,  // TODO: implement tracking
          totalSyncs: 0        // TODO: implement tracking
        }
      }
    } catch (error) {
      console.error('[SyncStore] Failed to get sync stats:', error)
      return null
    }
  }

  // デバッグ用の手動データリフレッシュ
  async function forceDataRefresh() {
    try {
      await Promise.all([
        refreshSyncStatus(),
        refreshUnsyncedDataCount()
      ])
      console.log('[SyncStore] Force data refresh completed')
    } catch (error) {
      console.error('[SyncStore] Force data refresh failed:', error)
    }
  }

  return {
    // State
    isEnabled: readonly(isEnabled),
    isSyncing: readonly(isSyncing),
    lastSyncTime: readonly(lastSyncTime),
    lastSyncError: readonly(lastSyncError),
    conflictData: readonly(conflictData),
    unsyncedDataCount: readonly(unsyncedDataCount),

    // Computed
    status,
    hasUnsyncedData,
    hasConflict,
    canSync,

    // Actions
    enableSync,
    enableSyncForNewUser,
    disableSync,
    performManualSync,
    refreshSyncStatus,
    refreshUnsyncedDataCount,
    clearError,
    clearConflict,
    initialize,
    getSyncStats,
    forceDataRefresh
  }
})