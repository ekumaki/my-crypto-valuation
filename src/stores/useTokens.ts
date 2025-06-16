import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dbService, type Token } from '@/services/db'
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
      tokens.value = await dbService.getTokens()
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
      const token: Token = {
        symbol: tokenData.symbol.toUpperCase(),
        name: tokenData.name,
        id: tokenData.id,
        iconUrl: tokenData.iconUrl
      }

      await dbService.addToken(token)
      await loadTokens()
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
      await dbService.deleteToken(symbol)
      await loadTokens()
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