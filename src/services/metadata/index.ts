// メタデータサービスのメインエクスポート

export { metadataManagerService } from './metadata-manager.service'
export { metadataCacheService } from './metadata-cache.service'
export { unsyncedDataTrackerService } from './unsynced-data-tracker.service'

// 型定義
export type { SyncMetadata, UnsyncedDataDetail, UnsyncedDataCount } from '@/types/sync'

// 下位互換性のための統合インターフェース
class MetadataServiceAdapter {
  private globalSyncTime: Date | null = null

  constructor() {
    this.loadGlobalSyncTime()
    this.performInitialCleanup()
  }

  // MetadataManagerServiceのメソッドを委譲
  createDefaultMetadata() {
    return metadataManagerService.createDefaultMetadata()
  }

  markAsModified(metadata: any) {
    return metadataManagerService.markAsModified(metadata)
  }

  markAsDeleted(metadata: any) {
    return metadataManagerService.markAsDeleted(metadata)
  }

  markAsSynced(metadata: any) {
    return metadataManagerService.markAsSynced(metadata)
  }

  validateMetadata(metadata: any) {
    return metadataManagerService.validateMetadata(metadata)
  }

  normalizeMetadata(metadata: any) {
    return metadataManagerService.normalizeMetadata(metadata)
  }

  needsSync(metadata: any) {
    return metadataManagerService.needsSync(metadata)
  }

  // UnsyncedDataTrackerServiceのメソッドを委譲
  async getUnsyncedDataDetails() {
    return unsyncedDataTrackerService.getUnsyncedDataDetails()
  }

  async getUnsyncedDataCount() {
    return unsyncedDataTrackerService.getUnsyncedDataCount()
  }

  async getUnsyncedCountByType(type: 'holding' | 'location' | 'token') {
    return unsyncedDataTrackerService.getUnsyncedCountByType(type)
  }

  async getUnsyncedStats() {
    return unsyncedDataTrackerService.getUnsyncedStats()
  }

  // MetadataCacheServiceのメソッドを委譲
  getCachedMetadata(key: string) {
    return metadataCacheService.get(key)
  }

  setCachedMetadata(key: string, metadata: any) {
    return metadataCacheService.set(key, metadata)
  }

  clearCache() {
    return metadataCacheService.clearCache()
  }

  getCacheStats() {
    return metadataCacheService.getStats()
  }

  // グローバル同期時刻の管理
  getGlobalSyncTime(): Date | null {
    return this.globalSyncTime
  }

  setGlobalSyncTime(time: Date): void {
    this.globalSyncTime = time
    try {
      localStorage.setItem('globalSyncTime', time.toISOString())
      console.log('[Metadata] Global sync time set:', time)
    } catch (error) {
      console.error('[Metadata] Failed to save global sync time:', error)
    }
  }

  clearGlobalSyncTime(): void {
    this.globalSyncTime = null
    try {
      localStorage.removeItem('globalSyncTime')
      console.log('[Metadata] Global sync time cleared')
    } catch (error) {
      console.error('[Metadata] Failed to clear global sync time:', error)
    }
  }

  private loadGlobalSyncTime(): void {
    try {
      const saved = localStorage.getItem('globalSyncTime')
      if (saved) {
        this.globalSyncTime = new Date(saved)
        console.log('[Metadata] Global sync time loaded:', this.globalSyncTime)
      }
    } catch (error) {
      console.error('[Metadata] Failed to load global sync time:', error)
      this.globalSyncTime = null
    }
  }

  private performInitialCleanup(): void {
    try {
      console.log('[Metadata] Performing initial cleanup')
      
      // キャッシュをクリア
      metadataCacheService.clearCache()
      
      // グローバル同期時刻の妥当性チェック
      if (this.globalSyncTime) {
        const now = new Date()
        const timeDiff = Math.abs(now.getTime() - this.globalSyncTime.getTime())
        
        // 1年以上古い、または未来の同期時刻をクリア
        if (timeDiff > 365 * 24 * 60 * 60 * 1000 || this.globalSyncTime > now) {
          console.log('[Metadata] Clearing invalid globalSyncTime:', this.globalSyncTime)
          this.clearGlobalSyncTime()
        }
      }
      
      console.log('[Metadata] Initial cleanup completed')
    } catch (error) {
      console.warn('[Metadata] Initial cleanup failed:', error)
    }
  }

  // 統計情報の取得
  async getComprehensiveStats() {
    try {
      const [unsyncedStats, cacheStats] = await Promise.all([
        this.getUnsyncedStats(),
        Promise.resolve(this.getCacheStats())
      ])

      return {
        unsynced: unsyncedStats,
        cache: cacheStats,
        globalSyncTime: this.globalSyncTime,
        lastCleanup: new Date()
      }
    } catch (error) {
      console.error('[Metadata] Failed to get comprehensive stats:', error)
      return null
    }
  }
}

// 下位互換性のためのデフォルトエクスポート
export const metadataService = new MetadataServiceAdapter()
export default metadataService