// 同期スケジューラサービス

import { SYNC_CONFIG } from '@/config/sync.config'
import { syncEventEmitter } from './event-emitter.service'

export class SyncSchedulerService {
  private syncTimer: number | null = null
  private conflictCheckTimer: number | null = null
  private isAutoSyncEnabled = false

  /**
   * 自動同期を開始する
   */
  startAutoSync(syncCallback: () => Promise<void>) {
    if (this.isAutoSyncEnabled) {
      return // 既に開始済み
    }

    this.isAutoSyncEnabled = true
    
    // 初回同期を実行
    setTimeout(() => {
      syncCallback().catch(console.error)
    }, 1000)

    // 定期同期を設定
    this.syncTimer = window.setInterval(() => {
      syncCallback().catch(console.error)
    }, SYNC_CONFIG.intervals.autoSync)

    console.log(`[SyncScheduler] Auto sync started with interval: ${SYNC_CONFIG.intervals.autoSync}ms`)
    syncEventEmitter.emit('autoSyncStarted')
  }

  /**
   * 自動同期を停止する
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    this.isAutoSyncEnabled = false
    console.log('[SyncScheduler] Auto sync stopped')
    syncEventEmitter.emit('autoSyncStopped')
  }

  /**
   * 競合チェックを開始する
   */
  startConflictCheck(conflictCallback: () => Promise<void>) {
    if (this.conflictCheckTimer) {
      return // 既に開始済み
    }

    this.conflictCheckTimer = window.setInterval(() => {
      conflictCallback().catch(console.error)
    }, SYNC_CONFIG.intervals.conflictCheck)

    console.log(`[SyncScheduler] Conflict check started with interval: ${SYNC_CONFIG.intervals.conflictCheck}ms`)
  }

  /**
   * 競合チェックを停止する
   */
  stopConflictCheck() {
    if (this.conflictCheckTimer) {
      clearInterval(this.conflictCheckTimer)
      this.conflictCheckTimer = null
    }

    console.log('[SyncScheduler] Conflict check stopped')
  }

  /**
   * すべてのタイマーを停止する
   */
  stopAll() {
    this.stopAutoSync()
    this.stopConflictCheck()
  }

  /**
   * 手動同期を実行する（レート制限付き）
   */
  private lastManualSync = 0
  private readonly MANUAL_SYNC_COOLDOWN = 5000 // 5秒

  async executeManualSync(syncCallback: () => Promise<void>): Promise<boolean> {
    const now = Date.now()
    
    if (now - this.lastManualSync < this.MANUAL_SYNC_COOLDOWN) {
      console.warn('[SyncScheduler] Manual sync rate limited')
      return false
    }

    this.lastManualSync = now
    
    try {
      await syncCallback()
      syncEventEmitter.emit('manualSyncCompleted')
      return true
    } catch (error) {
      console.error('[SyncScheduler] Manual sync failed:', error)
      syncEventEmitter.emit('manualSyncFailed', error)
      return false
    }
  }

  /**
   * 同期スケジュールの状態を取得
   */
  getStatus() {
    return {
      autoSyncEnabled: this.isAutoSyncEnabled,
      syncTimerActive: !!this.syncTimer,
      conflictCheckActive: !!this.conflictCheckTimer,
      lastManualSync: this.lastManualSync,
      intervals: SYNC_CONFIG.intervals
    }
  }

  /**
   * 同期間隔を動的に変更する
   */
  updateSyncInterval(newInterval: number, syncCallback: () => Promise<void>) {
    if (this.isAutoSyncEnabled) {
      this.stopAutoSync()
      // 新しい間隔で再開
      const originalInterval = SYNC_CONFIG.intervals.autoSync
      SYNC_CONFIG.intervals.autoSync = newInterval
      this.startAutoSync(syncCallback)
      
      console.log(`[SyncScheduler] Sync interval updated: ${originalInterval}ms -> ${newInterval}ms`)
    }
  }
}

// シングルトンインスタンス
export const syncSchedulerService = new SyncSchedulerService()