// 同期コアサービス - メイン同期ロジック

import { ref, computed } from 'vue'
import { dbV2 } from '../db-v2'
import { storageService } from '../storage.service'
import { cloudBackupService } from './cloud-backup.service'
import { conflictResolverService } from './conflict-resolver.service'
import { syncSchedulerService } from './sync-scheduler.service'
import { syncEventEmitter } from './event-emitter.service'
import type { SyncStatus, SyncResult, SyncConflict } from './types'
import { SYNC_CONFIG } from '@/config/sync.config'

export class SyncCoreService {
  private _status = ref<SyncStatus>({
    isEnabled: false,
    isSyncing: false,
    lastSyncTime: null,
    lastSyncError: null,
    cloudFileExists: false,
    localDataExists: false,
    conflictDetected: false
  })

  private _conflictData = ref<SyncConflict | null>(null)

  // Computed getters
  get status() { return computed(() => this._status.value) }
  get conflictData() { return computed(() => this._conflictData.value) }
  get isEnabled() { return computed(() => this._status.value.isEnabled) }
  get isSyncing() { return computed(() => this._status.value.isSyncing) }

  constructor() {
    this.loadSyncStatus()
    this.performInitialCleanup()
  }

  /**
   * 同期を有効化する（新規ユーザー用）
   */
  async enableSyncForNewUser(): Promise<SyncResult> {
    try {
      console.log('[SyncCore] Enabling sync for new user')
      
      // ローカルデータを取得してクラウドにアップロード
      const localData = await this.gatherLocalData()
      const uploadResult = await cloudBackupService.uploadBackup(localData)
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.message)
      }

      // 同期を有効化
      this._status.value.isEnabled = true
      this._status.value.lastSyncTime = Date.now()
      this._status.value.lastSyncError = null
      this._status.value.cloudFileExists = true
      this._status.value.localDataExists = true

      this.saveSyncStatus()
      this.startAutoSync()

      const result: SyncResult = {
        success: true,
        message: '新規ユーザーの同期が有効化されました'
      }

