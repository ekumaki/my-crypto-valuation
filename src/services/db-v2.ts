import Dexie, { Table } from 'dexie'
import { DATABASE_CONFIG } from '@/config/database.config'
import type { Location, Holding, Price, Token } from '@/types/database'

export class CryptoPortfolioDBV2 extends Dexie {
  locations!: Table<Location>
  holdings!: Table<Holding>
  prices!: Table<Price>
  tokens!: Table<Token>

  constructor() {
    super('cryptoPortfolioV2')
    
    this.version(1).stores({
      locations: 'id, name, type, isCustom',
      holdings: 'id, locationId, symbol, quantity, createdAt, updatedAt',
      prices: '[symbol+date], priceJpy, fetchedAt'
    })

    this.version(2).stores({
      locations: 'id, name, type, isCustom',
      holdings: 'id, symbol, createdAt, updatedAt, isEncrypted, encryptedQuantity, encryptedLocationId, encryptedNote',
      prices: '[symbol+date], priceJpy, fetchedAt'
    }).upgrade(tx => {
      return tx.table('holdings').toCollection().modify(holding => {
        if (!holding.isEncrypted) {
          holding.isEncrypted = false
        }
      })
    })

    this.version(3).stores({
      locations: 'id, name, type, isCustom',
      holdings: 'id, symbol, createdAt, updatedAt, isEncrypted, encryptedQuantity, encryptedLocationId, encryptedNote',
      prices: '[symbol+date], symbol, priceJpy, fetchedAt',
      tokens: 'symbol, name, id'
    })

    this.version(4).stores({
      locations: 'id, name, type, isCustom, metadata',
      holdings: 'id, symbol, createdAt, updatedAt, isEncrypted, encryptedQuantity, encryptedLocationId, encryptedNote, metadata',
      prices: '[symbol+date], symbol, priceJpy, fetchedAt',
      tokens: 'symbol, name, id, metadata'
    })

    this.version(5).stores({
      locations: 'id, name, type, isCustom, metadata',
      holdings: 'id, symbol, createdAt, updatedAt, isEncrypted, encryptedQuantity, encryptedLocationId, encryptedNote, metadata',
      prices: '[symbol+date], symbol, priceJpy, fetchedAt',
      tokens: 'symbol, name, id, iconUrl, metadata'
    }).upgrade(tx => {
      // 既存のトークンデータにiconUrlフィールドを追加
      return tx.table('tokens').toCollection().modify(token => {
        if (token.iconUrl === undefined) {
          token.iconUrl = null
        }
      })
    })

    this.version(6).stores({
      locations: 'id, name, type, isCustom, metadata',
      holdings: 'id, symbol, createdAt, updatedAt, isEncrypted, encryptedQuantity, encryptedLocationId, encryptedNote, metadata',
      prices: '[symbol+date], symbol, priceJpy, fetchedAt',
      tokens: 'symbol, name, id, iconUrl, isCustom, metadata'
    }).upgrade(async tx => {
      // 既存のトークンデータにisCustomフィールドを追加
      const presetSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'SHIB', 'MATIC', 'LTC', 'ATOM', 'LINK', 'UNI']
      return tx.table('tokens').toCollection().modify(token => {
        if (token.isCustom === undefined) {
          token.isCustom = !presetSymbols.includes(token.symbol?.toUpperCase())
        }
      })
    })

    this.on('populate', () => this.populate())
  }
  
  private async populate() {
    console.log('[DEBUG] DB populate - initializing with safe preset data')
    try {
      const { metadataService } = await import('@/services/metadata.service')
      await metadataService.ensurePresetDataExists()
      console.log('[DEBUG] DB populate - completed successfully with ensurePresetDataExists')
    } catch (error) {
      console.error('[DEBUG] DB populate - failed:', error)
      // Fallback: still try to ensure basic data exists
      console.log('[DEBUG] DB populate - falling back to forceResetAllMetadata')
      try {
        const { metadataService } = await import('@/services/metadata.service')
        await metadataService.forceResetAllMetadata()
      } catch (fallbackError) {
        console.error('[DEBUG] DB populate - fallback also failed:', fallbackError)
      }
    }
  }
  
  // データベース接続を確認
  async ensureConnection(): Promise<void> {
    try {
      if (!this.isOpen()) {
        await this.open()
      }
    } catch (error) {
      console.error('[DB] Failed to ensure connection:', error)
      throw error
    }
  }

  // 安全なデータベース操作ラッパー
  async safeOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error: any) {
      console.error('[DB] Operation failed:', error)
      throw error
    }
  }
}

