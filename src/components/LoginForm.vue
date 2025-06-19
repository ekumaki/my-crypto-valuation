<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <div class="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
          <svg class="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          暗号資産ポートフォリオ
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          {{ isSetupMode ? 'セキュアなパスワードを設定してください' : 'パスワードを入力してください' }}
        </p>
      </div>
      
      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <div>
            <label for="password" class="sr-only">パスワード</label>
            <div class="relative">
              <input
                id="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                v-model="password"
                :placeholder="isSetupMode ? '新しいパスワードを入力' : 'パスワードを入力'"
                class="relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                :class="{ 'border-red-300 dark:border-red-600': error }"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg v-if="showPassword" class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029M6.343 6.343A8 8 0 0112 4c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-1.043 1.777M6.343 6.343L19.657 19.657m-12-12l12 12" />
                </svg>
                <svg v-else class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>
          
          <div v-if="isSetupMode && password" class="space-y-2">
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
          
          <div v-if="isSetupMode">
            <label for="confirmPassword" class="sr-only">パスワード確認</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              v-model="confirmPassword"
              placeholder="パスワードを再入力"
              class="relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              :class="{ 'border-red-300 dark:border-red-600': confirmPassword && password !== confirmPassword }"
              required
            />
            <div v-if="confirmPassword && password !== confirmPassword" class="mt-1 text-xs text-red-600 dark:text-red-400">
              パスワードが一致しません
            </div>
          </div>
        </div>

        <div v-if="error" class="text-sm text-red-600 dark:text-red-400 text-center">
          {{ error }}
        </div>

        <div>
          <button
            type="submit"
            :disabled="isLoading || (isSetupMode && (!passwordValidation?.isValid || password !== confirmPassword))"
            class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="isLoading" class="absolute left-0 inset-y-0 flex items-center pl-3">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            </span>
            {{ isLoading ? '処理中...' : (isSetupMode ? 'パスワードを設定' : 'ログイン') }}
          </button>
        </div>

        <div v-if="!isSetupMode" class="text-center">
          <button
            type="button"
            @click="showResetConfirm = true"
            class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            すべてのデータをリセット
          </button>
        </div>
      </form>
    </div>
    
    <!-- Reset Confirmation Modal -->
    <div v-if="showResetConfirm" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full">
          <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white text-center mb-2">
          データリセットの確認
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
          すべてのポートフォリオデータと設定が削除されます。この操作は取り消せません。
        </p>
        <div class="flex space-x-3">
          <button
            @click="showResetConfirm = false"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            キャンセル
          </button>
          <button
            @click="handleReset"
            class="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { authService } from '@/services/auth.service'

const emit = defineEmits<{
  loginSuccess: []
}>()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const error = ref('')
const isSetupMode = ref(false)
const showResetConfirm = ref(false)

const passwordStrength = computed(() => {
  return authService.getPasswordStrength(password.value)
})

const passwordValidation = computed(() => {
  return authService.validatePassword(password.value)
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
    let result
    if (isSetupMode.value) {
      if (password.value !== confirmPassword.value) {
        error.value = 'パスワードが一致しません'
        return
      }
      result = await authService.setupPassword(password.value)
    } else {
      result = await authService.login(password.value)
    }
    
    if (result.success) {
      emit('loginSuccess')
    } else {
      error.value = result.error || 'エラーが発生しました'
    }
  } catch (err) {
    console.error('Authentication error:', err)
    error.value = 'システムエラーが発生しました'
  } finally {
    isLoading.value = false
  }
}

async function handleReset() {
  isLoading.value = true
  showResetConfirm.value = false
  
  try {
    await authService.resetAndClearData()
    isSetupMode.value = true
    password.value = ''
    confirmPassword.value = ''
    error.value = ''
  } catch (err) {
    console.error('Reset error:', err)
    error.value = 'リセットに失敗しました'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  isSetupMode.value = await authService.isFirstTimeSetup()
})
</script>