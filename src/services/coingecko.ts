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

const BASE_URL = 'https://api.coingecko.com/api/v3'

class CoinGeckoService {
  private requestQueue: Array<() => Promise<any>> = []
  private isProcessing = false
  private lastRequestTime = 0
  private readonly REQUEST_DELAY = 100 // 100ms between requests

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return
    
    this.isProcessing = true
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!
      
      // レート制限を実装
      const timeSinceLastRequest = Date.now() - this.lastRequestTime
      if (timeSinceLastRequest < this.REQUEST_DELAY) {
        await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY - timeSinceLastRequest))
      }
      
      try {
        await request()
      } catch (error) {
        console.error('Queue request failed:', error)
      }
      
      this.lastRequestTime = Date.now()
    }
    
    this.isProcessing = false
  }

  private async fetchAPI<T>(endpoint: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = async () => {
        try {
          const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            mode: 'cors'
          })
          if (!response.ok) {
            if (response.status === 429) {
              // 429エラーの場合は待機して再試行
              await new Promise(resolve => setTimeout(resolve, 1000))
              const retryResponse = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                mode: 'cors'
              })
              if (!retryResponse.ok) {
                throw new Error(`CoinGecko API error: ${retryResponse.status}`)
              }
              resolve(await retryResponse.json())
            } else {
              throw new Error(`CoinGecko API error: ${response.status}`)
            }
          } else {
            resolve(await response.json())
          }
        } catch (error) {
          console.error('CoinGecko API fetch error:', error)
          reject(error)
        }
      }
      
      this.requestQueue.push(request)
      this.processQueue()
    })
  }

  async searchTokens(query: string): Promise<CoinGeckoToken[]> {
    if (!query.trim()) return []
    
    try {
      console.log('[DEBUG] CoinGecko.searchTokens - searching for:', query)
      const data = await this.fetchAPI<CoinGeckoSearchResult>(`/search?query=${encodeURIComponent(query)}`)
      console.log('[DEBUG] CoinGecko.searchTokens - found', data.coins.length, 'tokens')
      return data.coins.slice(0, 10) // Limit to 10 results
    } catch (error) {
      console.error('[DEBUG] CoinGecko.searchTokens - search failed:', error)
      
      // ネットワークエラーの場合はより詳細なログを出力
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('[DEBUG] CoinGecko.searchTokens - network error, check proxy configuration')
      }
      
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