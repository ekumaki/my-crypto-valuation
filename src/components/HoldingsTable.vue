<template>
  <div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              通貨
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              保有量
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
            <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="aggregatedHoldingsArray.length === 0">
            <td colspan="6" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
              <div class="flex flex-col items-center">
                <svg class="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                </svg>
                <p class="text-lg font-medium mb-2">保有通貨がありません</p>
                <p class="text-sm">「＋通貨を追加」ボタンから仮想通貨を追加してください</p>
              </div>
            </td>
          </tr>
          
          <tr v-for="holding in aggregatedHoldingsArray" :key="holding.symbol" class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <!-- Token Info -->
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="flex-shrink-0 h-8 w-8">
                  <img v-if="holding.token?.iconUrl" :src="holding.token.iconUrl" :alt="holding.symbol" class="h-8 w-8 rounded-full">
                  <div v-else class="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <span class="text-xs font-bold text-gray-600 dark:text-gray-300">{{ holding.symbol.charAt(0) }}</span>
                  </div>
                </div>
                <div class="ml-3">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">{{ holding.symbol }}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">{{ holding.token?.name || '不明' }}</div>
                </div>
              </div>
            </td>

            <!-- Quantity -->
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <div class="text-sm text-gray-900 dark:text-white">
                {{ formatNumber(holding.totalQuantity) }}
              </div>
            </td>

            <!-- Price -->
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <div class="text-sm text-gray-900 dark:text-white">
                <span v-if="holding.price">{{ formatCurrency(holding.price) }}</span>
                <span v-else class="text-gray-400">-</span>
              </div>
            </td>

            <!-- Value -->
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                <span v-if="holding.value">{{ formatCurrency(holding.value) }}</span>
                <span v-else class="text-gray-400">-</span>
              </div>
            </td>

            <!-- Notes -->
            <td class="px-6 py-4">
              <div class="text-sm text-gray-900 dark:text-white">
                <span v-if="holding.notes.length > 0">{{ holding.notes.join(', ') }}</span>
                <span v-else class="text-gray-400">-</span>
              </div>
            </td>

            <!-- Actions -->
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <div class="flex items-center justify-center space-x-2">
                <button
                  @click="editHolding(holding)"
                  class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                  title="編集"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
                <button
                  @click="confirmDeleteAll(holding)"
                  class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  title="すべて削除"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        
        <!-- Total Row -->
        <tfoot v-if="aggregatedHoldingsArray.length > 0" class="bg-gray-50 dark:bg-gray-700 font-medium sticky bottom-0">
          <tr class="border-t border-gray-200 dark:border-gray-600">
            <td class="px-6 py-4 text-sm text-gray-900 dark:text-white" colspan="3">
              合計評価額
            </td>
            <td class="px-6 py-4 text-right text-lg font-bold text-gray-900 dark:text-white">
              {{ formatCurrency(holdingsStore.totalValue) }}
            </td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Edit Modal -->
    <AddHoldingModal
      v-if="editingHolding"
      :holding="editingHolding"
      @close="editingHolding = null"
      @saved="handleHoldingSaved"
    />

    <!-- Delete Confirmation Modal -->
    <div v-if="deletingSymbol" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
          {{ deletingSymbol }} をすべて削除
        </h3>
        
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          この通貨のすべての保有データを削除してもよろしいですか？この操作は元に戻せません。
        </p>
        
        <div class="flex justify-end space-x-3">
          <button
            @click="cancelDelete"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
          >
            キャンセル
          </button>
          <button
            @click="deleteAllHoldings"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
          >
            すべて削除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import { useTokensStore } from '@/stores/useTokens'
import { formatCurrency, formatNumber } from '@/utils/format'
import AddHoldingModal from '@/components/AddHoldingModal.vue'
import type { Holding } from '@/services/db-v2'

interface AggregatedHoldingDisplay {
  symbol: string
  totalQuantity: number
  holdings: Holding[]
  notes: string[]
  token?: any
  price?: number
  value?: number
}

const holdingsStore = useHoldingsStoreV2()
const tokensStore = useTokensStore()

const editingHolding = ref<Holding | null>(null)
const deletingSymbol = ref<string | null>(null)

const aggregatedHoldingsArray = computed(() => {
  const result: AggregatedHoldingDisplay[] = []
  
  for (const [symbol, data] of holdingsStore.aggregatedHoldings) {
    const token = tokensStore.tokens.find(t => t.symbol === symbol)
    const price = holdingsStore.prices[symbol]?.priceJpy
    const value = price && data.totalQuantity ? price * data.totalQuantity : 0
    
    result.push({
      symbol,
      totalQuantity: data.totalQuantity,
      holdings: data.holdings,
      notes: data.notes,
      token,
      price,
      value
    })
  }
  
  return result.sort((a, b) => a.symbol.localeCompare(b.symbol))
})

function editHolding(aggregatedHolding: AggregatedHoldingDisplay) {
  // For editing, we'll use the first holding of this symbol
  if (aggregatedHolding.holdings.length > 0) {
    editingHolding.value = aggregatedHolding.holdings[0]
  }
}

function confirmDeleteAll(aggregatedHolding: AggregatedHoldingDisplay) {
  deletingSymbol.value = aggregatedHolding.symbol
}

function cancelDelete() {
  deletingSymbol.value = null
}

async function deleteAllHoldings() {
  if (!deletingSymbol.value) return
  
  const symbol = deletingSymbol.value
  const holdingsToDelete = holdingsStore.aggregatedHoldings.get(symbol)?.holdings || []
  
  // Delete all holdings for this symbol
  for (const holding of holdingsToDelete) {
    await holdingsStore.deleteHolding(holding.id)
  }
  
  deletingSymbol.value = null
}

function handleHoldingSaved() {
  editingHolding.value = null
  // Reload data
  Promise.all([
    holdingsStore.loadHoldings(),
    holdingsStore.loadAggregatedHoldings()
  ])
}
</script>