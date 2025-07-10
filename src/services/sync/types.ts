// 同期サービス関連の型定義

export interface CloudBackupData {
  portfolioData: any
  timestamp: number
  version: string
  checksum: string
}

export interface SyncStatus {
  isEnabled: boolean
  isSyncing: boolean
  lastSyncTime: number | null
  lastSyncError: string | null
  cloudFileExists: boolean
  localDataExists: boolean
  conflictDetected: boolean
}

export interface SyncConflict {
  localData: any
  cloudData: any
  localTimestamp: number
  cloudTimestamp: number
}

export interface SyncResult {
  success: boolean
  message: string
  conflictData?: SyncConflict
}

export interface ConflictResolution {
  action: 'use_local' | 'use_cloud' | 'merge' | 'cancel'
  data?: any
}

export interface SyncMetrics {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  averageSyncTime: number
  lastSyncDuration: number
}

// Toast通知用の型定義
declare global {
  interface Window {
    showToast?: {
      success: (title: string, message?: string, duration?: number) => string
      error: (title: string, message?: string, duration?: number) => string
      info: (title: string, message?: string, duration?: number) => string
      warning: (title: string, message?: string, duration?: number) => string
    }
  }
}