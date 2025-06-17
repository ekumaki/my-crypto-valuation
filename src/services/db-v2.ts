import Dexie, { Table } from 'dexie'

// Location types
export type LocationType = 'domestic_cex' | 'global_cex' | 'sw_wallet' | 'hw_wallet' | 'custom'

export interface Location {
  id: string
  name: string
  type: LocationType
  isCustom: boolean
}

export interface Holding {
  id: string
  locationId: string
  symbol: string
  quantity: number
  note?: string
  createdAt: number
  updatedAt: number
}

export interface Price {
  symbol: string
  date: string
  priceJpy: number
  fxRate?: number
  fetchedAt: number
}

export class CryptoPortfolioDBV2 extends Dexie {
  locations!: Table<Location>
  holdings!: Table<Holding>
  prices!: Table<Price>

  constructor() {
    super('cryptoPortfolioV2')
    
    this.version(1).stores({
      locations: 'id, name, type, isCustom',
      holdings: 'id, locationId, symbol, quantity, createdAt, updatedAt',
      prices: '[symbol+date], priceJpy, fetchedAt'
    })

    this.on('populate', () => this.populate())
  }

  private async populate() {
    // Populate with preset locations
    const presetLocations: Location[] = [
      // Domestic CEX
      { id: 'bitflyer', name: 'bitFlyer', type: 'domestic_cex', isCustom: false },
      { id: 'coincheck', name: 'Coincheck', type: 'domestic_cex', isCustom: false },
      { id: 'bitbank', name: 'bitbank', type: 'domestic_cex', isCustom: false },
      { id: 'gmo-coin', name: 'GMO Coin', type: 'domestic_cex', isCustom: false },
      { id: 'sbi-vc', name: 'SBI VC Trade', type: 'domestic_cex', isCustom: false },
      
      // Global CEX
      { id: 'binance', name: 'Binance', type: 'global_cex', isCustom: false },
      { id: 'coinbase', name: 'Coinbase', type: 'global_cex', isCustom: false },
      { id: 'kraken', name: 'Kraken', type: 'global_cex', isCustom: false },
      { id: 'bybit', name: 'Bybit', type: 'global_cex', isCustom: false },
      { id: 'okx', name: 'OKX', type: 'global_cex', isCustom: false },
      
      // Software Wallets
      { id: 'metamask', name: 'MetaMask', type: 'sw_wallet', isCustom: false },
      { id: 'trust-wallet', name: 'Trust Wallet', type: 'sw_wallet', isCustom: false },
      { id: 'phantom', name: 'Phantom', type: 'sw_wallet', isCustom: false },
      { id: 'keplr', name: 'Keplr', type: 'sw_wallet', isCustom: false },
      { id: 'backpack', name: 'Backpack', type: 'sw_wallet', isCustom: false },
      
      // Hardware Wallets
      { id: 'ledger', name: 'Ledger', type: 'hw_wallet', isCustom: false },
      { id: 'trezor', name: 'Trezor', type: 'hw_wallet', isCustom: false }
    ]

    await this.locations.bulkAdd(presetLocations)
  }
}

export const dbV2 = new CryptoPortfolioDBV2()

// Database service functions
export const dbServiceV2 = {
  // Location operations
  async getLocations(): Promise<Location[]> {
    return await dbV2.locations.orderBy('name').toArray()
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
    return await dbV2.holdings.add(newHolding)
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
      .orderBy('fetchedAt')
      .reverse()
      .first()
  },

  // Check if price is fresh (within 12 hours)
  isPriceFresh(price: Price): boolean {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000
    return Date.now() - price.fetchedAt < TWELVE_HOURS
  },

  // Clear all data (for testing)
  async clearAllData(): Promise<void> {
    await dbV2.transaction('rw', dbV2.holdings, dbV2.prices, async () => {
      await dbV2.holdings.clear()
      await dbV2.prices.clear()
    })
  }
}