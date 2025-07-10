// 共通の型定義

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ServiceResponse<T = any> extends ApiResponse<T> {}

// エラー関連
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp?: number
}

// 設定関連
export interface AppConfig {
  autoSync: boolean
  syncInterval: number
  sessionTimeout: number
  debugMode: boolean
}

// UI状態
export interface LoadingState {
  isLoading: boolean
  loadingMessage?: string
}

export interface ErrorState {
  hasError: boolean
  error: string | null
  errorCode?: string
}

// ページネーション
export interface PaginationOptions {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// フィルタリング
export interface FilterOptions {
  search?: string
  category?: string
  dateFrom?: Date
  dateTo?: Date
}