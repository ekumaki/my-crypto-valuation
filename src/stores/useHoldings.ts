import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dbService, type Holding, type Token, type Price } from '@/services/db'
import { coinGeckoService } from '@/services/coingecko'

export interface HoldingWithPrice extends Holding {
  token?: Token
  price?: number
  value?: number
  note?: string
}

export const useHoldingsStore = defineStore('holdings', () => {
  const holdings = ref<HoldingWithPrice[]>([])
  const prices = ref<Record<string, Price>>({})
  const isLoading = ref(false)
  const isPriceLoading = ref(false)
  const error = ref<string | null>(null)
  const lastPriceUpdate = ref<Date | null>(null)

  const totalValue = computed(() => {
    return holdings.value.reduce((total, holding) => {
      return total + (holding.value || 0)
    }, 0)
  })

  const holdingsWithPrices = computed(() => {
    return holdings.value.map(holding => ({
      ...holding,
      value: holding.price && holding.quantity ? holding.price * holding.quantity : 0
    }))
  })

  async function loadHoldings() {
    try {
      isLoading.value = true
      error.value = null

      const [holdingsData, tokensData] = await Promise.all([
        dbService.getHoldings(),
        dbService.getTokens()
      ])

      const tokensMap = new Map(tokensData.map(token => [token.symbol, token]))

      holdings.value = holdingsData.map(holding => {
        const token = tokensMap.get(holding.symbol)
        const price = prices.value[holding.symbol]?.priceJpy
        
        return {
          ...holding,
          token,
          price,
          value: price && holding.quantity ? price * holding.quantity : 0
        }
      })
    } catch (err) {
      error.value = 'ポートフォリオの読み込みに失敗しました'
      console.error('Failed to load holdings:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function updateHolding(symbol: string, quantity: number, note?: string) {
    try {
      error.value = null
      
      // Update in database
      await dbService.setHolding(symbol, quantity)
      
      // Update local state
      const existingIndex = holdings.value.findIndex(h => h.symbol === symbol)
      
      if (quantity <= 0) {
        if (existingIndex >= 0) {
          holdings.value.splice(existingIndex, 1)
        }
      } else {
        const token = await dbService.getToken(symbol)
        const price = prices.value[symbol]?.priceJpy
        
        const holding: HoldingWithPrice = {
          symbol,
          quantity,
          token,
          price,
          value: price && quantity ? price * quantity : 0,
          note
        }

        if (existingIndex >= 0) {
          holdings.value[existingIndex] = holding
        } else {
          holdings.value.push(holding)
        }
      }
      
      return true
    } catch (err) {
      error.value = '保有量の更新に失敗しました'
      console.error('Failed to update holding:', err)
      return false
    }
  }

  async function updatePrices() {
    if (holdings.value.length === 0) return

    try {
      isPriceLoading.value = true
      error.value = null

      const yesterday = coinGeckoService.getPreviousDayDateString()
      const tokenIds = holdings.value
        .map(h => h.token?.id)
        .filter(Boolean) as string[]

      if (tokenIds.length === 0) return

      // Check for cached prices first
      const pricePromises = holdings.value.map(async (holding) => {
        if (!holding.token?.id) return null

        const cachedPrice = await dbService.getPrice(holding.symbol, yesterday)
        if (cachedPrice && dbService.isPriceFresh(cachedPrice)) {
          return { symbol: holding.symbol, price: cachedPrice }
        }

        // Fetch fresh price
        const price = await coinGeckoService.getPreviousDayPrice(holding.token.id)
        if (price) {
          await dbService.setPrice(holding.symbol, yesterday, price)
          return {
            symbol: holding.symbol,
            price: { symbol: holding.symbol, date: yesterday, priceJpy: price, fetchedAt: Date.now() }
          }
        }
        return null
      })

      const priceResults = await Promise.all(pricePromises)
      
      // Update prices map
      priceResults.forEach(result => {
        if (result) {
          prices.value[result.symbol] = result.price
        }
      })

      // Update holdings with new prices
      holdings.value = holdings.value.map(holding => ({
        ...holding,
        price: prices.value[holding.symbol]?.priceJpy,
        value: prices.value[holding.symbol]?.priceJpy && holding.quantity 
          ? prices.value[holding.symbol].priceJpy * holding.quantity 
          : 0
      }))

      lastPriceUpdate.value = new Date()
    } catch (err) {
      error.value = '価格の更新に失敗しました'
      console.error('Failed to update prices:', err)
    } finally {
      isPriceLoading.value = false
    }
  }

  async function removeHolding(symbol: string) {
    return await updateHolding(symbol, 0)
  }

  function clearError() {
    error.value = null
  }

  // Initialize prices from database on load
  async function loadPrices() {
    try {
      const allPrices = await dbService.prices.toArray()
      const pricesMap: Record<string, Price> = {}
      
      // Get the latest price for each symbol
      allPrices.forEach(price => {
        const existing = pricesMap[price.symbol]
        if (!existing || price.fetchedAt > existing.fetchedAt) {
          pricesMap[price.symbol] = price
        }
      })
      
      prices.value = pricesMap
    } catch (err) {
      console.error('Failed to load prices:', err)
    }
  }

  return {
    holdings,
    holdingsWithPrices,
    totalValue,
    isLoading,
    isPriceLoading,
    error,
    lastPriceUpdate,
    loadHoldings,
    updateHolding,
    removeHolding,
    updatePrices,
    loadPrices,
    clearError
  }
})