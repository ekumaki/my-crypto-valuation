<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            クラウドパスワード入力
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
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
            <div>
              <h4 class="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
                {{ promptType === 'sync' ? 'データ同期のため' : 'データ復元のため' }}
              </h4>
              <p class="text-sm text-blue-700 dark:text-blue-300">
                {{ 
                  promptType === 'sync' 
                    ? 'クラウドデータにアクセスするためにパスワードを入力してください。' 
                    : 'クラウドに保存されたデータを復号化するためにパスワードを入力してください。'
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
          <div class="flex items-start space-x-2">
            <svg class="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div>
              <p class="text-sm font-medium text-red-800 dark:text-red-400">
                認証エラー
              </p>
              <p class="text-sm text-red-700 dark:text-red-300">
                {{ error }}
              </p>
            </div>
          </div>
        </div>

        <!-- Password Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label for="cloudPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              クラウドパスワード
            </label>
            <div class="relative">
              <input
                id="cloudPassword"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="クラウドパスワードを入力"
                :class="{ 'border-red-500': error }"
                ref="passwordInput"
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
          </div>

          <!-- Remember Option (if applicable) -->
          <div v-if="showRememberOption" class="flex items-center">
            <input
              id="rememberPassword"
              v-model="rememberPassword"
              type="checkbox"
              class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            >
            <label for="rememberPassword" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              セッション中はパスワードを記憶する
            </label>
          </div>

          <!-- Help Text -->
          <div class="text-sm text-gray-600 dark:text-gray-400">
            <p>
              このパスワードは設定時に使用したクラウドパスワードです。
              アプリケーションパスワードとは異なります。
            </p>
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
              :disabled="!password.trim() || isSubmitting"
              class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {{ isSubmitting ? '認証中...' : '認証' }}
            </button>
          </div>
        </form>

        <!-- Retry Counter -->
        <div v-if="retryCount > 0" class="mt-4 text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            認証失敗回数: {{ retryCount }}/{{ maxRetries }}
          </p>
          <p v-if="retryCount >= maxRetries - 1" class="text-sm text-red-600 dark:text-red-400 mt-1">
            次回の失敗でしばらくの間試行がブロックされます
          </p>
        </div>

        <!-- Help Link -->
        <div class="mt-6 text-center">
          <button
            @click="showHelp = !showHelp"
            class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            パスワードを忘れた場合は？
          </button>
        </div>

        <!-- Help Section -->
        <div v-if="showHelp" class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h5 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
            パスワードを忘れた場合
          </h5>
          <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li>• クラウドパスワードは復旧できません</li>
            <li>• Google Driveの既存バックアップは使用できなくなります</li>
            <li>• 新しいパスワードでクラウド同期を再設定する必要があります</li>
            <li>• ローカルデータは影響を受けません</li>
          </ul>
          <div class="mt-3">
            <button
              @click="handleForgotPassword"
              class="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded transition-colors"
            >
              新しいパスワードで再設定
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { syncService } from '@/services/sync.service'

interface Props {
  promptType?: 'sync' | 'restore'
  showRememberOption?: boolean
  maxRetries?: number
}

const props = withDefaults(defineProps<Props>(), {
  promptType: 'sync',
  showRememberOption: true,
  maxRetries: 5
})

const emit = defineEmits<{
  close: []
  passwordProvided: [password: string, remember?: boolean]
  forgotPassword: []
}>()

const password = ref('')
const showPassword = ref(false)
const rememberPassword = ref(false)
const isSubmitting = ref(false)
const error = ref('')
const retryCount = ref(0)
const showHelp = ref(false)
const passwordInput = ref<HTMLInputElement>()

async function handleSubmit() {
  if (!password.value.trim()) return

  try {
    isSubmitting.value = true
    error.value = ''

    // Test the password if it's for sync
    if (props.promptType === 'sync') {
      const isValid = await syncService.testCloudPassword(password.value)
      if (!isValid) {
        throw new Error('パスワードが正しくありません')
      }
    }

    emit('passwordProvided', password.value, rememberPassword.value)
  } catch (err) {
    retryCount.value++
    error.value = err instanceof Error ? err.message : 'パスワードの認証に失敗しました'
    
    // Clear password on error
    password.value = ''
    
    // Focus back to input
    nextTick(() => {
      passwordInput.value?.focus()
    })

    // Block further attempts if max retries exceeded
    if (retryCount.value >= props.maxRetries) {
      error.value = '試行回数が上限に達しました。しばらく待ってから再試行してください。'
      setTimeout(() => {
        retryCount.value = 0
        error.value = ''
      }, 60000) // 1 minute lockout
    }
  } finally {
    isSubmitting.value = false
  }
}

function handleForgotPassword() {
  emit('forgotPassword')
}

onMounted(() => {
  // Auto-focus on password input
  nextTick(() => {
    passwordInput.value?.focus()
  })
})
</script>