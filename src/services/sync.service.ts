import { ref, computed } from 'vue'
import { googleAuthService } from './google-auth.service'
import { googleDriveApiService, type DriveFile } from './google-drive-api.service'
import { cloudEncryptionService, type EncryptedData, type CloudBackupData } from './cloud-encryption.service'
import { GOOGLE_DRIVE_CONFIG, SYNC_CONFIG, ERROR_MESSAGES } from '@/config/google-drive.config'
import { dbV2 } from '@/services/db-v2'

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
  private syncTimer: number | null = null
  private conflictCheckTimer: number | null = null

  constructor() {
    this.loadSyncStatus()
  }

  // Reactive getters
  get status() { return computed(() => this._status.value) }
  get isEnabled() { return computed(() => this._status.value.isEnabled) }
  get isSyncing() { return computed(() => this._status.value.isSyncing) }
  get hasCloudPassword() { return computed(() => this._cloudPassword.value !== null) }

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

      this._cloudPassword.value = cloudPassword
      this._status.value.isEnabled = true
      this._status.value.lastSyncError = null

      // Perform initial sync
      const syncResult = await this.performSync()
      
      if (syncResult.success) {
        this.startAutoSync()
      }

      this.saveSyncStatus()
      return syncResult
    } catch (error) {
      console.error('Failed to enable sync:', error)
      return {
        success: false,
        message: error.message || 'クラウド同期の有効化に失敗しました'
      }
    }
  }

  async disableSync(): Promise<void> {
    this._status.value.isEnabled = false
    this._cloudPassword.value = null
    this.stopAutoSync()
    this.saveSyncStatus()
  }

  async performSync(): Promise<SyncResult> {
    if (!this._status.value.isEnabled || !this._cloudPassword.value) {
      return { success: false, message: 'クラウド同期が無効です' }
    }

    if (this._status.value.isSyncing) {
      return { success: false, message: '同期処理中です' }
    }

    try {
      this._status.value.isSyncing = true
      this._status.value.lastSyncError = null

      // Get local data
      const localData = await this.getLocalData()
      const localTimestamp = await this.getLocalTimestamp()

      // Check for cloud backup
      const backupFile = await googleDriveApiService.findBackupFile()
      
      if (!backupFile) {
        // No cloud backup exists, upload local data
        if (localData.holdings.length > 0 || localData.tokens.length > 0) {
          await this.uploadToCloud(localData)
          this._status.value.lastSyncTime = Date.now()
          this.saveSyncStatus()
          return { success: true, message: 'データをクラウドにアップロードしました' }
        } else {
          return { success: true, message: 'ローカルデータがありません' }
        }
      }

      // Download and decrypt cloud data
      const cloudData = await this.downloadFromCloud(backupFile.id)
      
      // Check for conflicts
      if (localData.holdings.length > 0 && cloudData.portfolioData.holdings.length > 0) {
        const conflictExists = await this.detectConflict(localData, cloudData, localTimestamp)
        
        if (conflictExists) {
          this._status.value.conflictDetected = true
          return {
            success: false,
            message: '同期競合が検出されました',
            conflictData: {
              localData,
              cloudData: cloudData.portfolioData,
              localTimestamp,
              cloudTimestamp: cloudData.timestamp
            }
          }
        }
      }

      // Merge data based on timestamps
      const mergedData = await this.mergeData(localData, cloudData, localTimestamp)
      
      // Update local data if needed
      if (cloudData.timestamp > localTimestamp) {
        await this.updateLocalData(mergedData)
      }

      // Update cloud data if needed
      if (localTimestamp > cloudData.timestamp) {
        await this.uploadToCloud(mergedData)
      }

      this._status.value.lastSyncTime = Date.now()
      this._status.value.conflictDetected = false
      this.saveSyncStatus()

      return { success: true, message: 'データが正常に同期されました' }
    } catch (error) {
      console.error('Sync failed:', error)
      this._status.value.lastSyncError = error.message
      this.saveSyncStatus()
      return { success: false, message: error.message || '同期に失敗しました' }
    } finally {
      this._status.value.isSyncing = false
    }
  }

  private async getLocalData(): Promise<any> {
    // Import secure storage to get decrypted data
    const { secureStorage } = await import('@/services/storage.service')
    
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
    // Simple conflict detection based on timestamps and data differences
    const timeDiff = Math.abs(localTimestamp - cloudData.timestamp)
    
    // If timestamps are close (within 1 minute), check for data differences
    if (timeDiff < 60000) {
      const localHash = JSON.stringify(localData)
      const cloudHash = JSON.stringify(cloudData.portfolioData)
      return localHash !== cloudHash
    }
    
    return false
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
      const cleanLocations = data.locations.map(this.cleanObjectForDB)
      await dbV2.locations.bulkAdd(cleanLocations)
    }
    
    // Update tokens directly (not encrypted)
    if (data.tokens && Array.isArray(data.tokens)) {
      await dbV2.tokens.clear()
      const cleanTokens = data.tokens.map(this.cleanObjectForDB)
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

  async resolveConflict(resolution: 'local' | 'cloud' | 'merge', conflictData: SyncConflict): Promise<SyncResult> {
    try {
      this._status.value.isSyncing = true
      
      let finalData: any
      
      switch (resolution) {
        case 'local':
          finalData = conflictData.localData
          break
        case 'cloud':
          finalData = conflictData.cloudData
          break
        case 'merge':
          // Simple merge strategy - could be more sophisticated
          finalData = {
            holdings: [...conflictData.localData.holdings, ...conflictData.cloudData.holdings],
            locations: [...conflictData.localData.locations, ...conflictData.cloudData.locations],
            tokens: [...(conflictData.localData.tokens || []), ...(conflictData.cloudData.tokens || [])]
          }
          break
      }

      // Update both local and cloud
      await this.updateLocalData(finalData)
      await this.uploadToCloud(finalData)

      this._status.value.conflictDetected = false
      this._status.value.lastSyncTime = Date.now()
      this.saveSyncStatus()

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

    this.syncTimer = setInterval(async () => {
      if (this._status.value.isEnabled && googleAuthService.isAuthenticated.value) {
        await this.performSync()
      }
    }, SYNC_CONFIG.autoSyncInterval)
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
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