export const dbV2 = new CryptoPortfolioDBV2()

// Database service functions
export const dbServiceV2 = {
  // Location operations
  async getLocations(): Promise<Location[]> {
    const locations = await dbV2.locations.orderBy('name').toArray()
    console.log('[DEBUG] dbServiceV2.getLocations - returning', locations.length, 'locations')
    return locations
  },

  async getLocationsByType(type: LocationType): Promise<Location[]> {
    return await dbV2.locations.where('type').equals(type).sortBy('name')
  },

  async addCustomLocation(name: string): Promise<Location> {
    const location: Location = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'custom',
      isCustom: true
    }
    await dbV2.locations.add(location)
    
    // データ変更時の自動同期をトリガー
    try {
      const { syncService } = await import('@/services/sync.service')
      await syncService.triggerSyncOnDataChange()
    } catch (error) {
      console.warn('Failed to trigger sync on custom location add:', error)
    }
    
    return location
  },

  async getLocation(id: string): Promise<Location | undefined> {
    return await dbV2.locations.get(id)
  },

  // Holdings operations
  async addHolding(holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now()
    const newHolding: Holding = {
      ...holding,
      id: `holding-${now}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now
    }
    await dbV2.holdings.add(newHolding)
    return newHolding.id
  },

  async updateHolding(id: string, updates: Partial<Omit<Holding, 'id' | 'createdAt'>>): Promise<number> {
    return await dbV2.holdings.update(id, {
      ...updates,
      updatedAt: Date.now()
    })
  },

  async deleteHolding(id: string): Promise<void> {
    await dbV2.holdings.delete(id)
  },

  async getHoldings(): Promise<Holding[]> {
    return await dbV2.holdings.orderBy('updatedAt').reverse().toArray()
  },

  async getHoldingsByLocation(locationId: string): Promise<Holding[]> {
    return await dbV2.holdings.where('locationId').equals(locationId).toArray()
  },

  async getHoldingsBySymbol(symbol: string): Promise<Holding[]> {
    return await dbV2.holdings.where('symbol').equals(symbol.toUpperCase()).toArray()
  },

  // Get aggregated holdings by symbol
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
  },

  // Price operations
  async setPrice(symbol: string, date: string, priceJpy: number, fxRate?: number): Promise<void> {
    await dbV2.prices.put({
      symbol: symbol.toUpperCase(),
      date,
      priceJpy,
      fxRate,
      fetchedAt: Date.now()
    })
  },

  async getPrice(symbol: string, date: string): Promise<Price | undefined> {
    return await dbV2.prices.get([symbol.toUpperCase(), date])
  },

  async getLatestPrice(symbol: string): Promise<Price | undefined> {
    return await dbV2.prices
      .where('symbol')
      .equals(symbol.toUpperCase())
      .reverse()
      .first()
  },

  // Check if price is fresh (within 12 hours)
  isPriceFresh(price: Price): boolean {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000
    return Date.now() - price.fetchedAt < TWELVE_HOURS
  },

  // Token operations
  async getToken(symbol: string): Promise<Token | undefined> {
    return await dbV2.tokens.get(symbol.toUpperCase())
  },

  async addToken(token: Token): Promise<void> {
    const upperSymbol = token.symbol.toUpperCase()
    const existingToken = await this.getToken(upperSymbol)
    
    if (existingToken) {
      // If token already exists, only update if new token has more information
      if (token.iconUrl && !existingToken.iconUrl) {
        console.log(`[DEBUG] addToken - updating token with icon: ${upperSymbol}`)
        await dbV2.tokens.put({ ...existingToken, ...token, symbol: upperSymbol })
      } else if (token.name !== upperSymbol && existingToken.name === upperSymbol) {
        // Update if we have a proper name instead of just the symbol
        console.log(`[DEBUG] addToken - updating token with proper name: ${upperSymbol}`)
        await dbV2.tokens.put({ ...existingToken, ...token, symbol: upperSymbol })
      } else {
        console.log(`[DEBUG] addToken - token already exists with full info, skipping: ${upperSymbol}`)
      }
    } else {
      console.log(`[DEBUG] addToken - adding new token: ${upperSymbol}`)
      await dbV2.tokens.put({ ...token, symbol: upperSymbol })
    }
  },

  async ensureTokenExists(symbol: string): Promise<void> {
    const upperSymbol = symbol.toUpperCase()
    const existingToken = await this.getToken(upperSymbol)
    
    if (!existingToken) {
      // Only add a basic token if it doesn't exist at all
      // This is a fallback for tokens that weren't properly added
      console.log(`[DEBUG] ensureTokenExists - creating fallback token for: ${upperSymbol}`)
      await this.addToken({
        symbol: upperSymbol,
        name: upperSymbol, // Use symbol as name for unknown tokens
        id: upperSymbol.toLowerCase(),
        iconUrl: undefined // Explicitly set as undefined for fallback tokens
      })
      
      // データ変更時の自動同期をトリガー
      try {
        const { syncService } = await import('@/services/sync.service')
        await syncService.triggerSyncOnDataChange()
      } catch (error) {
        console.warn('Failed to trigger sync on token ensure:', error)
      }
    } else {
      console.log(`[DEBUG] ensureTokenExists - token already exists: ${upperSymbol}`, existingToken)
    }
  },

  // トークンのアイコン情報を修復
  async repairTokenIcons(): Promise<void> {
    try {
      const tokens = await dbV2.tokens.toArray()
      const { coinGeckoService } = await import('@/services/coingecko')
      
      for (const token of tokens) {
        if (!token.iconUrl) {
          try {
            // CoinGeckoからアイコン情報を取得
            const searchResults = await coinGeckoService.searchTokens(token.symbol)
            const foundToken = searchResults.find(result => 
              result.symbol.toUpperCase() === token.symbol.toUpperCase()
            )
            
            if (foundToken && foundToken.thumb) {
              // アイコンURLを更新
              await dbV2.tokens.update(token.symbol, { iconUrl: foundToken.thumb })
              console.log(`Updated icon for ${token.symbol}:`, foundToken.thumb)
            }
          } catch (error) {
            console.warn(`Failed to update icon for ${token.symbol}:`, error)
          }
        }
      }
    } catch (error) {
      console.error('Failed to repair token icons:', error)
    }
  },

  // Clear all data (for testing)
  async clearAllData(): Promise<void> {
    console.log('[DB] Clearing all data...')
    try {
      await dbV2.ensureConnection()
      await dbV2.transaction('rw', dbV2.holdings, dbV2.prices, async () => {
        await dbV2.holdings.clear()
        await dbV2.prices.clear()
      })
      console.log('[DB] All data cleared successfully')
    } catch (error) {
      console.error('[DB] Failed to clear data:', error)
      // データベースが閉じられている場合は無視
      if (error.name === 'DatabaseClosedError') {
        console.log('[DB] Database already closed, skipping clear operation')
      } else {
        throw error
      }
    }
  },

  // データベースの強制アップグレード
  async forceUpgrade(): Promise<void> {
    try {
      // データベースを閉じて再オープンすることで強制アップグレード
      await dbV2.close()
      await dbV2.open()
      console.log('Database force upgrade completed')
    } catch (error) {
      console.error('Failed to force upgrade database:', error)
    }
  }
}