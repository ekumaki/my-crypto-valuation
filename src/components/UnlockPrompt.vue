<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 p-6">
      <!-- Header -->
      <div class="mb-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          データアクセスのロック解除
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          暗号化されたデータにアクセスするため、パスワードを再入力してください
        </p>
      </div>

      <!-- Password Input -->
      <form @submit.prevent="handleUnlock">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            パスワード
          </label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            :class="error ? 'border-red-500' : ''"
            @input="clearError"
          />
          <div v-if="error" class="mt-1 text-sm text-red-600">
            {{ error }}
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            @click="$emit('cancel')"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
          >
            キャンセル
          </button>
          <button
            type="submit"
            :disabled="isLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
          >
            <span v-if="isLoading">確認中...</span>
            <span v-else>ロック解除</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { authService } from '@/services/auth.service'

const emit = defineEmits<{
  unlock: []
  cancel: []
}>()

const password = ref('')
const error = ref('')
const isLoading = ref(false)

function clearError() {
  error.value = ''
}

async function handleUnlock() {
  if (!password.value.trim()) {
    error.value = 'パスワードを入力してください'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    const result = await authService.unlockWithPassword(password.value)
    
    if (result.success) {
      password.value = ''
      emit('unlock')
    } else {
      error.value = result.error || 'パスワードが正しくありません'
    }
  } catch (err) {
    error.value = 'ロック解除に失敗しました'
    console.error('Unlock error:', err)
  } finally {
    isLoading.value = false
  }
}
</script>