<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            パスワード変更
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
      
      <div class="p-6">
        <form @submit.prevent="handlePasswordChange">
          <div class="space-y-4">
            <!-- Current Password -->
            <div>
              <label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                現在のパスワード
              </label>
              <input
                id="currentPassword"
                v-model="currentPassword"
                type="password"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="現在のパスワードを入力"
              />
            </div>
            
            <!-- New Password -->
            <div>
              <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                新しいパスワード
              </label>
              <input
                id="newPassword"
                v-model="newPassword"
                type="password"
                required
                minlength="8"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="新しいパスワードを入力（8文字以上）"
              />
            </div>
            
            <!-- Confirm New Password -->
            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                新しいパスワード（確認）
              </label>
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                required
                minlength="8"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="新しいパスワードを再入力"
              />
            </div>
            
            <!-- Password Validation -->
            <div v-if="newPassword" class="text-sm space-y-1">
              <div :class="newPassword.length >= 8 ? 'text-green-600' : 'text-red-600'">
                ✓ 8文字以上
              </div>
              <div :class="hasUpperCase ? 'text-green-600' : 'text-red-600'">
                ✓ 大文字を含む
              </div>
              <div :class="hasLowerCase ? 'text-green-600' : 'text-red-600'">
                ✓ 小文字を含む
              </div>
              <div :class="hasNumber ? 'text-green-600' : 'text-red-600'">
                ✓ 数字を含む
              </div>
              <div :class="hasSymbol ? 'text-green-600' : 'text-red-600'">
                ✓ 記号を含む
              </div>
              <div v-if="confirmPassword" :class="newPassword === confirmPassword ? 'text-green-600' : 'text-red-600'">
                ✓ パスワードが一致
              </div>
            </div>
            
            <!-- Error Message -->
            <div v-if="error" class="text-sm text-red-600 dark:text-red-400">
              {{ error }}
            </div>
            
            <!-- Warning Message -->
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md p-3">
              <div class="flex">
                <svg class="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <div class="text-sm text-yellow-800 dark:text-yellow-200">
                  <p class="font-medium">重要な注意事項</p>
                  <p>パスワードを変更すると、Google Driveの既存データが新しいパスワードで再暗号化されます。この処理には時間がかかる場合があります。</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="flex space-x-3 mt-6">
            <button
              type="button"
              @click="$emit('close')"
              class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              キャンセル
            </button>
            <button
              type="submit"
              :disabled="!isFormValid || isChanging"
              class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed"
            >
              {{ isChanging ? '変更中...' : 'パスワード変更' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { cloudEncryptionService } from '@/services/cloud-encryption.service'
import { syncService } from '@/services/sync.service'
import { errorHandlerService } from '@/services/error-handler.service'

const emit = defineEmits<{
  close: []
  success: []
}>()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const isChanging = ref(false)

const hasUpperCase = computed(() => /[A-Z]/.test(newPassword.value))
const hasLowerCase = computed(() => /[a-z]/.test(newPassword.value))
const hasNumber = computed(() => /[0-9]/.test(newPassword.value))
const hasSymbol = computed(() => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword.value))

const isFormValid = computed(() => {
  return currentPassword.value.length > 0 &&
         newPassword.value.length >= 8 &&
         hasUpperCase.value &&
         hasLowerCase.value &&
         hasNumber.value &&
         hasSymbol.value &&
         confirmPassword.value.length >= 8 &&
         newPassword.value === confirmPassword.value
})

async function handlePasswordChange() {
  if (!isFormValid.value) {
    return
  }

  error.value = ''
  isChanging.value = true

  try {
    console.log('Starting password change process...')

    // Step 1: Check if new password is different from current password
    if (currentPassword.value === newPassword.value) {
      error.value = '新しいパスワードは現在のパスワードと異なる必要があります'
      return
    }

    // Step 2: Verify current password
    const isCurrentPasswordValid = await cloudEncryptionService.verifyPassword(currentPassword.value)
    if (!isCurrentPasswordValid) {
      error.value = '現在のパスワードが正しくありません'
      return
    }

    console.log('Current password verified successfully')

    // Step 3: Change password and re-encrypt cloud data
    const result = await syncService.changeCloudPassword(currentPassword.value, newPassword.value)
    
    if (!result.success) {
      error.value = result.message || 'パスワード変更に失敗しました'
      return
    }

    console.log('Password change completed successfully')

    // Success
    if (window.showToast) {
      window.showToast.success('パスワード変更完了', 'クラウドパスワードが正常に変更されました')
    }
    
    emit('success')

  } catch (error: any) {
    console.error('Password change error:', error)
    errorHandlerService.handleError(error, 'Password Change', 'error')
    error.value = error.message || 'パスワード変更中にエラーが発生しました'
  } finally {
    isChanging.value = false
  }
}
</script> 