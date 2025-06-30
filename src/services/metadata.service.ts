import { SyncMetadata, UnsyncedDataDetail, UnsyncedDataCount } from '@/types/sync'
import { dbV2 } from './db-v2'

class MetadataService {
  private globalSyncTime: Date | null = null
  private metadataCache = new Map<string, SyncMetadata>()
  private cacheExpiry: number | null = null
  private readonly CACHE_DURATION = 5000 // 5 seconds

  constructor() {
    this.loadGlobalSyncTime()
    
    // 初期化時のクリーンアップ
    this.performInitialCleanup()
  }

  private performInitialCleanup() {
    try {
      console.log('[DEBUG] MetadataService - performing initial cleanup')
      
      // 無効なメタデータキャッシュをクリア
      this.clearCache()
      
      // グローバル同期時刻の妥当性チェック
      if (this.globalSyncTime) {
        const now = new Date()
        const timeDiff = Math.abs(now.getTime() - this.globalSyncTime.getTime())
        
        // 1年以上古い、または未来の同期時刻をクリア
        if (timeDiff > 365 * 24 * 60 * 60 * 1000 || this.globalSyncTime > now) {
          console.log('[DEBUG] MetadataService - clearing invalid globalSyncTime:', this.globalSyncTime)
          localStorage.removeItem('globalSyncTime')
          this.globalSyncTime = null
        }
      }
      
      console.log('[DEBUG] MetadataService - initial cleanup completed')
    } catch (error) {
      console.warn('[DEBUG] MetadataService - initial cleanup failed:', error)
    }
  }

  /**
   * Create default metadata for new items
   */
  createDefaultMetadata(): SyncMetadata {
    return {
      isNew: true,
      isModified: false,
      isDeleted: false,
      isSynced: false,
      lastModified: new Date(),
      lastSyncTime: null,
      version: 1
    }
  }

  /**
   * Update metadata when item is modified
   */
  markAsModified(metadata: SyncMetadata): SyncMetadata {
    return {
      ...metadata,
      isModified: true,
      isSynced: false,
      lastModified: new Date(),
      version: metadata.version + 1
    }
  }

  /**
   * Mark item as deleted (logical deletion)
   */
  markAsDeleted(metadata: SyncMetadata): SyncMetadata {
    return {
      ...metadata,
      isDeleted: true,
      isSynced: false,
      lastModified: new Date(),
      version: metadata.version + 1
    }
  }

  /**
   * Mark item as synced
   */
  markAsSynced(metadata: SyncMetadata): SyncMetadata {
    const now = new Date()
    return {
      ...metadata,
      isNew: false,
      isModified: false,
      isDeleted: false,
      isSynced: true,
      lastSyncTime: now,
      lastModified: now
    }
  }

