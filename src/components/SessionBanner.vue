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
          <!-- Cloud Sync Status -->
          <div v-if="syncStatus.isEnabled" class="flex items-center space-x-2">
            <div 
              :class="[
                'w-2 h-2 rounded-full',
                syncStatus.isSyncing ? 'bg-yellow-500 animate-pulse' : 
                syncStatus.lastSyncError ? 'bg-red-500' : 'bg-green-500'
              ]"
            ></div>
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{
                syncStatus.isSyncing ? '同期中' :
                syncStatus.lastSyncError ? '同期エラー' : 
                syncStatus.lastSyncTime ? `同期済み (${formatSyncTime(syncStatus.lastSyncTime)})` : '同期準備完了'
              }}
            </span>
          </div>
          
          <div class="text-sm text-gray-600 dark:text-gray-400">
            残り時間: {{ remainingDisplay }}
          </div>
          
          <div class="relative" ref="dropdownRef">
            <button
              @click="showDropdown = !showDropdown"
              class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex items-center space-x-1"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
              </svg>
              <span>設定</span>
            </button>
            
            <div v-if="showDropdown" class="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div class="py-1">
                <button
                  @click="openCloudSync"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  クラウド同期
                </button>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '@/stores/session.store'
import { syncService } from '@/services/sync.service'

const emit = defineEmits<{
  openPasswordSettings: []
  openCloudSync: []
}>()

const sessionStore = useSessionStore()
const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const remainingMinutes = computed(() => sessionStore.remainingMinutes)
const remainingDisplay = computed(() => sessionStore.remainingDisplay)
const syncStatus = computed(() => syncService.status.value)

function logout() {
  showDropdown.value = false
  sessionStore.logout()
}

function openPasswordSettings() {
  showDropdown.value = false
  emit('openPasswordSettings')
}

function openCloudSync() {
  showDropdown.value = false
  emit('openCloudSync')
}

function formatSyncTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  
  if (diffMinutes < 1) {
    return 'たった今'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分前`
  } else if (diffMinutes < 1440) {
    return `${Math.floor(diffMinutes / 60)}時間前`
  } else {
    return date.toLocaleDateString('ja-JP')
  }
}

function handleClickOutside(event: Event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>