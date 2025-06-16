export interface CoinGeckoToken {
  id: string
  symbol: string
  name: string
  thumb?: string
  large?: string
}

export interface CoinGeckoSearchResult {
  coins: CoinGeckoToken[]
}

export interface CoinGeckoPriceResult {
  [key: string]: {
    jpy?: number
    usd?: number
  }
}

export interface CoinGeckoExchangeRate {
  rates: {
    jpy: {
      value: number
    }
  }
}

const BASE_URL = import.meta.env.DEV ? '/api' : 'https://api.coingecko.com/api/v3'

class CoinGeckoService {
  private async fetchAPI<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`)
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error('CoinGecko API fetch error:', error)
      throw error
    }
  }

  async searchTokens(query: string): Promise<CoinGeckoToken[]> {
    if (!query.trim()) return []
    
    try {
      const data = await this.fetchAPI<CoinGeckoSearchResult>(`/search?query=${encodeURIComponent(query)}`)
      return data.coins.slice(0, 10) // Limit to 10 results
    } catch (error) {
      console.error('Token search failed:', error)
      return []
    }
  }

  async getCurrentPrices(coinIds: string[]): Promise<Record<string, number>> {
    if (coinIds.length === 0) return {}

    try {
      const ids = coinIds.join(',')
      const data = await this.fetchAPI<CoinGeckoPriceResult>(`/simple/price?ids=${ids}&vs_currencies=jpy,usd`)
      
      const prices: Record<string, number> = {}
      
      for (const [coinId, priceData] of Object.entries(data)) {
        if (priceData.jpy) {
          prices[coinId] = priceData.jpy
        } else if (priceData.usd) {
          // Convert USD to JPY
          const jpyRate = await this.getUSDToJPYRate()
          prices[coinId] = priceData.usd * jpyRate
        }
      }
      
      return prices
    } catch (error) {
      console.error('Price fetch failed:', error)
      throw error
    }
  }

  async getHistoricalPrice(coinId: string, date: string): Promise<number | null> {
    try {
      // Format: DD-MM-YYYY
      const formattedDate = this.formatDateForAPI(date)
      const data = await this.fetchAPI<any>(`/coins/${coinId}/history?date=${formattedDate}`)
      
      if (data.market_data?.current_price?.jpy) {
        return data.market_data.current_price.jpy
      } else if (data.market_data?.current_price?.usd) {
        const jpyRate = await this.getUSDToJPYRate()
        return data.market_data.current_price.usd * jpyRate
      }
      
      return null
    } catch (error) {
      console.error('Historical price fetch failed:', error)
      return null
    }
  }

  async getPreviousDayPrice(coinId: string): Promise<number | null> {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateString = yesterday.toISOString().split('T')[0]
    
    return await this.getHistoricalPrice(coinId, dateString)
  }

  private async getUSDToJPYRate(): Promise<number> {
    try {
      const data = await this.fetchAPI<CoinGeckoExchangeRate>('/exchange_rates')
      return data.rates.jpy.value
    } catch (error) {
      console.error('Exchange rate fetch failed:', error)
      return 150 // Fallback rate
    }
  }

  private formatDateForAPI(dateString: string): string {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  // Get previous day date string
  getPreviousDayDateString(): string {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }
}

export const coinGeckoService = new CoinGeckoService()