  /**
   * Check if an individual item is unsynced
   */
  isUnsyncedData(metadata: SyncMetadata, syncEnabled: boolean = true): boolean {
    const debugInfo = {
      isDeleted: metadata.isDeleted,
      isNew: metadata.isNew,
      isModified: metadata.isModified,
      isSynced: metadata.isSynced,
      hasLastSyncTime: !!metadata.lastSyncTime,
      syncDisabled: metadata.syncDisabled,
      syncEnabled
    }
    
    // 削除済みで未同期の場合
    if (metadata.isDeleted && !metadata.isSynced) {
      console.log('[DEBUG] isUnsyncedData - deleted and unsynced:', debugInfo)
      return true
    }
    
    // 新規作成で未同期の場合
    if (metadata.isNew && !metadata.isSynced) {
      console.log('[DEBUG] isUnsyncedData - new and unsynced:', debugInfo)
      return true
    }
    
    // 変更済みで未同期の場合
    if (metadata.isModified && !metadata.isSynced) {
      console.log('[DEBUG] isUnsyncedData - modified and unsynced:', debugInfo)
      return true
    }
    
    // 既に同期済みとマークされている場合は同期済み
    if (metadata.isSynced && metadata.lastSyncTime) {
      console.log('[DEBUG] isUnsyncedData - synced with timestamp:', debugInfo)
      return false
    }
    
    // 同期無効時に作成されたデータの特別処理
    if (metadata.syncDisabled) {
      const result = syncEnabled ? !metadata.isSynced : true
      console.log('[DEBUG] isUnsyncedData - syncDisabled data:', { ...debugInfo, result })
      return result
    }
    
    // 最後の同期時刻がない場合は未同期（ただし、globalSyncTimeより前に作成されたものは同期済みとみなす）
    if (!metadata.lastSyncTime) {
      if (this.globalSyncTime && metadata.lastModified <= this.globalSyncTime) {
        console.log('[DEBUG] isUnsyncedData - no sync time but before global sync:', debugInfo)
        return false // 既存データとして扱う
      }
      console.log('[DEBUG] isUnsyncedData - no sync time and after global sync:', debugInfo)
      return true // 新しいデータで未同期
    }
    
    // グローバル同期時刻より後に変更された場合は未同期
    if (this.globalSyncTime && metadata.lastModified > this.globalSyncTime) {
      console.log('[DEBUG] isUnsyncedData - modified after global sync:', debugInfo)
      return true
    }
    
    console.log('[DEBUG] isUnsyncedData - default synced:', debugInfo)
    return false
  }

  /**
   * Get action type for unsynced item
   */
  getActionType(metadata: SyncMetadata): 'created' | 'updated' | 'deleted' {
    if (metadata.isDeleted) return 'deleted'
    if (metadata.isNew) return 'created'
    return 'updated'
  }

  /**
   * Set global sync time
   */
  setGlobalSyncTime(time: Date): void {
    this.globalSyncTime = time
    localStorage.setItem('globalSyncTime', time.toISOString())
    this.clearCache()
  }

  /**
   * Load global sync time from storage
   */
  private loadGlobalSyncTime(): void {
    const saved = localStorage.getItem('globalSyncTime')
    if (saved) {
      this.globalSyncTime = new Date(saved)
    }
  }

  /**
   * Clear metadata cache
   */
  private clearCache(): void {
    this.metadataCache.clear()
    this.cacheExpiry = null
  }

  /**
   * Public method to clear cache - for external use
   */
  clearMetadataCache(): void {
    console.log('[DEBUG] clearMetadataCache - clearing all cached metadata')
    this.clearCache()
    // 強制的にキャッシュを無効化
    this.cacheExpiry = null
    console.log('[DEBUG] clearMetadataCache - cache cleared and invalidated')
  }

  /**
   * Get metadata for a specific item
   */
  getItemMetadata(type: string, id: string | number): SyncMetadata | null {
    const key = `${type}_${id}`
    return this.metadataCache.get(key) || null
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return this.cacheExpiry !== null && Date.now() < this.cacheExpiry
  }

