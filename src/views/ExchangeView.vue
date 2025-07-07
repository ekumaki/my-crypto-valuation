<template>
  <div class="space-y-6">
    <!-- Header with Price Update Button -->
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">取引所別一覧</h2>
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

    <!-- Exchange Table -->
    <div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">場所</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">区分</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">評価額（JPY）</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="exchangeData.length === 0">
              <td colspan="3" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">データがありません</td>
            </tr>
            <tr
              v-for="item in exchangeData"
              :key="item.locationId"
              @click="showBreakdown(item)"
              class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-white">{{ getLocationName(item.locationId) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-white">{{ getLocationTypeLabel(item.locationId) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm font-medium text-gray-900 dark:text-white">{{ formatCurrency(item.value) }}</div>
              </td>
            </tr>
          </tbody>
          <!-- Total Footer -->
          <tfoot v-if="exchangeData.length > 0" class="bg-gray-50 dark:bg-gray-700 font-medium sticky bottom-0">
            <tr class="border-t border-gray-200 dark:border-gray-600">
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white" colspan="2">合計評価額</td>
              <td class="px-6 py-4 text-right text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalValue) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Breakdown Modal -->
    <div v-if="showBreakdownModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ getLocationName(selectedLocationId) }} の保有詳細
          </h3>
          <button @click="closeBreakdown" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="p-6 overflow-y-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">通貨</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">数量</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">評価額</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">割合</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="row in breakdownData" :key="row.symbol">
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-white">{{ row.symbol }}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-white text-right">{{ formatNumber(row.quantity) }}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-white text-right">{{ formatCurrency(row.value) }}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-white text-right">{{ formatPercentage(row.value / selectedTotalValue * 100) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Last Update Info -->
    <div v-if="holdingsStore.lastPriceUpdate" class="text-sm text-gray-500 dark:text-gray-400 text-center">
      最終更新: {{ formatDate(holdingsStore.lastPriceUpdate) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import { useLocationsStore } from '@/stores/useLocations'
import { formatNumber, formatCurrency, formatPercentage, formatDate } from '@/utils/format'

const holdingsStore = useHoldingsStoreV2()
const locationsStore = useLocationsStore()

const locationTypeLabels: Record<LocationType, string> = {
  domestic_cex: '国内取引所',
  global_cex: '海外取引所',
  sw_wallet: 'ソフトウェアウォレット',
  hw_wallet: 'ハードウェアウォレット',
  custom: 'カスタム'
}

// 区分ごとのソート順を定義
const locationTypeOrder: Record<LocationType, number> = {
  domestic_cex: 1,
  global_cex: 2,
  sw_wallet: 3,
  hw_wallet: 4,
  custom: 5,
}

function getLocationName(locationId: string): string {
  const location = locationsStore.locations.find(l => l.id === locationId)
  return location?.name || 'Unknown'
}

function getLocationTypeLabel(locationId: string): string {
  const location = locationsStore.locations.find(l => l.id === locationId)
  return location ? locationTypeLabels[location.type] : ''
}

// Exchange level aggregated data
const exchangeData = computed(() => {
  const map = new Map<string, { locationId: string; value: number; type: LocationType; name: string }>()
  for (const holding of holdingsStore.holdings) {
    const price = holdingsStore.prices[holding.symbol]?.priceJpy
    if (!price) continue
    const holdingValue = holding.quantity * price
    
    const location = locationsStore.locations.find(l => l.id === holding.locationId)
    if (!location) continue // 場所が見つからない場合はスキップ

    if (!map.has(holding.locationId)) {
      map.set(holding.locationId, { locationId: holding.locationId, value: 0, type: location.type, name: location.name })
    }
    map.get(holding.locationId)!.value += holdingValue
  }
  
  return Array.from(map.values()).sort((a, b) => {
    // 区分でソート
    const typeOrderA = locationTypeOrder[a.type] ?? 999; // 未知のタイプは最後に
    const typeOrderB = locationTypeOrder[b.type] ?? 999;
    if (typeOrderA !== typeOrderB) {
      return typeOrderA - typeOrderB;
    }
    // 同じ区分内では場所の名前でソート
    return a.name.localeCompare(b.name);
  });
})

const totalValue = computed(() => exchangeData.value.reduce((sum, item) => sum + item.value, 0))

// Breakdown modal states
const showBreakdownModal = ref(false)
const selectedLocationId = ref('')
const selectedTotalValue = ref(0)
const breakdownData = ref<{ symbol: string; quantity: number; value: number }[]>([])

function showBreakdown(item: { locationId: string; value: number }) {
  selectedLocationId.value = item.locationId
  selectedTotalValue.value = item.value

  const rows: Record<string, { quantity: number; value: number }> = {}
  for (const holding of holdingsStore.holdings.filter(h => h.locationId === item.locationId)) {
    const price = holdingsStore.prices[holding.symbol]?.priceJpy
    if (!price) continue
    if (!rows[holding.symbol]) {
      rows[holding.symbol] = { quantity: 0, value: 0 }
    }
    rows[holding.symbol].quantity += holding.quantity
    rows[holding.symbol].value += holding.quantity * price
  }
  breakdownData.value = Object.entries(rows).map(([symbol, data]) => ({ symbol, ...data }))
  showBreakdownModal.value = true
}

function closeBreakdown() {
  showBreakdownModal.value = false
}

function updatePrices() {
  holdingsStore.updatePrices()
}

onMounted(async () => {
  await Promise.all([
    locationsStore.loadLocations(),
    holdingsStore.loadHoldings(),
    holdingsStore.loadPrices()
  ])
})
</script> 