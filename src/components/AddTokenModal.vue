<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          通貨を追加
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6">
        <!-- Search Input -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            通貨名またはティッカーで検索
          </label>
          <div class="relative">
            <input
              v-model="searchQuery"
              @input="handleSearch"
              type="text"
              placeholder="例: Bitcoin, BTC"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
            <div v-if="tokensStore.isSearching" class="absolute right-3 top-2.5">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            </div>
          </div>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="mb-6">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">検索結果</h4>
          <div class="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
            <div
              v-for="token in searchResults"
              :key="token.id"
              @click="selectToken(token)"
              class="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0"
            >
              <div class="flex-shrink-0 h-8 w-8 mr-3">
                <img v-if="token.iconUrl" :src="token.iconUrl" :alt="token.symbol" class="h-8 w-8 rounded-full">
                <div v-else class="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span class="text-xs font-bold text-gray-600 dark:text-gray-300">{{ token.symbol.charAt(0) }}</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ token.name }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {{ token.symbol }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Results -->
        <div v-else-if="searchQuery && !tokensStore.isSearching && searchResults.length === 0" class="mb-6">
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 20a7.962 7.962 0 01-6.248-3.709m12.248 0A8 8 0 105.172 8.172M15 9.5a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <p class="text-sm">「{{ searchQuery }}」に一致する通貨が見つかりませんでした</p>
          </div>
        </div>

        <!-- Selected Token -->
        <div v-if="selectedToken" class="mb-6">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">選択された通貨</h4>
          <div class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
            <div class="flex-shrink-0 h-10 w-10 mr-4">
              <img v-if="selectedToken.iconUrl" :src="selectedToken.iconUrl" :alt="selectedToken.symbol" class="h-10 w-10 rounded-full">
              <div v-else class="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <span class="text-sm font-bold text-gray-600 dark:text-gray-300">{{ selectedToken.symbol.charAt(0) }}</span>
              </div>
            </div>
            <div class="flex-1">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ selectedToken.name }}
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {{ selectedToken.symbol }}
              </div>
            </div>
          </div>

          <!-- Quantity Input -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              保有量
            </label>
            <input
              v-model="quantity"
              type="number"
              step="0.00000001"
              min="0"
              placeholder="0.00000000"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <!-- Note Input -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              メモ（任意）
            </label>
            <input
              v-model="note"
              type="text"
              placeholder="メモを入力..."
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <!-- Instructions -->
        <div v-else class="mb-6">
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <p class="text-sm">通貨名またはティッカーシンボルを入力して検索してください</p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
          <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
        >
          キャンセル
        </button>
        <button
          @click="addToken"
          :disabled="!selectedToken || isAdding"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          <span v-if="isAdding">追加中...</span>
          <span v-else>追加</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTokensStore } from '@/stores/useTokens'
import { useHoldingsStore } from '@/stores/useHoldings'

interface TokenResult {
  id: string
  symbol: string
  name: string
  iconUrl?: string
}

const emit = defineEmits<{
  close: []
  'token-added': []
}>()

const tokensStore = useTokensStore()
const holdingsStore = useHoldingsStore()

const searchQuery = ref('')
const selectedToken = ref<TokenResult | null>(null)
const quantity = ref('')
const note = ref('')
const isAdding = ref(false)
const error = ref('')

const searchResults = computed(() => tokensStore.searchResults)

let searchTimeout: number | null = null

function handleSearch() {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  searchTimeout = setTimeout(() => {
    if (searchQuery.value.trim()) {
      tokensStore.searchTokens(searchQuery.value)
    } else {
      tokensStore.clearSearch()
    }
  }, 300)
}

function selectToken(token: TokenResult) {
  console.log('selectToken called with:', token)
  selectedToken.value = token
  console.log('selectedToken set to:', selectedToken.value)
  tokensStore.clearSearch()
  searchQuery.value = ''
  console.log('Search cleared, selectedToken after clear:', selectedToken.value)
}

async function addToken() {
  if (!selectedToken.value) {
    console.log('No token selected')
    return
  }

  try {
    isAdding.value = true
    error.value = ''
    console.log('Adding token:', selectedToken.value)

    // Add token to database
    const success = await tokensStore.addToken({
      id: selectedToken.value.id,
      symbol: selectedToken.value.symbol,
      name: selectedToken.value.name,
      iconUrl: selectedToken.value.iconUrl
    })

    console.log('Add token result:', success)

    if (!success) {
      error.value = 'トークンの追加に失敗しました'
      console.error('Token addition failed')
      return
    }

    // Add holding if quantity is specified
    const qty = parseFloat(quantity.value) || 0
    console.log('Quantity:', qty)
    if (qty > 0) {
      const holdingResult = await holdingsStore.updateHolding(selectedToken.value.symbol, qty, note.value)
      console.log('Holding update result:', holdingResult)
    }

    console.log('Emitting token-added event')
    emit('token-added')
  } catch (err) {
    error.value = 'エラーが発生しました: ' + (err as Error).message
    console.error('Failed to add token:', err)
  } finally {
    isAdding.value = false
  }
}

// Clear search results when search query changes, but keep selected token
watch(() => searchQuery.value, (newValue) => {
  if (!newValue && !selectedToken.value) {
    // Only clear selectedToken if no token is currently selected
    selectedToken.value = null
  }
})
</script>