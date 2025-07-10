// 同期設定

export const SYNC_CONFIG = {
  // 基本設定
  retryAttempts: 3,
  retryDelay: 2000, // 2秒
  
  // インターバル設定
  intervals: {
    autoSync: 5 * 60 * 1000, // 5分
    conflictCheck: 30 * 1000, // 30秒
    metadataRefresh: 60 * 1000, // 1分
    healthCheck: 2 * 60 * 1000 // 2分
  },
  
  // ファイルサイズ制限
  limits: {
    maxBackupSize: 10 * 1024 * 1024, // 10MB
    maxDataSize: 5 * 1024 * 1024, // 5MB
    maxHistoryEntries: 100
  },
  
  // Google Drive設定
  googleDrive: {
    appFolder: 'CryptoPortfolioApp',
    backupFileName: 'portfolio-backup.json',
    metadataFileName: 'sync-metadata.json',
    chunkSize: 1024 * 1024 // 1MB
  },
  
  // 競合解決設定
  conflict: {
    resolution: 'prompt', // 'prompt' | 'local' | 'remote' | 'merge'
    autoResolveThreshold: 24 * 60 * 60 * 1000, // 24時間
    maxConflictHistory: 50
  },
  
  // デバッグ設定
  debug: {
    enableLogging: true,
    logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
    maxLogEntries: 1000
  }
} as const