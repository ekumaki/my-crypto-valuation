<template>
  <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-12">
        <div class="flex items-center">
          <div class="flex items-center space-x-2">
            <svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm text-gray-600 dark:text-gray-400">
              認証済み
            </span>
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="text-sm text-gray-600 dark:text-gray-400">
            残り時間: {{ remainingMinutes }}分
          </div>
          
          <div class="relative">
            <button
              @click="showDropdown = !showDropdown"
              class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex items-center space-x-1"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 12a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0v-.5A1.5 1.5 0 0114.5 6c.526 0 .988-.27 1.256-.679a6.012 6.012 0 011.912 2.706A8.025 8.025 0 0110 16.5a8.025 8.025 0 01-7.668-8.473z" clip-rule="evenodd" />
              </svg>
              <span>設定</span>
            </button>
            
            <div v-if="showDropdown" class="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div class="py-1">
                <button
                  @click="openPasswordSettings"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  パスワード変更
                </button>
                <button
                  @click="logout"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session.store'

const emit = defineEmits<{
  openPasswordSettings: []
}>()

const sessionStore = useSessionStore()
const showDropdown = ref(false)

const remainingMinutes = computed(() => sessionStore.remainingMinutes)

function logout() {
  showDropdown.value = false
  sessionStore.logout()
}

function openPasswordSettings() {
  showDropdown.value = false
  emit('openPasswordSettings')
}
</script>