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
        console.log('[DEBUG] ensureStorageUnlocked - storage is locked, attempting auto unlock...')
        
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
              console.log(`[DEBUG] ensureStorageUnlocked - successfully auto-unlocked with ${keySource} key`)
              
              // セッションストレージにキーがない場合は保存
              if (keySource === 'local' && !sessionStorage.getItem('encryptionKey')) {
                sessionStorage.setItem('encryptionKey', keyData)
                console.log('[DEBUG] ensureStorageUnlocked - restored key to session storage')
              }
              
              return true
            }
          } catch (keyError) {
            console.error(`[DEBUG] ensureStorageUnlocked - failed to import key from ${keySource} storage:`, keyError)
            // Remove invalid key
            if (keySource === 'session') {
              sessionStorage.removeItem('encryptionKey')
            } else {
              localStorage.removeItem('encryptionKey')
            }
          }
        }
        
        // If auto unlock failed, request unlock from user
        console.log('[DEBUG] ensureStorageUnlocked - auto unlock failed, requesting user unlock...')
        const { useSessionStore } = await import('@/stores/session.store')
        const sessionStore = useSessionStore()
        
        const unlockSuccess = await sessionStore.requestUnlock()
        return unlockSuccess && secureStorage.isUnlocked()
      }
      
      return true
    } catch (error) {
      console.error('[DEBUG] ensureStorageUnlocked - error:', error)
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
      
      let savedId: string | number | null = null
      
      if (syncEnabled) {
        // 同期が有効な場合は暗号化されたストレージを使用
        try {
          const storageUnlocked = await ensureStorageUnlocked()
          if (!storageUnlocked) {
            throw new Error('ストレージのロック解除に失敗しました')
          }
          
          savedId = await secureStorage.addHolding(holding)
          console.log('[DEBUG] addHolding - successfully added to secure storage, ID:', savedId)
        } catch (secureError) {
          console.error('[DEBUG] addHolding - secure storage failed:', secureError)
          throw new Error(`暗号化ストレージへの保存に失敗しました: ${secureError instanceof Error ? secureError.message : String(secureError)}`)
        }
      } else {
        // 同期が無効な場合は直接DBに保存
        try {
          console.log('[DEBUG] addHolding - adding to DB directly (sync disabled)')
          savedId = await dbServiceV2.addHolding(holding)
          console.log('[DEBUG] addHolding - successfully added to DB, ID:', savedId)
        } catch (dbError) {
          console.error('[DEBUG] addHolding - DB save failed:', dbError)
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
        console.log('[DEBUG] addHolding - completed reload')
      } catch (reloadError) {
        console.warn('[DEBUG] addHolding - reload failed but save succeeded:', reloadError)
        // リロード失敗はワーニングとして扱い、処理は継続
      }
      
      // メタデータ処理（エラーが発生しても保存処理は成功とする）
      try {
        await processHoldingMetadata(savedId.toString(), syncEnabled, holding.symbol)
      } catch (metaError) {
        console.warn('[DEBUG] addHolding - metadata processing failed (but save succeeded):', metaError)
      }
      
      // 自動同期（非同期で実行、エラーでも保存処理は成功とする）
      if (syncEnabled) {
        // 自動同期を非同期で実行（メイン処理をブロックしない）
        setTimeout(async () => {
          try {
            const { syncService } = await import('@/services/sync.service')
            if (syncService.isEnabled.value) {
              console.log('[DEBUG] addHolding - triggering automatic sync')
              const result = await syncService.performSync({ skipConflictDetection: true })
              if (result.success) {
                console.log('[DEBUG] addHolding - automatic sync completed successfully')
              } else {
                console.warn('[DEBUG] addHolding - automatic sync failed:', result.message)
                if (window.showToast) {
                  window.showToast.warning('同期エラー', `データの自動同期に失敗しました: ${result.message}`)
                }
              }
            }
          } catch (syncError) {
            console.warn('[DEBUG] addHolding - sync failed (but save succeeded):', syncError)
          }
        }, 100)
      }
      
      console.log('[DEBUG] addHolding - operation completed successfully')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保有データの追加に失敗しました'
      error.value = errorMessage
      console.error('[DEBUG] addHolding - operation failed:', err)
      return false
    }
  }

  // Helper function to process metadata for holdings
  async function processHoldingMetadata(holdingId: string, syncEnabled: boolean, symbol: string) {
    try {
      const { metadataService } = await import('@/services/metadata.service')
      const now = new Date()
      
      console.log('[DEBUG] processHoldingMetadata - starting for ID:', holdingId, 'symbol:', symbol, 'syncEnabled:', syncEnabled)
      
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
        console.log('[DEBUG] processHoldingMetadata - holding metadata updated for ID:', holdingId)
      } catch (holdingMetaError) {
        console.warn('[DEBUG] processHoldingMetadata - holding metadata update failed:', holdingMetaError)
      }
      
      // トークンのメタデータ処理（失敗しても継続）
      try {
        const { dbV2 } = await import('@/services/db-v2')
        const token = await dbV2.tokens.where('symbol').equals(symbol).first()
        
        if (token) {
          console.log('[DEBUG] processHoldingMetadata - found token for symbol:', symbol)
          
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
          console.log('[DEBUG] processHoldingMetadata - token metadata updated for symbol:', symbol)
          
          // IDでもメタデータを更新（念のため）
          if (token.id) {
            await metadataService.updateCacheForItem('token', token.id, tokenMetadata)
            console.log('[DEBUG] processHoldingMetadata - token metadata updated for ID:', token.id)
          }
        } else {
          console.log('[DEBUG] processHoldingMetadata - token not found for symbol:', symbol)
        }
      } catch (tokenError) {
        console.warn('[DEBUG] processHoldingMetadata - token metadata processing failed (continuing):', tokenError)
      }
      
      console.log('[DEBUG] processHoldingMetadata - completed successfully')
    } catch (error) {
      console.error('[DEBUG] processHoldingMetadata - failed:', error)
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
        console.log('[DEBUG] updateHolding - metadata updated for ID:', id)
        
        // 自動同期を実行（同期有効な場合のみ）
        if (syncEnabled) {
          if (syncService.isEnabled.value) {
            console.log('[DEBUG] updateHolding - triggering automatic sync')
            syncService.performSync({ skipConflictDetection: true }).then(result => {
              if (result.success) {
                console.log('[DEBUG] updateHolding - automatic sync completed successfully')
                // 同期完了後、未同期件数の更新を確実にするため少し待機
                setTimeout(() => {
                  console.log('[DEBUG] updateHolding - sync complete, events should have fired')
                }, 200)
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
          } else {
            console.log('[DEBUG] updateHolding - sync not enabled, skipping automatic sync')
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
        console.log('[DEBUG] deleteHolding - metadata updated for ID:', id)
        
        // 自動同期を実行（同期有効な場合のみ）
        if (syncEnabled) {
          if (syncService.isEnabled.value) {
            console.log('[DEBUG] deleteHolding - triggering automatic sync')
            syncService.performSync({ skipConflictDetection: true }).then(result => {
              if (result.success) {
                console.log('[DEBUG] deleteHolding - automatic sync completed successfully')
                // 同期完了後、未同期件数の更新を確実にするため少し待機
                setTimeout(() => {
                  console.log('[DEBUG] deleteHolding - sync complete, events should have fired')
                }, 200)
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
          } else {
            console.log('[DEBUG] deleteHolding - sync not enabled or no cloud password, skipping automatic sync')
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