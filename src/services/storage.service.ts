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
  
  setEncryptionKey(key: CryptoKey) {
    this.encryptionKey = key
  }
  
  clearEncryptionKey() {
    this.encryptionKey = null
  }
  
  isUnlocked(): boolean {
    return this.encryptionKey !== null
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
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
    }
    
    const now = Date.now()
    const newHolding: Holding = {
      ...holding,
      id: `holding-${now}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now
    }
    
    const encryptedHolding = await this.encryptHolding(newHolding)
    
    // Ensure token exists in tokens table
    await dbServiceV2.ensureTokenExists(holding.symbol)
    
    await dbV2.table('holdings').add(encryptedHolding as any)
    
    // Update last data modified timestamp for sync
    localStorage.setItem('lastDataModified', Date.now().toString())
    
    return newHolding.id
  }
  
  async updateHolding(id: string, updates: Partial<Omit<Holding, 'id' | 'createdAt'>>): Promise<number> {
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
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
    
    return result
  }
  
  async deleteHolding(id: string): Promise<void> {
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
    }
    
    await dbV2.table('holdings').delete(id)
    
    // Update last data modified timestamp for sync
    localStorage.setItem('lastDataModified', Date.now().toString())
  }
  
  async getHoldings(): Promise<Holding[]> {
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
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
      throw new Error('Storage is locked')
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
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
    }
    
    await dbServiceV2.clearAllData()
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
    console.log('[DEBUG] ensureInitialDataExists - checking if initial data exists...')
    
    // Check if locations exist
    const locationCount = await dbV2.locations.count()
    console.log('[DEBUG] ensureInitialDataExists - location count:', locationCount)
    
    if (locationCount === 0) {
      console.log('[DEBUG] ensureInitialDataExists - populating locations...')
      const presetLocations = [
        // Domestic CEX
        { id: 'bitflyer', name: 'bitFlyer', type: 'domestic_cex' as const, isCustom: false },
        { id: 'coincheck', name: 'Coincheck', type: 'domestic_cex' as const, isCustom: false },
        { id: 'bitbank', name: 'bitbank', type: 'domestic_cex' as const, isCustom: false },
        { id: 'gmo-coin', name: 'GMO Coin', type: 'domestic_cex' as const, isCustom: false },
        { id: 'sbi-vc', name: 'SBI VC Trade', type: 'domestic_cex' as const, isCustom: false },
        
        // Global CEX
        { id: 'binance', name: 'Binance', type: 'global_cex' as const, isCustom: false },
        { id: 'coinbase', name: 'Coinbase', type: 'global_cex' as const, isCustom: false },
        { id: 'kraken', name: 'Kraken', type: 'global_cex' as const, isCustom: false },
        { id: 'bybit', name: 'Bybit', type: 'global_cex' as const, isCustom: false },
        { id: 'okx', name: 'OKX', type: 'global_cex' as const, isCustom: false },
        
        // Software Wallets
        { id: 'metamask', name: 'MetaMask', type: 'sw_wallet' as const, isCustom: false },
        { id: 'trust-wallet', name: 'Trust Wallet', type: 'sw_wallet' as const, isCustom: false },
        { id: 'phantom', name: 'Phantom', type: 'sw_wallet' as const, isCustom: false },
        { id: 'keplr', name: 'Keplr', type: 'sw_wallet' as const, isCustom: false },
        { id: 'backpack', name: 'Backpack', type: 'sw_wallet' as const, isCustom: false },
        
        // Hardware Wallets
        { id: 'ledger', name: 'Ledger', type: 'hw_wallet' as const, isCustom: false },
        { id: 'trezor', name: 'Trezor', type: 'hw_wallet' as const, isCustom: false }
      ]
      
      await dbV2.locations.bulkAdd(presetLocations)
      console.log('[DEBUG] ensureInitialDataExists - locations populated')
    }
    
    // Check if tokens exist
    const tokenCount = await dbV2.tokens.count()
    console.log('[DEBUG] ensureInitialDataExists - token count:', tokenCount)
    
    if (tokenCount === 0) {
      console.log('[DEBUG] ensureInitialDataExists - populating tokens...')
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
      
      await dbV2.tokens.bulkAdd(presetTokens)
      console.log('[DEBUG] ensureInitialDataExists - tokens populated')
    }
    
    console.log('[DEBUG] ensureInitialDataExists - initial data check completed')
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
    localStorage.removeItem('crypto-portfolio-auth')
    await this.clearAllData()
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