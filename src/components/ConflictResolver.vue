<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            同期競合の解決
          </h3>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="px-6 py-4">
        <!-- Conflict Explanation -->
        <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div class="flex items-start space-x-3">
            <svg class="w-6 h-6 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <div>
              <h4 class="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-2">
                データの競合が検出されました
              </h4>
              <p class="text-sm text-yellow-700 dark:text-yellow-300">
                ローカルデータとクラウドデータの間に違いがあります。
                どちらのデータを使用するか、または両方を統合するかを選択してください。
              </p>
            </div>
          </div>
        </div>

        <!-- Conflict Information -->
        <div class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <h4 class="flex items-center text-sm font-medium text-gray-900 dark:text-white mb-2">
              <svg class="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm8 0a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1V8z" clip-rule="evenodd" />
              </svg>
              ローカルデータ
            </h4>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              最終更新: {{ formatTimestamp(conflictData.localTimestamp) }}
            </p>
            <div class="text-sm">
              <p class="text-gray-700 dark:text-gray-300">
                保有データ数: {{ conflictData.localData.holdings?.length || 0 }}
              </p>
              <p class="text-gray-700 dark:text-gray-300">
                保管場所数: {{ conflictData.localData.locations?.length || 0 }}
              </p>
              <p class="text-gray-700 dark:text-gray-300">
                トークン数: {{ conflictData.localData.tokens?.length || 0 }}
              </p>
            </div>
          </div>

          <div class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <h4 class="flex items-center text-sm font-medium text-gray-900 dark:text-white mb-2">
              <svg class="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd" />
                <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V9a1 1 0 00-1-1h-1v4.5a1.5 1.5 0 01-3 0V8a1 1 0 011-1z" />
              </svg>
              クラウドデータ
            </h4>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              最終更新: {{ formatTimestamp(conflictData.cloudTimestamp) }}
            </p>
            <div class="text-sm">
              <p class="text-gray-700 dark:text-gray-300">
                保有データ数: {{ conflictData.cloudData.holdings?.length || 0 }}
              </p>
              <p class="text-gray-700 dark:text-gray-300">
                保管場所数: {{ conflictData.cloudData.locations?.length || 0 }}
              </p>
              <p class="text-gray-700 dark:text-gray-300">
                トークン数: {{ conflictData.cloudData.tokens?.length || 0 }}
              </p>
            </div>
          </div>
        </div>

        <!-- Resolution Options -->
        <div class="mb-6">
          <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">
            解決方法を選択してください
          </h4>
          
          <div class="space-y-3">
            <!-- Use Local Data -->
            <label class="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <input
                v-model="selectedResolution"
                type="radio"
                value="local"
                class="mt-1 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              >
              <div class="flex-1">
                <div class="font-medium text-gray-900 dark:text-white">
                  ローカルデータを使用
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  このデバイスのデータを優先し、クラウドデータを上書きします。
                </p>
                <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  推奨: このデバイスで最近変更を行った場合
                </div>
              </div>
            </label>

            <!-- Use Cloud Data -->
            <label class="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <input
                v-model="selectedResolution"
                type="radio"
                value="cloud"
                class="mt-1 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              >
              <div class="flex-1">
                <div class="font-medium text-gray-900 dark:text-white">
                  クラウドデータを使用
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  クラウドのデータを優先し、ローカルデータを置き換えます。
                </p>
                <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  推奨: 他のデバイスで最近変更を行った場合
                </div>
              </div>
            </label>

            <!-- Merge Data -->
            <label class="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <input
                v-model="selectedResolution"
                type="radio"
                value="merge"
                class="mt-1 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              >
              <div class="flex-1">
                <div class="font-medium text-gray-900 dark:text-white">
                  データを統合
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  ローカルとクラウドのデータを統合します。重複データは自動的に処理されます。
                </p>
                <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  推奨: どちらにも重要なデータが含まれている場合
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Data Preview -->
        <div v-if="selectedResolution" class="mb-6">
          <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">
            変更プレビュー
          </h4>
          
          <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div class="text-sm space-y-2">
              <div v-if="selectedResolution === 'local'">
                <p class="text-green-700 dark:text-green-400">✓ ローカルデータがクラウドに保存されます</p>
                <p class="text-red-700 dark:text-red-400">✗ クラウドの既存データは削除されます</p>
              </div>
              <div v-else-if="selectedResolution === 'cloud'">
                <p class="text-green-700 dark:text-green-400">✓ クラウドデータがローカルに保存されます</p>
                <p class="text-red-700 dark:text-red-400">✗ ローカルの既存データは削除されます</p>
              </div>
              <div v-else-if="selectedResolution === 'merge'">
                <p class="text-green-700 dark:text-green-400">✓ 両方のデータが統合されます</p>
                <p class="text-yellow-700 dark:text-yellow-400">⚠ 重複したデータは自動的に統合されます</p>
                <p class="text-blue-700 dark:text-blue-400">ℹ 結果データ数: {{ getMergedDataCounts() }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Backup Warning -->
        <div class="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-orange-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <div>
              <h5 class="text-sm font-medium text-orange-800 dark:text-orange-400">
                重要な注意事項
              </h5>
              <p class="text-sm text-orange-700 dark:text-orange-300">
                この操作は元に戻すことができません。データが失われる可能性があります。
                重要なデータは事前にエクスポートしてバックアップを取ることをお勧めします。
              </p>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex space-x-3">
          <button
            @click="$emit('close')"
            class="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            @click="resolveConflict"
            :disabled="!selectedResolution || isResolving"
            class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {{ isResolving ? '解決中...' : '競合を解決' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { syncService, type SyncConflict } from '@/services/sync.service'
import { errorHandlerService } from '@/services/error-handler.service'

interface Props {
  conflictData: SyncConflict
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  conflictResolved: []
}>()

const selectedResolution = ref<'local' | 'cloud' | 'merge' | null>(null)
const isResolving = ref(false)

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes}分前`
  } else if (diffHours < 24) {
    return `${diffHours}時間前`
  } else {
    return date.toLocaleString('ja-JP')
  }
}

function getMergedDataCounts(): string {
  const localHoldings = props.conflictData.localData.holdings?.length || 0
  const cloudHoldings = props.conflictData.cloudData.holdings?.length || 0
  const localLocations = props.conflictData.localData.locations?.length || 0
  const cloudLocations = props.conflictData.cloudData.locations?.length || 0
  const localTokens = props.conflictData.localData.tokens?.length || 0
  const cloudTokens = props.conflictData.cloudData.tokens?.length || 0
  
  // Simple estimate - actual merge may deduplicate
  const estimatedHoldings = localHoldings + cloudHoldings
  const estimatedLocations = localLocations + cloudLocations
  const estimatedTokens = localTokens + cloudTokens
  
  return `保有データ約${estimatedHoldings}件、保管場所約${estimatedLocations}件、トークン約${estimatedTokens}件`
}

async function resolveConflict() {
  if (!selectedResolution.value) return

  try {
    isResolving.value = true
    
    const result = await syncService.resolveConflict(
      selectedResolution.value,
      props.conflictData
    )

    if (result.success) {
      emit('conflictResolved')
    } else {
      errorHandlerService.handleError(
        new Error(result.message),
        'Conflict Resolution',
        'error'
      )
    }
  } catch (error) {
    errorHandlerService.handleError(error, 'Conflict Resolution', 'error')
  } finally {
    isResolving.value = false
  }
}
</script>