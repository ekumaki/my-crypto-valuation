// 同期競合解決サービス

import type { SyncConflict, ConflictResolution, CloudBackupData } from './types'
import { SYNC_CONFIG } from '@/config/sync.config'

export class ConflictResolverService {
  /**
   * 競合を検出する
   */
  detectConflict(localData: any, cloudData: CloudBackupData, isRelogin: boolean = false): SyncConflict | null {
    if (!localData || !cloudData) {
      return null
    }

    // ローカルデータが空の場合は競合なし（クラウドデータを使用）
    if (this.isLocalDataEmpty(localData)) {
      console.log('[ConflictResolver] Local data is empty, no conflict detected')
      return null
    }

    const localTimestamp = localData.timestamp || 0
    const cloudTimestamp = cloudData.timestamp || 0

    // データ内容の比較（先に実行して同一データの場合は競合なし）
    if (this.areDataEqual(localData, cloudData.portfolioData)) {
      console.log('[ConflictResolver] Data is identical, no conflict detected')
      return null
    }

    // 再ログイン時の特別処理
    if (isRelogin) {
      // 再ログイン時は同一ユーザーの可能性が高いため、より緩い条件で自動解決
      const timeDiff = Math.abs(localTimestamp - cloudTimestamp)
      
      // 24時間以内の差であれば、より新しいデータを自動選択
      if (timeDiff < 24 * 60 * 60 * 1000) {
        console.log('[ConflictResolver] Relogin detected with recent data, will auto-resolve')
        return this.createAutoResolvableConflict(localData, cloudData.portfolioData, localTimestamp, cloudTimestamp)
      }
    }

    // 通常の競合検出
    const timeDiff = Math.abs(localTimestamp - cloudTimestamp)
    if (timeDiff < SYNC_CONFIG.conflict.autoResolveThreshold) {
      return null
    }

    // 実際の競合として返す
    return {
      localData,
      cloudData: cloudData.portfolioData,
      localTimestamp,
      cloudTimestamp
    }
  }

  /**
   * 自動競合解決を試行する
   */
  autoResolve(conflict: SyncConflict): ConflictResolution | null {
    const { localTimestamp, cloudTimestamp } = conflict
    
    // 自動解決可能フラグがある場合は優先的に処理
    if ((conflict as any).autoResolvable) {
      console.log('[ConflictResolver] Auto-resolving conflict:', (conflict as any).reason)
      
      // より新しいデータを自動選択
      if (cloudTimestamp > localTimestamp) {
        return { action: 'use_cloud', data: conflict.cloudData }
      } else {
        return { action: 'use_local', data: conflict.localData }
      }
    }
    
    // 設定に基づく自動解決
    switch (SYNC_CONFIG.conflict.resolution) {
      case 'local':
        return { action: 'use_local', data: conflict.localData }
      
      case 'remote':
        return { action: 'use_cloud', data: conflict.cloudData }
      
      case 'merge':
        const mergedData = this.mergeData(conflict.localData, conflict.cloudData)
        if (mergedData) {
          return { action: 'merge', data: mergedData }
        }
        break
    }

    // 時間ベースの解決（より新しいデータを選択）
    const timeDiff = Math.abs(cloudTimestamp - localTimestamp)
    
    // 短時間の差（5分以内）であれば自動解決
    if (timeDiff < 5 * 60 * 1000) {
      if (cloudTimestamp > localTimestamp) {
        return { action: 'use_cloud', data: conflict.cloudData }
      } else {
        return { action: 'use_local', data: conflict.localData }
      }
    }

    // 通常の時間ベース解決
    if (cloudTimestamp > localTimestamp) {
      return { action: 'use_cloud', data: conflict.cloudData }
    } else if (localTimestamp > cloudTimestamp) {
      return { action: 'use_local', data: conflict.localData }
    }

    return null
  }

  /**
   * データをマージする（可能な場合）
   */
  private mergeData(localData: any, cloudData: any): any | null {
    try {
      // シンプルなマージロジック
      // より高度なマージロジックが必要な場合は拡張可能
      const merged = {
        ...cloudData,
        ...localData,
        timestamp: Math.max(localData.timestamp || 0, cloudData.timestamp || 0)
      }

      return merged
    } catch (error) {
      console.error('Failed to merge data:', error)
      return null
    }
  }

