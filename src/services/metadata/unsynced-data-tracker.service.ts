// 未同期データ追跡サービス

import type { UnsyncedDataDetail, UnsyncedDataCount } from '@/types/sync'
import { dbV2 } from '../db-v2'
import { metadataManagerService } from './metadata-manager.service'

export class UnsyncedDataTrackerService {
  /**
   * 未同期データの詳細を取得
   */
  async getUnsyncedDataDetails(): Promise<UnsyncedDataDetail[]> {
    try {
      const [holdings, locations, tokens] = await Promise.all([
        this.getUnsyncedHoldings(),
        this.getUnsyncedLocations(),
        this.getUnsyncedTokens()
      ])

      return [...holdings, ...locations, ...tokens]
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to get unsynced data details:', error)
      return []
    }
  }

  /**
   * 未同期データの数を取得
   */
  async getUnsyncedDataCount(): Promise<UnsyncedDataCount> {
    try {
      const [holdingsCount, locationsCount, tokensCount] = await Promise.all([
        this.countUnsyncedHoldings(),
        this.countUnsyncedLocations(),
        this.countUnsyncedTokens()
      ])

      const total = holdingsCount + locationsCount + tokensCount

      return {
        holdings: holdingsCount,
        locations: locationsCount,
        tokens: tokensCount,
        total
      }
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to get unsynced data count:', error)
      return {
        holdings: 0,
        locations: 0,
        tokens: 0,
        total: 0
      }
    }
  }

  /**
   * 未同期のHoldingを取得
   */
  private async getUnsyncedHoldings(): Promise<UnsyncedDataDetail[]> {
    try {
      const holdings = await dbV2.holdings.toArray()
      const unsyncedHoldings: UnsyncedDataDetail[] = []

      for (const holding of holdings) {
        const metadata = holding.metadata
        if (metadata && metadataManagerService.needsSync(metadata)) {
          unsyncedHoldings.push({
            type: 'holding',
            id: holding.id,
            name: `${holding.symbol} (${holding.quantity})`,
            action: this.determineAction(metadata),
            lastModified: metadata.lastModified
          })
        }
      }

      return unsyncedHoldings
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to get unsynced holdings:', error)
      return []
    }
  }

  /**
   * 未同期のLocationを取得
   */
  private async getUnsyncedLocations(): Promise<UnsyncedDataDetail[]> {
    try {
      const locations = await dbV2.locations.toArray()
      const unsyncedLocations: UnsyncedDataDetail[] = []

      for (const location of locations) {
        const metadata = location.metadata
        if (metadata && metadataManagerService.needsSync(metadata)) {
          unsyncedLocations.push({
            type: 'location',
            id: location.id,
            name: location.name,
            action: this.determineAction(metadata),
            lastModified: metadata.lastModified
          })
        }
      }

      return unsyncedLocations
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to get unsynced locations:', error)
      return []
    }
  }

  /**
   * 未同期のTokenを取得
   */
  private async getUnsyncedTokens(): Promise<UnsyncedDataDetail[]> {
    try {
      const tokens = await dbV2.tokens.toArray()
      const unsyncedTokens: UnsyncedDataDetail[] = []

      for (const token of tokens) {
        const metadata = token.metadata
        if (metadata && metadataManagerService.needsSync(metadata)) {
          unsyncedTokens.push({
            type: 'token',
            id: token.symbol,
            name: `${token.name} (${token.symbol})`,
            action: this.determineAction(metadata),
            lastModified: metadata.lastModified
          })
        }
      }

      return unsyncedTokens
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to get unsynced tokens:', error)
      return []
    }
  }

  /**
   * 未同期のHolding数をカウント
   */
  private async countUnsyncedHoldings(): Promise<number> {
    try {
      const holdings = await dbV2.holdings.toArray()
      return holdings.filter(h => h.metadata && metadataManagerService.needsSync(h.metadata)).length
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to count unsynced holdings:', error)
      return 0
    }
  }

