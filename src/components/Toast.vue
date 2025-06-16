<template>
  <div class="fixed top-4 right-4 z-50 space-y-2">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="[
        'max-w-sm w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300',
        toast.entering ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      ]"
    >
      <div class="p-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <!-- Success Icon -->
            <svg
              v-if="toast.type === 'success'"
              class="h-6 w-6 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            
            <!-- Error Icon -->
            <svg
              v-else-if="toast.type === 'error'"
              class="h-6 w-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            
            <!-- Info Icon -->
            <svg
              v-else-if="toast.type === 'info'"
              class="h-6 w-6 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            
            <!-- Warning Icon -->
            <svg
              v-else
              class="h-6 w-6 text-yellow-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          <div class="ml-3 w-0 flex-1 pt-0.5">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ toast.title }}
            </p>
            <p v-if="toast.message" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ toast.message }}
            </p>
          </div>
          
          <div class="ml-4 flex-shrink-0 flex">
            <button
              @click="removeToast(toast.id)"
              class="bg-white dark:bg-gray-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span class="sr-only">閉じる</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Progress Bar -->
      <div v-if="toast.duration" class="bg-gray-200 dark:bg-gray-600 h-1">
        <div
          :class="[
            'h-full transition-all ease-linear',
            toast.type === 'success' ? 'bg-green-400' :
            toast.type === 'error' ? 'bg-red-400' :
            toast.type === 'info' ? 'bg-blue-400' : 'bg-yellow-400'
          ]"
          :style="`width: ${toast.progress}%; transition-duration: ${toast.duration}ms`"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
  entering: boolean
  progress: number
}

const toasts = reactive<Toast[]>([])

let toastIdCounter = 0

function addToast(
  type: Toast['type'],
  title: string,
  message?: string,
  duration = 5000
) {
  const id = `toast-${++toastIdCounter}`
  const toast: Toast = {
    id,
    type,
    title,
    message,
    duration,
    entering: false,
    progress: 100
  }

  toasts.push(toast)

  // Trigger enter animation
  setTimeout(() => {
    toast.entering = true
  }, 10)

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      toast.progress = 0
    }, 100)

    setTimeout(() => {
      removeToast(id)
    }, duration + 100)
  }

  return id
}

function removeToast(id: string) {
  const index = toasts.findIndex(t => t.id === id)
  if (index > -1) {
    const toast = toasts[index]
    toast.entering = false
    
    setTimeout(() => {
      toasts.splice(index, 1)
    }, 300)
  }
}

function clearAllToasts() {
  toasts.splice(0, toasts.length)
}

// Global toast methods
window.showToast = {
  success: (title: string, message?: string, duration?: number) => 
    addToast('success', title, message, duration),
  error: (title: string, message?: string, duration?: number) => 
    addToast('error', title, message, duration),
  info: (title: string, message?: string, duration?: number) => 
    addToast('info', title, message, duration),
  warning: (title: string, message?: string, duration?: number) => 
    addToast('warning', title, message, duration)
}

// Export for use in composition API
const useToast = () => {
  return {
    success: (title: string, message?: string, duration?: number) => 
      addToast('success', title, message, duration),
    error: (title: string, message?: string, duration?: number) => 
      addToast('error', title, message, duration),
    info: (title: string, message?: string, duration?: number) => 
      addToast('info', title, message, duration),
    warning: (title: string, message?: string, duration?: number) => 
      addToast('warning', title, message, duration),
    clear: clearAllToasts
  }
}

defineExpose({ useToast })

// Make TypeScript happy
declare global {
  interface Window {
    showToast: {
      success: (title: string, message?: string, duration?: number) => string
      error: (title: string, message?: string, duration?: number) => string
      info: (title: string, message?: string, duration?: number) => string
      warning: (title: string, message?: string, duration?: number) => string
    }
  }
}
</script>