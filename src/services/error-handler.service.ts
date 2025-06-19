import { ref } from 'vue'
import { ERROR_MESSAGES } from '@/config/google-drive.config'

export interface ErrorInfo {
  id: string
  message: string
  type: 'error' | 'warning' | 'info'
  timestamp: number
  context?: string
  recoverable: boolean
  retryAction?: () => Promise<void>
}

export interface ErrorStats {
  totalErrors: number
  authErrors: number
  networkErrors: number
  syncErrors: number
  encryptionErrors: number
}

class ErrorHandlerService {
  private _errors = ref<ErrorInfo[]>([])
  private _stats = ref<ErrorStats>({
    totalErrors: 0,
    authErrors: 0,
    networkErrors: 0,
    syncErrors: 0,
    encryptionErrors: 0
  })

  private errorIdCounter = 0
  private maxErrors = 50 // Keep only last 50 errors

  constructor() {
    this.setupGlobalErrorHandlers()
  }

  get errors() { return this._errors }
  get stats() { return this._stats }

  private setupGlobalErrorHandlers(): void {
    // Handle uncaught promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'Promise Rejection', 'error')
    })

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(
        new Error(event.message),
        `${event.filename}:${event.lineno}:${event.colno}`,
        'error'
      )
    })
  }

  handleError(
    error: any,
    context?: string,
    type: 'error' | 'warning' | 'info' = 'error',
    retryAction?: () => Promise<void>
  ): string {
    const errorId = `error_${++this.errorIdCounter}_${Date.now()}`
    
    let message = this.extractErrorMessage(error)
    let recoverable = false

    // Categorize and enhance error
    const errorCategory = this.categorizeError(error, message)
    
    switch (errorCategory) {
      case 'auth':
        this._stats.value.authErrors++
        recoverable = true
        break
      case 'network':
        this._stats.value.networkErrors++
        message = this.enhanceNetworkError(error, message)
        recoverable = true
        break
      case 'sync':
        this._stats.value.syncErrors++
        recoverable = true
        break
      case 'encryption':
        this._stats.value.encryptionErrors++
        recoverable = false
        break
    }

    const errorInfo: ErrorInfo = {
      id: errorId,
      message,
      type,
      timestamp: Date.now(),
      context,
      recoverable,
      retryAction
    }

    // Add to errors list
    this._errors.value.unshift(errorInfo)
    this._stats.value.totalErrors++

    // Trim errors list if it exceeds max
    if (this._errors.value.length > this.maxErrors) {
      this._errors.value = this._errors.value.slice(0, this.maxErrors)
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error(`[${errorCategory.toUpperCase()}] ${context || 'Unknown'}:`, error)
    }

    // Show toast notification for critical errors
    if (type === 'error' && this.isCriticalError(error, message)) {
      this.showErrorToast(message)
    }

    return errorId
  }

  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error
    }

    if (error instanceof Error) {
      return error.message
    }

    if (error?.message) {
      return error.message
    }

    if (error?.error) {
      return this.extractErrorMessage(error.error)
    }

    return '不明なエラーが発生しました'
  }

  private categorizeError(error: any, message: string): 'auth' | 'network' | 'sync' | 'encryption' | 'unknown' {
    const lowerMessage = message.toLowerCase()

    // Authentication errors
    if (
      lowerMessage.includes('auth') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('認証') ||
      error?.status === 401 ||
      error?.status === 403
    ) {
      return 'auth'
    }

    // Network errors
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('fetch') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('ネットワーク') ||
      error?.status >= 500 ||
      error?.code === 'NETWORK_ERROR'
    ) {
      return 'network'
    }

    // Sync errors
    if (
      lowerMessage.includes('sync') ||
      lowerMessage.includes('conflict') ||
      lowerMessage.includes('upload') ||
      lowerMessage.includes('download') ||
      lowerMessage.includes('同期') ||
      lowerMessage.includes('競合')
    ) {
      return 'sync'
    }

    // Encryption errors
    if (
      lowerMessage.includes('encrypt') ||
      lowerMessage.includes('decrypt') ||
      lowerMessage.includes('password') ||
      lowerMessage.includes('暗号') ||
      lowerMessage.includes('復号') ||
      lowerMessage.includes('パスワード')
    ) {
      return 'encryption'
    }

    return 'unknown'
  }

  private enhanceNetworkError(error: any, originalMessage: string): string {
    // Check if it's a quota exceeded error
    if (error?.status === 403 && error?.message?.includes('quota')) {
      return ERROR_MESSAGES.QUOTA_EXCEEDED
    }

    // Check if it's a rate limit error
    if (error?.status === 429) {
      return 'API利用制限に達しました。しばらく待ってから再試行してください'
    }

    // Check if it's a server error
    if (error?.status >= 500) {
      return 'サーバーエラーが発生しました。しばらく待ってから再試行してください'
    }

    // Check if it's a connection error
    if (!navigator.onLine) {
      return 'インターネット接続を確認してください'
    }

    return originalMessage
  }

  private isCriticalError(error: any, message: string): boolean {
    const criticalKeywords = [
      'auth',
      'unauthorized',
      'forbidden',
      'quota',
      'encrypt',
      'decrypt',
      '認証',
      '暗号',
      '復号'
    ]

    const lowerMessage = message.toLowerCase()
    return criticalKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  private showErrorToast(message: string): void {
    // Emit custom event for toast notification
    const event = new CustomEvent('show-toast', {
      detail: {
        type: 'error',
        message
      }
    })
    window.dispatchEvent(event)
  }

  async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    context?: string
  ): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        if (attempt === maxRetries) {
          this.handleError(error, context, 'error')
          throw error
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt)
        
        this.handleError(
          new Error(`Retry attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms`),
          context,
          'warning'
        )

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  clearError(errorId: string): void {
    const index = this._errors.value.findIndex(error => error.id === errorId)
    if (index !== -1) {
      this._errors.value.splice(index, 1)
    }
  }

  clearAllErrors(): void {
    this._errors.value = []
  }

  clearErrorsByType(type: 'error' | 'warning' | 'info'): void {
    this._errors.value = this._errors.value.filter(error => error.type !== type)
  }

  getErrorsByContext(context: string): ErrorInfo[] {
    return this._errors.value.filter(error => error.context === context)
  }

  getRecoverableErrors(): ErrorInfo[] {
    return this._errors.value.filter(error => error.recoverable && error.retryAction)
  }

  async retryError(errorId: string): Promise<boolean> {
    const error = this._errors.value.find(e => e.id === errorId)
    if (!error || !error.retryAction) {
      return false
    }

    try {
      await error.retryAction()
      this.clearError(errorId)
      return true
    } catch (retryError) {
      this.handleError(retryError, `Retry failed for ${errorId}`, 'error')
      return false
    }
  }

  exportErrorLog(): string {
    const errorData = {
      timestamp: new Date().toISOString(),
      stats: this._stats.value,
      errors: this._errors.value.map(error => ({
        ...error,
        retryAction: error.retryAction ? '[Function]' : null
      }))
    }

    return JSON.stringify(errorData, null, 2)
  }

  reset(): void {
    this._errors.value = []
    this._stats.value = {
      totalErrors: 0,
      authErrors: 0,
      networkErrors: 0,
      syncErrors: 0,
      encryptionErrors: 0
    }
    this.errorIdCounter = 0
  }
}

// Create and export singleton instance
export const errorHandlerService = new ErrorHandlerService()
export default errorHandlerService