  /**
   * 未同期のLocation数をカウント
   */
  private async countUnsyncedLocations(): Promise<number> {
    try {
      const locations = await dbV2.locations.toArray()
      return locations.filter(l => l.metadata && metadataManagerService.needsSync(l.metadata)).length
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to count unsynced locations:', error)
      return 0
    }
  }

  /**
   * 未同期のToken数をカウント
   */
  private async countUnsyncedTokens(): Promise<number> {
    try {
      const tokens = await dbV2.tokens.toArray()
      return tokens.filter(t => t.metadata && metadataManagerService.needsSync(t.metadata)).length
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to count unsynced tokens:', error)
      return 0
    }
  }

  /**
   * メタデータからアクションを判定
   */
  private determineAction(metadata: any): 'created' | 'updated' | 'deleted' {
    if (metadata.isDeleted) return 'deleted'
    if (metadata.isNew) return 'created'
    if (metadata.isModified) return 'updated'
    return 'updated' // デフォルト
  }

  /**
   * 指定した型の未同期データ数を取得
   */
  async getUnsyncedCountByType(type: 'holding' | 'location' | 'token'): Promise<number> {
    switch (type) {
      case 'holding':
        return this.countUnsyncedHoldings()
      case 'location':
        return this.countUnsyncedLocations()
      case 'token':
        return this.countUnsyncedTokens()
      default:
        return 0
    }
  }

  /**
   * 最も古い未同期データの最終変更時刻を取得
   */
  async getOldestUnsyncedTimestamp(): Promise<Date | null> {
    try {
      const details = await this.getUnsyncedDataDetails()
      if (details.length === 0) return null

      const timestamps = details.map(d => d.lastModified.getTime())
      const oldestTimestamp = Math.min(...timestamps)
      
      return new Date(oldestTimestamp)
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to get oldest unsynced timestamp:', error)
      return null
    }
  }

  /**
   * 同期が必要な優先度順でデータを取得
   */
  async getUnsyncedDataByPriority(): Promise<UnsyncedDataDetail[]> {
    try {
      const details = await this.getUnsyncedDataDetails()
      
      // 優先度: deleted > created > updated
      // 同一優先度内では古いものから
      return details.sort((a, b) => {
        const priorityA = this.getActionPriority(a.action)
        const priorityB = this.getActionPriority(b.action)
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA // 高い優先度から
        }
        
        return a.lastModified.getTime() - b.lastModified.getTime() // 古いものから
      })
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to get unsynced data by priority:', error)
      return []
    }
  }

  /**
   * アクションの優先度を取得
   */
  private getActionPriority(action: 'created' | 'updated' | 'deleted'): number {
    switch (action) {
      case 'deleted': return 3
      case 'created': return 2
      case 'updated': return 1
      default: return 0
    }
  }

  /**
   * 未同期データの統計を取得
   */
  async getUnsyncedStats() {
    try {
      const [count, oldestTimestamp, details] = await Promise.all([
        this.getUnsyncedDataCount(),
        this.getOldestUnsyncedTimestamp(),
        this.getUnsyncedDataDetails()
      ])

      const actionCounts = {
        created: details.filter(d => d.action === 'created').length,
        updated: details.filter(d => d.action === 'updated').length,
        deleted: details.filter(d => d.action === 'deleted').length
      }

      return {
        count,
        oldestTimestamp,
        actionCounts,
        hasUnsyncedData: count.total > 0
      }
    } catch (error) {
      console.error('[UnsyncedDataTracker] Failed to get unsynced stats:', error)
      return {
        count: { holdings: 0, locations: 0, tokens: 0, total: 0 },
        oldestTimestamp: null,
        actionCounts: { created: 0, updated: 0, deleted: 0 },
        hasUnsyncedData: false
      }
    }
  }
}

// シングルトンインスタンス
export const unsyncedDataTrackerService = new UnsyncedDataTrackerService()