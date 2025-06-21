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
    
    return await dbV2.table('holdings').add(encryptedHolding as any)
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
    
    return await dbV2.table('holdings').update(id, encryptedUpdates)
  }
  
  async deleteHolding(id: string): Promise<void> {
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
    }
    
    await dbV2.table('holdings').delete(id)
  }
  
  async getHoldings(): Promise<Holding[]> {
    if (!this.isUnlocked()) {
      throw new Error('Storage is locked')
    }
    
    const encryptedHoldings = await dbV2.table('holdings').orderBy('updatedAt').reverse().toArray()
    
    const holdings: Holding[] = []
    for (const encrypted of encryptedHoldings) {
      if (encrypted.isEncrypted) {
        holdings.push(await this.decryptHolding(encrypted as EncryptedHolding))
      } else {
        holdings.push(encrypted as Holding)
      }
    }
    
    return holdings
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
}

export const secureStorage = new SecureStorageService()