  /**
   * Get unsynced data count with caching
   */
  async getUnsyncedDataCount(syncEnabled: boolean = true): Promise<UnsyncedDataCount> {
    console.log('[DEBUG] getUnsyncedDataCount - called with syncEnabled:', syncEnabled, 'globalSyncTime:', this.globalSyncTime)
    
    if (this.isCacheValid()) {
      const cached = this.getCachedCount()
      console.log('[DEBUG] getUnsyncedDataCount - returning cached result:', cached)
      return cached
    }

    console.log('[DEBUG] getUnsyncedDataCount - cache miss, calculating fresh count')
    
    const holdings = await dbV2.holdings.toArray()
    const locations = await dbV2.locations.toArray()
    const tokens = await dbV2.tokens.toArray()

    console.log('[DEBUG] getUnsyncedDataCount - data loaded:', {
      holdingsCount: holdings.length,
      locationsCount: locations.length,
      tokensCount: tokens.length
    })

    let holdingCount = 0
    let locationCount = 0
    let tokenCount = 0

    // Count unsynced holdings
    for (const holding of holdings) {
      const metadata = this.getOrCreateMetadata(holding, 'holding')
      if (this.isUnsyncedData(metadata, syncEnabled)) {
        console.log('[DEBUG] getUnsyncedDataCount - unsynced holding found:', holding.symbol)
        holdingCount++
      }
    }

    // Count unsynced locations
    for (const location of locations) {
      const metadata = this.getOrCreateMetadata(location, 'location')
      if (this.isUnsyncedData(metadata, syncEnabled)) {
        console.log('[DEBUG] getUnsyncedDataCount - unsynced location found:', location.name)
        locationCount++
      }
    }

    // Count unsynced tokens
    for (const token of tokens) {
      const metadata = this.getOrCreateMetadata(token, 'token')
      if (this.isUnsyncedData(metadata, syncEnabled)) {
        console.log('[DEBUG] getUnsyncedDataCount - unsynced token found:', token.symbol)
        tokenCount++
      }
    }

    const result = {
      holdings: holdingCount,
      locations: locationCount,
      tokens: tokenCount,
      total: holdingCount + locationCount + tokenCount
    }

    console.log('[DEBUG] getUnsyncedDataCount - final result:', result)

    // Cache the result
    this.cacheResult(result)
    return result
  }

  /**
   * Get detailed list of unsynced items
   */
  async getUnsyncedDataDetails(syncEnabled: boolean = true): Promise<UnsyncedDataDetail[]> {
    const details: UnsyncedDataDetail[] = []
    
    const holdings = await dbV2.holdings.toArray()
    const locations = await dbV2.locations.toArray()
    const tokens = await dbV2.tokens.toArray()

    // Check holdings
    for (const holding of holdings) {
      const metadata = this.getOrCreateMetadata(holding, 'holding')
      if (this.isUnsyncedData(metadata, syncEnabled)) {
        details.push({
          type: 'holding',
          id: holding.id?.toString() || 'unknown',
          name: `${holding.symbol} (${holding.quantity})`,
          action: this.getActionType(metadata),
          lastModified: metadata.lastModified
        })
      }
    }

    // Check locations
    for (const location of locations) {
      const metadata = this.getOrCreateMetadata(location, 'location')
      if (this.isUnsyncedData(metadata, syncEnabled)) {
        details.push({
          type: 'location',
          id: location.id.toString(),
          name: location.name,
          action: this.getActionType(metadata),
          lastModified: metadata.lastModified
        })
      }
    }

    // Check tokens
    for (const token of tokens) {
      const metadata = this.getOrCreateMetadata(token, 'token')
      if (this.isUnsyncedData(metadata, syncEnabled)) {
        details.push({
          type: 'token',
          id: token.id?.toString() || 'unknown',
          name: `${token.name} (${token.symbol})`,
          action: this.getActionType(metadata),
          lastModified: metadata.lastModified
        })
      }
    }

    return details.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  }

  /**
   * Get or create metadata for an item
   */
  private getOrCreateMetadata(item: any, type: string): SyncMetadata {
    const key = `${type}_${item.id || item.symbol || 'new'}`
    
    // Check if metadata is already cached
    const cachedMetadata = this.metadataCache.get(key)
    if (cachedMetadata) {
      return cachedMetadata
    }
    
    if (item.metadata) {
      // Ensure dates are Date objects
      const metadata = {
        ...item.metadata,
        lastModified: new Date(item.metadata.lastModified),
        lastSyncTime: item.metadata.lastSyncTime ? new Date(item.metadata.lastSyncTime) : null
      }
      this.metadataCache.set(key, metadata)
      return metadata
    }

    // Create default metadata for existing items without metadata
    const defaultMetadata = this.createDefaultMetadata()
    
    // For items that exist in the database but have no metadata, 
    // we need to determine if they're pre-existing or new
    if (this.globalSyncTime) {
      // If we have a global sync time, items created before that time are considered synced
      const itemTimestamp = item.createdAt || item.updatedAt || 0
      if (itemTimestamp > 0 && itemTimestamp <= this.globalSyncTime.getTime()) {
        defaultMetadata.isNew = false
        defaultMetadata.isSynced = true
        defaultMetadata.lastSyncTime = this.globalSyncTime
        defaultMetadata.lastModified = new Date(itemTimestamp)
      } else {
        // Item is newer than last sync - treat as unsynced
        defaultMetadata.isNew = true
        defaultMetadata.isSynced = false
        defaultMetadata.lastSyncTime = null
        defaultMetadata.lastModified = new Date(itemTimestamp || Date.now())
      }
    } else {
      // No global sync time - treat as pre-existing synced data
      defaultMetadata.isNew = false
      defaultMetadata.isSynced = true
      defaultMetadata.lastSyncTime = new Date()
      defaultMetadata.lastModified = new Date(item.createdAt || item.updatedAt || Date.now())
    }
    
    this.metadataCache.set(key, defaultMetadata)
    return defaultMetadata
  }

