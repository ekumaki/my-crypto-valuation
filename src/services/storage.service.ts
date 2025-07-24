import { dbV2, dbServiceV2, type Holding, type Location, type Price } from './db-v2'
import { CryptoService, type EncryptedData } from './crypto.service'

export interface EncryptedHolding extends Omit<Holding, 'quantity' | 'note' | 'locationId'> {
  encryptedQuantity: string
  encryptedNote?: string
  encryptedLocationId: string
  isEncrypted: boolean
}

export interface AuthState {
  isAuthenticated: boolean
  passwordHash?: string
  salt?: string
}

export class SecureStorageService {
  private encryptionKey: CryptoKey | null = null
  private keyRecoveryAttempts = 0
  private maxKeyRecoveryAttempts = 3
  
  setEncryptionKey(key: CryptoKey) {
    this.encryptionKey = key
    this.keyRecoveryAttempts = 0
  }
  
  getEncryptionKey(): CryptoKey | null {
    return this.encryptionKey
  }
  
  clearEncryptionKey() {
    this.encryptionKey = null
    this.keyRecoveryAttempts = 0
  }
  
  isUnlocked(): boolean {
    return this.encryptionKey !== null
  }
  
  // 暗号化キーの自動復元を試行
  async tryRecoverEncryptionKey(): Promise<boolean> {
    if (this.encryptionKey || this.keyRecoveryAttempts >= this.maxKeyRecoveryAttempts) {
      return this.encryptionKey !== null
    }
    
    this.keyRecoveryAttempts++
    
    try {
      // Google認証サービスから暗号化キーを取得
      const { googleAuthService } = await import('./google-auth.service')
      const { authService } = await import('./auth.service')
      
      if (googleAuthService.isAuthenticated.value) {
        console.log('[DEBUG] Attempting to recover encryption key from Google auth...')
        const result = await authService.setupEncryptionFromGoogleAuth()
        if (result.success) {
          console.log('[DEBUG] Encryption key recovered successfully')
          return true
        }
      }
      
      console.log('[DEBUG] Encryption key recovery failed')
      return false
    } catch (error) {
      console.error('[DEBUG] Encryption key recovery error:', error)
      return false
    }
  }
  
