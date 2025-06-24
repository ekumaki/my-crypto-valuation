<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          {{ isEditing ? '保有データを編集' : '保有データを追加' }}
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
      <div class="p-6 space-y-6">
        <!-- Location Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            場所
          </label>
          <div class="relative">
            <select
              v-model="selectedLocationId"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">場所を選択してください</option>
              
              <!-- Domestic CEX -->
              <optgroup label="国内取引所">
                <option v-for="location in domesticCEX" :key="location.id" :value="location.id">
                  {{ location.name }}
                </option>
              </optgroup>
              
              <!-- Global CEX -->
              <optgroup label="海外取引所">
                <option v-for="location in globalCEX" :key="location.id" :value="location.id">
                  {{ location.name }}
                </option>
              </optgroup>
              
              <!-- Software Wallets -->
              <optgroup label="ソフトウェアウォレット">
                <option v-for="location in swWallets" :key="location.id" :value="location.id">
                  {{ location.name }}
                </option>
              </optgroup>
              
              <!-- Hardware Wallets -->
              <optgroup label="ハードウェアウォレット">
                <option v-for="location in hwWallets" :key="location.id" :value="location.id">
                  {{ location.name }}
                </option>
              </optgroup>
              
              <!-- Custom Locations -->
              <optgroup v-if="customLocations.length > 0" label="カスタム">
                <option v-for="location in customLocations" :key="location.id" :value="location.id">
                  {{ location.name }}
                </option>
              </optgroup>
              
              <option value="custom">その他（カスタム）</option>
            </select>
          </div>
        </div>

        <!-- Custom Location Input -->
        <div v-if="selectedLocationId === 'custom'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            カスタム場所名
          </label>
          <input
            v-model="customLocationName"
            type="text"
            placeholder="場所名を入力..."
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <!-- Token Search -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            通貨
          </label>
          <div class="relative">
            <input
              v-model="searchQuery"
              @input="handleSearch"
              type="text"
              placeholder="通貨名またはティッカーで検索"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
            <div v-if="tokensStore.isSearching" class="absolute right-3 top-2.5">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            </div>
          </div>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="mb-4">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">検索結果</h4>
          <div class="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
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

        <!-- Selected Token -->
        <div v-if="selectedToken">
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
        </div>

        <!-- Quantity Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            数量
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
        <div>
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

        <!-- Error Message -->
        <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
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
          @click="save"
          :disabled="!canSave || isSaving"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          <span v-if="isSaving">{{ isEditing ? '更新中...' : '追加中...' }}</span>
          <span v-else>{{ isEditing ? '更新' : '追加' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useTokensStore } from '@/stores/useTokens'
import { useLocationsStore } from '@/stores/useLocations'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import type { Holding } from '@/services/db-v2'

interface TokenResult {
  id: string
  symbol: string
  name: string
  iconUrl?: string
}

interface Props {
  holding?: Holding | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const tokensStore = useTokensStore()
const locationsStore = useLocationsStore()
const holdingsStore = useHoldingsStoreV2()

const isEditing = computed(() => !!props.holding)

const selectedLocationId = ref('')
const customLocationName = ref('')
const searchQuery = ref('')
const selectedToken = ref<TokenResult | null>(null)
const quantity = ref('')
const note = ref('')
const isSaving = ref(false)
const error = ref('')

const searchResults = computed(() => tokensStore.searchResults)

const domesticCEX = computed(() => locationsStore.getLocationsByType('domestic_cex'))
const globalCEX = computed(() => locationsStore.getLocationsByType('global_cex'))
const swWallets = computed(() => locationsStore.getLocationsByType('sw_wallet'))
const hwWallets = computed(() => locationsStore.getLocationsByType('hw_wallet'))
const customLocations = computed(() => locationsStore.getLocationsByType('custom'))

const canSave = computed(() => {
  const hasLocation = selectedLocationId.value && selectedLocationId.value !== 'custom'
  const hasCustomLocation = selectedLocationId.value === 'custom' && customLocationName.value.trim()
  const hasToken = selectedToken.value
  const hasQuantity = parseFloat(quantity.value) > 0
  
  return (hasLocation || hasCustomLocation) && hasToken && hasQuantity
})

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
  selectedToken.value = token
  tokensStore.clearSearch()
  searchQuery.value = ''
}

async function save() {
  if (!canSave.value) return

  try {
    isSaving.value = true
    error.value = ''

    let locationId = selectedLocationId.value

    // Create custom location if needed
    if (selectedLocationId.value === 'custom') {
      const customLocation = await locationsStore.addCustomLocation(customLocationName.value.trim())
      locationId = customLocation.id
    }

    // Add token to database if not exists
    if (selectedToken.value) {
      await tokensStore.addToken({
        id: selectedToken.value.id,
        symbol: selectedToken.value.symbol,
        name: selectedToken.value.name,
        iconUrl: selectedToken.value.iconUrl
      })
    }

    const holdingData = {
      locationId,
      symbol: selectedToken.value!.symbol.toUpperCase(),
      quantity: parseFloat(quantity.value),
      note: note.value.trim() || undefined
    }

    let success = false
    if (isEditing.value && props.holding) {
      success = await holdingsStore.updateHolding(props.holding.id, holdingData)
    } else {
      success = await holdingsStore.addHolding(holdingData)
    }

    if (success) {
      emit('saved')
    } else {
      error.value = isEditing.value ? 'データの更新に失敗しました' : 'データの追加に失敗しました'
    }
  } catch (err) {
    error.value = 'エラーが発生しました: ' + (err as Error).message
    console.error('Failed to save holding:', err)
  } finally {
    isSaving.value = false
  }
}

// Initialize form when editing
watch(() => props.holding, (holding) => {
  if (holding) {
    selectedLocationId.value = holding.locationId
    quantity.value = holding.quantity.toString()
    note.value = holding.note || ''
    
    // Find and set selected token
    const token = tokensStore.tokens.find(t => t.symbol === holding.symbol)
    if (token) {
      selectedToken.value = {
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        iconUrl: token.iconUrl
      }
    }
  }
}, { immediate: true })

onMounted(async () => {
  console.log('[DEBUG] AddHoldingModal - starting data load')
  
  // Check database state before loading
  const { dbV2 } = await import('@/services/db-v2')
  const dbLocationCount = await dbV2.locations.count()
  console.log('[DEBUG] AddHoldingModal - database location count before load:', dbLocationCount)
  
  await Promise.all([
    tokensStore.loadTokens(),
    locationsStore.loadLocations()
  ])
  
  // Check database state after loading
  const dbLocationCountAfter = await dbV2.locations.count()
  console.log('[DEBUG] AddHoldingModal - database location count after load:', dbLocationCountAfter)
  
  console.log('[DEBUG] AddHoldingModal - data load completed')
  console.log('[DEBUG] Total locations loaded:', locationsStore.locations.length)
  console.log('[DEBUG] Domestic CEX:', domesticCEX.value.length)
  console.log('[DEBUG] Global CEX:', globalCEX.value.length)
  console.log('[DEBUG] SW Wallets:', swWallets.value.length)
  console.log('[DEBUG] HW Wallets:', hwWallets.value.length)
  
  // Additional debugging: list actual location data
  console.log('[DEBUG] AddHoldingModal - actual location data:', locationsStore.locations.map(l => ({ id: l.id, name: l.name, type: l.type })))
})
</script>