  /**
   * Cache the count result
   */
  private cacheResult(result: UnsyncedDataCount): void {
    // Store in a simple cache structure
    this.metadataCache.set('cached_count', result as any)
    this.cacheExpiry = Date.now() + this.CACHE_DURATION
  }

  /**
   * Get cached count result
   */
  private getCachedCount(): UnsyncedDataCount {
    const cached = this.metadataCache.get('cached_count') as any
    return cached || { holdings: 0, locations: 0, tokens: 0, total: 0 }
  }

  /**
   * Update cache for a specific item and persist to database
   */
  async updateCacheForItem(type: string, id: string | number, metadata: SyncMetadata): Promise<void> {
    const key = `${type}_${id}`
    this.metadataCache.set(key, metadata)
    
    // Persist metadata to database
    try {
      switch (type) {
        case 'holding':
          await dbV2.holdings.update(id, { metadata })
          break
        case 'location':
          await dbV2.locations.update(id, { metadata })
          break
        case 'token':
          await dbV2.tokens.update(id, { metadata })
          break
      }
      console.log('[DEBUG] updateCacheForItem - persisted metadata for:', type, id)
    } catch (error) {
      console.warn('[DEBUG] updateCacheForItem - failed to persist metadata:', error)
    }
    
    // Clear count cache to force refresh
    this.cacheExpiry = null
  }

