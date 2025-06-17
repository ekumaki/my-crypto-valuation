<template>
  <div class="space-y-6">
    <!-- Header with Add Button -->
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
        保有数量入力
      </h2>
      
      <button
        @click="showAddModal = true"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-900"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        通貨を追加
      </button>
    </div>

    <!-- Holdings Table -->
    <div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                場所
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                通貨
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                数量
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
            <tr v-if="holdingsStore.holdings.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                  </svg>
                  <p class="text-lg font-medium mb-2">保有データがありません</p>
                  <p class="text-sm">「通貨を追加」ボタンから仮想通貨を追加してください</p>
                </div>
              </td>
            </tr>
            
            <tr v-for="holding in holdingsStore.holdings" :key="holding.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <!-- Location -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-white">
                  {{ getLocationName(holding.locationId) }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {{ getLocationTypeLabel(holding.locationId) }}
                </div>
              </td>

              <!-- Token Info -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-8 w-8">
                    <img 
                      v-if="getTokenIcon(holding.symbol)" 
                      :src="getTokenIcon(holding.symbol)" 
                      :alt="holding.symbol" 
                      class="h-8 w-8 rounded-full"
                    >
                    <div v-else class="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <span class="text-xs font-bold text-gray-600 dark:text-gray-300">{{ holding.symbol.charAt(0) }}</span>
                    </div>
                  </div>
                  <div class="ml-3">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ holding.symbol }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ getTokenName(holding.symbol) || '不明' }}</div>
                  </div>
                </div>
              </td>

              <!-- Quantity -->
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm text-gray-900 dark:text-white">
                  {{ formatNumber(holding.quantity) }}
                </div>
              </td>

              <!-- Note -->
              <td class="px-6 py-4">
                <input
                  :value="holding.note || ''"
                  @blur="updateNote(holding.id, $event.target.value)"
                  type="text"
                  placeholder="メモを入力..."
                  class="w-full text-sm text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 placeholder-gray-400"
                />
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
                    @click="confirmDelete(holding)"
                    class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    title="削除"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <AddHoldingModal
      v-if="showAddModal || editingHolding"
      :holding="editingHolding"
      @close="closeModal"
      @saved="handleSaved"
    />

    <!-- Delete Confirmation Modal -->
    <div v-if="deletingHolding" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
          保有データを削除
        </h3>
        
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {{ getLocationName(deletingHolding.locationId) }}の{{ deletingHolding.symbol }}を削除してもよろしいですか？この操作は元に戻せません。
        </p>
        
        <div class="flex justify-end space-x-3">
          <button
            @click="cancelDelete"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
          >
            キャンセル
          </button>
          <button
            @click="deleteHolding"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import { useTokensStore } from '@/stores/useTokens'
import { useLocationsStore } from '@/stores/useLocations'
import { formatNumber } from '@/utils/format'
import type { Holding, LocationType } from '@/services/db-v2'
import AddHoldingModal from '@/components/AddHoldingModal.vue'

const holdingsStore = useHoldingsStoreV2()
const tokensStore = useTokensStore()
const locationsStore = useLocationsStore()

const showAddModal = ref(false)
const editingHolding = ref<Holding | null>(null)
const deletingHolding = ref<Holding | null>(null)

const locationTypeLabels: Record<LocationType, string> = {
  domestic_cex: '国内取引所',
  global_cex: '海外取引所',
  sw_wallet: 'ソフトウェアウォレット',
  hw_wallet: 'ハードウェアウォレット',
  custom: 'カスタム'
}

function getLocationName(locationId: string): string {
  const location = locationsStore.locations.find(l => l.id === locationId)
  return location?.name || 'Unknown'
}

function getLocationTypeLabel(locationId: string): string {
  const location = locationsStore.locations.find(l => l.id === locationId)
  return location ? locationTypeLabels[location.type] : ''
}

function getTokenIcon(symbol: string): string | undefined {
  const token = tokensStore.tokens.find(t => t.symbol === symbol)
  return token?.iconUrl
}

function getTokenName(symbol: string): string | undefined {
  const token = tokensStore.tokens.find(t => t.symbol === symbol)
  return token?.name
}

function editHolding(holding: Holding) {
  editingHolding.value = holding
}

function confirmDelete(holding: Holding) {
  deletingHolding.value = holding
}

function cancelDelete() {
  deletingHolding.value = null
}

async function deleteHolding() {
  if (!deletingHolding.value) return
  
  await holdingsStore.deleteHolding(deletingHolding.value.id)
  deletingHolding.value = null
}

function closeModal() {
  showAddModal.value = false
  editingHolding.value = null
}

function handleSaved() {
  closeModal()
  holdingsStore.loadHoldings()
}

async function updateNote(holdingId: string, note: string) {
  await holdingsStore.updateHolding(holdingId, { note })
}

onMounted(async () => {
  await Promise.all([
    tokensStore.loadTokens(),
    locationsStore.loadLocations(),
    holdingsStore.loadHoldings()
  ])
})
</script>