  /**
   * 自動解決可能な競合を作成
   */
  private createAutoResolvableConflict(localData: any, cloudData: any, localTimestamp: number, cloudTimestamp: number): SyncConflict {
    // より新しいデータを自動選択するためのマーカーを付与
    const conflict: SyncConflict = {
      localData,
      cloudData,
      localTimestamp,
      cloudTimestamp
    }
    
    // 自動解決フラグを追加（内部処理用）
    ;(conflict as any).autoResolvable = true
    ;(conflict as any).reason = 'relogin_recent_data'
    
    return conflict
  }

  /**
   * データが等しいかチェックする
   */
  private areDataEqual(data1: any, data2: any): boolean {
    try {
      // タイムスタンプを除外して比較（同期時に微小な差が生じるため）
      const cleanData1 = this.cleanDataForComparison(data1)
      const cleanData2 = this.cleanDataForComparison(data2)
      
      return JSON.stringify(cleanData1) === JSON.stringify(cleanData2)
    } catch (error) {
      console.error('Failed to compare data:', error)
      return false
    }
  }

  /**
   * ローカルデータが空かどうかをチェック
   */
  private isLocalDataEmpty(localData: any): boolean {
    if (!localData) return true
    
    // 主要なデータ配列をチェック
    const holdingsCount = Array.isArray(localData.holdings) ? localData.holdings.length : 0
    const locationsCount = Array.isArray(localData.locations) ? localData.locations.length : 0
    const tokensCount = Array.isArray(localData.tokens) ? localData.tokens.length : 0
    
    // すべてのデータが0件の場合は空とみなす
    const isEmpty = holdingsCount === 0 && locationsCount === 0 && tokensCount === 0
    
    console.log('[ConflictResolver] Local data check:', {
      holdings: holdingsCount,
      locations: locationsCount,
      tokens: tokensCount,
      isEmpty
    })
    
    return isEmpty
  }

  /**
   * 比較用にデータをクリーンアップ
   */
  private cleanDataForComparison(data: any): any {
    if (!data || typeof data !== 'object') return data
    
    const cleaned = { ...data }
    
    // タイムスタンプ系フィールドを除外
    delete cleaned.timestamp
    delete cleaned.lastSyncTime
    delete cleaned.lastModified
    
    // 配列の場合は各要素も同様に処理
    if (Array.isArray(cleaned.holdings)) {
      cleaned.holdings = cleaned.holdings.map((item: any) => {
        const cleanItem = { ...item }
        delete cleanItem.updatedAt
        delete cleanItem.createdAt
        return cleanItem
      })
    }
    
    if (Array.isArray(cleaned.locations)) {
      cleaned.locations = cleaned.locations.map((item: any) => {
        const cleanItem = { ...item }
        delete cleanItem.updatedAt
        delete cleanItem.createdAt
        return cleanItem
      })
    }
    
    if (Array.isArray(cleaned.tokens)) {
      cleaned.tokens = cleaned.tokens.map((item: any) => {
        const cleanItem = { ...item }
        delete cleanItem.updatedAt
        delete cleanItem.createdAt
        return cleanItem
      })
    }
    
    return cleaned
  }

  /**
   * 競合履歴を記録する
   */
  recordConflict(conflict: SyncConflict, resolution: ConflictResolution) {
    try {
      const history = this.getConflictHistory()
      const record = {
        timestamp: Date.now(),
        conflict,
        resolution,
        id: this.generateConflictId()
      }

      history.push(record)

      // 履歴サイズを制限
      if (history.length > SYNC_CONFIG.conflict.maxConflictHistory) {
        history.splice(0, history.length - SYNC_CONFIG.conflict.maxConflictHistory)
      }

      localStorage.setItem('sync_conflict_history', JSON.stringify(history))
    } catch (error) {
      console.error('Failed to record conflict:', error)
    }
  }

  /**
   * 競合履歴を取得する
   */
  getConflictHistory(): any[] {
    try {
      const historyJson = localStorage.getItem('sync_conflict_history')
      return historyJson ? JSON.parse(historyJson) : []
    } catch (error) {
      console.error('Failed to get conflict history:', error)
      return []
    }
  }

  /**
   * 競合IDを生成する
   */
  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// シングルトンインスタンス
export const conflictResolverService = new ConflictResolverService()