  /**
   * Mark all current data as synced
   */
  async markAllAsSynced(): Promise<void> {
    console.log('[DEBUG] markAllAsSynced - starting to mark all data as synced')
    
    try {
      const holdings = await dbV2.holdings.toArray()
      const locations = await dbV2.locations.toArray()
      const tokens = await dbV2.tokens.toArray()
      const now = new Date()

      // Mark holdings as synced
      for (const holding of holdings) {
        const metadata = this.getOrCreateMetadata(holding, 'holding')
        const syncedMetadata = {
          ...this.markAsSynced(metadata),
          lastSyncTime: now
        }
        // syncDisabledフラグを完全に削除
        delete (syncedMetadata as any).syncDisabled
        await this.updateCacheForItem('holding', holding.id || holding.symbol, syncedMetadata)
      }

      // Mark locations as synced
      for (const location of locations) {
        const metadata = this.getOrCreateMetadata(location, 'location')
        const syncedMetadata = {
          ...this.markAsSynced(metadata),
          lastSyncTime: now
        }
        // syncDisabledフラグを完全に削除
        delete (syncedMetadata as any).syncDisabled
        await this.updateCacheForItem('location', location.id, syncedMetadata)
      }

      // Mark tokens as synced
      for (const token of tokens) {
        const metadata = this.getOrCreateMetadata(token, 'token')
        const syncedMetadata = {
          ...this.markAsSynced(metadata),
          lastSyncTime: now
        }
        // syncDisabledフラグを完全に削除
        delete (syncedMetadata as any).syncDisabled
        await this.updateCacheForItem('token', token.id || token.symbol, syncedMetadata)
      }

      // 新しく追加されたトークンメタデータも同期済みとしてマーク
      // キャッシュ内の未同期トークンメタデータをチェック
      const holdingSymbols = new Set(holdings.map(h => h.symbol))
      console.log('[DEBUG] markAllAsSynced - checking cached tokens for holdings symbols:', Array.from(holdingSymbols))
      
      for (const [cacheKey, metadata] of this.metadataCache.entries()) {
        if (cacheKey.startsWith('token_') && !metadata.isSynced) {
          const tokenIdentifier = cacheKey.replace('token_', '')
          console.log('[DEBUG] markAllAsSynced - checking cached token:', tokenIdentifier, 'metadata:', metadata)
          
          // シンボルベースでチェック（BTC, ETHなど）
          const isUsedSymbol = holdingSymbols.has(tokenIdentifier)
          // IDベースでチェック（bitcoin, ethereumなど）
          const matchingToken = tokens.find(t => t.id === tokenIdentifier)
          const isUsedId = matchingToken && holdingSymbols.has(matchingToken.symbol)
          
          if (isUsedSymbol || isUsedId) {
            console.log('[DEBUG] markAllAsSynced - marking cached token as synced:', tokenIdentifier)
            const syncedMetadata = {
              ...this.markAsSynced(metadata),
              lastSyncTime: now
            }
            delete (syncedMetadata as any).syncDisabled
            await this.updateCacheForItem('token', tokenIdentifier, syncedMetadata)
          }
        }
      }

      // グローバル同期時刻を設定
      this.setGlobalSyncTime(now)
      
      // キャッシュをクリアするが、すぐに新しい同期済み状態でキャッシュを再構築
      this.clearCache()
      
      // 同期完了後、少し待ってからキャッシュを再構築
      await new Promise(resolve => setTimeout(resolve, 50))
      
      console.log('[DEBUG] markAllAsSynced - completed successfully, cache will be rebuilt with synced state')
    } catch (error) {
      console.error('[DEBUG] markAllAsSynced - error:', error)
      throw error
    }
  }

  /**
   * Force reset all metadata - useful for clearing legacy unsynced data
   */
  async forceResetAllMetadata(): Promise<void> {
    console.log('[DEBUG] forceResetAllMetadata - clearing all metadata and repopulating initial data')

    // Clear all cached metadata
    this.clearCache()

    // Clear all localStorage keys related to sync
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('unsynced_') || key.startsWith('metadata_') || key.includes('syncData') || key.includes('conflictData') || key.includes('unsyncedCount') || key.includes('syncStatus') || key.includes('globalSyncTime') || key === 'legacyDataResetCompleted')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

    // Clear existing tables
    await dbV2.locations.clear()
    await dbV2.tokens.clear()

    // Create metadata that marks items as pre-existing and synced
    const createInitialMetadata = () => {
      const now = new Date()
      return {
        isNew: false,
        isModified: false,
        isDeleted: false,
        isSynced: true,
        lastModified: now,
        lastSyncTime: now,
        version: 1
      }
    }

    // Populate with preset locations
    const presetLocations = [
        { id: 'bitflyer', name: 'bitFlyer', type: 'domestic_cex' as const, isCustom: false },
        { id: 'coincheck', name: 'Coincheck', type: 'domestic_cex' as const, isCustom: false },
        { id: 'bitbank', name: 'bitbank', type: 'domestic_cex' as const, isCustom: false },
        { id: 'gmo-coin', name: 'GMO Coin', type: 'domestic_cex' as const, isCustom: false },
        { id: 'sbi-vc', name: 'SBI VC Trade', type: 'domestic_cex' as const, isCustom: false },
        { id: 'binance', name: 'Binance', type: 'global_cex' as const, isCustom: false },
        { id: 'coinbase', name: 'Coinbase', type: 'global_cex' as const, isCustom: false },
        { id: 'kraken', name: 'Kraken', type: 'global_cex' as const, isCustom: false },
        { id: 'bybit', name: 'Bybit', type: 'global_cex' as const, isCustom: false },
        { id: 'okx', name: 'OKX', type: 'global_cex' as const, isCustom: false },
        { id: 'metamask', name: 'MetaMask', type: 'sw_wallet' as const, isCustom: false },
        { id: 'trust-wallet', name: 'Trust Wallet', type: 'sw_wallet' as const, isCustom: false },
        { id: 'phantom', name: 'Phantom', type: 'sw_wallet' as const, isCustom: false },
        { id: 'keplr', name: 'Keplr', type: 'sw_wallet' as const, isCustom: false },
        { id: 'backpack', name: 'Backpack', type: 'sw_wallet' as const, isCustom: false },
        { id: 'ledger', name: 'Ledger', type: 'hw_wallet' as const, isCustom: false },
        { id: 'trezor', name: 'Trezor', type: 'hw_wallet' as const, isCustom: false }
    ].map((location: any) => ({ ...location, metadata: createInitialMetadata() }))

