<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            クラウドパスワード設定
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
        <!-- Info Section -->
        <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div class="flex items-start space-x-3">
            <svg class="w-6 h-6 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <div>
              <h4 class="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
                クラウドパスワードについて
              </h4>
              <p class="text-sm text-blue-700 dark:text-blue-300">
                このパスワードはGoogle Driveに保存されるデータの暗号化に使用されます。
                セキュリティのため、このパスワードは当アプリケーションでは保存されません。
              </p>
            </div>
          </div>
        </div>

        <!-- Password Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Password Input -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              クラウドパスワード
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="安全なパスワードを入力"
                :class="{ 'border-red-500': passwordErrors.length > 0 }"
              >
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg 
                  v-if="showPassword"
                  class="w-5 h-5 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
                <svg 
                  v-else
                  class="w-5 h-5 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            
            <!-- Password Strength Indicator -->
            <div class="mt-2">
              <div class="flex space-x-1">
                <div 
                  v-for="i in 4" 
                  :key="i"
                  class="h-1 flex-1 rounded-full"
                  :class="[
                    i <= passwordStrength ? 
                      passwordStrength <= 1 ? 'bg-red-500' :
                      passwordStrength <= 2 ? 'bg-yellow-500' :
                      passwordStrength <= 3 ? 'bg-blue-500' : 'bg-green-500'
                    : 'bg-gray-200 dark:bg-gray-600'
                  ]"
                ></div>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                パスワード強度: {{ passwordStrengthText }}
              </p>
            </div>

            <!-- Password Errors -->
            <div v-if="passwordErrors.length > 0" class="mt-2">
              <ul class="text-sm text-red-600 dark:text-red-400 space-y-1">
                <li v-for="error in passwordErrors" :key="error" class="flex items-center space-x-1">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <span>{{ error }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Confirm Password Input -->
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              パスワード確認
            </label>
            <div class="relative">
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="パスワードを再入力"
                :class="{ 'border-red-500': confirmPassword && password !== confirmPassword }"
              >
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg 
                  v-if="showConfirmPassword"
                  class="w-5 h-5 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
                <svg 
                  v-else
                  class="w-5 h-5 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            <div v-if="confirmPassword && password !== confirmPassword" class="mt-2">
              <p class="text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <span>パスワードが一致しません</span>
              </p>
            </div>
          </div>

          <!-- Generate Password Button -->
          <div class="flex items-center justify-between">
            <button
              type="button"
              @click="generateSecurePassword"
              class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
            >
              安全なパスワードを生成
            </button>
            <span v-if="generatedPassword" class="text-sm text-green-600 dark:text-green-400">
              パスワードが生成されました
            </span>
          </div>

          <!-- Security Notice -->
          <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div class="flex items-start space-x-2">
              <svg class="w-5 h-5 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div>
                <p class="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                  重要な注意事項
                </p>
                <p class="text-sm text-yellow-700 dark:text-yellow-300">
                  このパスワードを忘れると、クラウドに保存されたデータを復元できなくなります。
                  安全な場所に保管してください。
                </p>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex space-x-3 pt-4">
            <button
              type="button"
              @click="$emit('close')"
              class="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              :disabled="!isFormValid || isSubmitting"
              class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {{ isSubmitting ? '設定中...' : '設定完了' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { cloudEncryptionService } from '@/services/cloud-encryption.service'

const emit = defineEmits<{
  close: []
  setupComplete: [password: string]
}>()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)
const generatedPassword = ref(false)

// Password validation
const passwordValidation = computed(() => {
  return cloudEncryptionService.validatePassword(password.value)
})

const passwordErrors = computed(() => {
  return password.value ? passwordValidation.value.errors : []
})

const passwordStrength = computed(() => {
  if (!password.value) return 0
  
  let strength = 0
  if (password.value.length >= 8) strength++
  if (/[a-z]/.test(password.value)) strength++
  if (/[A-Z]/.test(password.value)) strength++
  if (/[0-9]/.test(password.value)) strength++
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password.value)) strength++
  
  return Math.min(strength, 4)
})

const passwordStrengthText = computed(() => {
  switch (passwordStrength.value) {
    case 0:
    case 1:
      return '弱い'
    case 2:
      return '普通'
    case 3:
      return '強い'
    case 4:
      return 'とても強い'
    default:
      return '不明'
  }
})

const isFormValid = computed(() => {
  return passwordValidation.value.isValid && 
         password.value === confirmPassword.value &&
         password.value.length > 0
})

function generateSecurePassword() {
  const generated = cloudEncryptionService.generateSecurePassword(16)
  password.value = generated
  confirmPassword.value = generated
  generatedPassword.value = true
  
  // Clear the flag after a few seconds
  setTimeout(() => {
    generatedPassword.value = false
  }, 3000)
}

async function handleSubmit() {
  if (!isFormValid.value) return

  try {
    isSubmitting.value = true
    
    // Test encryption with the password
    const testResult = await cloudEncryptionService.testEncryption(password.value)
    if (!testResult) {
      throw new Error('パスワードの検証に失敗しました')
    }

    emit('setupComplete', password.value)
  } catch (error) {
    console.error('Password setup failed:', error)
    // Handle error display here if needed
  } finally {
    isSubmitting.value = false
  }
}

// Clear generated password flag when password is manually changed
watch(password, () => {
  if (generatedPassword.value) {
    generatedPassword.value = false
  }
})
</script>