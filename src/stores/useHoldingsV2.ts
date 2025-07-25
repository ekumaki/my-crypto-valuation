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

  // Helper function to ensure storage is unlocked
  async function ensureStorageUnlocked(): Promise<boolean> {
    try {
      if (!secureStorage.isUnlocked()) {
        
        // Try to restore encryption key from session storage or local storage
        let keyData = sessionStorage.getItem('encryptionKey')
        let keySource = 'session'
        
        // セッションストレージにない場合はローカルストレージから取得
        if (!keyData) {
          keyData = localStorage.getItem('encryptionKey')
          keySource = 'local'
        }
        
        if (keyData) {
          try {
            const { CryptoService } = await import('@/services/crypto.service')
            const cryptoKey = await CryptoService.importKey(keyData)
            secureStorage.setEncryptionKey(cryptoKey)
            
            if (secureStorage.isUnlocked()) {
              
              // セッションストレージにキーがない場合は保存
              if (keySource === 'local' && !sessionStorage.getItem('encryptionKey')) {
                sessionStorage.setItem('encryptionKey', keyData)
              }
              
              return true
            }
          } catch (keyError) {
            // Remove invalid key
            if (keySource === 'session') {
              sessionStorage.removeItem('encryptionKey')
            } else {
              localStorage.removeItem('encryptionKey')
            }
          }
        }
        
        // If auto unlock failed, request unlock from user
        const { useSessionStore } = await import('@/stores/session.store')
        const sessionStore = useSessionStore()
        
        const unlockSuccess = await sessionStore.requestUnlock()
        return unlockSuccess && secureStorage.isUnlocked()
      }
      
      return true
    } catch (error) {
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
          holdings.value = []
          return
        }
        
        holdings.value = await secureStorage.getHoldings()
      } else {
        // 同期が無効な場合は直接DBから読み込み
        holdings.value = await dbServiceV2.getHoldings()
      }
      
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
          aggregatedHoldings.value = new Map()
          return
        }
        
        aggregatedHoldings.value = await secureStorage.getAggregatedHoldings()
      } else {
        // 同期が無効な場合は直接DBから読み込み
        aggregatedHoldings.value = await dbServiceV2.getAggregatedHoldings()
      }
      
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
      
      
      let savedId: string | number | null = null
      
      if (syncEnabled) {
        // 同期が有効な場合は暗号化されたストレージを使用
        try {
          const storageUnlocked = await ensureStorageUnlocked()
          if (!storageUnlocked) {
            throw new Error('ストレージのロック解除に失敗しました')
          }
          
          savedId = await secureStorage.addHolding(holding)
        } catch (secureError) {
          throw new Error(`暗号化ストレージへの保存に失敗しました: ${secureError instanceof Error ? secureError.message : String(secureError)}`)
        }
      } else {
        // 同期が無効な場合は直接DBに保存
        try {
          savedId = await dbServiceV2.addHolding(holding)
        } catch (dbError) {
          throw new Error(`データベースへの保存に失敗しました: ${dbError instanceof Error ? dbError.message : String(dbError)}`)
        }
      }
      
      if (!savedId) {
        throw new Error('データの保存に失敗しました（IDが取得できませんでした）')
      }
      
      // リロード処理
      try {
        await Promise.all([
          loadHoldings(),
          loadAggregatedHoldings()
        ])
      } catch (reloadError) {
        // リロード失敗はワーニングとして扱い、処理は継続
      }
      
      // メタデータ処理（エラーが発生しても保存処理は成功とする）
      try {
        await processHoldingMetadata(savedId.toString(), syncEnabled, holding.symbol)
      } catch (metaError) {
      }
      
      // 自動同期（非同期で実行、エラーでも保存処理は成功とする）
      if (syncEnabled) {
        // 自動同期を非同期で実行（メイン処理をブロックしない）
        setTimeout(async () => {
          try {
            const { syncService } = await import('@/services/sync.service')
            if (syncService.isEnabled.value) {
              const result = await syncService.performSync({ skipConflictDetection: true })
              if (result.success) {
              } else {
                if (window.showToast) {
                  window.showToast.warning('同期エラー', `データの自動同期に失敗しました: ${result.message}`)
                }
              }
            }
          } catch (syncError) {
          }
        }, 100)
      }
      
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保有データの追加に失敗しました'
      error.value = errorMessage
      return false
    }
  }

  // Helper function to process metadata for holdings
  async function processHoldingMetadata(holdingId: string, syncEnabled: boolean, symbol: string) {
    try {
      const { metadataService } = await import('@/services/metadata.service')
      const now = new Date()
      
      
      // 保有データのメタデータを設定
      const holdingMetadata = {
        isNew: true,
        isModified: false,
        isDeleted: false,
        isSynced: !syncEnabled, // 同期無効時は既に同期済みとして扱う
        lastModified: now,
        lastSyncTime: syncEnabled ? null : now,
        version: 1
      }
      
      try {
        await metadataService.updateCacheForItem('holding', holdingId, holdingMetadata)
      } catch (holdingMetaError) {
      }
      
      // トークンのメタデータ処理（失敗しても継続）
      try {
        const { dbV2 } = await import('@/services/db-v2')
        const token = await dbV2.tokens.where('symbol').equals(symbol).first()
        
        if (token) {
          
          const tokenMetadata = {
            isNew: false,
            isModified: false,
            isDeleted: false,
            isSynced: !syncEnabled, // 同期無効時は既に同期済みとして扱う
            lastModified: now,
            lastSyncTime: syncEnabled ? null : now,
            version: 1
          }
          
          // シンボルでメタデータを更新
          await metadataService.updateCacheForItem('token', symbol, tokenMetadata)
          
          // IDでもメタデータを更新（念のため）
          if (token.id) {
            await metadataService.updateCacheForItem('token', token.id, tokenMetadata)
          }
        } else {
        }
      } catch (tokenError) {
      }
      
    } catch (error) {
      throw error
    }
  }

  async function updateHolding(id: string, updates: Partial<Omit<Holding, 'id' | 'createdAt'>>) {
    try {
      error.value = null
      const syncEnabled = await isSyncEnabled()
      
      if (syncEnabled) {
        // 同期が有効な場合は暗号化されたストレージを使用
        const storageUnlocked = await ensureStorageUnlocked()
        if (!storageUnlocked) {
          throw new Error('ストレージのロック解除に失敗しました')
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
        
        // 自動同期を実行（同期有効な場合のみ）
        if (syncEnabled) {
          if (syncService.isEnabled.value) {
            syncService.performSync({ skipConflictDetection: true }).then(result => {
              if (result.success) {
                // 同期完了後、未同期件数の更新を確実にするため少し待機
                setTimeout(() => {
                }, 200)
              } else {
                // Show error toast for sync failures
                if (window.showToast) {
                  window.showToast.warning('同期エラー', `データの自動同期に失敗しました: ${result.message}`)
                }
              }
            }).catch(err => {
              // Show error toast for sync errors
              if (window.showToast) {
                window.showToast.error('同期エラー', 'データの自動同期中にエラーが発生しました')
              }
            })
          } else {
          }
        }
      } catch (metaError) {
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
        const storageUnlocked = await ensureStorageUnlocked()
        if (!storageUnlocked) {
          throw new Error('ストレージのロック解除に失敗しました')
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
        
        // 自動同期を実行（同期有効な場合のみ）
        if (syncEnabled) {
          if (syncService.isEnabled.value) {
            syncService.performSync({ skipConflictDetection: true }).then(result => {
              if (result.success) {
                // 同期完了後、未同期件数の更新を確実にするため少し待機
                setTimeout(() => {
                }, 200)
              } else {
                // Show error toast for sync failures
                if (window.showToast) {
                  window.showToast.warning('同期エラー', `データの自動同期に失敗しました: ${result.message}`)
                }
              }
            }).catch(err => {
              // Show error toast for sync errors
              if (window.showToast) {
                window.showToast.error('同期エラー', 'データの自動同期中にエラーが発生しました')
              }
            })
          } else {
          }
        }
      } catch (metaError) {
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
