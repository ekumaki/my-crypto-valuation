<template>
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          パスワード変更
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            現在のパスワード
          </label>
          <input
            id="currentPassword"
            type="password"
            v-model="currentPassword"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
        
        <div>
          <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            新しいパスワード
          </label>
          <input
            id="newPassword"
            type="password"
            v-model="newPassword"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            required
          />
          
          <div v-if="newPassword" class="mt-2 space-y-2">
            <div class="text-sm text-gray-600 dark:text-gray-400">パスワード強度:</div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                class="h-2 rounded-full transition-all duration-300"
                :class="strengthColor"
                :style="{ width: `${passwordStrength}%` }"
              ></div>
            </div>
            <div class="text-xs" :class="strengthTextColor">{{ strengthText }}</div>
            
            <div v-if="passwordValidation && !passwordValidation.isValid" class="space-y-1">
              <div v-for="error in passwordValidation.errors" :key="error" class="text-xs text-red-600 dark:text-red-400">
                • {{ error }}
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            新しいパスワード（確認）
          </label>
          <input
            id="confirmPassword"
            type="password"
            v-model="confirmPassword"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            :class="{ 'border-red-300 dark:border-red-600': confirmPassword && newPassword !== confirmPassword }"
            required
          />
          <div v-if="confirmPassword && newPassword !== confirmPassword" class="mt-1 text-xs text-red-600 dark:text-red-400">
            パスワードが一致しません
          </div>
        </div>
        
        <div v-if="error" class="text-sm text-red-600 dark:text-red-400">
          {{ error }}
        </div>
        
        <div class="flex space-x-3 pt-4">
          <button
            type="button"
            @click="$emit('close')"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            キャンセル
          </button>
          <button
            type="submit"
            :disabled="isLoading || !passwordValidation?.isValid || newPassword !== confirmPassword"
            class="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isLoading ? '変更中...' : 'パスワード変更' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { authService } from '@/services/auth.service'

const emit = defineEmits<{
  close: []
  success: []
}>()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const error = ref('')

const passwordStrength = computed(() => {
  return authService.getPasswordStrength(newPassword.value)
})

const passwordValidation = computed(() => {
  return authService.validatePassword(newPassword.value)
})

const strengthColor = computed(() => {
  if (passwordStrength.value < 30) return 'bg-red-500'
  if (passwordStrength.value < 60) return 'bg-yellow-500'
  if (passwordStrength.value < 80) return 'bg-blue-500'
  return 'bg-green-500'
})

const strengthTextColor = computed(() => {
  if (passwordStrength.value < 30) return 'text-red-600 dark:text-red-400'
  if (passwordStrength.value < 60) return 'text-yellow-600 dark:text-yellow-400'
  if (passwordStrength.value < 80) return 'text-blue-600 dark:text-blue-400'
  return 'text-green-600 dark:text-green-400'
})

const strengthText = computed(() => {
  if (passwordStrength.value < 30) return '弱い'
  if (passwordStrength.value < 60) return '普通'
  if (passwordStrength.value < 80) return '強い'
  return '非常に強い'
})

async function handleSubmit() {
  if (isLoading.value) return
  
  error.value = ''
  isLoading.value = true
  
  try {
    const result = await authService.changePassword(currentPassword.value, newPassword.value)
    
    if (result.success) {
      emit('success')
      emit('close')
    } else {
      error.value = result.error || 'パスワード変更に失敗しました'
    }
  } catch (err) {
    console.error('Password change error:', err)
    error.value = 'システムエラーが発生しました'
  } finally {
    isLoading.value = false
  }
}
</script>