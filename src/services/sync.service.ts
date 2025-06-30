import { ref, computed } from 'vue'
import { googleAuthService } from './google-auth.service'
import { googleDriveApiService, type DriveFile } from './google-drive-api.service'
import { cloudEncryptionService, type EncryptedData, type CloudBackupData } from './cloud-encryption.service'
import { GOOGLE_DRIVE_CONFIG, SYNC_CONFIG, ERROR_MESSAGES } from '@/config/google-drive.config'
import { dbV2 } from '@/services/db-v2'

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

  private _cloudPassword = ref<string | null>(null)
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
  get hasCloudPassword() { return computed(() => this._cloudPassword.value !== null) }
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
    this.eventEmitter.emit('syncComplete')
  }

  private emitConflictResolved() {
    this.eventEmitter.emit('conflictResolved')
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
  
  // Method to set cloud password (for manual sync scenarios)
  setCloudPassword(password: string): void {
    this._cloudPassword.value = password
  }

  private async loadSyncStatus(): Promise<void> {
    try {
      const savedStatus = localStorage.getItem('syncStatus')
      if (savedStatus) {
        const parsed = JSON.parse(savedStatus)
        this._status.value = { ...this._status.value, ...parsed }
      }

      // Load cloud password if sync is enabled
      if (this._status.value.isEnabled) {
        const savedPassword = localStorage.getItem('cloudPassword')
        if (savedPassword) {
          this._cloudPassword.value = savedPassword
        } else {
          this._status.value.isEnabled = false
        }
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
        if (this._status.value.lastSyncTime) {
          metadataService.setGlobalSyncTime(new Date(this._status.value.lastSyncTime))
        }
      } catch (error) {
        console.warn('Failed to initialize metadata service:', error)
      }
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  private saveSyncStatus(): void {
    const statusToSave = {
      isEnabled: this._status.value.isEnabled,
      lastSyncTime: this._status.value.lastSyncTime,
      lastSyncError: this._status.value.lastSyncError
    }
    localStorage.setItem('syncStatus', JSON.stringify(statusToSave))
    
    // Save cloud password if enabled
    if (this._status.value.isEnabled && this._cloudPassword.value) {
      localStorage.setItem('cloudPassword', this._cloudPassword.value)
    } else if (!this._status.value.isEnabled) {
      localStorage.removeItem('cloudPassword')
    }
  }

  async checkCloudFileExists(): Promise<void> {
    try {
      console.log('Checking for cloud backup file...')
      const backupFile = await googleDriveApiService.findBackupFile()
      this._status.value.cloudFileExists = backupFile !== null
      console.log('Cloud file check result:', backupFile !== null)
      console.log('Backup file:', backupFile)
    } catch (error) {
      console.error('Failed to check cloud file existence:', error)
      this._status.value.cloudFileExists = false
    }
  }

  async enableSync(cloudPassword: string): Promise<SyncResult> {
    try {
      if (!googleAuthService.isAuthenticated.value) {
        throw new Error('Google認証が必要です')
      }

      // Validate password
      const passwordValidation = cloudEncryptionService.validatePassword(cloudPassword)
      if (!passwordValidation.isValid) {
        throw new Error(`パスワードが要件を満たしていません: ${passwordValidation.errors.join(', ')}`)
      }

      // Test encryption with password
      const encryptionTest = await cloudEncryptionService.testEncryption(cloudPassword)
      if (!encryptionTest) {
        throw new Error('暗号化テストに失敗しました')
      }

      // Set cloud password first
      this._cloudPassword.value = cloudPassword
      
      // Update local storage encryption key to match cloud password
      const { authService } = await import('@/services/auth.service')
      const { secureStorage } = await import('@/services/storage.service')
      
      // Check if user has existing auth state
      const authState = await secureStorage.getAuthState()
      console.log('[DEBUG] enableSync - existing authState:', authState)
      
      if (authState.passwordHash && authState.salt) {
        // Existing user - verify and unlock with cloud password
        const unlockResult = await authService.unlockWithPassword(cloudPassword)
        if (!unlockResult.success) {
          // Password mismatch - this could be a password change scenario
          // Clear incompatible encrypted data and setup new password
          console.log('[DEBUG] enableSync - password mismatch, clearing incompatible data')
          await secureStorage.clearIncompatibleEncryptedData()
          
          const setupResult = await authService.setupPassword(cloudPassword)
          if (!setupResult.success) {
            throw new Error('ローカル暗号化キーの再設定に失敗しました')
          }
          console.log('[DEBUG] enableSync - password reset and new key setup completed')
        } else {
          console.log('[DEBUG] enableSync - existing user unlocked successfully')
        }
      } else {
        // New user or reset - setup password
        const setupResult = await authService.setupPassword(cloudPassword)
        if (!setupResult.success) {
          throw new Error('ローカル暗号化キーの設定に失敗しました')
        }
        console.log('[DEBUG] enableSync - new user password setup completed')
      }

      this._status.value.isEnabled = true
      this._status.value.lastSyncError = null

      // Perform initial sync
      const syncResult = await this.performSync()
      
      if (syncResult.success) {
        this.startAutoSync()
      }

      this.saveSyncStatus()
      return syncResult
    } catch (error: any) {
      console.error('Failed to enable sync:', error)
      return {
        success: false,
        message: error?.message || 'クラウド同期の有効化に失敗しました'
      }
    }
  }

  async enableSyncForNewUser(cloudPassword: string): Promise<SyncResult> {
    try {
      if (!googleAuthService.isAuthenticated.value) {
        throw new Error('Google認証が必要です')
      }

      // Validate password
      const passwordValidation = cloudEncryptionService.validatePassword(cloudPassword)
      if (!passwordValidation.isValid) {
        throw new Error(`パスワードが要件を満たしていません: ${passwordValidation.errors.join(', ')}`)
      }

      // Test encryption with password
      const encryptionTest = await cloudEncryptionService.testEncryption(cloudPassword)
      if (!encryptionTest) {
        throw new Error('暗号化テストに失敗しました')
      }

      // Set cloud password first
      this._cloudPassword.value = cloudPassword
      
      // Update local storage encryption key to match cloud password
      const { authService } = await import('@/services/auth.service')
      const { secureStorage } = await import('@/services/storage.service')
      
      // For new users, always setup the password
      const setupResult = await authService.setupPassword(cloudPassword)
      if (!setupResult.success) {
        throw new Error('ローカル暗号化キーの設定に失敗しました')
      }
      console.log('[DEBUG] enableSyncForNewUser - password setup completed')
      
      this._status.value.isEnabled = true
      this._status.value.lastSyncError = null

      // For new users, create an empty initial data file in Google Drive
      console.log('Creating initial empty data file for new user...')
      const initialData = {
        holdings: [],
        locations: [],
        tokens: []
      }
      
      await this.uploadToCloud(initialData)
      console.log('Initial data file created successfully')
      
      this._status.value.cloudFileExists = true
      this._status.value.lastSyncTime = Date.now()

      this.startAutoSync()
      this.saveSyncStatus()
      
      return { success: true, message: 'クラウド同期が有効になりました' }
    } catch (error: any) {
      console.error('Failed to enable sync for new user:', error)
      return {
        success: false,
        message: error?.message || 'クラウド同期の有効化に失敗しました'
      }
    }
  }

  async disableSync(): Promise<void> {
    this._status.value.isEnabled = false
    this._cloudPassword.value = null
    this.stopAutoSync()
    
    // Note: We intentionally do NOT clear the encryption key here
    // to allow continued local data access without re-authentication
    console.log('[DEBUG] disableSync - sync disabled but encryption key preserved for local access')
    
    this.saveSyncStatus()
  }

  async performSync(): Promise<SyncResult> {
    if (!this._status.value.isEnabled || !googleAuthService.isAuthenticated.value) {
      return { success: false, message: '同期が無効または認証されていません' }
    }

    if (this._status.value.isSyncing) {
      return { success: false, message: '同期中です' }
    }

    try {
      this._status.value.isSyncing = true
      this._status.value.lastSyncError = null
      console.log('[DEBUG] performSync - starting sync process')

      // Ensure storage is unlocked before sync
      const { secureStorage } = await import('@/services/storage.service')
      if (!secureStorage.isUnlocked()) {
        console.log('[DEBUG] performSync - storage is locked, attempting auto unlock...')
        
        // Try to restore encryption key from session storage or local storage
        let keyData = sessionStorage.getItem('encryptionKey')
        let keySource = 'session'
        
        // セッションストレージにない場合はローカルストレージから取得
        if (!keyData) {
          keyData = localStorage.getItem('encryptionKey')
          keySource = 'local'
        }
        
        if (keyData) {
          try {
            const { CryptoService } = await import('@/services/crypto.service')
            const cryptoKey = await CryptoService.importKey(keyData)
            secureStorage.setEncryptionKey(cryptoKey)
            
            if (secureStorage.isUnlocked()) {
              console.log(`[DEBUG] performSync - successfully auto-unlocked with ${keySource} key`)
              
              // セッションストレージにキーがない場合は保存
              if (keySource === 'local' && !sessionStorage.getItem('encryptionKey')) {
                sessionStorage.setItem('encryptionKey', keyData)
                console.log('[DEBUG] performSync - restored key to session storage')
              }
            }
          } catch (keyError) {
            console.error(`[DEBUG] performSync - failed to import key from ${keySource} storage:`, keyError)
            // Remove invalid key
            if (keySource === 'session') {
              sessionStorage.removeItem('encryptionKey')
            } else {
              localStorage.removeItem('encryptionKey')
            }
          }
        }
        
        // If still locked, request unlock from user
        if (!secureStorage.isUnlocked()) {
          console.log('[DEBUG] performSync - auto unlock failed, sync cannot proceed without unlock')
          return { success: false, message: 'ストレージがロックされています。データにアクセスするにはパスワードを入力してください。' }
        }
      }

      // Get current local data and timestamp
      const localData = await this.getLocalData()
      const localTimestamp = await this.getLocalTimestamp()
      console.log('[DEBUG] performSync - local data retrieved:', {
        holdingsCount: localData.holdings?.length || 0,
        tokensCount: localData.tokens?.length || 0,
        locationsCount: localData.locations?.length || 0,
        localTimestamp: new Date(localTimestamp).toISOString()
      })

      // Check if backup file exists
      const backupFile = await googleDriveApiService.findBackupFile()
      console.log('[DEBUG] performSync - backup file check:', backupFile ? 'exists' : 'not found')

      if (!backupFile) {
        // No cloud backup exists - upload current data
        console.log('[DEBUG] performSync - uploading initial backup')
        await this.uploadToCloud(localData)
        
        // Update sync status and metadata
        this._status.value.lastSyncTime = Date.now()
        this._status.value.cloudFileExists = true
        this.saveSyncStatus()
        
        // Mark all current data as synced
        const { metadataService } = await import('@/services/metadata.service')
        await metadataService.markAllAsSynced()
        console.log('[DEBUG] performSync - initial upload completed, all data marked as synced')
        
        // 同期時刻をメタデータサービスにも保存
        metadataService.setGlobalSyncTime(new Date(this._status.value.lastSyncTime))
        
        // キャッシュを強制的にクリアして未同期件数を正しく更新
        metadataService.clearMetadataCache()
        console.log('[DEBUG] performSync - metadata cache cleared after initial sync')
        
        this.emitSyncComplete()
        return { success: true, message: '初回同期が完了しました' }
      }

      // Download and compare with local data
      console.log('[DEBUG] performSync - downloading cloud data')
      const cloudData = await this.downloadFromCloud(backupFile.id)
      console.log('[DEBUG] performSync - cloud data retrieved:', {
        holdingsCount: cloudData.portfolioData.holdings?.length || 0,
        tokensCount: cloudData.portfolioData.tokens?.length || 0,
        locationsCount: cloudData.portfolioData.locations?.length || 0,
        cloudTimestamp: new Date(cloudData.timestamp).toISOString()
      })

      // Create data hashes for comparison (BEFORE any modifications)
      const localHash = this.createDataHash(localData)
      const cloudHash = this.createDataHash(cloudData.portfolioData)
      console.log('[DEBUG] performSync - hash comparison:', {
        localHash: localHash.substring(0, 50) + '...',
        cloudHash: cloudHash.substring(0, 50) + '...',
        hashesMatch: localHash === cloudHash
      })

      // If hashes match, data is identical - just update timestamps
      if (localHash === cloudHash) {
        console.log('[DEBUG] performSync - data identical, updating timestamps only')
        
        this._status.value.lastSyncTime = Date.now()
        this.saveSyncStatus()
        
        // Mark all data as synced since they're identical
        const { metadataService } = await import('@/services/metadata.service')
        await metadataService.markAllAsSynced()
        console.log('[DEBUG] performSync - sync completed successfully (no changes needed)')
        
        // 同期時刻をメタデータサービスにも保存
        metadataService.setGlobalSyncTime(new Date(this._status.value.lastSyncTime))
        
        // キャッシュを強制的にクリアして未同期件数を正しく更新
        metadataService.clearMetadataCache()
        console.log('[DEBUG] performSync - metadata cache cleared after identical data sync')
        
        this.emitSyncComplete()
        return { success: true, message: '同期が完了しました（変更なし）' }
      }

      // データが異なる場合、新規追加データがあるかチェック
      const hasNewLocalData = await this.hasNewLocalData()
      console.log('[DEBUG] performSync - has new local data:', hasNewLocalData)

      // 新規データのみの場合は競合ではなく、クラウドに追加する
      if (hasNewLocalData && !this.hasConflictingModifications(localData, cloudData.portfolioData)) {
        console.log('[DEBUG] performSync - new data only, uploading to cloud')
        
        // Upload merged data to cloud
        await this.uploadToCloud(localData)
        
        // Update sync status
        this._status.value.lastSyncTime = Date.now()
        this._status.value.cloudFileExists = true
        this.saveSyncStatus()
        
        // Mark all data as synced
        const { metadataService } = await import('@/services/metadata.service')
        await metadataService.markAllAsSynced()
        console.log('[DEBUG] performSync - new data uploaded successfully')
        
        // 同期時刻をメタデータサービスにも保存
        metadataService.setGlobalSyncTime(new Date(this._status.value.lastSyncTime))
        
        // キャッシュを強制的にクリアして未同期件数を正しく更新
        metadataService.clearMetadataCache()
        console.log('[DEBUG] performSync - metadata cache cleared after new data upload')
        
        this.emitSyncComplete()
        return { success: true, message: '新しいデータが同期されました' }
      }

      // Data differs - check for conflicts
      const hasConflict = await this.detectConflict(localData, cloudData, localTimestamp)
      console.log('[DEBUG] performSync - conflict detection result:', hasConflict)

      if (hasConflict) {
        // Store conflict data for resolution
        this._conflictData.value = {
          localData,
          cloudData: cloudData.portfolioData,
          localTimestamp,
          cloudTimestamp: cloudData.timestamp
        }
        this._status.value.conflictDetected = true
        this.saveSyncStatus()
        
        console.log('[DEBUG] performSync - conflict detected, stored for resolution')
        this.emitConflictResolved()
        return {
          success: false,
          message: 'データに競合が検出されました。競合を解決してください。',
          conflictData: this._conflictData.value
        }
      }

      // No conflict - merge data (use most recent)
      console.log('[DEBUG] performSync - no conflict, merging data')
      const mergedData = await this.mergeData(localData, cloudData, localTimestamp)
      
      // Update both local and cloud with merged data
      await this.updateLocalData(mergedData)
      await this.uploadToCloud(mergedData)

      // Update sync status
      this._status.value.lastSyncTime = Date.now()
      this._status.value.cloudFileExists = true
      this.saveSyncStatus()

              // Mark all data as synced after successful merge
        const { metadataService: metadataServiceMerge } = await import('@/services/metadata.service')
        await metadataServiceMerge.markAllAsSynced()
        console.log('[DEBUG] performSync - merge completed, all data marked as synced')

        // 同期時刻をメタデータサービスにも保存
        metadataServiceMerge.setGlobalSyncTime(new Date(this._status.value.lastSyncTime))

        // キャッシュを強制的にクリアして未同期件数を正しく更新
        metadataServiceMerge.clearMetadataCache()
      console.log('[DEBUG] performSync - metadata cache cleared after merge completion')

      this.emitSyncComplete()
      return { success: true, message: '同期が完了しました' }
    } catch (error: any) {
      console.error('[DEBUG] performSync - error occurred:', error)
      const errorMessage = error?.message || '同期中にエラーが発生しました'
      this._status.value.lastSyncError = errorMessage
      this.saveSyncStatus()
      return { success: false, message: errorMessage }
    } finally {
      this._status.value.isSyncing = false
    }
  }

  private async updateLocalTimestamps(syncTime: number): Promise<void> {
    this._status.value.lastSyncTime = syncTime
    localStorage.setItem('lastDataModified', syncTime.toString())
    this.saveSyncStatus()
    const { metadataService } = await import('@/services/metadata.service')
    await metadataService.markAllAsSynced()
  }

  async getLocalData(): Promise<any> {
    // Import secure storage to get decrypted data
    const { secureStorage } = await import('@/services/storage.service')
    
    let holdings: any[] = []
    
    try {
      holdings = await secureStorage.getHoldings()
    } catch (error: any) {
      console.error('[DEBUG] getLocalData - failed to get holdings:', error)
      
      if (error.message === 'ENCRYPTION_KEY_MISMATCH') {
        console.log('[DEBUG] getLocalData - clearing incompatible encrypted data')
        await secureStorage.clearIncompatibleEncryptedData()
        holdings = [] // Return empty holdings after clearing
      } else {
        throw error
      }
    }
    
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
    if (!this._cloudPassword.value) {
      throw new Error('クラウドパスワードが設定されていません')
    }

    const encryptedData = await cloudEncryptionService.encryptPortfolioData(data, this._cloudPassword.value)
    const encryptedDataString = JSON.stringify(encryptedData)

    // Check file size
    if (encryptedDataString.length > SYNC_CONFIG.maxBackupSize) {
      throw new Error('バックアップファイルのサイズが上限を超えています')
    }

    const backupFile = await googleDriveApiService.findBackupFile()
    
    if (backupFile) {
      // Update existing file
      await googleDriveApiService.updateFile(backupFile.id, encryptedDataString)
    } else {
      // Create new file
      await googleDriveApiService.uploadFile({
        data: encryptedDataString,
        metadata: {
          name: GOOGLE_DRIVE_CONFIG.backupFileName,
          mimeType: 'application/json'
        }
      })
    }
  }

  private async downloadFromCloud(fileId: string): Promise<CloudBackupData> {
    if (!this._cloudPassword.value) {
      throw new Error('クラウドパスワードが設定されていません')
    }

    const encryptedDataString = await googleDriveApiService.downloadFile(fileId)
    const encryptedData: EncryptedData = JSON.parse(encryptedDataString)
    
    return await cloudEncryptionService.decryptPortfolioData(encryptedData, this._cloudPassword.value)
  }

  private async detectConflict(localData: any, cloudData: CloudBackupData, localTimestamp: number): Promise<boolean> {
    // Conflict detection based on meaningful data differences
    const timeDiff = Math.abs(localTimestamp - cloudData.timestamp)
    
    console.log('[DEBUG] Conflict detection:')
    console.log('  Local timestamp:', new Date(localTimestamp).toISOString())
    console.log('  Cloud timestamp:', new Date(cloudData.timestamp).toISOString())
    console.log('  Time difference (ms):', timeDiff)
    
    // Check for meaningful data differences regardless of timestamp
    const localHash = this.createDataHash(localData)
    const cloudHash = this.createDataHash(cloudData.portfolioData)
    
    console.log('  Local data hash:', localHash)
    console.log('  Cloud data hash:', cloudHash)
    
    const hasConflict = localHash !== cloudHash
    console.log('  Conflict detected:', hasConflict)
    
    return hasConflict
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
    
    localStorage.setItem('lastDataModified', Date.now().toString())
    console.log('updateLocalData completed successfully')
  }

  /**
   * Cleans object for IndexedDB storage by removing non-cloneable properties
   */
  private cleanObjectForDB(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }
    
    if (typeof obj !== 'object') {
      return obj
    }
    
    // Create a clean object with only serializable properties
    const cleaned: any = {}
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          if (Array.isArray(value)) {
            cleaned[key] = value.map(item => this.cleanObjectForDB(item))
          } else if (value instanceof Date) {
            cleaned[key] = value
          } else {
            cleaned[key] = this.cleanObjectForDB(value)
          }
        } else if (typeof value === 'function') {
          // Skip functions
          continue
        } else {
          cleaned[key] = value
        }
      }
    }
    
    return cleaned
  }

  async resolveConflict(resolution: 'local' | 'cloud', conflictData: SyncConflict): Promise<SyncResult> {
    try {
      this._status.value.isSyncing = true
      console.log('[DEBUG] resolveConflict - starting with resolution:', resolution)
      
      let finalData: any
      
      switch (resolution) {
        case 'local':
          finalData = conflictData.localData
          break
        case 'cloud':
          finalData = conflictData.cloudData
          break
      }

      // Update both local and cloud
      await this.updateLocalData(finalData)
      await this.uploadToCloud(finalData)

      // Clear conflict state
      this._status.value.conflictDetected = false
      this._conflictData.value = null
      this._status.value.lastSyncTime = Date.now()
      this._status.value.lastSyncError = null
      this.saveSyncStatus()

      // Mark all items as synced after conflict resolution
      try {
        const { metadataService } = await import('@/services/metadata.service')
        await metadataService.markAllAsSynced()
        // 同期時刻をメタデータサービスにも保存
        metadataService.setGlobalSyncTime(new Date(this._status.value.lastSyncTime))
        
        // キャッシュを強制的にクリアして未同期件数を正しく更新
        metadataService.clearMetadataCache()
        
        console.log('[DEBUG] resolveConflict - metadata marked as synced')
      } catch (metadataError) {
        console.warn('[DEBUG] resolveConflict - metadata sync failed:', metadataError)
        // Don't fail the entire conflict resolution if metadata sync fails
      }

      console.log('[DEBUG] resolveConflict - completed successfully')
      this.emitConflictResolved()
      return { success: true, message: '競合が解決されました' }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      return { success: false, message: '競合の解決に失敗しました' }
    } finally {
      this._status.value.isSyncing = false
    }
  }

  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = window.setInterval(async () => {
      if (this._status.value.isEnabled && googleAuthService.isAuthenticated.value) {
        try {
          const result = await this.performSync()
          if (!result.success) {
            console.warn('[DEBUG] Auto sync failed:', result.message)
            // Show warning toast for auto sync failures (less intrusive than error)
            if (window.showToast) {
              window.showToast.warning('定期同期エラー', `定期同期に失敗しました: ${result.message}`)
            }
          } else {
            console.log('[DEBUG] Auto sync completed successfully')
          }
        } catch (error) {
          console.error('[DEBUG] Auto sync error:', error)
          // Show error toast for auto sync errors
          if (window.showToast) {
            window.showToast.error('定期同期エラー', '定期同期中にエラーが発生しました')
          }
        }
      }
    }, SYNC_CONFIG.autoSyncInterval)
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  async resetAutoSyncTimer(): Promise<void> {
    console.log('Resetting auto-sync timer...')
    if (this._status.value.isEnabled) {
      this.stopAutoSync()
      this.startAutoSync()
      console.log('Auto-sync timer reset and restarted')
    }
  }

  async testCloudPassword(password: string): Promise<boolean> {
    try {
      const backupFile = await googleDriveApiService.findBackupFile()
      if (!backupFile) {
        return true // No cloud file to test against
      }

      // Test decryption with the provided password
      const encryptedDataString = await googleDriveApiService.downloadFile(backupFile.id)
      const encryptedData: EncryptedData = JSON.parse(encryptedDataString)
      
      // Try to decrypt with the provided password
      await cloudEncryptionService.decryptPortfolioData(encryptedData, password)
      return true
    } catch (error) {
      console.error('Cloud password test failed:', error)
      return false
    }
  }

  async changeCloudPassword(currentPassword: string, newPassword: string): Promise<SyncResult> {
    try {
      console.log('Starting cloud password change process...')
      
      if (!googleAuthService.isAuthenticated.value) {
        return { success: false, message: 'Google認証が必要です' }
      }

      // Step 1: Verify current password
      const isCurrentPasswordValid = await this.testCloudPassword(currentPassword)
      if (!isCurrentPasswordValid) {
        return { success: false, message: '現在のパスワードが正しくありません' }
      }

      console.log('Current password verified')

      // Step 2: Download current data with current password
      const backupFile = await googleDriveApiService.findBackupFile()
      if (!backupFile) {
        return { success: false, message: 'クラウドバックアップファイルが見つかりません' }
      }

      const encryptedDataString = await googleDriveApiService.downloadFile(backupFile.id)
      const encryptedData: EncryptedData = JSON.parse(encryptedDataString)
      
      // Decrypt with current password
      const cloudData = await cloudEncryptionService.decryptPortfolioData(encryptedData, currentPassword)
      console.log('Successfully decrypted cloud data with current password')

      // Step 3: Update local authentication with new password
      const { authService } = await import('@/services/auth.service')
      const { secureStorage } = await import('@/services/storage.service')
      
      // Update local password hash and encryption key
      const setupResult = await authService.setupPassword(newPassword)
      if (!setupResult.success) {
        return { success: false, message: 'ローカルパスワードの更新に失敗しました' }
      }
      
      console.log('Local password updated successfully')

      // Step 4: Update cloud password
      this._cloudPassword.value = newPassword
      
      // Step 5: Re-encrypt and upload data with new password
      await this.uploadToCloud(cloudData.portfolioData)
      console.log('Successfully re-encrypted and uploaded data with new password')

      // Step 6: Save sync status
      this.saveSyncStatus()
      
      console.log('Cloud password change completed successfully')
      
      return { success: true, message: 'パスワードが正常に変更されました' }

    } catch (error: any) {
      console.error('Cloud password change failed:', error)
      return { 
        success: false, 
        message: error.message || 'パスワード変更中にエラーが発生しました' 
      }
    }
  }

  private async performInitialCleanup() {
    try {
      console.log('[DEBUG] SyncService - performing initial cleanup')
      
      // 競合状態をクリア（アプリ起動時に残っている可能性がある）
      this._status.value.conflictDetected = false
      this._conflictData.value = null
      
      // 不整合なlastDataModifiedをクリア
      const lastModified = localStorage.getItem('lastDataModified')
      if (lastModified) {
        const timestamp = parseInt(lastModified)
        const now = Date.now()
        
        // 異常に古い、または未来のタイムスタンプをクリア
        if (timestamp < 946684800000 || timestamp > now + 86400000) { // 2000年より前、または1日後より未来
          console.log('[DEBUG] SyncService - clearing invalid lastDataModified:', timestamp)
          localStorage.removeItem('lastDataModified')
        }
      }
      
      this.saveSyncStatus()
      console.log('[DEBUG] SyncService - initial cleanup completed')
    } catch (error) {
      console.warn('[DEBUG] SyncService - initial cleanup failed:', error)
    }
  }

  private async hasNewLocalData(): Promise<boolean> {
    try {
      const { metadataService } = await import('@/services/metadata.service')
      const unsyncedCount = await metadataService.getUnsyncedDataCount()
      
      // 未同期データがある場合は新規データありとみなす
      return unsyncedCount.total > 0
    } catch (error) {
      console.warn('[DEBUG] hasNewLocalData - error:', error)
      return false
    }
  }
  
  private hasConflictingModifications(localData: any, cloudData: any): boolean {
    // 既存データの変更があるかチェック（削除や更新）
    // このメソッドは簡略化して、基本的には新規追加のみを想定
    
    // 保有データの数が減っている場合は削除があったとみなす
    const localHoldingsCount = (localData.holdings || []).length
    const cloudHoldingsCount = (cloudData.holdings || []).length
    
    if (localHoldingsCount < cloudHoldingsCount) {
      console.log('[DEBUG] hasConflictingModifications - holdings count decreased, potential deletion')
      return true
    }
    
    // その他の競合チェックは省略（新規追加メインのため）
    return false
  }

  destroy(): void {
    this.stopAutoSync()
    if (this.conflictCheckTimer) {
      clearInterval(this.conflictCheckTimer)
    }
  }
}

// Create and export singleton instance
export const syncService = new SyncService()
export default syncService
