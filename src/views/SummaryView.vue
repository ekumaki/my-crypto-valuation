<template>
  <div class="space-y-6">
    <!-- Header with Price Update Button -->
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
        ポートフォリオ
      </h2>
      
      <button
        @click="updatePrices"
        :disabled="holdingsStore.isPriceLoading"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
      >
        <svg
          :class="{ 'animate-spin': holdingsStore.isPriceLoading }"
          class="w-4 h-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        価格を取得
      </button>
    </div>

    <!-- Summary Table -->
    <div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                通貨
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                合計数量
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                価格（JPY）
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                評価額（JPY）
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                メモ
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="holdingsStore.aggregatedHoldings.size === 0">
              <td colspan="5" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                  </svg>
                  <p class="text-lg font-medium mb-2">保有通貨がありません</p>
                  <p class="text-sm">「保有数量入力」タブから仮想通貨を追加してください</p>
                </div>
              </td>
            </tr>
            
            <tr 
              v-for="[symbol, data] in holdingsStore.aggregatedHoldings" 
              :key="symbol"
              @click="showBreakdown(symbol, data)"
              class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <!-- Token Info -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-8 w-8">
                    <img 
                      v-if="getTokenIcon(symbol)" 
                      :src="getTokenIcon(symbol)" 
                      :alt="symbol" 
                      class="h-8 w-8 rounded-full"
                    >
                    <div v-else class="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <span class="text-xs font-bold text-gray-600 dark:text-gray-300">{{ symbol.charAt(0) }}</span>
                    </div>
                  </div>
                  <div class="ml-3">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ symbol }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ getTokenName(symbol) || '不明' }}</div>
                  </div>
                </div>
              </td>

              <!-- Total Quantity -->
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm text-gray-900 dark:text-white">
                  {{ formatNumber(data.totalQuantity) }}
                </div>
              </td>

              <!-- Price -->
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm text-gray-900 dark:text-white">
                  <span v-if="holdingsStore.prices[symbol]">{{ formatCurrency(holdingsStore.prices[symbol].priceJpy) }}</span>
                  <span v-else class="text-gray-400">-</span>
                </div>
              </td>

              <!-- Value -->
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  <span v-if="getSymbolValue(symbol, data.totalQuantity)">{{ formatCurrency(getSymbolValue(symbol, data.totalQuantity)) }}</span>
                  <span v-else class="text-gray-400">-</span>
                </div>
              </td>

              <!-- Notes -->
              <td class="px-6 py-4">
                <div class="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                  {{ data.notes.join(', ') || '-' }}
                </div>
              </td>
            </tr>
          </tbody>
          
          <!-- Total Footer -->
          <tfoot v-if="holdingsStore.aggregatedHoldings.size > 0" class="bg-gray-50 dark:bg-gray-700 font-medium sticky bottom-0">
            <tr class="border-t border-gray-200 dark:border-gray-600">
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white" colspan="3">
                合計評価額
              </td>
              <td class="px-6 py-4 text-right text-lg font-bold text-gray-900 dark:text-white">
                {{ formatCurrency(totalValue) }}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Last Update Info -->
    <div v-if="holdingsStore.lastPriceUpdate" class="text-sm text-gray-500 dark:text-gray-400 text-center">
      最終更新: {{ formatDate(holdingsStore.lastPriceUpdate) }}
    </div>

    <!-- Breakdown Modal -->
    <div v-if="showBreakdownModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ selectedSymbol }} の保有詳細
          </h3>
          <button
            @click="closeBreakdown"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">場所</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">数量</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">割合</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="holding in selectedBreakdown" :key="holding.id">
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-white">
                  {{ getLocationName(holding.locationId) }}
                </td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-white text-right">
                  {{ formatNumber(holding.quantity) }}
                </td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-white text-right">
                  {{ formatPercentage(holding.quantity / selectedTotalQuantity * 100) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import { useTokensStore } from '@/stores/useTokens'
import { useLocationsStore } from '@/stores/useLocations'
import { formatCurrency, formatNumber, formatDate, formatPercentage } from '@/utils/format'
import type { Holding } from '@/services/db-v2'

const holdingsStore = useHoldingsStoreV2()
const tokensStore = useTokensStore()
const locationsStore = useLocationsStore()

const showBreakdownModal = ref(false)
const selectedSymbol = ref('')
const selectedBreakdown = ref<Holding[]>([])
const selectedTotalQuantity = ref(0)

const totalValue = computed(() => {
  let total = 0
  for (const [symbol, data] of holdingsStore.aggregatedHoldings) {
    const price = holdingsStore.prices[symbol]?.priceJpy
    if (price && data.totalQuantity) {
      total += price * data.totalQuantity
    }
  }
  return total
})

function getTokenIcon(symbol: string): string | undefined {
  const token = tokensStore.tokens.find(t => t.symbol === symbol)
  return token?.iconUrl
}

function getTokenName(symbol: string): string | undefined {
  const token = tokensStore.tokens.find(t => t.symbol === symbol)
  return token?.name
}

function getSymbolValue(symbol: string, quantity: number): number | null {
  const price = holdingsStore.prices[symbol]?.priceJpy
  return price ? price * quantity : null
}

function getLocationName(locationId: string): string {
  const location = locationsStore.locations.find(l => l.id === locationId)
  return location?.name || 'Unknown'
}

function showBreakdown(symbol: string, data: any) {
  selectedSymbol.value = symbol
  selectedBreakdown.value = data.holdings
  selectedTotalQuantity.value = data.totalQuantity
  showBreakdownModal.value = true
}

function closeBreakdown() {
  showBreakdownModal.value = false
  selectedSymbol.value = ''
  selectedBreakdown.value = []
  selectedTotalQuantity.value = 0
}

async function updatePrices() {
  await holdingsStore.updatePrices()
}

onMounted(async () => {
  await Promise.all([
    tokensStore.loadTokens(),
    locationsStore.loadLocations()
  ])
  
  // Load encrypted holdings with unlock prompt if needed
  const { withEncryption } = await import('@/utils/encryption-guard')
  await withEncryption(async () => {
    await holdingsStore.loadAggregatedHoldings()
    await holdingsStore.loadPrices()
    
    // Auto-update prices if holdings exist
    if (holdingsStore.aggregatedHoldings.size > 0) {
      await holdingsStore.updatePrices()
    }
  })
})
</script>