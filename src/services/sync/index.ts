// 同期サービスのメインエクスポート

import { syncCoreService } from './sync-core.service'
import { cloudBackupService } from './cloud-backup.service'
import { conflictResolverService } from './conflict-resolver.service'
import { syncSchedulerService } from './sync-scheduler.service'
import { syncEventEmitter } from './event-emitter.service'

export { syncCoreService } from './sync-core.service'
export { cloudBackupService } from './cloud-backup.service'
export { conflictResolverService } from './conflict-resolver.service'
export { syncSchedulerService } from './sync-scheduler.service'
export { syncEventEmitter } from './event-emitter.service'

// 型定義
export type {
  SyncStatus,
  SyncResult,
  SyncConflict,
  CloudBackupData,
  ConflictResolution,
  SyncMetrics
} from './types'

// 下位互換性のための統合インターフェース
class SyncServiceAdapter {
  // SyncCoreServiceのメソッドを委譲
  get status() { return syncCoreService.status }
  get conflictData() { return syncCoreService.conflictData }
  get isEnabled() { return syncCoreService.isEnabled }
  get isSyncing() { return syncCoreService.isSyncing }

  async enableSync() { return syncCoreService.enableSync() }
  async enableSyncForNewUser() { return syncCoreService.enableSyncForNewUser() }
  async disableSync() { return syncCoreService.disableSync() }
  async performManualSync() { return syncCoreService.performManualSync() }

  // イベント関連
  on(event: string, callback: Function) { syncEventEmitter.on(event, callback) }
  off(event: string, callback: Function) { syncEventEmitter.off(event, callback) }

  // クラウドバックアップ操作
  async uploadBackup(data: any) { return cloudBackupService.uploadBackup(data) }
  async downloadBackup() { return cloudBackupService.downloadBackup() }
  async checkBackupExists() { return cloudBackupService.checkBackupExists() }
  async deleteBackup() { return cloudBackupService.deleteBackup() }

  // スケジューラ操作
  getSchedulerStatus() { return syncSchedulerService.getStatus() }
}

// 下位互換性のためのデフォルトエクスポート
export const syncService = new SyncServiceAdapter()
export default syncService