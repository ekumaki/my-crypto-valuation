// メタデータ管理サービス - 基本的なメタデータ操作

import type { SyncMetadata } from '@/types/sync'
import { SYNC_CONFIG } from '@/config/sync.config'

export class MetadataManagerService {
  /**
   * 新しいアイテム用のデフォルトメタデータを作成
   */
  createDefaultMetadata(): SyncMetadata {
    return {
      isNew: true,
      isModified: false,
      isDeleted: false,
      isSynced: false,
      lastModified: new Date(),
      lastSyncTime: null,
      version: 1
    }
  }

  /**
   * アイテムが変更された時のメタデータ更新
   */
  markAsModified(metadata: SyncMetadata): SyncMetadata {
    return {
      ...metadata,
      isModified: true,
      isSynced: false,
      lastModified: new Date(),
      version: metadata.version + 1
    }
  }

  /**
   * アイテムを削除済みとしてマーク（論理削除）
   */
  markAsDeleted(metadata: SyncMetadata): SyncMetadata {
    return {
      ...metadata,
      isDeleted: true,
      isSynced: false,
      lastModified: new Date(),
      version: metadata.version + 1
    }
  }

  /**
   * アイテムを同期済みとしてマーク
   */
  markAsSynced(metadata: SyncMetadata): SyncMetadata {
    const now = new Date()
    return {
      ...metadata,
      isNew: false,
      isModified: false,
      isDeleted: false,
      isSynced: true,
      lastSyncTime: now,
      lastModified: now
    }
  }

  /**
   * メタデータの妥当性をチェック
   */
  validateMetadata(metadata: SyncMetadata): boolean {
    try {
      // 基本的な型チェック
      if (typeof metadata.isNew !== 'boolean' ||
          typeof metadata.isModified !== 'boolean' ||
          typeof metadata.isDeleted !== 'boolean' ||
          typeof metadata.isSynced !== 'boolean' ||
          typeof metadata.version !== 'number') {
        return false
      }

      // 日付の妥当性チェック
      if (!(metadata.lastModified instanceof Date) ||
          isNaN(metadata.lastModified.getTime())) {
        return false
      }

      if (metadata.lastSyncTime !== null &&
          (!(metadata.lastSyncTime instanceof Date) ||
           isNaN(metadata.lastSyncTime.getTime()))) {
        return false
      }

      // バージョンの妥当性チェック
      if (metadata.version < 1) {
        return false
      }

      return true
    } catch (error) {
      console.error('[MetadataManager] Metadata validation failed:', error)
      return false
    }
  }

  /**
   * メタデータを正規化（不正な値を修正）
   */
  normalizeMetadata(metadata: Partial<SyncMetadata>): SyncMetadata {
    const now = new Date()
    
    return {
      isNew: Boolean(metadata.isNew ?? true),
      isModified: Boolean(metadata.isModified ?? false),
      isDeleted: Boolean(metadata.isDeleted ?? false),
      isSynced: Boolean(metadata.isSynced ?? false),
      lastModified: this.normalizeDate(metadata.lastModified, now),
      lastSyncTime: metadata.lastSyncTime ? this.normalizeDate(metadata.lastSyncTime) : null,
      version: Math.max(Number(metadata.version) || 1, 1),
      syncDisabled: Boolean(metadata.syncDisabled ?? false)
    }
  }

  /**
   * 日付を正規化
   */
  private normalizeDate(date: any, defaultDate?: Date): Date {
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date
    }
    
    if (typeof date === 'string' || typeof date === 'number') {
      const parsed = new Date(date)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }
    
    return defaultDate || new Date()
  }

  /**
   * 同期が必要かどうかをチェック
   */
  needsSync(metadata: SyncMetadata): boolean {
    if (metadata.syncDisabled) {
      return false
    }

    return (
      metadata.isNew ||
      metadata.isModified ||
      metadata.isDeleted ||
      !metadata.isSynced
    )
  }

  /**
   * メタデータの競合をチェック
   */
  hasConflict(localMetadata: SyncMetadata, remoteMetadata: SyncMetadata): boolean {
    // バージョン番号による競合検出
    if (localMetadata.version !== remoteMetadata.version) {
      return true
    }

    // 最終更新時刻による競合検出
    const localTime = localMetadata.lastModified.getTime()
    const remoteTime = remoteMetadata.lastModified.getTime()
    const timeDiff = Math.abs(localTime - remoteTime)

    // 閾値以上の時間差がある場合は競合とみなす
    return timeDiff > SYNC_CONFIG.conflict.autoResolveThreshold
  }

  /**
   * より新しいメタデータを選択
   */
  selectNewerMetadata(metadata1: SyncMetadata, metadata2: SyncMetadata): SyncMetadata {
    // バージョン番号で比較
    if (metadata1.version !== metadata2.version) {
      return metadata1.version > metadata2.version ? metadata1 : metadata2
    }

    // 最終更新時刻で比較
    if (metadata1.lastModified.getTime() !== metadata2.lastModified.getTime()) {
      return metadata1.lastModified > metadata2.lastModified ? metadata1 : metadata2
    }

    // 同じ場合はローカルを優先
    return metadata1
  }

  /**
   * メタデータの統計情報を取得
   */
  getMetadataStats(metadataList: SyncMetadata[]) {
    const stats = {
      total: metadataList.length,
      new: 0,
      modified: 0,
      deleted: 0,
      synced: 0,
      needsSync: 0,
      syncDisabled: 0
    }

    for (const metadata of metadataList) {
      if (metadata.isNew) stats.new++
      if (metadata.isModified) stats.modified++
      if (metadata.isDeleted) stats.deleted++
      if (metadata.isSynced) stats.synced++
      if (this.needsSync(metadata)) stats.needsSync++
      if (metadata.syncDisabled) stats.syncDisabled++
    }

    return stats
  }
}

// シングルトンインスタンス
export const metadataManagerService = new MetadataManagerService()