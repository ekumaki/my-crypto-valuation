export interface GoogleDriveConfig {
  clientId: string
  apiKey: string
  appFolder: string
  backupFileName: string
  discoveryDoc: string
  scopes: string[]
}

export const GOOGLE_DRIVE_CONFIG: GoogleDriveConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  appFolder: 'CryptoPortfolioApp',
  backupFileName: 'portfolio-backup.json',
  discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata'
  ]
}

export const SYNC_CONFIG = {
  retryAttempts: 3,
  retryDelay: 2000, // 2 seconds
  conflictCheckInterval: 30000, // 30 seconds
  autoSyncInterval: 300000, // 5 minutes
  maxBackupSize: 10 * 1024 * 1024, // 10MB
  encryptionAlgorithm: 'AES-256-GCM'
}

export const ERROR_MESSAGES = {
  AUTH_FAILED: 'Google認証に失敗しました',
  UPLOAD_FAILED: 'データのアップロードに失敗しました',
  DOWNLOAD_FAILED: 'データのダウンロードに失敗しました',
  ENCRYPTION_FAILED: 'データの暗号化に失敗しました',
  DECRYPTION_FAILED: 'データの復号化に失敗しました',
  INVALID_PASSWORD: 'クラウドパスワードが正しくありません',
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  QUOTA_EXCEEDED: 'Google Driveの容量制限に達しました',
  SYNC_CONFLICT: '同期競合が発生しました',
  FILE_NOT_FOUND: 'バックアップファイルが見つかりません'
}