      syncEventEmitter.emit('syncEnabled', result)
      return result

    } catch (error: any) {
      console.error('[SyncCore] Failed to enable sync for new user:', error)
      const result: SyncResult = {
        success: false,
        message: error.message || '同期の有効化に失敗しました'
      }
      syncEventEmitter.emit('syncEnableFailed', result)
      return result
    }
  }

  /**
   * 同期を有効化する（既存ユーザー用）
   */
  async enableSync(): Promise<SyncResult> {
    try {
      console.log('[SyncCore] Enabling sync for existing user')

      // クラウドとローカルの両方を確認
      const [cloudExists, localExists] = await Promise.all([
        cloudBackupService.checkBackupExists(),
        this.checkLocalDataExists()
      ])

      if (!cloudExists && !localExists) {
        return {
          success: false,
          message: 'クラウドとローカルの両方にデータが見つかりません'
        }
      }

      // データの競合チェック（既存ユーザーの場合は再ログインとして扱う）
      if (cloudExists && localExists) {
        const conflictResult = await this.checkForConflicts(true) // 再ログインフラグを設定
        if (conflictResult && !conflictResult.success) {
          return conflictResult
        }
      }

      // 片方しかない場合は自動的に同期
      if (cloudExists && !localExists) {
        await this.downloadFromCloud()
      } else if (!cloudExists && localExists) {
        const localData = await this.gatherLocalData()
        await cloudBackupService.uploadBackup(localData)
      }

      this._status.value.isEnabled = true
      this._status.value.lastSyncTime = Date.now()
      this._status.value.lastSyncError = null
      this._status.value.cloudFileExists = cloudExists
      this._status.value.localDataExists = localExists

      this.saveSyncStatus()
      this.startAutoSync()

      const result: SyncResult = {
        success: true,
        message: '同期が有効化されました'
      }

      syncEventEmitter.emit('syncEnabled', result)
      return result

    } catch (error: any) {
      console.error('[SyncCore] Failed to enable sync:', error)
      const result: SyncResult = {
        success: false,
        message: error.message || '同期の有効化に失敗しました'
      }
      syncEventEmitter.emit('syncEnableFailed', result)
      return result
    }
  }

  /**
   * 手動同期を実行
   */
  async performManualSync(): Promise<SyncResult> {
    return await syncSchedulerService.executeManualSync(() => this.performSync())
      ? { success: true, message: '手動同期が完了しました' }
      : { success: false, message: '手動同期に失敗しました（レート制限）' }
  }

  /**
   * メイン同期処理
   */
  private async performSync(): Promise<void> {
    if (this._status.value.isSyncing || !this._status.value.isEnabled) {
      return
    }

    this._status.value.isSyncing = true
    this._status.value.lastSyncError = null

    try {
      console.log('[SyncCore] Starting sync...')
      
      // 競合チェック（定期同期では通常の競合検出）
      const conflictResult = await this.checkForConflicts(false)
      if (conflictResult && !conflictResult.success) {
        if (conflictResult.conflictData) {
          this._conflictData.value = conflictResult.conflictData
          this._status.value.conflictDetected = true
          this.saveSyncStatus()
          return
        }
        throw new Error(conflictResult.message)
      }

      // ローカルデータを収集してアップロード
      const localData = await this.gatherLocalData()
      const uploadResult = await cloudBackupService.uploadBackup(localData)

      if (!uploadResult.success) {
        throw new Error(uploadResult.message)
      }

      this._status.value.lastSyncTime = Date.now()
      this._status.value.cloudFileExists = true
      this._status.value.localDataExists = true
      this.saveSyncStatus()

      console.log('[SyncCore] Sync completed successfully')
      syncEventEmitter.emit('syncCompleted')

    } catch (error: any) {
      console.error('[SyncCore] Sync failed:', error)
      this._status.value.lastSyncError = error.message
      this.saveSyncStatus()
      syncEventEmitter.emit('syncFailed', error)
    } finally {
      this._status.value.isSyncing = false
    }
  }

  /**
   * 競合をチェック
   */
  private async checkForConflicts(isRelogin: boolean = false): Promise<SyncResult | null> {
    try {
      const [localData, downloadResult] = await Promise.all([
        this.gatherLocalData(),
        cloudBackupService.downloadBackup()
      ])

      if (!downloadResult.success) {
        return null // クラウドデータがない場合は競合なし
      }

      // 再ログイン情報を競合検出に渡す
      const conflict = conflictResolverService.detectConflict(localData, {
        portfolioData: downloadResult.data,
        timestamp: downloadResult.data?.timestamp || Date.now(),
        version: '1.0',
        checksum: ''
      }, isRelogin)

      if (!conflict) {
        return null // 競合なし
      }

      // 自動解決を試行
      const autoResolution = conflictResolverService.autoResolve(conflict)
      if (autoResolution) {
        await this.applyResolution(autoResolution)
        conflictResolverService.recordConflict(conflict, autoResolution)
        
        const message = isRelogin 
          ? '再ログイン時のデータ差分を自動解決しました'
          : '競合が自動解決されました'
        
        console.log('[SyncCore]', message)
        return { success: true, message }
      }

      // 手動解決が必要
      return {
        success: false,
        message: '同期競合が検出されました。手動で解決してください。',
        conflictData: conflict
      }

    } catch (error: any) {
      console.error('[SyncCore] Conflict check failed:', error)
      return {
        success: false,
        message: '競合チェックでエラーが発生しました'
      }
    }
  }

  /**
   * ローカルデータを収集
   */
  private async gatherLocalData(): Promise<any> {
    const [locations, holdings, tokens, prices] = await Promise.all([
      dbV2.locations.toArray(),
      dbV2.holdings.toArray(),
      dbV2.tokens.toArray(),
      dbV2.prices.toArray()
    ])

    return {
      locations,
      holdings,
      tokens,
      prices,
      timestamp: Date.now(),
      version: '2.0'
    }
  }

  /**
   * クラウドからダウンロードしてローカルに適用
   */
  private async downloadFromCloud(): Promise<void> {
    const result = await cloudBackupService.downloadBackup()
    if (!result.success || !result.data) {
      throw new Error(result.message)
    }

    await this.restoreFromBackup(result.data)
  }

  /**
   * バックアップからデータを復元
   */
  private async restoreFromBackup(data: any): Promise<void> {
    try {
      await dbV2.transaction('rw', [dbV2.locations, dbV2.holdings, dbV2.tokens, dbV2.prices], async () => {
        // 既存データをクリア
        await Promise.all([
          dbV2.locations.clear(),
          dbV2.holdings.clear(),
          dbV2.tokens.clear(),
          dbV2.prices.clear()
        ])

        // 新しいデータを挿入
        if (data.locations?.length) await dbV2.locations.bulkAdd(data.locations)
        if (data.holdings?.length) await dbV2.holdings.bulkAdd(data.holdings)
        if (data.tokens?.length) await dbV2.tokens.bulkAdd(data.tokens)
        if (data.prices?.length) await dbV2.prices.bulkAdd(data.prices)
      })

      console.log('[SyncCore] Data restored from backup')
    } catch (error) {
      console.error('[SyncCore] Failed to restore from backup:', error)
      throw error
    }
  }

  /**
   * 競合解決を適用
   */
  private async applyResolution(resolution: any): Promise<void> {
    switch (resolution.action) {
      case 'use_cloud':
        await this.downloadFromCloud()
        break
      case 'use_local':
        // ローカルデータをアップロード
        const localData = await this.gatherLocalData()
        await cloudBackupService.uploadBackup(localData)
        break
      case 'merge':
        if (resolution.data) {
          await this.restoreFromBackup(resolution.data)
          await cloudBackupService.uploadBackup(resolution.data)
        }
        break
    }
  }

  /**
   * ローカルデータの存在確認
   */
  private async checkLocalDataExists(): Promise<boolean> {
    try {
      const [locationCount, holdingCount] = await Promise.all([
        dbV2.locations.count(),
        dbV2.holdings.count()
      ])
      return locationCount > 0 || holdingCount > 0
    } catch (error) {
      console.error('[SyncCore] Failed to check local data:', error)
      return false
    }
  }

  /**
   * 自動同期を開始
   */
  private startAutoSync(): void {
    syncSchedulerService.startAutoSync(() => this.performSync())
  }

  /**
   * 同期ステータスを保存
   */
  private saveSyncStatus(): void {
    try {
      localStorage.setItem('syncStatus', JSON.stringify(this._status.value))
    } catch (error) {
      console.error('[SyncCore] Failed to save sync status:', error)
    }
  }

  /**
   * 同期ステータスを読み込み
   */
  private loadSyncStatus(): void {
    try {
      const saved = localStorage.getItem('syncStatus')
      if (saved) {
        const status = JSON.parse(saved)
        this._status.value = { ...this._status.value, ...status }
      }
    } catch (error) {
      console.error('[SyncCore] Failed to load sync status:', error)
    }
  }

  /**
   * 初期クリーンアップ
   */
  private async performInitialCleanup(): Promise<void> {
    try {
      // 不整合なステータスをリセット
      if (this._status.value.isSyncing) {
        this._status.value.isSyncing = false
        this.saveSyncStatus()
      }
    } catch (error) {
      console.error('[SyncCore] Initial cleanup failed:', error)
    }
  }

  /**
   * 同期を無効化
   */
  async disableSync(): Promise<SyncResult> {
    try {
      syncSchedulerService.stopAll()
      this._status.value.isEnabled = false
      this._status.value.isSyncing = false
      this._conflictData.value = null
      this.saveSyncStatus()

      syncEventEmitter.emit('syncDisabled')
      return { success: true, message: '同期が無効化されました' }
    } catch (error: any) {
      console.error('[SyncCore] Failed to disable sync:', error)
      return { success: false, message: '同期の無効化に失敗しました' }
    }
  }
}

// シングルトンインスタンス
export const syncCoreService = new SyncCoreService()