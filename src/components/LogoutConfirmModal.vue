<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            ログアウトの確認
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
        <div v-if="unsyncedCount > 0" class="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div class="flex items-start space-x-3">
            <svg class="w-6 h-6 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <div>
              <h4 class="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-1">
                未同期のデータがあります
              </h4>
              <p class="text-sm text-yellow-700 dark:text-yellow-300">
                未同期のデータが<strong>{{ unsyncedCount }}件</strong>あります。
                ログアウトすると、これらのデータは失われる可能性があります。
              </p>
            </div>
          </div>
        </div>

        <p class="text-gray-700 dark:text-gray-300 mb-6">
          {{ unsyncedCount > 0 ? 'このままログアウトしますか？' : 'ログアウトしますか？' }}
        </p>

        <div v-if="unsyncedCount > 0" class="flex flex-col space-y-3">
          <!-- Manual sync button when unsynced data exists -->
          <button
            @click="$emit('manualSync')"
            :disabled="isSyncing"
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {{ isSyncing ? '同期中...' : '今すぐ同期' }}
          </button>
          
          <!-- Action buttons -->
          <div class="flex space-x-3">
            <button
              @click="$emit('close')"
              class="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              @click="$emit('confirmDiscard')"
              class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              そのままログアウト
            </button>
          </div>
        </div>
        
        <div v-else class="flex space-x-3">
          <button
            @click="$emit('close')"
            class="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            @click="$emit('confirm')"
            class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  unsyncedCount: number
  isSyncing?: boolean
}

defineProps<Props>()

defineEmits<{
  close: []
  confirm: []
  manualSync: []
  confirmDiscard: []
}>()
</script> 