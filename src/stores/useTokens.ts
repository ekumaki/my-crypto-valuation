import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dbV2, dbServiceV2, type Token } from '@/services/db-v2'
import { coinGeckoService } from '@/services/coingecko'

export const useTokensStore = defineStore('tokens', () => {
  const tokens = ref<Token[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const searchResults = ref<any[]>([])
  const isSearching = ref(false)

  const sortedTokens = computed(() => {
    return [...tokens.value].sort((a, b) => a.symbol.localeCompare(b.symbol))
  })

  async function loadTokens() {
    try {
      isLoading.value = true
      error.value = null
      tokens.value = await dbV2.tokens.toArray()
      
      // アイコンが不足しているトークンがある場合は修復を実行
      const tokensWithoutIcons = tokens.value.filter(token => !token.iconUrl)
      if (tokensWithoutIcons.length > 0) {
        console.log(`Found ${tokensWithoutIcons.length} tokens without icons, attempting repair...`)
        await dbServiceV2.repairTokenIcons()
        // 修復後に再読み込み
        tokens.value = await dbV2.tokens.toArray()
      }
    } catch (err) {
      error.value = 'トークンの読み込みに失敗しました'
      console.error('Failed to load tokens:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function addToken(tokenData: { id: string; symbol: string; name: string; iconUrl?: string }) {
    try {
      error.value = null
      console.log('[DEBUG] addToken - attempting to add token:', tokenData)
      
      // Check if token already exists
      const existingToken = await dbV2.tokens.where('symbol').equals(tokenData.symbol.toUpperCase()).first()
      if (existingToken) {
        console.log('[DEBUG] addToken - token already exists:', existingToken)
        return true
      }
      
      const token: Token = {
        symbol: tokenData.symbol.toUpperCase(),
        name: tokenData.name,
        id: tokenData.id,
        iconUrl: tokenData.iconUrl
      }

      console.log('[DEBUG] addToken - adding token to database:', token)
      await dbServiceV2.addToken(token)
      
      console.log('[DEBUG] addToken - reloading tokens')
      await loadTokens()
      
      // データ変更時の自動同期をトリガー（非同期で実行）
      try {
        const { syncService } = await import('@/services/sync.service')
        syncService.triggerSyncOnDataChange().catch(syncError => {
          console.warn('Failed to trigger sync on token add:', syncError)
        })
      } catch (error) {
        console.warn('Failed to setup sync trigger on token add:', error)
      }
      
      console.log('[DEBUG] addToken - token added successfully')
      return true
    } catch (err) {
      error.value = 'トークンの追加に失敗しました'
      console.error('Failed to add token:', err)
      return false
    }
  }

  async function removeToken(symbol: string) {
    try {
      error.value = null
      await dbV2.tokens.delete(symbol)
      await loadTokens()
      
      // データ変更時の自動同期をトリガー
      try {
        const { syncService } = await import('@/services/sync.service')
        await syncService.triggerSyncOnDataChange()
      } catch (error) {
        console.warn('Failed to trigger sync on token remove:', error)
      }
      
      return true
    } catch (err) {
      error.value = 'トークンの削除に失敗しました'
      console.error('Failed to remove token:', err)
      return false
    }
  }

  async function searchTokens(query: string) {
    if (!query.trim()) {
      searchResults.value = []
      return
    }

    try {
      isSearching.value = true
      const results = await coinGeckoService.searchTokens(query)
      searchResults.value = results.map(coin => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        iconUrl: coin.thumb || coin.large
      }))
    } catch (err) {
      console.error('Search failed:', err)
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }

  function clearSearch() {
    searchResults.value = []
  }

  function clearError() {
    error.value = null
  }

  return {
    tokens,
    sortedTokens,
    isLoading,
    error,
    searchResults,
    isSearching,
    loadTokens,
    addToken,
    removeToken,
    searchTokens,
    clearSearch,
    clearError
  }
})