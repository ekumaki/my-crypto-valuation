// メタデータキャッシュサービス

import type { SyncMetadata } from '@/types/sync'

export class MetadataCacheService {
  private metadataCache = new Map<string, SyncMetadata>()
  private cacheExpiry: number | null = null
  private readonly CACHE_DURATION = 5000 // 5秒

  /**
   * キャッシュからメタデータを取得
   */
  get(key: string): SyncMetadata | null {
    if (this.isExpired()) {
      this.clearCache()
      return null
    }

    return this.metadataCache.get(key) || null
  }

  /**
   * メタデータをキャッシュに保存
   */
  set(key: string, metadata: SyncMetadata): void {
    this.metadataCache.set(key, metadata)
    this.updateExpiry()
  }

  /**
   * 複数のメタデータを一括でキャッシュに保存
   */
  setMany(entries: [string, SyncMetadata][]): void {
    for (const [key, metadata] of entries) {
      this.metadataCache.set(key, metadata)
    }
    this.updateExpiry()
  }

  /**
   * キーに対応するメタデータをキャッシュから削除
   */
  delete(key: string): boolean {
    return this.metadataCache.delete(key)
  }

  /**
   * キャッシュに指定のキーが存在するかチェック
   */
  has(key: string): boolean {
    if (this.isExpired()) {
      this.clearCache()
      return false
    }

    return this.metadataCache.has(key)
  }

  /**
   * キャッシュサイズを取得
   */
  size(): number {
    return this.metadataCache.size
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.metadataCache.clear()
    this.cacheExpiry = null
  }

  /**
   * キャッシュの有効期限をチェック
   */
  private isExpired(): boolean {
    if (this.cacheExpiry === null) {
      return false
    }

    const now = Date.now()
    return now > this.cacheExpiry
  }

  /**
   * キャッシュの有効期限を更新
   */
  private updateExpiry(): void {
    this.cacheExpiry = Date.now() + this.CACHE_DURATION
  }

  /**
   * キャッシュのすべてのキーを取得
   */
  keys(): string[] {
    if (this.isExpired()) {
      this.clearCache()
      return []
    }

    return Array.from(this.metadataCache.keys())
  }

  /**
   * キャッシュのすべての値を取得
   */
  values(): SyncMetadata[] {
    if (this.isExpired()) {
      this.clearCache()
      return []
    }

    return Array.from(this.metadataCache.values())
  }

  /**
   * キャッシュのすべてのエントリを取得
   */
  entries(): [string, SyncMetadata][] {
    if (this.isExpired()) {
      this.clearCache()
      return []
    }

    return Array.from(this.metadataCache.entries())
  }

  /**
   * 条件に一致するキャッシュエントリを検索
   */
  findWhere(predicate: (metadata: SyncMetadata, key: string) => boolean): [string, SyncMetadata][] {
    if (this.isExpired()) {
      this.clearCache()
      return []
    }

    const results: [string, SyncMetadata][] = []
    
    for (const [key, metadata] of this.metadataCache.entries()) {
      if (predicate(metadata, key)) {
        results.push([key, metadata])
      }
    }

    return results
  }

  /**
   * キャッシュの統計情報を取得
   */
  getStats() {
    const values = this.values()
    
    return {
      size: this.size(),
      isExpired: this.isExpired(),
      expiresAt: this.cacheExpiry,
      timeToExpiry: this.cacheExpiry ? Math.max(0, this.cacheExpiry - Date.now()) : null,
      contentStats: {
        new: values.filter(m => m.isNew).length,
        modified: values.filter(m => m.isModified).length,
        deleted: values.filter(m => m.isDeleted).length,
        synced: values.filter(m => m.isSynced).length
      }
    }
  }

  /**
   * 期限切れアイテムのクリーンアップ
   */
  cleanup(): void {
    if (this.isExpired()) {
      this.clearCache()
    }
  }

  /**
   * キャッシュを強制リフレッシュ
   */
  refresh(): void {
    this.clearCache()
  }
}

// シングルトンインスタンス
export const metadataCacheService = new MetadataCacheService()