    // Populate with preset tokens
    const presetTokens = [
        { symbol: 'BTC', name: 'Bitcoin', id: 'bitcoin' },
        { symbol: 'ETH', name: 'Ethereum', id: 'ethereum' },
        { symbol: 'BNB', name: 'BNB', id: 'binancecoin' },
        { symbol: 'ADA', name: 'Cardano', id: 'cardano' },
        { symbol: 'SOL', name: 'Solana', id: 'solana' },
        { symbol: 'XRP', name: 'XRP', id: 'ripple' },
        { symbol: 'DOT', name: 'Polkadot', id: 'polkadot' },
        { symbol: 'DOGE', name: 'Dogecoin', id: 'dogecoin' },
        { symbol: 'AVAX', name: 'Avalanche', id: 'avalanche-2' },
        { symbol: 'SHIB', name: 'Shiba Inu', id: 'shiba-inu' },
        { symbol: 'MATIC', name: 'Polygon', id: 'matic-network' },
        { symbol: 'LTC', name: 'Litecoin', id: 'litecoin' },
        { symbol: 'ATOM', name: 'Cosmos', id: 'cosmos' },
        { symbol: 'LINK', name: 'Chainlink', id: 'chainlink' },
        { symbol: 'UNI', name: 'Uniswap', id: 'uniswap' }
    ].map((token: any) => ({ ...token, metadata: createInitialMetadata() }))

    await dbV2.locations.bulkAdd(presetLocations)
    await dbV2.tokens.bulkAdd(presetTokens)

    // Set the global sync time to ensure everything is marked as synced
    this.setGlobalSyncTime(new Date())

    console.log('[DEBUG] forceResetAllMetadata - completed successfully')
  }

  /**
   * Debug function to manually clear all legacy data from browser console
   * Usage: window.clearLegacyData()
   */
  async debugClearAllLegacyData(): Promise<void> {
    console.log('[DEBUG] Manual legacy data cleanup started')
    
    // Remove the completion flag first
    localStorage.removeItem('legacyDataResetCompleted')
    
    // Clear all localStorage keys that might contain legacy data
    const allKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) allKeys.push(key)
    }
    
    const keysToRemove = allKeys.filter(key => 
      key.includes('unsynced') || 
      key.includes('metadata') || 
      key.includes('sync') ||
      key.includes('conflict') ||
      key.startsWith('holding_') ||
      key.startsWith('location_') ||
      key.startsWith('token_')
    )
    
    console.log('[DEBUG] Manual cleanup - removing keys:', keysToRemove)
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    // Force reset
    await this.forceResetAllMetadata()
    
    console.log('[DEBUG] Manual legacy data cleanup completed')
    alert('レガシーデータの削除が完了しました。ページを再読み込みしてください。')
  }
}

export const metadataService = new MetadataService()

// Debug function for browser console
if (typeof window !== 'undefined') {
  (window as any).clearLegacyData = () => metadataService.debugClearAllLegacyData()
  console.log('[DEBUG] window.clearLegacyData() function available for manual legacy data cleanup')
} 