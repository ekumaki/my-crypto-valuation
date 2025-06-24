import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dbServiceV2, type Holding, type Price } from '@/services/db-v2'
import { secureStorage } from '@/services/storage.service'
import { coinGeckoService } from '@/services/coingecko'
import { useTokensStore } from './useTokens'

export const useHoldingsStoreV2 = defineStore('holdingsV2', () => {
  const holdings = ref<Holding[]>([])
  const aggregatedHoldings = ref<Map<string, { totalQuantity: number, holdings: Holding[], notes: string[] }>>(new Map())
  const prices = ref<Record<string, Price>>({})
  const isLoading = ref(false)
  const isPriceLoading = ref(false)
  const error = ref<string | null>(null)
  const lastPriceUpdate = ref<Date | null>(null)

  const totalValue = computed(() => {
    let total = 0
    for (const [symbol, data] of aggregatedHoldings.value) {
      const price = prices.value[symbol]?.priceJpy
      if (price && data.totalQuantity) {
        total += price * data.totalQuantity
      }
    }
    return total
  })

  async function loadHoldings() {
    try {
      isLoading.value = true
      error.value = null
      
      // Check if storage is unlocked before attempting to load
      if (!secureStorage.isUnlocked()) {
        console.log('[DEBUG] loadHoldings - storage is locked, skipping load')
        holdings.value = []
        return
      }
      
      console.log('[DEBUG] loadHoldings - attempting to load holdings from secure storage')
      holdings.value = await secureStorage.getHoldings()
      console.log('[DEBUG] loadHoldings - successfully loaded', holdings.value.length, 'holdings')
    } catch (err) {
      error.value = 'ポートフォリオの読み込みに失敗しました'
      console.error('Failed to load holdings:', err)
      console.error('Error name:', err instanceof Error ? err.name : 'Unknown')
      console.error('Error message:', err instanceof Error ? err.message : err)
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack')
    } finally {
      isLoading.value = false
    }
  }

  async function loadAggregatedHoldings() {
    try {
      isLoading.value = true
      error.value = null
      
      // Check if storage is unlocked before attempting to load
      if (!secureStorage.isUnlocked()) {
        console.log('[DEBUG] loadAggregatedHoldings - storage is locked, skipping load')
        aggregatedHoldings.value = new Map()
        return
      }
      
      console.log('[DEBUG] loadAggregatedHoldings - attempting to load aggregated holdings')
      aggregatedHoldings.value = await secureStorage.getAggregatedHoldings()
      console.log('[DEBUG] loadAggregatedHoldings - successfully loaded', aggregatedHoldings.value.size, 'aggregated holdings')
    } catch (err) {
      error.value = 'ポートフォリオの読み込みに失敗しました'
      console.error('Failed to load aggregated holdings:', err)
      console.error('Error name:', err instanceof Error ? err.name : 'Unknown')
      console.error('Error message:', err instanceof Error ? err.message : err)
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack')
    } finally {
      isLoading.value = false
    }
  }

  async function addHolding(holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      error.value = null
      console.log('[DEBUG] addHolding - storage unlocked:', secureStorage.isUnlocked())
      console.log('[DEBUG] addHolding - attempting to add:', holding)
      
      if (!secureStorage.isUnlocked()) {
        console.log('[DEBUG] addHolding - storage is locked, attempting to unlock...')
        
        // Check if we're authenticated and can unlock storage
        const { authService } = await import('@/services/auth.service')
        const isAuthenticated = await authService.isAuthenticated()
        console.log('[DEBUG] addHolding - authentication status:', isAuthenticated)
        
        if (!isAuthenticated) {
          throw new Error('Not authenticated - cannot add holding')
        }
        
        // Try to restore encryption key from session
        try {
          console.log('[DEBUG] addHolding - attempting to restore encryption key from session...')
          
          // Check if we can use the session store to trigger unlock prompt
          const { useSessionStore } = await import('@/stores/session.store')
          const sessionStore = useSessionStore()
          
          console.log('[DEBUG] addHolding - requesting unlock through session store...')
          const unlockSuccess = await sessionStore.requestUnlock()
          
          if (unlockSuccess && secureStorage.isUnlocked()) {
            console.log('[DEBUG] addHolding - unlock successful, retrying operation...')
            // Don't throw error, let the operation continue
          } else {
            console.log('[DEBUG] addHolding - unlock failed or cancelled')
            throw new Error('ストレージのロック解除に失敗しました')
          }
        } catch (unlockError) {
          console.error('[DEBUG] addHolding - failed to unlock storage:', unlockError)
          throw new Error('ストレージがロックされています。パスワードを再入力してください。')
        }
      }
      
      await secureStorage.addHolding(holding)
      console.log('[DEBUG] addHolding - successfully added to storage')
      
      await Promise.all([
        loadHoldings(),
        loadAggregatedHoldings()
      ])
      console.log('[DEBUG] addHolding - completed reload')
      
      // Trigger automatic sync with Google Drive if sync is enabled
      try {
        const { syncService } = await import('@/services/sync.service')
        if (syncService.isEnabled.value) {
          console.log('[DEBUG] addHolding - triggering automatic sync')
          // Don't await sync to avoid blocking the UI
          syncService.performSync().then(result => {
            if (result.success) {
              console.log('[DEBUG] addHolding - automatic sync completed successfully')
            } else {
              console.warn('[DEBUG] addHolding - automatic sync failed:', result.message)
              // Show error toast for sync failures
              if (window.showToast) {
                window.showToast.warning('同期エラー', `データの自動同期に失敗しました: ${result.message}`)
              }
            }
          }).catch(err => {
            console.error('[DEBUG] addHolding - automatic sync error:', err)
            // Show error toast for sync errors
            if (window.showToast) {
              window.showToast.error('同期エラー', 'データの自動同期中にエラーが発生しました')
            }
          })
        } else {
          console.log('[DEBUG] addHolding - sync not enabled, skipping automatic sync')
        }
      } catch (syncError) {
        console.warn('[DEBUG] addHolding - failed to trigger sync:', syncError)
        // Don't fail the whole operation if sync fails
      }
      
      return true
    } catch (err) {
      error.value = '保有データの追加に失敗しました'
      console.error('Failed to add holding:', err)
      console.error('Error details:', err)
      return false
    }
  }

  async function updateHolding(id: string, updates: Partial<Omit<Holding, 'id' | 'createdAt'>>) {
    try {
      error.value = null
      await secureStorage.updateHolding(id, updates)
      await Promise.all([
        loadHoldings(),
        loadAggregatedHoldings()
      ])
      
      // Trigger automatic sync with Google Drive if sync is enabled
      try {
        const { syncService } = await import('@/services/sync.service')
        if (syncService.isEnabled.value) {
          console.log('[DEBUG] updateHolding - triggering automatic sync')
          syncService.performSync().then(result => {
            if (result.success) {
              console.log('[DEBUG] updateHolding - automatic sync completed successfully')
            } else {
              console.warn('[DEBUG] updateHolding - automatic sync failed:', result.message)
              // Show error toast for sync failures
              if (window.showToast) {
                window.showToast.warning('同期エラー', `データの自動同期に失敗しました: ${result.message}`)
              }
            }
          }).catch(err => {
            console.error('[DEBUG] updateHolding - automatic sync error:', err)
            // Show error toast for sync errors
            if (window.showToast) {
              window.showToast.error('同期エラー', 'データの自動同期中にエラーが発生しました')
            }
          })
        }
      } catch (syncError) {
        console.warn('[DEBUG] updateHolding - failed to trigger sync:', syncError)
      }
      
      return true
    } catch (err) {
      error.value = '保有データの更新に失敗しました'
      console.error('Failed to update holding:', err)
      return false
    }
  }

  async function deleteHolding(id: string) {
    try {
      error.value = null
      await secureStorage.deleteHolding(id)
      await Promise.all([
        loadHoldings(),
        loadAggregatedHoldings()
      ])
      
      // Trigger automatic sync with Google Drive if sync is enabled
      try {
        const { syncService } = await import('@/services/sync.service')
        if (syncService.isEnabled.value) {
          console.log('[DEBUG] deleteHolding - triggering automatic sync')
          syncService.performSync().then(result => {
            if (result.success) {
              console.log('[DEBUG] deleteHolding - automatic sync completed successfully')
            } else {
              console.warn('[DEBUG] deleteHolding - automatic sync failed:', result.message)
              // Show error toast for sync failures
              if (window.showToast) {
                window.showToast.warning('同期エラー', `データの自動同期に失敗しました: ${result.message}`)
              }
            }
          }).catch(err => {
            console.error('[DEBUG] deleteHolding - automatic sync error:', err)
            // Show error toast for sync errors
            if (window.showToast) {
              window.showToast.error('同期エラー', 'データの自動同期中にエラーが発生しました')
            }
          })
        }
      } catch (syncError) {
        console.warn('[DEBUG] deleteHolding - failed to trigger sync:', syncError)
      }
      
      return true
    } catch (err) {
      error.value = '保有データの削除に失敗しました'
      console.error('Failed to delete holding:', err)
      return false
    }
  }

  async function updatePrices() {
    if (aggregatedHoldings.value.size === 0) return

    try {
      isPriceLoading.value = true
      error.value = null

      const yesterday = coinGeckoService.getPreviousDayDateString()
      const symbols = Array.from(aggregatedHoldings.value.keys())
      const tokensStore = useTokensStore()

      // Get token IDs for price fetching
      const tokenIds: string[] = []
      const symbolToIdMap: Record<string, string> = {}

      for (const symbol of symbols) {
        const token = tokensStore.tokens.find(t => t.symbol === symbol)
        if (token?.id) {
          tokenIds.push(token.id)
          symbolToIdMap[symbol] = token.id
        }
      }

      if (tokenIds.length === 0) return

      // Check for cached prices first
      const pricePromises = symbols.map(async (symbol) => {
        const tokenId = symbolToIdMap[symbol]
        if (!tokenId) return null

        const cachedPrice = await dbServiceV2.getPrice(symbol, yesterday)
        if (cachedPrice && dbServiceV2.isPriceFresh(cachedPrice)) {
          return { symbol, price: cachedPrice }
        }

        // Fetch fresh price
        const price = await coinGeckoService.getPreviousDayPrice(tokenId)
        if (price) {
          await dbServiceV2.setPrice(symbol, yesterday, price)
          return {
            symbol,
            price: { symbol, date: yesterday, priceJpy: price, fetchedAt: Date.now() }
          }
        }
        return null
      })

      const priceResults = await Promise.all(pricePromises)
      
      // Update prices map
      const newPrices: Record<string, Price> = {}
      priceResults.forEach(result => {
        if (result) {
          newPrices[result.symbol] = result.price
        }
      })

      prices.value = { ...prices.value, ...newPrices }
      lastPriceUpdate.value = new Date()
    } catch (err) {
      error.value = '価格の更新に失敗しました'
      console.error('Failed to update prices:', err)
    } finally {
      isPriceLoading.value = false
    }
  }

  async function loadPrices() {
    try {
      const symbols = Array.from(aggregatedHoldings.value.keys())
      const pricesMap: Record<string, Price> = {}
      
      for (const symbol of symbols) {
        const latestPrice = await dbServiceV2.getLatestPrice(symbol)
        if (latestPrice) {
          pricesMap[symbol] = latestPrice
        }
      }
      
      prices.value = pricesMap
    } catch (err) {
      console.error('Failed to load prices:', err)
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    holdings,
    aggregatedHoldings,
    prices,
    totalValue,
    isLoading,
    isPriceLoading,
    error,
    lastPriceUpdate,
    loadHoldings,
    loadAggregatedHoldings,
    addHolding,
    updateHolding,
    deleteHolding,
    updatePrices,
    loadPrices,
    clearError
  }
})