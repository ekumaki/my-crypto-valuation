<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">取引所別一覧</h2>

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
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="groupedData.length === 0">
              <td colspan="3" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                データがありません
              </td>
            </tr>
            <tr v-for="item in groupedData" :key="item.locationId + '-' + item.symbol" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-white">{{ getLocationName(item.locationId) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-white">{{ item.symbol }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm text-gray-900 dark:text-white">{{ formatNumber(item.quantity) }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useHoldingsStoreV2 } from '@/stores/useHoldingsV2'
import { useLocationsStore } from '@/stores/useLocations'
import { formatNumber } from '@/utils/format'

const holdingsStore = useHoldingsStoreV2()
const locationsStore = useLocationsStore()

function getLocationName(locationId: string): string {
  const location = locationsStore.locations.find(l => l.id === locationId)
  return location?.name || 'Unknown'
}

const groupedData = computed(() => {
  const map = new Map<string, { locationId: string, symbol: string, quantity: number }>()
  for (const holding of holdingsStore.holdings) {
    const key = `${holding.locationId}|${holding.symbol}`
    if (!map.has(key)) {
      map.set(key, { locationId: holding.locationId, symbol: holding.symbol, quantity: 0 })
    }
    map.get(key)!.quantity += holding.quantity
  }
  return Array.from(map.values())
})

onMounted(async () => {
  await Promise.all([
    locationsStore.loadLocations(),
    holdingsStore.loadHoldings()
  ])
})
</script> 