  private async encryptField(value: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available')
    }
    const encrypted = await CryptoService.encrypt(value, this.encryptionKey)
    return JSON.stringify(encrypted)
  }
  
  private async decryptField(encryptedValue: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available')
    }
    const encrypted: EncryptedData = JSON.parse(encryptedValue)
    return await CryptoService.decrypt(encrypted, this.encryptionKey)
  }
  
  private async encryptHolding(holding: Holding): Promise<EncryptedHolding> {
    const encryptedQuantity = await this.encryptField(holding.quantity.toString())
    const encryptedLocationId = await this.encryptField(holding.locationId)
    const encryptedNote = holding.note ? await this.encryptField(holding.note) : undefined
    
    return {
      id: holding.id,
      symbol: holding.symbol,
      createdAt: holding.createdAt,
      updatedAt: holding.updatedAt,
      encryptedQuantity,
      encryptedLocationId,
      encryptedNote,
      isEncrypted: true
    }
  }
  
  private async decryptHolding(encryptedHolding: EncryptedHolding): Promise<Holding> {
    const quantity = parseFloat(await this.decryptField(encryptedHolding.encryptedQuantity))
    const locationId = await this.decryptField(encryptedHolding.encryptedLocationId)
    const note = encryptedHolding.encryptedNote ? await this.decryptField(encryptedHolding.encryptedNote) : undefined
    
    return {
      id: encryptedHolding.id,
      symbol: encryptedHolding.symbol,
      quantity,
      locationId,
      note,
      createdAt: encryptedHolding.createdAt,
      updatedAt: encryptedHolding.updatedAt
    }
  }
  
  async addHolding(holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    console.log('[DEBUG] SecureStorage.addHolding - starting with:', holding)
    
    if (!this.isUnlocked()) {
      console.log('[DEBUG] SecureStorage.addHolding - storage is locked, attempting recovery')
      // 暗号化キーの自動復元を試行
      const recovered = await this.tryRecoverEncryptionKey()
      if (!recovered) {
        console.error('[DEBUG] SecureStorage.addHolding - storage is locked and key recovery failed')
        throw new Error('暗号化ストレージがロックされており、キーの復元に失敗しました')
      }
      console.log('[DEBUG] SecureStorage.addHolding - key recovery successful')
    }
    
    const now = Date.now()
    const newHolding: Holding = {
      ...holding,
      id: `holding-${now}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now
    }
    
    console.log('[DEBUG] SecureStorage.addHolding - created holding object:', newHolding)
    
    try {
      console.log('[DEBUG] SecureStorage.addHolding - starting encryption')
      const encryptedHolding = await this.encryptHolding(newHolding)
      console.log('[DEBUG] SecureStorage.addHolding - encryption successful')
      
      // Token should already exist from AddHoldingModal
      // ensureTokenExists is only a fallback and shouldn't overwrite existing token info
      // Commenting out to prevent overwriting token information
      // try {
      //   await dbServiceV2.ensureTokenExists(holding.symbol)
      //   console.log('[DEBUG] SecureStorage.addHolding - token existence ensured for:', holding.symbol)
      // } catch (tokenError) {
      //   console.warn('[DEBUG] SecureStorage.addHolding - token ensure failed (continuing):', tokenError)
      // }
      
      console.log('[DEBUG] SecureStorage.addHolding - adding to database')
      await dbV2.table('holdings').add(encryptedHolding as any)
      console.log('[DEBUG] SecureStorage.addHolding - successfully added to database')
      
      // Update last data modified timestamp for sync
      localStorage.setItem('lastDataModified', Date.now().toString())
      
      // Update metadata for sync tracking (non-blocking)
      setTimeout(async () => {
        try {
          const { metadataService } = await import('@/services/metadata.service')
          const metadata = {
            isNew: true,
            isModified: false,
            isDeleted: false,
            isSynced: false, // 新規追加なので未同期
            lastModified: new Date(now),
            lastSyncTime: null,
            version: 1
          }
          await metadataService.updateCacheForItem('holding', newHolding.id, metadata)
          console.log('[DEBUG] SecureStorage.addHolding - metadata updated for new holding:', newHolding.id)
        } catch (error) {
          console.warn('[DEBUG] SecureStorage.addHolding - failed to update metadata (but save succeeded):', error)
        }
      }, 10)
      
      // データ変更時の自動同期をトリガー（非同期）
      setTimeout(async () => {
        try {
          const { syncService } = await import('@/services/sync.service')
          syncService.triggerSyncOnDataChange().catch(syncError => {
            console.warn('[DEBUG] SecureStorage.addHolding - failed to trigger sync on data change:', syncError)
          })
        } catch (error) {
          console.warn('[DEBUG] SecureStorage.addHolding - failed to setup sync trigger:', error)
        }
      }, 50)
      
      console.log('[DEBUG] SecureStorage.addHolding - operation completed successfully:', newHolding.id)
      return newHolding.id
    } catch (encryptionError) {
      console.error('[DEBUG] SecureStorage.addHolding - encryption or save failed:', encryptionError)
      
      if (encryptionError instanceof Error) {
        if (encryptionError.message.includes('encrypt')) {
          throw new Error(`データの暗号化に失敗しました: ${encryptionError.message}`)
        } else if (encryptionError.message.includes('add')) {
          throw new Error(`データベースへの保存に失敗しました: ${encryptionError.message}`)
        } else {
          throw new Error(`保存処理中にエラーが発生しました: ${encryptionError.message}`)
        }
      } else {
        throw new Error('保存処理中に予期しないエラーが発生しました')
      }
    }
  }
  
  async updateHolding(id: string, updates: Partial<Omit<Holding, 'id' | 'createdAt'>>): Promise<number> {
    if (!this.isUnlocked()) {
      // 暗号化キーの自動復元を試行
      const recovered = await this.tryRecoverEncryptionKey()
      if (!recovered) {
        throw new Error('Storage is locked and key recovery failed')
      }
    }
    
    const encryptedUpdates: any = {
      updatedAt: Date.now()
    }
    
    if (updates.quantity !== undefined) {
      encryptedUpdates.encryptedQuantity = await this.encryptField(updates.quantity.toString())
    }
    if (updates.locationId !== undefined) {
      encryptedUpdates.encryptedLocationId = await this.encryptField(updates.locationId)
    }
    if (updates.note !== undefined) {
      encryptedUpdates.encryptedNote = updates.note ? await this.encryptField(updates.note) : null
    }
    if (updates.symbol !== undefined) {
      encryptedUpdates.symbol = updates.symbol
    }
    
    const result = await dbV2.table('holdings').update(id, encryptedUpdates)
    
    // Update last data modified timestamp for sync
    localStorage.setItem('lastDataModified', Date.now().toString())
    
    // Update metadata for sync tracking
    try {
      const { metadataService } = await import('@/services/metadata.service')
      // Get existing metadata or create default
      const existingHolding = await dbV2.table('holdings').get(id)
      const currentMetadata = existingHolding?.metadata || metadataService.createDefaultMetadata()
      const updatedMetadata = metadataService.markAsModified(currentMetadata)
      metadataService.updateCacheForItem('holding', id, updatedMetadata)
    } catch (error) {
      console.warn('Failed to update metadata for holding update:', error)
    }
    
    // データ変更時の自動同期をトリガー
    try {
      const { syncService } = await import('@/services/sync.service')
      await syncService.triggerSyncOnDataChange()
    } catch (error) {
      console.warn('Failed to trigger sync on data change:', error)
    }
    
    return result
  }
  
  async deleteHolding(id: string): Promise<void> {
    if (!this.isUnlocked()) {
      // 暗号化キーの自動復元を試行
      const recovered = await this.tryRecoverEncryptionKey()
      if (!recovered) {
        throw new Error('Storage is locked and key recovery failed')
      }
    }
    
    // Update metadata for sync tracking before deletion
    try {
      const { metadataService } = await import('@/services/metadata.service')
      const existingHolding = await dbV2.table('holdings').get(id)
      const currentMetadata = existingHolding?.metadata || metadataService.createDefaultMetadata()
      const deletedMetadata = metadataService.markAsDeleted(currentMetadata)
      metadataService.updateCacheForItem('holding', id, deletedMetadata)
    } catch (error) {
      console.warn('Failed to update metadata for holding deletion:', error)
    }
    
    await dbV2.table('holdings').delete(id)
    
    // Update last data modified timestamp for sync
    localStorage.setItem('lastDataModified', Date.now().toString())
    
    // データ変更時の自動同期をトリガー
    try {
      const { syncService } = await import('@/services/sync.service')
      await syncService.triggerSyncOnDataChange()
    } catch (error) {
      console.warn('Failed to trigger sync on data change:', error)
    }
  }
  
  async getHoldings(): Promise<Holding[]> {
    if (!this.isUnlocked()) {
      // 暗号化キーの自動復元を試行
      const recovered = await this.tryRecoverEncryptionKey()
      if (!recovered) {
        throw new Error('Storage is locked and key recovery failed')
      }
    }
    
    console.log('[DEBUG] getHoldings - fetching from database...')
    const encryptedHoldings = await dbV2.table('holdings').orderBy('updatedAt').reverse().toArray()
    console.log('[DEBUG] getHoldings - fetched', encryptedHoldings.length, 'raw holdings from database')
    
    const holdings: Holding[] = []
    for (let i = 0; i < encryptedHoldings.length; i++) {
      const encrypted = encryptedHoldings[i]
      console.log('[DEBUG] getHoldings - processing holding', i, 'isEncrypted:', encrypted.isEncrypted)
      
      try {
        if (encrypted.isEncrypted) {
          const decrypted = await this.decryptHolding(encrypted as EncryptedHolding)
          holdings.push(decrypted)
          console.log('[DEBUG] getHoldings - successfully decrypted holding', i)
        } else {
          holdings.push(encrypted as Holding)
          console.log('[DEBUG] getHoldings - added unencrypted holding', i)
        }
      } catch (decryptError) {
        console.error('[DEBUG] getHoldings - failed to decrypt holding', i, ':', decryptError)
        console.error('[DEBUG] getHoldings - this is likely due to encryption key mismatch')
        
        // If decryption fails, it's likely due to key mismatch
        // For sync scenarios, we should clear the incompatible data
        throw new Error('ENCRYPTION_KEY_MISMATCH')
      }
    }
    
    console.log('[DEBUG] getHoldings - returning', holdings.length, 'processed holdings')
    return holdings
  }

  async clearIncompatibleEncryptedData(): Promise<void> {
    console.log('[DEBUG] clearIncompatibleEncryptedData - clearing encrypted holdings...')
    await dbV2.holdings.clear()
    console.log('[DEBUG] clearIncompatibleEncryptedData - encrypted holdings cleared')
  }
  
  async getHoldingsByLocation(locationId: string): Promise<Holding[]> {
    if (!this.isUnlocked()) {
      // 暗号化キーの自動復元を試行
      const recovered = await this.tryRecoverEncryptionKey()
      if (!recovered) {
        throw new Error('Storage is locked and key recovery failed')
      }
    }
    
    const allHoldings = await this.getHoldings()
    return allHoldings.filter(holding => holding.locationId === locationId)
  }
  
  async getHoldingsBySymbol(symbol: string): Promise<Holding[]> {
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
    }
    
    const allHoldings = await this.getHoldings()
    return allHoldings.filter(holding => holding.symbol === symbol.toUpperCase())
  }
  
  async getAggregatedHoldings(): Promise<Map<string, { totalQuantity: number, holdings: Holding[], notes: string[] }>> {
    const holdings = await this.getHoldings()
    const aggregated = new Map()

    for (const holding of holdings) {
      const symbol = holding.symbol.toUpperCase()
      if (!aggregated.has(symbol)) {
        aggregated.set(symbol, {
          totalQuantity: 0,
          holdings: [],
          notes: []
        })
      }
      
      const agg = aggregated.get(symbol)
      agg.totalQuantity += holding.quantity
      agg.holdings.push(holding)
      if (holding.note && holding.note.trim()) {
        agg.notes.push(holding.note.trim())
      }
    }

    return aggregated
  }
  
  async migrateUnencryptedData(): Promise<void> {
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
    }
    
    const allHoldings = await dbV2.table('holdings').toArray()
    const unencryptedHoldings = allHoldings.filter(h => !h.isEncrypted)
    
    if (unencryptedHoldings.length === 0) {
      return
    }
    
    console.log(`Migrating ${unencryptedHoldings.length} unencrypted holdings...`)
    
    for (const holding of unencryptedHoldings) {
      const encryptedHolding = await this.encryptHolding(holding as Holding)
      await dbV2.table('holdings').update(holding.id, encryptedHolding)
    }
    
    console.log('Migration completed successfully')
  }
  
  async getLocations(): Promise<Location[]> {
    return await dbServiceV2.getLocations()
  }
  
  async getLocationsByType(type: any): Promise<Location[]> {
    return await dbServiceV2.getLocationsByType(type)
  }
  
  async addCustomLocation(name: string): Promise<Location> {
    return await dbServiceV2.addCustomLocation(name)
  }
  
  async getLocation(id: string): Promise<Location | undefined> {
    return await dbServiceV2.getLocation(id)
  }
  
  async setPrice(symbol: string, date: string, priceJpy: number, fxRate?: number): Promise<void> {
    return await dbServiceV2.setPrice(symbol, date, priceJpy, fxRate)
  }
  
  async getPrice(symbol: string, date: string): Promise<Price | undefined> {
    return await dbServiceV2.getPrice(symbol, date)
  }
  
  async getLatestPrice(symbol: string): Promise<Price | undefined> {
    return await dbServiceV2.getLatestPrice(symbol)
  }
  
  isPriceFresh(price: Price): boolean {
    return dbServiceV2.isPriceFresh(price)
  }
  
  async clearAllData(): Promise<void> {
    // データクリア時は暗号化キーの状態に関係なく実行
    // ログアウト時のクリーンアップを可能にする
    console.log('[DEBUG] clearAllData - clearing database data...')
    await dbServiceV2.clearAllData()
    console.log('[DEBUG] clearAllData - database data cleared successfully')
  }
  
  async clearAllDataForNewUser(): Promise<void> {
    // Clear only encrypted data for new user without checking unlock state
    // This is needed to remove old encrypted data that was encrypted with different keys
    // Keep locations and tokens data intact
    console.log('[DEBUG] clearAllDataForNewUser - clearing encrypted holdings data...')
    await dbV2.holdings.clear()
    await dbV2.prices.clear()
    console.log('[DEBUG] clearAllDataForNewUser - encrypted data cleared successfully')
    
    // Ensure initial data exists for new user
    await this.ensureInitialDataExists()
  }

  async ensureInitialDataExists(): Promise<void> {
    console.log('[DEBUG] ensureInitialDataExists - ensuring preset data exists safely')
    try {
      const { metadataService } = await import('@/services/metadata.service')
      await metadataService.ensurePresetDataExists()
      console.log('[DEBUG] ensureInitialDataExists - completed successfully')
    } catch (error) {
      console.error('[DEBUG] ensureInitialDataExists - failed:', error)
    }
  }
  
  async getAuthState(): Promise<AuthState> {
    const authData = localStorage.getItem('crypto-portfolio-auth')
    console.log('[DEBUG] getAuthState - raw localStorage data:', authData)
    if (!authData) {
      return { isAuthenticated: false }
    }
    
    try {
      const parsed = JSON.parse(authData)
      console.log('[DEBUG] getAuthState - parsed data:', parsed)
      return parsed
    } catch (error) {
      console.log('[DEBUG] getAuthState - parse error:', error)
      return { isAuthenticated: false }
    }
  }
  
  async setAuthState(state: AuthState): Promise<void> {
    console.log('[DEBUG] setAuthState - setting state:', state)
    localStorage.setItem('crypto-portfolio-auth', JSON.stringify(state))
  }
  
  async clearAuthState(): Promise<void> {
    console.log('[DEBUG] clearAuthState - starting cleanup...')
    localStorage.removeItem('crypto-portfolio-auth')
    
    // 認証状態クリア時は暗号化キーもクリア
    this.clearEncryptionKey()
    
    // データベースクリア（ロック状態に関係なく）
    await this.clearAllData()
    console.log('[DEBUG] clearAuthState - cleanup completed')
  }

  async forceReset(): Promise<void> {
    // Force clear all data regardless of lock state
    try {
      // Clear localStorage auth data
      localStorage.removeItem('crypto-portfolio-auth')
      
      // Clear all database data without checking lock state
      await dbServiceV2.clearAllData()
      
      console.log('Force reset completed successfully')
    } catch (error) {
      console.error('Force reset failed:', error)
      // Don't throw - we want to continue with other cleanup
    }
  }
}

export const secureStorage = new SecureStorageService()