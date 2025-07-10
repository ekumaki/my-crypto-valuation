import { ref, computed } from 'vue'
import { googleAuthService } from './google-auth.service'
import { googleDriveApiService, type DriveFile } from './google-drive-api.service'
import { GOOGLE_DRIVE_CONFIG, SYNC_CONFIG, ERROR_MESSAGES } from '@/config/google-drive.config'
import { dbV2 } from '@/services/db-v2'

// 新しいクラウドバックアップデータの型定義（暗号化なし）
export interface CloudBackupData {
  portfolioData: any
  timestamp: number
  version: string
  checksum: string
}

// Type declaration for Toast notifications
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

// Event emitter for sync events
class SyncEventEmitter {
  private listeners: Map<string, Function[]> = new Map()

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(...args))
    }
  }
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

class SyncService {
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
  private syncTimer: number | null = null
  private conflictCheckTimer: number | null = null
  private eventEmitter = new SyncEventEmitter()

  constructor() {
    this.loadSyncStatus()
    
    // 初期化時にクリーンアップを実行
    this.performInitialCleanup()
  }

  // Reactive getters
  get status() { return computed(() => this._status.value) }
  get isEnabled() { return computed(() => this._status.value.isEnabled) }
  get isSyncing() { return computed(() => this._status.value.isSyncing) }
  get conflictData() { return computed(() => this._conflictData.value) }
  
  // Event emitter methods
  onSyncComplete(callback: Function) {
    this.eventEmitter.on('syncComplete', callback)
  }

  offSyncComplete(callback: Function) {
    this.eventEmitter.off('syncComplete', callback)
  }

  onConflictResolved(callback: Function) {
    this.eventEmitter.on('conflictResolved', callback)
  }

  offConflictResolved(callback: Function) {
    this.eventEmitter.off('conflictResolved', callback)
  }

  private emitSyncComplete() {
    // メタデータ更新とキャッシュ再構築の完了を確実にするために待機
    setTimeout(async () => {
      console.log('[DEBUG] emitSyncComplete - firing sync complete event')
      this.eventEmitter.emit('syncComplete')
      
      // 最終的な未同期件数をログ出力
      try {
        const { metadataService } = await import('@/services/metadata.service')
        const finalCount = await metadataService.getUnsyncedDataCount(true)
        console.log('[DEBUG] emitSyncComplete - final unsynced count after event:', finalCount)
      } catch (error) {
        console.error('[DEBUG] emitSyncComplete - failed to get final count:', error)
      }
    }, 300)
  }

  private emitConflictResolved() {
    // メタデータ更新の完了を確実にするために少し待機
    setTimeout(() => {
      console.log('[DEBUG] emitConflictResolved - firing conflict resolved event')
      this.eventEmitter.emit('conflictResolved')
    }, 100)
  }
  
  /**
   * Clear conflict state - useful for forced logout scenarios
   */
  clearConflictState(): void {
    console.log('[DEBUG] SyncService.clearConflictState() called')
    this._status.value.conflictDetected = false
    this._conflictData.value = null
    this._status.value.lastSyncError = null
    this.saveSyncStatus()
  }
  
  async getUnsyncedDataCount(): Promise<number> {
    try {
      // Use metadata service for accurate unsynced data count
      const { metadataService } = await import('@/services/metadata.service')
      const unsyncedData = await metadataService.getUnsyncedDataCount(this._status.value.isEnabled)
      return unsyncedData.total
    } catch (error) {
      console.error('Failed to get unsynced data count:', error)
      return 0
    }
  }
  
