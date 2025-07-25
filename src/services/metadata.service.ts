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
      
      // 無効なメタデータキャッシュをクリア
      this.clearCache()
      
      // グローバル同期時刻の妥当性チェック
      if (this.globalSyncTime) {
        const now = new Date()
        const timeDiff = Math.abs(now.getTime() - this.globalSyncTime.getTime())
        
        // 1年以上古い、または未来の同期時刻をクリア
        if (timeDiff > 365 * 24 * 60 * 60 * 1000 || this.globalSyncTime > now) {
          localStorage.removeItem('globalSyncTime')
          this.globalSyncTime = null
        }
      }
      
    } catch (error) {
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
    // 同期済みフラグが立っていて、同期時刻がある場合は同期済み
    if (metadata.isSynced && metadata.lastSyncTime) {
      return false
    }
    
    // 削除・新規・変更のいずれかのフラグが立っている場合は未同期
    if (metadata.isDeleted || metadata.isNew || metadata.isModified) {
      return true
    }
    
    // isSyncedフラグが明示的にfalseの場合は未同期
    if (metadata.isSynced === false) {
      return true
    }
    
    // 同期時刻がない場合
    if (!metadata.lastSyncTime) {
      // グローバル同期時刻より前のデータは同期済みとみなす
      if (this.globalSyncTime && metadata.lastModified <= this.globalSyncTime) {
        return false
      }
      // それ以外は未同期
      return true
    }
    
    // デフォルトは同期済み
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
    this.clearCache()
    // 強制的にキャッシュを無効化
    this.cacheExpiry = null
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
    
    if (this.isCacheValid()) {
      const cached = this.getCachedCount()
      return cached
    }

    
    const holdings = await dbV2.holdings.toArray()
    const locations = await dbV2.locations.toArray()
    const tokens = await dbV2.tokens.toArray()

    return Promise.resolve({
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
        holdingCount++
      }
    }

    // Count unsynced locations
    for (const location of locations) {
      const metadata = this.getOrCreateMetadata(location, 'location')
      if (this.isUnsyncedData(metadata, syncEnabled)) {
        locationCount++
      }
    }

    // Count unsynced tokens
    for (const token of tokens) {
      const metadata = this.getOrCreateMetadata(token, 'token')
      if (this.isUnsyncedData(metadata, syncEnabled)) {
        tokenCount++
      }
    }

    const result = {
      holdings: holdingCount,
      locations: locationCount,
      tokens: tokenCount,
      total: holdingCount + locationCount + tokenCount
    }


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
   * Check if an item is preset data
   */
  private isPresetData(item: any, type: string): boolean {
    if (type === 'location') {
      const presetLocationIds = [
        'bitflyer', 'coincheck', 'bitbank', 'gmo-coin', 'sbi-vc',
        'binance', 'coinbase', 'kraken', 'bybit', 'okx',
        'metamask', 'trust-wallet', 'phantom', 'keplr', 'backpack',
        'ledger', 'trezor'
      ]
      return presetLocationIds.includes(item.id)
    }
    
    if (type === 'token') {
      const presetTokenSymbols = [
        'BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 
        'AVAX', 'SHIB', 'MATIC', 'LTC', 'ATOM', 'LINK', 'UNI'
      ]
      return presetTokenSymbols.includes(item.symbol)
    }
    
    // Holdings are never preset data
    return false
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
    
    // プリセットデータかどうかをチェック
    const isPresetData = this.isPresetData(item, type)
    
    if (isPresetData) {
      // プリセットデータは常に同期済みとして扱う
      defaultMetadata.isNew = false
      defaultMetadata.isSynced = true
      defaultMetadata.lastSyncTime = this.globalSyncTime || new Date()
      defaultMetadata.lastModified = this.globalSyncTime || new Date()
    } else if (this.globalSyncTime) {
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
    } catch (error) {
    }
    
    // Clear count cache to force refresh
    this.cacheExpiry = null
  }

  /**
   * Mark all current data as synced
   */
  async markAllAsSynced(): Promise<void> {
    
    try {
      // キャッシュを事前にクリアして最新データを確実に取得
      this.clearCache()
      
      const holdings = await dbV2.holdings.toArray()
      const locations = await dbV2.locations.toArray()
      const tokens = await dbV2.tokens.toArray()
      const now = new Date()

      // 保有している仮想通貨のシンボルを収集
      const holdingSymbols = new Set(holdings.map(h => h.symbol))

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
        
        // 保有している仮想通貨のトークンは特別に処理
        if (holdingSymbols.has(token.symbol)) {
          // シンボルとIDの両方でキャッシュを更新
          await this.updateCacheForItem('token', token.symbol, syncedMetadata)
          if (token.id) {
            await this.updateCacheForItem('token', token.id, syncedMetadata)
          }
        }
      }

      // 保有トークンに関連するすべてのメタデータを強制的に同期済みに
      for (const symbol of holdingSymbols) {
        const token = tokens.find(t => t.symbol === symbol)
        if (token) {
          const syncedMetadata = {
            isNew: false,
            isModified: false,
            isDeleted: false,
            isSynced: true,
            lastModified: now,
            lastSyncTime: now,
            version: 1
          }
          await this.updateCacheForItem('token', symbol, syncedMetadata)
          if (token.id) {
            await this.updateCacheForItem('token', token.id, syncedMetadata)
          }
        }
      }

      // グローバル同期時刻を設定
      this.setGlobalSyncTime(now)
      
      // キャッシュを完全にクリアして、次回の未同期件数計算時に新しいデータを使用する
      this.clearCache()
      
      // データベースへの書き込みが完了するまで待機
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 再度キャッシュをクリアして確実に最新状態を反映
      this.clearCache()
      
    } catch (error) {
      throw error
    }
  }


  /**
   * Clean up legacy metadata without affecting user data
   */
  async cleanupLegacyMetadata(): Promise<void> {

    // Clear all cached metadata
    this.clearCache()

    // Clear only problematic localStorage keys
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('unsynced_') || key.startsWith('metadata_') || key.includes('conflictData') || key.includes('unsyncedCount') || key === 'legacyDataResetCompleted')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

  }

  /**
   * Force reset all metadata - useful for clearing legacy unsynced data
   * WARNING: This will delete all custom tokens and locations!
   */
  async forceResetAllMetadata(): Promise<void> {

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

    // Preserve custom tokens before clearing
    const customTokens = await this.getCustomTokens()
    
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
    ]

    // Populate with preset tokens
    const presetTokens = [
        { symbol: 'BTC', name: 'Bitcoin', id: 'bitcoin', isCustom: false },
        { symbol: 'ETH', name: 'Ethereum', id: 'ethereum', isCustom: false },
        { symbol: 'BNB', name: 'BNB', id: 'binancecoin', isCustom: false },
        { symbol: 'ADA', name: 'Cardano', id: 'cardano', isCustom: false },
        { symbol: 'SOL', name: 'Solana', id: 'solana', isCustom: false },
        { symbol: 'XRP', name: 'XRP', id: 'ripple', isCustom: false },
        { symbol: 'DOT', name: 'Polkadot', id: 'polkadot', isCustom: false },
        { symbol: 'DOGE', name: 'Dogecoin', id: 'dogecoin', isCustom: false },
        { symbol: 'AVAX', name: 'Avalanche', id: 'avalanche-2', isCustom: false },
        { symbol: 'SHIB', name: 'Shiba Inu', id: 'shiba-inu', isCustom: false },
        { symbol: 'MATIC', name: 'Polygon', id: 'matic-network', isCustom: false },
        { symbol: 'LTC', name: 'Litecoin', id: 'litecoin', isCustom: false },
        { symbol: 'ATOM', name: 'Cosmos', id: 'cosmos', isCustom: false },
        { symbol: 'LINK', name: 'Chainlink', id: 'chainlink', isCustom: false },
        { symbol: 'UNI', name: 'Uniswap', id: 'uniswap', isCustom: false }
    ]

    // Add locations and then update with metadata
    await dbV2.locations.bulkAdd(presetLocations)
    for (const location of presetLocations) {
      await this.updateCacheForItem('location', location.id, createInitialMetadata())
    }

    // Add tokens and then update with metadata
    await dbV2.tokens.bulkAdd(presetTokens)
    for (const token of presetTokens) {
      await this.updateCacheForItem('token', token.symbol, createInitialMetadata())
    }

    // Restore custom tokens that were preserved
    if (customTokens.length > 0) {
      // Ensure custom tokens are marked as custom
      const customTokensWithFlag = customTokens.map(token => ({
        ...token,
        isCustom: true
      }))
      await dbV2.tokens.bulkAdd(customTokensWithFlag)
      
      // Create metadata for custom tokens - mark them as existing but not synced
      const createCustomTokenMetadata = () => {
        const now = new Date()
        return {
          isNew: false,
          isModified: false,
          isDeleted: false,
          isSynced: false, // Custom tokens need to be synced
          lastModified: now,
          lastSyncTime: null,
          version: 1
        }
      }
      
      for (const token of customTokens) {
        await this.updateCacheForItem('token', token.symbol, createCustomTokenMetadata())
      }
    }

    // Set the global sync time to ensure everything is marked as synced
    this.setGlobalSyncTime(new Date())

  }

  /**
   * Safely ensure preset data exists without destroying existing custom data
   * This is the recommended method for normal app initialization
   */
  async ensurePresetDataExists(): Promise<void> {
    
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

    // Define preset locations
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
    ]

    // Define preset tokens
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
    ]

    // Ensure preset locations exist
    for (const location of presetLocations) {
      const exists = await dbV2.locations.get(location.id)
      if (!exists) {
        await dbV2.locations.put(location)
        await this.updateCacheForItem('location', location.id, createInitialMetadata())
      }
    }

    // Ensure preset tokens exist
    for (const token of presetTokens) {
      const exists = await dbV2.tokens.get(token.symbol)
      if (!exists) {
        await dbV2.tokens.put(token)
        await this.updateCacheForItem('token', token.symbol, createInitialMetadata())
      }
    }

  }

  /**
   * Check if a token is a preset token
   */
  isPresetToken(symbol: string): boolean {
    const presetSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'SHIB', 'MATIC', 'LTC', 'ATOM', 'LINK', 'UNI']
    return presetSymbols.includes(symbol.toUpperCase())
  }

  /**
   * Get all custom (non-preset) tokens from database
   */
  async getCustomTokens(): Promise<Token[]> {
    try {
      const allTokens = await dbV2.tokens.toArray()
      const customTokens = allTokens.filter(token => !this.isPresetToken(token.symbol))
      return customTokens
    } catch (error) {
      return []
    }
  }

  /**
   * Mark a token as custom
   */
  async markTokenAsCustom(symbol: string): Promise<void> {
    try {
      const token = await dbV2.tokens.get(symbol.toUpperCase())
      if (token && !this.isPresetToken(token.symbol)) {
        await dbV2.tokens.update(symbol.toUpperCase(), { isCustom: true })
      }
    } catch (error) {
    }
  }

  /**
   * Ensure all custom tokens are properly marked
   */
  async ensureCustomTokensMarked(): Promise<void> {
    try {
      const allTokens = await dbV2.tokens.toArray()
      
      for (const token of allTokens) {
        const shouldBeCustom = !this.isPresetToken(token.symbol)
        if (shouldBeCustom && !token.isCustom) {
          await dbV2.tokens.update(token.symbol, { isCustom: true })
        } else if (!shouldBeCustom && token.isCustom) {
          await dbV2.tokens.update(token.symbol, { isCustom: false })
        }
      }
      
    } catch (error) {
    }
  }

  /**
   * Debug function to manually clear all legacy data from browser console
   * Usage: window.clearLegacyData()
   */
  async debugClearAllLegacyData(): Promise<void> {
    
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
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    // Force reset
    await this.forceResetAllMetadata()
    
    alert('レガシーデータの削除が完了しました。ページを再読み込みしてください。')
  }
}

export const metadataService = new MetadataService()

// Debug function for browser console
if (typeof window !== 'undefined') {
  (window as any).clearLegacyData = () => metadataService.debugClearAllLegacyData()
} 
