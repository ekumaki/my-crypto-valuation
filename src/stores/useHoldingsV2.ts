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

  // Helper function to check if sync is enabled
  async function isSyncEnabled(): Promise<boolean> {
    try {
      const { syncService } = await import('@/services/sync.service')
      return syncService.isEnabled.value
    } catch (error) {
      console.warn('Failed to check sync status, defaulting to false:', error)
      return false
    }
  }

  async function loadHoldings() {
    try {
      isLoading.value = true
      error.value = null
      
      const syncEnabled = await isSyncEnabled()
      
      if (syncEnabled) {
        // 同期が有効な場合は暗号化されたストレージを使用
        if (!secureStorage.isUnlocked()) {
          console.log('[DEBUG] loadHoldings - sync enabled but storage is locked, skipping load')
          holdings.value = []
          return
        }
        
        console.log('[DEBUG] loadHoldings - loading from secure storage (sync enabled)')
        holdings.value = await secureStorage.getHoldings()
      } else {
        // 同期が無効な場合は直接DBから読み込み
        console.log('[DEBUG] loadHoldings - loading from DB directly (sync disabled)')
        holdings.value = await dbServiceV2.getHoldings()
      }
      
      console.log('[DEBUG] loadHoldings - successfully loaded', holdings.value.length, 'holdings')
    } catch (err) {
      error.value = 'ポートフォリオの読み込みに失敗しました'
      console.error('Failed to load holdings:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function loadAggregatedHoldings() {
    try {
      isLoading.value = true
      error.value = null
      
      const syncEnabled = await isSyncEnabled()
      
      if (syncEnabled) {
        // 同期が有効な場合は暗号化されたストレージを使用
        if (!secureStorage.isUnlocked()) {
          console.log('[DEBUG] loadAggregatedHoldings - sync enabled but storage is locked, skipping load')
          aggregatedHoldings.value = new Map()
          return
        }
        
        console.log('[DEBUG] loadAggregatedHoldings - loading from secure storage (sync enabled)')
        aggregatedHoldings.value = await secureStorage.getAggregatedHoldings()
      } else {
        // 同期が無効な場合は直接DBから読み込み
        console.log('[DEBUG] loadAggregatedHoldings - loading from DB directly (sync disabled)')
        aggregatedHoldings.value = await dbServiceV2.getAggregatedHoldings()
      }
      
      console.log('[DEBUG] loadAggregatedHoldings - successfully loaded', aggregatedHoldings.value.size, 'aggregated holdings')
    } catch (err) {
      error.value = 'ポートフォリオの読み込みに失敗しました'
      console.error('Failed to load aggregated holdings:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function addHolding(holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      error.value = null
      const syncEnabled = await isSyncEnabled()
      
      console.log('[DEBUG] addHolding - sync enabled:', syncEnabled)
      console.log('[DEBUG] addHolding - attempting to add:', holding)
      
      if (syncEnabled) {
        // 同期が有効な場合は暗号化されたストレージを使用
        if (!secureStorage.isUnlocked()) {
          console.log('[DEBUG] addHolding - sync enabled but storage is locked, attempting to unlock...')
          
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
        console.log('[DEBUG] addHolding - successfully added to secure storage')
      } else {
        // 同期が無効な場合は直接DBに保存
        console.log('[DEBUG] addHolding - adding to DB directly (sync disabled)')
        await dbServiceV2.addHolding(holding)
        console.log('[DEBUG] addHolding - successfully added to DB')
      }
      
      await Promise.all([
        loadHoldings(),
        loadAggregatedHoldings()
      ])
      console.log('[DEBUG] addHolding - completed reload')
      
      // メタデータ処理と自動同期
      try {
        const { metadataService } = await import('@/services/metadata.service')
        const { syncService } = await import('@/services/sync.service')
        const now = new Date()
        
        // 保有データのメタデータを設定
        const holdingMetadata = {
          isNew: true,
          isModified: false,
          isDeleted: false,
          isSynced: false,
          lastModified: now,
          lastSyncTime: null,
          version: 1
        }
        
        // 同期無効時は特別フラグを追加
        if (!syncEnabled) {
          (holdingMetadata as any).syncDisabled = true
        }
        
        // 最新の保有データIDを取得
        let newHoldingId: string | number
        if (syncEnabled) {
          const { dbV2 } = await import('@/services/db-v2')
          const latestHoldings = await dbV2.holdings.orderBy('updatedAt').reverse().limit(1).toArray()
          newHoldingId = latestHoldings[0]?.id || Date.now()
        } else {
          const latestHoldings = await dbServiceV2.getHoldings()
          newHoldingId = latestHoldings[0]?.id || Date.now()
        }
        
        await metadataService.updateCacheForItem('holding', newHoldingId, holdingMetadata)
        console.log('[DEBUG] addHolding - metadata updated for ID:', newHoldingId)
        
        // 自動同期を実行（同期有効かつクラウドパスワードがある場合のみ）
        if (syncEnabled) {
          if (syncService.isEnabled.value && syncService.hasCloudPassword.value) {
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
        }
      } catch (metaError) {
        console.warn('[DEBUG] addHolding - metadata/sync processing failed:', metaError)
        // Don't fail the whole operation if metadata/sync fails
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
      const syncEnabled = await isSyncEnabled()
      
      if (syncEnabled) {
        // 同期が有効な場合は暗号化されたストレージを使用
        if (!secureStorage.isUnlocked()) {
          const { useSessionStore } = await import('@/stores/session.store')
          const sessionStore = useSessionStore()
          const unlockSuccess = await sessionStore.requestUnlock()
          
          if (!unlockSuccess || !secureStorage.isUnlocked()) {
            throw new Error('ストレージのロック解除に失敗しました')
          }
        }
        
        await secureStorage.updateHolding(id, updates)
      } else {
        // 同期が無効な場合は直接DBを更新
        await dbServiceV2.updateHolding(id, updates)
      }
      
      await Promise.all([
        loadHoldings(),
        loadAggregatedHoldings()
      ])
      
      // メタデータ処理と自動同期
      try {
        const { metadataService } = await import('@/services/metadata.service')
        const { syncService } = await import('@/services/sync.service')
        const now = new Date()
        
        // 保有データのメタデータを設定
        const holdingMetadata = {
          isNew: false,
          isModified: true,
          isDeleted: false,
          isSynced: false,
          lastModified: now,
          lastSyncTime: null,
          version: 1
        }
        
        // 同期無効時は特別フラグを追加
        if (!syncEnabled) {
          (holdingMetadata as any).syncDisabled = true
        }
        
        await metadataService.updateCacheForItem('holding', id, holdingMetadata)
        console.log('[DEBUG] updateHolding - metadata updated for ID:', id)
        
        // 自動同期を実行（同期有効かつクラウドパスワードがある場合のみ）
        if (syncEnabled) {
          if (syncService.isEnabled.value && syncService.hasCloudPassword.value) {
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
        }
      } catch (metaError) {
        console.warn('[DEBUG] updateHolding - metadata/sync processing failed:', metaError)
        // Don't fail the whole operation if metadata/sync fails
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
      const syncEnabled = await isSyncEnabled()
      
      if (syncEnabled) {
        // 同期が有効な場合は暗号化されたストレージを使用
        if (!secureStorage.isUnlocked()) {
          const { useSessionStore } = await import('@/stores/session.store')
          const sessionStore = useSessionStore()
          const unlockSuccess = await sessionStore.requestUnlock()
          
          if (!unlockSuccess || !secureStorage.isUnlocked()) {
            throw new Error('ストレージのロック解除に失敗しました')
          }
        }
        
        await secureStorage.deleteHolding(id)
      } else {
        // 同期が無効な場合は直接DBから削除
        await dbServiceV2.deleteHolding(id)
      }
      
      await Promise.all([
        loadHoldings(),
        loadAggregatedHoldings()
      ])
      
      // メタデータ処理と自動同期
      try {
        const { metadataService } = await import('@/services/metadata.service')
        const { syncService } = await import('@/services/sync.service')
        const now = new Date()
        
        // 保有データのメタデータを設定
        const holdingMetadata = {
          isNew: false,
          isModified: false,
          isDeleted: true,
          isSynced: false,
          lastModified: now,
          lastSyncTime: null,
          version: 1
        }
        
        // 同期無効時は特別フラグを追加
        if (!syncEnabled) {
          (holdingMetadata as any).syncDisabled = true
        }
        
        await metadataService.updateCacheForItem('holding', id, holdingMetadata)
        console.log('[DEBUG] deleteHolding - metadata updated for ID:', id)
        
        // 自動同期を実行（同期有効かつクラウドパスワードがある場合のみ）
        if (syncEnabled) {
          if (syncService.isEnabled.value && syncService.hasCloudPassword.value) {
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
        }
      } catch (metaError) {
        console.warn('[DEBUG] deleteHolding - metadata/sync processing failed:', metaError)
        // Don't fail the whole operation if metadata/sync fails
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