import Dexie, { Table } from 'dexie'

export interface Token {
  symbol: string
  name: string
  id: string
  iconUrl?: string
}

export interface Holding {
  symbol: string
  quantity: number
}

export interface Price {
  symbol: string
  date: string
  priceJpy: number
  fxRate?: number
  fetchedAt: number
}

export class CryptoPortfolioDB extends Dexie {
  tokens!: Table<Token>
  holdings!: Table<Holding>
  prices!: Table<Price>

  constructor() {
    super('cryptoPortfolio')
    
    this.version(1).stores({
      tokens: 'symbol, name, id',
      holdings: 'symbol, quantity',
      prices: '[symbol+date], priceJpy, fetchedAt'
    })
  }
}

export const db = new CryptoPortfolioDB()

// Database utility functions
export const dbService = {
  // Token operations
  async addToken(token: Token) {
    return await db.tokens.put(token)
  },

  async getTokens() {
    return await db.tokens.orderBy('symbol').toArray()
  },

  async getToken(symbol: string) {
    return await db.tokens.get(symbol)
  },

  async deleteToken(symbol: string) {
    await db.transaction('rw', db.tokens, db.holdings, db.prices, async () => {
      await db.tokens.delete(symbol)
      await db.holdings.delete(symbol)
      await db.prices.where('symbol').equals(symbol).delete()
    })
  },

  // Holdings operations
  async setHolding(symbol: string, quantity: number) {
    if (quantity <= 0) {
      await db.holdings.delete(symbol)
    } else {
      await db.holdings.put({ symbol, quantity })
    }
  },

  async getHoldings() {
    return await db.holdings.toArray()
  },

  async getHolding(symbol: string) {
    return await db.holdings.get(symbol)
  },

  // Price operations
  async setPrice(symbol: string, date: string, priceJpy: number, fxRate?: number) {
    await db.prices.put({
      symbol,
      date,
      priceJpy,
      fxRate,
      fetchedAt: Date.now()
    })
  },

  async getPrice(symbol: string, date: string) {
    return await db.prices.get([symbol, date])
  },

  async getLatestPrice(symbol: string) {
    return await db.prices
      .where('symbol')
      .equals(symbol)
      .orderBy('fetchedAt')
      .reverse()
      .first()
  },

  // Check if price is fresh (within 12 hours)
  isPriceFresh(price: Price): boolean {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000
    return Date.now() - price.fetchedAt < TWELVE_HOURS
  }
}