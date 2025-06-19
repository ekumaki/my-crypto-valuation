<template>
  <div v-if="show" class="fixed top-0 left-0 right-0 bg-amber-500 text-white z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between py-3">
        <div class="flex items-center space-x-3">
          <svg class="h-5 w-5 text-amber-100" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div>
            <div class="font-medium">セッション期限切れまで {{ remainingMinutes }}分</div>
            <div class="text-sm text-amber-100">
              操作がない場合、自動的にログアウトされます
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <button
            @click="extendSession"
            class="bg-white text-amber-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-50 transition-colors"
          >
            セッション延長
          </button>
          <button
            @click="logout"
            class="bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-700 transition-colors border border-amber-400"
          >
            今すぐログアウト
          </button>
          <button
            @click="dismissWarning"
            class="text-amber-100 hover:text-white p-1"
          >
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session.store'

const sessionStore = useSessionStore()

const show = computed(() => sessionStore.showWarning)
const remainingMinutes = computed(() => Math.max(1, sessionStore.remainingMinutes))

function extendSession() {
  sessionStore.extendSession()
}

function logout() {
  sessionStore.logout()
}

function dismissWarning() {
  // Note: This is a temporary dismissal, warning will reappear
  sessionStore.showWarning = false
}
</script>