  private async loadSyncStatus(): Promise<void> {
    try {
      const savedStatus = localStorage.getItem('syncStatus')
      if (savedStatus) {
        const parsed = JSON.parse(savedStatus)
        this._status.value = { ...this._status.value, ...parsed }
      }

      // Check if local data exists
      const holdings = await dbV2.holdings.toArray()
      this._status.value.localDataExists = holdings.length > 0

      // Check if cloud file exists (if authenticated)
      if (googleAuthService.isAuthenticated.value) {
        await this.checkCloudFileExists()
      }
      
      // Initialize metadata service with global sync time
      try {
        const { metadataService } = await import('@/services/metadata.service')
        const globalSyncTime = this._status.value.lastSyncTime || 0
        metadataService.setGlobalSyncTime(new Date(globalSyncTime))
        console.log('[DEBUG] loadSyncStatus - initialized metadata service with global sync time:', globalSyncTime)
      } catch (error) {
        console.warn('Failed to initialize metadata service:', error)
      }
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  private saveSyncStatus(): void {
    try {
      const statusToSave = {
        isEnabled: this._status.value.isEnabled,
        lastSyncTime: this._status.value.lastSyncTime,
        lastSyncError: this._status.value.lastSyncError,
        cloudFileExists: this._status.value.cloudFileExists,
        localDataExists: this._status.value.localDataExists,
        conflictDetected: this._status.value.conflictDetected
      }
      localStorage.setItem('syncStatus', JSON.stringify(statusToSave))
    } catch (error) {
      console.error('Failed to save sync status:', error)
    }
  }

  async checkCloudFileExists(): Promise<void> {
    try {
      const backupFile = await googleDriveApiService.findBackupFile()
      this._status.value.cloudFileExists = !!backupFile
      this.saveSyncStatus()
    } catch (error) {
      console.error('Failed to check cloud file existence:', error)
      this._status.value.cloudFileExists = false
    }
  }

  // 同期を有効化（既存ユーザー用）
  async enableSync(): Promise<SyncResult> {
    try {
      console.log('[DEBUG] enableSync - starting sync enablement for existing user')
      
      // Google認証チェック
      if (!googleAuthService.isAuthenticated.value) {
        throw new Error('Google認証が必要です')
      }

      // 同期設定を有効化
      this._status.value.isEnabled = true
      this._status.value.lastSyncError = null
      this.saveSyncStatus()

      // 初期データを確実に同期済みとしてマーク
      try {
        const { metadataService } = await import('@/services/metadata.service')
        await metadataService.forceResetAllMetadata()
        console.log('[DEBUG] enableSync - initial data marked as synced')
      } catch (error) {
        console.warn('[DEBUG] enableSync - failed to mark initial data as synced:', error)
      }

      // 自動同期を開始
      this.startAutoSync()

      // ローカルデータ件数を確認して競合検出をスキップするか判定
      const { secureStorage } = await import('@/services/storage.service')
      const localHoldings = await secureStorage.getHoldings()
      const skipConflictDetection = localHoldings.length === 0
      
      console.log('[DEBUG] enableSync - performing initial sync')
      console.log('[DEBUG] enableSync - local holdings count:', localHoldings.length)
      console.log('[DEBUG] enableSync - skip conflict detection:', skipConflictDetection)
      
      // 競合検出をスキップして同期実行（ローカルデータ0件時）
      const syncResult = await this.performSync({ skipConflictDetection })
      
      if (!syncResult.success && !syncResult.conflictData) {
        // 競合以外のエラーの場合は同期を無効化
        this._status.value.isEnabled = false
        this.stopAutoSync()
        this.saveSyncStatus()
        return syncResult
      }

      console.log('[DEBUG] enableSync - sync enabled successfully')
      return { success: true, message: '同期が有効になりました' }
    } catch (error) {
      console.error('Failed to enable sync:', error)
      this._status.value.isEnabled = false
      this._status.value.lastSyncError = error instanceof Error ? error.message : '同期の有効化に失敗しました'
      this.saveSyncStatus()
      
      return {
        success: false,
        message: error instanceof Error ? error.message : '同期の有効化に失敗しました'
      }
    }
  }

  // 同期を有効化（新規ユーザー用）
  async enableSyncForNewUser(): Promise<SyncResult> {
    try {
      console.log('[DEBUG] enableSyncForNewUser - starting sync enablement for new user')
      
      // Google認証チェック
      if (!googleAuthService.isAuthenticated.value) {
        throw new Error('Google認証が必要です')
      }

      // 同期設定を有効化
      this._status.value.isEnabled = true
      this._status.value.lastSyncError = null
      this.saveSyncStatus()

      // 初期データを確実に同期済みとしてマーク
      try {
        const { metadataService } = await import('@/services/metadata.service')
        await metadataService.forceResetAllMetadata()
        console.log('[DEBUG] enableSyncForNewUser - initial data marked as synced')
      } catch (error) {
        console.warn('[DEBUG] enableSyncForNewUser - failed to mark initial data as synced:', error)
      }

      // 自動同期を開始
      this.startAutoSync()

      // 新規ユーザーの場合は常に競合検出をスキップ
      console.log('[DEBUG] enableSyncForNewUser - performing initial sync')
      console.log('[DEBUG] enableSyncForNewUser - skip conflict detection: true (new user)')
      
      // 競合検出をスキップして同期実行（新規ユーザー）
      const syncResult = await this.performSync({ skipConflictDetection: true })
      
      if (!syncResult.success && !syncResult.conflictData) {
        // 競合以外のエラーの場合は同期を無効化
        this._status.value.isEnabled = false
        this.stopAutoSync()
        this.saveSyncStatus()
        return syncResult
      }

      console.log('[DEBUG] enableSyncForNewUser - sync enabled successfully')
      return { success: true, message: '同期が有効になりました' }
    } catch (error) {
      console.error('Failed to enable sync for new user:', error)
      this._status.value.isEnabled = false
      this._status.value.lastSyncError = error instanceof Error ? error.message : '同期の有効化に失敗しました'
      this.saveSyncStatus()
      
      return {
        success: false,
        message: error instanceof Error ? error.message : '同期の有効化に失敗しました'
      }
    }
  }

  async disableSync(): Promise<void> {
    console.log('[DEBUG] disableSync - disabling sync')
    this._status.value.isEnabled = false
    this._status.value.lastSyncError = null
    this.stopAutoSync()
    this.saveSyncStatus()
    
    // クラウドパスワードをローカルストレージから削除
    localStorage.removeItem('cloudPassword')
    
    console.log('[DEBUG] disableSync - sync disabled successfully')
  }

  async performSync(options: { skipConflictDetection?: boolean } = {}): Promise<SyncResult> {
    if (this._status.value.isSyncing) {
      return { success: false, message: '同期が既に実行中です' }
    }

    if (!googleAuthService.isAuthenticated.value) {
      return { success: false, message: 'Google認証が必要です' }
    }

    this._status.value.isSyncing = true
    this._status.value.lastSyncError = null
    
    try {
      console.log('[DEBUG] performSync - starting sync process')
      
      // 暗号化キーの復元を試行
      const { secureStorage } = await import('@/services/storage.service')
      if (!secureStorage.isUnlocked()) {
        const autoUnlockSuccess = await this.attemptAutoUnlock()
        if (!autoUnlockSuccess) {
          throw new Error('ENCRYPTION_KEY_NOT_AVAILABLE')
        }
      }

      // ローカルデータを取得
      const localData = await this.getLocalData()
      const localTimestamp = await this.getLocalTimestamp()
      
      console.log('[DEBUG] performSync - got local data:', {
        holdingsCount: localData.holdings?.length || 0,
        locationsCount: localData.locations?.length || 0,
        tokensCount: localData.tokens?.length || 0,
        localTimestamp: new Date(localTimestamp).toISOString()
      })

      // クラウドファイルの存在確認
      const backupFile = await googleDriveApiService.findBackupFile()
      
      if (!backupFile) {
        // クラウドファイルが存在しない場合は新規アップロード
        console.log('[DEBUG] performSync - no cloud file found, uploading local data')
        await this.uploadToCloud(localData)
        
        const syncTime = Date.now()
        this._status.value.lastSyncTime = syncTime
        this._status.value.cloudFileExists = true
        
        await this.updateLocalTimestamps(syncTime)
        
        this.saveSyncStatus()
        this.emitSyncComplete()
        
        return { success: true, message: 'ローカルデータをクラウドにアップロードしました' }
      }

      // クラウドデータをダウンロード
      console.log('[DEBUG] performSync - downloading cloud data')
      const cloudData = await this.downloadFromCloud(backupFile.id)
      
      console.log('[DEBUG] performSync - got cloud data:', {
        holdingsCount: cloudData.portfolioData?.holdings?.length || 0,
        locationsCount: cloudData.portfolioData?.locations?.length || 0,
        tokensCount: cloudData.portfolioData?.tokens?.length || 0,
        cloudTimestamp: new Date(cloudData.timestamp).toISOString()
      })

      // 競合検出（スキップオプションが有効でない場合のみ）
      if (!options.skipConflictDetection) {
        const hasConflict = await this.detectConflict(localData, cloudData, localTimestamp)
        
        if (hasConflict) {
          console.log('[DEBUG] performSync - conflict detected, storing conflict data')
          this._conflictData.value = {
            localData,
            cloudData: cloudData.portfolioData,
            localTimestamp,
            cloudTimestamp: cloudData.timestamp
          }
          this._status.value.conflictDetected = true
          this._status.value.lastSyncError = '同期競合が検出されました'
          this.saveSyncStatus()
          
          return {
            success: false,
            message: '同期競合が検出されました',
            conflictData: this._conflictData.value
          }
        }
      } else {
        console.log('[DEBUG] performSync - skipping conflict detection, prioritizing local data')
      }

      // 同期処理
      let finalData: any
      let syncMessage: string

      if (options.skipConflictDetection) {
        // 競合検出をスキップした場合の処理
        const localHoldings = localData.holdings || []
        if (localHoldings.length === 0) {
          // ローカル保有データが0件の場合はクラウドデータを優先
          console.log('[DEBUG] performSync - local holdings empty, downloading cloud data')
          finalData = cloudData.portfolioData
          await this.updateLocalData(finalData)
          syncMessage = 'クラウドデータをローカルに取得しました'
        } else {
          // ローカル保有データがある場合はローカルデータを優先
          console.log('[DEBUG] performSync - local data priority mode, uploading to cloud')
          finalData = localData
          await this.uploadToCloud(finalData)
          syncMessage = 'ローカルデータをクラウドにアップロードしました'
        }
      } else if (cloudData.timestamp > localTimestamp) {
        // クラウドデータが新しい場合
        console.log('[DEBUG] performSync - cloud data is newer, updating local data')
        finalData = cloudData.portfolioData
        await this.updateLocalData(finalData)
        syncMessage = 'クラウドデータでローカルデータを更新しました'
      } else if (localTimestamp > cloudData.timestamp) {
        // ローカルデータが新しい場合
        console.log('[DEBUG] performSync - local data is newer, uploading to cloud')
        finalData = localData
        await this.uploadToCloud(finalData)
        syncMessage = 'ローカルデータをクラウドにアップロードしました'
      } else {
        // タイムスタンプが同じ場合
        console.log('[DEBUG] performSync - timestamps are equal, no sync needed')
        finalData = localData
        syncMessage = 'データは既に同期されています'
      }

      // 同期完了処理
      const syncTime = Date.now()
      this._status.value.lastSyncTime = syncTime
      this._status.value.conflictDetected = false
      this._conflictData.value = null
      
      await this.updateLocalTimestamps(syncTime)
      
      // 同期完了後、すべてのデータを同期済みとしてマーク
      try {
        const { metadataService } = await import('@/services/metadata.service')
        await metadataService.markAllAsSynced()
        console.log('[DEBUG] performSync - all data marked as synced')
      } catch (error) {
        console.warn('[DEBUG] performSync - failed to mark data as synced:', error)
      }
      
      this.saveSyncStatus()
      this.emitSyncComplete()
      
      console.log('[DEBUG] performSync - sync completed successfully')
      return { success: true, message: syncMessage }

    } catch (error) {
      console.error('Sync failed:', error)
      
      if (error instanceof Error && error.message === 'ENCRYPTION_KEY_NOT_AVAILABLE') {
        this._status.value.lastSyncError = '暗号化キーが利用できません。再ログインが必要です。'
        return { success: false, message: '暗号化キーが利用できません。再ログインが必要です。' }
      }
      
      const errorMessage = error instanceof Error ? error.message : '同期に失敗しました'
      this._status.value.lastSyncError = errorMessage
      this.saveSyncStatus()
      
      return { success: false, message: errorMessage }
    } finally {
      this._status.value.isSyncing = false
    }
  }

  private async attemptAutoUnlock(): Promise<boolean> {
    try {
      const { secureStorage } = await import('@/services/storage.service')
      
      if (secureStorage.isUnlocked()) {
        console.log('[DEBUG] attemptAutoUnlock - storage already unlocked')
        return true
      }

      // セッションストレージから暗号化キーを取得
      let keyData = sessionStorage.getItem('encryptionKey')
      let keySource = 'session'
      
      // セッションストレージにない場合はローカルストレージから取得
      if (!keyData) {
        keyData = localStorage.getItem('encryptionKey')
        keySource = 'local'
      }
      
      if (keyData) {
        console.log(`[DEBUG] attemptAutoUnlock - found encryption key in ${keySource} storage, attempting to unlock`)
        
        try {
          const { CryptoService } = await import('@/services/crypto.service')
          const cryptoKey = await CryptoService.importKey(keyData)
          secureStorage.setEncryptionKey(cryptoKey)
          
          if (secureStorage.isUnlocked()) {
            console.log(`[DEBUG] attemptAutoUnlock - successfully unlocked with ${keySource} key`)
            
            // セッションストレージにキーがない場合は保存
            if (keySource === 'local' && !sessionStorage.getItem('encryptionKey')) {
              sessionStorage.setItem('encryptionKey', keyData)
              console.log('[DEBUG] attemptAutoUnlock - restored key to session storage')
            }
            
            return true
          } else {
            console.log(`[DEBUG] attemptAutoUnlock - ${keySource} key failed to unlock storage`)
          }
        } catch (keyError) {
          console.error(`[DEBUG] attemptAutoUnlock - failed to import key from ${keySource} storage:`, keyError)
          // Remove invalid key
          if (keySource === 'session') {
            sessionStorage.removeItem('encryptionKey')
          } else {
            localStorage.removeItem('encryptionKey')
          }
        }
      } else {
        console.log('[DEBUG] attemptAutoUnlock - no encryption key found in session or local storage')
      }

      return false
    } catch (error) {
      console.error('[DEBUG] attemptAutoUnlock - error during auto unlock:', error)
      return false
    }
  }

  private async updateLocalTimestamps(syncTime: number): Promise<void> {
    localStorage.setItem('lastDataModified', syncTime.toString())
  }

  async getLocalData(): Promise<any> {
    const { secureStorage } = await import('@/services/storage.service')
    
    try {
      const holdings = await secureStorage.getHoldings()
      console.log('[DEBUG] getLocalData - got holdings:', holdings.length)
    } catch (error) {
      if (error instanceof Error && error.message === 'ENCRYPTION_KEY_MISMATCH') {
        console.log('[DEBUG] getLocalData - clearing incompatible encrypted data')
        await secureStorage.clearIncompatibleEncryptedData()
        // After clearing, return empty data
        return {
          holdings: [],
          locations: await dbV2.locations.toArray(),
          tokens: await dbV2.tokens.toArray()
        }
      }
      throw error
    }
    
    const holdings = await secureStorage.getHoldings()
    const locations = await dbV2.locations.toArray()
    const tokens = await dbV2.tokens.toArray()
    
    return {
      holdings,
      locations,
      tokens
    }
  }

  private async getLocalTimestamp(): Promise<number> {
    const lastModified = localStorage.getItem('lastDataModified')
    return lastModified ? parseInt(lastModified) : 0
  }

  private async uploadToCloud(data: any): Promise<void> {
    // 平文でのクラウドバックアップデータを作成
    const backupData: CloudBackupData = {
      portfolioData: data,
      timestamp: Date.now(),
      version: '2.0', // 新しいバージョン（暗号化なし）
      checksum: this.createDataHash(data)
    }

    const dataString = JSON.stringify(backupData, null, 2)

    // Check file size
    if (dataString.length > SYNC_CONFIG.maxBackupSize) {
      throw new Error('バックアップファイルのサイズが上限を超えています')
    }

    const backupFile = await googleDriveApiService.findBackupFile()
    
    if (backupFile) {
      // Update existing file
      await googleDriveApiService.updateFile(backupFile.id, dataString)
    } else {
      // Create new file
      await googleDriveApiService.uploadFile({
        data: dataString,
        metadata: {
          name: GOOGLE_DRIVE_CONFIG.backupFileName,
          mimeType: 'application/json'
        }
      })
    }
  }

  private async downloadFromCloud(fileId: string): Promise<CloudBackupData> {
    const dataString = await googleDriveApiService.downloadFile(fileId)
    const backupData: CloudBackupData = JSON.parse(dataString)
    
    // データの整合性チェック
    if (!backupData.portfolioData || !backupData.timestamp) {
      throw new Error('無効なバックアップデータです')
    }
    
    return backupData
  }

  private async detectConflict(localData: any, cloudData: CloudBackupData, localTimestamp: number): Promise<boolean> {
    console.log('[DEBUG] Conflict detection:')
    console.log('  Local timestamp:', new Date(localTimestamp).toISOString())
    console.log('  Cloud timestamp:', new Date(cloudData.timestamp).toISOString())
    
    // ローカルの保有データが0件の場合は競合なし（初回同期として扱う）
    const localHoldings = localData.holdings || []
    if (localHoldings.length === 0) {
      console.log('  Local holdings count: 0 - treating as initial sync, no conflict')
      return false
    }
    
    console.log('  Local holdings count:', localHoldings.length)
    console.log('  Cloud holdings count:', (cloudData.portfolioData.holdings || []).length)
    
    // 保有データのみで競合判定（保管場所・トークンは除外）
    const localHoldingsHash = this.createHoldingsHash(localHoldings)
    const cloudHoldingsHash = this.createHoldingsHash(cloudData.portfolioData.holdings || [])
    
    console.log('  Local holdings hash:', localHoldingsHash)
    console.log('  Cloud holdings hash:', cloudHoldingsHash)
    
    const hasConflict = localHoldingsHash !== cloudHoldingsHash
    console.log('  Conflict detected:', hasConflict)
    
    return hasConflict
  }
  
  private createHoldingsHash(holdings: any[]): string {
    // 保有データのみでハッシュを生成（保管場所・トークンは除外）
    const normalized = (holdings || [])
      .filter((h: any) => h && h.symbol && h.quantity != null && h.quantity > 0) // 有効な保有データのみ
      .map((h: any) => ({
        symbol: h.symbol?.toUpperCase()?.trim() || '',
        quantity: Math.round(parseFloat((h.quantity || 0).toString()) * 100000000) / 100000000, // 8桁精度
        locationId: (h.locationId || '').toString().trim(),
        note: (h.note || '').trim()
      }))
      .sort((a: any, b: any) => {
        const symbolCompare = a.symbol.localeCompare(b.symbol)
        if (symbolCompare !== 0) return symbolCompare
        const locationCompare = a.locationId.localeCompare(b.locationId)
        if (locationCompare !== 0) return locationCompare
        return a.quantity - b.quantity
      })
    
    const dataString = JSON.stringify(normalized, null, 0)
    console.log('[DEBUG] createHoldingsHash - holdings count:', normalized.length)
    console.log('[DEBUG] createHoldingsHash - data preview:', dataString.substring(0, 200) + '...')
    
    // Simple hash function
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    const hashString = hash.toString(16)
    console.log('[DEBUG] createHoldingsHash - result:', hashString)
    return hashString
  }
  
  private createDataHash(data: any): string {
    // Create a normalized hash that ignores minor differences and metadata
    const normalized = {
      holdings: (data.holdings || [])
        .filter((h: any) => h && h.symbol && h.quantity != null) // Filter out invalid holdings
        .map((h: any) => ({
          symbol: h.symbol?.toUpperCase()?.trim() || '',
          quantity: Math.round(parseFloat((h.quantity || 0).toString()) * 100000000) / 100000000, // Round to 8 decimal places
          locationId: (h.locationId || '').toString().trim(),
          note: (h.note || '').trim()
        }))
        .filter((h: any) => h.symbol && h.quantity > 0) // Only include valid holdings with positive quantity
        .sort((a: any, b: any) => {
          const symbolCompare = a.symbol.localeCompare(b.symbol)
          if (symbolCompare !== 0) return symbolCompare
          const locationCompare = a.locationId.localeCompare(b.locationId)
          if (locationCompare !== 0) return locationCompare
          return a.quantity - b.quantity
        }),
      locations: (data.locations || [])
        .filter((l: any) => l && l.id && l.name && l.isCustom) // Only include custom locations
        .map((l: any) => ({
          id: l.id.toString().trim(),
          name: l.name.trim(),
          type: l.type || 'custom',
          isCustom: true
        }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id)),
      tokens: (data.tokens || [])
        .filter((t: any) => t && t.symbol && t.name) // Filter out invalid tokens
        .map((t: any) => ({
          symbol: t.symbol?.toUpperCase()?.trim() || '',
          name: t.name.trim(),
          id: (t.id || '').toString().trim()
        }))
        .filter((t: any) => {
          // Exclude preset tokens from hash
          const presetSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'SHIB', 'MATIC', 'LTC', 'ATOM', 'LINK', 'UNI']
          return !presetSymbols.includes(t.symbol)
        })
        .sort((a: any, b: any) => a.symbol.localeCompare(b.symbol))
    }
    
    // Create hash from normalized data
    const dataString = JSON.stringify(normalized, null, 0)
    console.log('[DEBUG] createDataHash - normalized data:', {
      holdingsCount: normalized.holdings.length,
      customLocationsCount: normalized.locations.length,
      customTokensCount: normalized.tokens.length,
      dataString: dataString.substring(0, 200) + '...'
    })
    
    // Simple hash function (for debugging purposes)
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    const hashString = hash.toString(16)
    console.log('[DEBUG] createDataHash - result:', hashString)
    return hashString
  }

  private async mergeData(localData: any, cloudData: CloudBackupData, localTimestamp: number): Promise<any> {
    // Use the most recent data
    if (cloudData.timestamp > localTimestamp) {
      return cloudData.portfolioData
    } else {
      return localData
    }
  }

  private async updateLocalData(data: any): Promise<void> {
    const { secureStorage } = await import('@/services/storage.service')
    
    console.log('updateLocalData called with:', data)
    console.log('[DEBUG] Detailed sync data contents:')
    console.log('  Holdings count:', data.holdings?.length || 0)
    console.log('  Holdings data:', data.holdings)
    console.log('  Tokens count:', data.tokens?.length || 0)
    console.log('  Locations count:', data.locations?.length || 0)
    console.log('secureStorage isUnlocked:', secureStorage.isUnlocked())
    
    // Clear existing data
    await dbV2.holdings.clear()
    
    // Add holdings using secure storage to maintain encryption compatibility
    if (data.holdings && Array.isArray(data.holdings)) {
      console.log('Adding holdings:', data.holdings.length)
      for (const holding of data.holdings) {
        console.log('Adding holding:', holding)
        try {
          await secureStorage.addHolding({
            symbol: holding.symbol,
            quantity: holding.quantity,
            locationId: holding.locationId,
            note: holding.note || ''
          })
          console.log('Successfully added holding:', holding.symbol)
        } catch (error) {
          console.error('Failed to add holding:', holding, error)
          throw error
        }
      }
    }
    
    // Update locations directly (not encrypted)
    if (data.locations && Array.isArray(data.locations)) {
      await dbV2.locations.clear()
      const cleanLocations = data.locations.map((item: any) => this.cleanObjectForDB(item))
      await dbV2.locations.bulkAdd(cleanLocations)
    }
    
    // Update tokens directly (not encrypted)
    if (data.tokens && Array.isArray(data.tokens)) {
      await dbV2.tokens.clear()
      const cleanTokens = data.tokens.map((item: any) => this.cleanObjectForDB(item))
      await dbV2.tokens.bulkAdd(cleanTokens)
      console.log('Added tokens:', data.tokens.length)
    }
    
    // Update metadata service
    try {
      const { metadataService } = await import('@/services/metadata.service')
      metadataService.clearMetadataCache()
      console.log('[DEBUG] updateLocalData - metadata cache cleared')
    } catch (error) {
      console.warn('Failed to clear metadata cache:', error)
    }
    
    // Update last data modified timestamp
    localStorage.setItem('lastDataModified', Date.now().toString())
  }

  private cleanObjectForDB(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObjectForDB(item))
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(obj)) {
        if (key !== 'metadata' && value !== undefined) {
          cleaned[key] = this.cleanObjectForDB(value)
        }
      }
      return cleaned
    }
    
    return obj
  }

  async resolveConflict(resolution: 'local' | 'cloud', conflictData: SyncConflict): Promise<SyncResult> {
    if (!conflictData) {
      return { success: false, message: '競合データが見つかりません' }
    }

    this._status.value.isSyncing = true
    
    try {
      let dataToUse: any
      let message: string

      if (resolution === 'local') {
        // ローカルデータを使用
        dataToUse = conflictData.localData
        await this.uploadToCloud(dataToUse)
        message = 'ローカルデータでクラウドを更新しました'
      } else {
        // クラウドデータを使用
        dataToUse = conflictData.cloudData
        await this.updateLocalData(dataToUse)
        message = 'クラウドデータでローカルを更新しました'
      }

      // 競合状態をクリア
      this._status.value.conflictDetected = false
      this._conflictData.value = null
      this._status.value.lastSyncError = null
      
      // 同期時刻を更新
      const syncTime = Date.now()
      this._status.value.lastSyncTime = syncTime
      await this.updateLocalTimestamps(syncTime)
      
      this.saveSyncStatus()
      this.emitConflictResolved()
      
      return { success: true, message }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      const errorMessage = error instanceof Error ? error.message : '競合の解決に失敗しました'
      this._status.value.lastSyncError = errorMessage
      this.saveSyncStatus()
      
      return { success: false, message: errorMessage }
    } finally {
      this._status.value.isSyncing = false
    }
  }

  private startAutoSync(): void {
    this.stopAutoSync() // 既存のタイマーをクリア
    
    // 定期的な自動同期（5分間隔）
    this.syncTimer = window.setInterval(async () => {
      if (!this._status.value.isSyncing && !this._status.value.conflictDetected) {
        console.log('[DEBUG] Auto sync triggered')
        await this.performSync()
      }
    }, 5 * 60 * 1000) // 5 minutes
    
    // 競合チェック（30秒間隔）
    this.conflictCheckTimer = window.setInterval(async () => {
      if (this._status.value.conflictDetected) {
        console.log('[DEBUG] Conflict check - conflict still detected')
      }
    }, 30 * 1000) // 30 seconds
    
    console.log('[DEBUG] Auto sync timers started')
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
    
    if (this.conflictCheckTimer) {
      clearInterval(this.conflictCheckTimer)
      this.conflictCheckTimer = null
    }
    
    console.log('[DEBUG] Auto sync timers stopped')
  }

  async resetAutoSyncTimer(): Promise<void> {
    if (this._status.value.isEnabled) {
      this.startAutoSync()
    }
  }

  private async performInitialCleanup() {
    try {
      // 古いクラウドパスワード関連の設定をクリーンアップ
      const oldCloudPassword = localStorage.getItem('cloudPassword')
      if (oldCloudPassword) {
        console.log('[DEBUG] performInitialCleanup - removing old cloud password')
        localStorage.removeItem('cloudPassword')
      }
    } catch (error) {
      console.warn('Failed to perform initial cleanup:', error)
    }
  }

  destroy(): void {
    this.stopAutoSync()
    // Clear all event listeners
    this.eventEmitter = new SyncEventEmitter()
  }

  /**
   * データ変更時の自動同期をトリガー
   */
  async triggerSyncOnDataChange(): Promise<void> {
    // 同期が有効で、現在同期中でなく、競合が検出されていない場合のみ実行
    if (this._status.value.isEnabled && 
        !this._status.value.isSyncing && 
        !this._status.value.conflictDetected) {
      console.log('[DEBUG] triggerSyncOnDataChange - triggering sync due to data change')
      
      // 短時間の遅延後に同期を実行（連続する変更をバッチ処理するため）
      setTimeout(async () => {
        if (this._status.value.isEnabled && 
            !this._status.value.isSyncing && 
            !this._status.value.conflictDetected) {
          // データ変更時は競合検出をスキップしてローカルデータを優先
          await this.performSync({ skipConflictDetection: true })
        }
      }, 1000) // 1秒の遅延
    }
  }
}

export const syncService = new SyncService()
