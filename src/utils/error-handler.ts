// 統一エラーハンドリングシステム

import { logger } from './logger'
import type { AppError } from '@/types/common'

export class AppErrorHandler {
  /**
   * アプリケーションエラーを作成
   */
  createError(code: string, message: string, details?: any): AppError {
    return {
      code,
      message,
      details,
      timestamp: Date.now()
    }
  }

  /**
   * エラーをハンドル
   */
  handleError(error: Error | AppError | any, module: string = 'Unknown'): AppError {
    let appError: AppError

    if (this.isAppError(error)) {
      appError = error
    } else if (error instanceof Error) {
      appError = this.createError(
        'GENERIC_ERROR',
        error.message,
        { stack: error.stack, name: error.name }
      )
    } else {
      appError = this.createError(
        'UNKNOWN_ERROR',
        typeof error === 'string' ? error : 'Unknown error occurred',
        error
      )
    }

    // ログに記録
    logger.error(module, appError.message, {
      code: appError.code,
      details: appError.details,
      timestamp: appError.timestamp
    })

    // ユーザーに通知（必要に応じて）
    this.notifyUser(appError)

    return appError
  }

  /**
   * 非同期エラーをハンドル
   */
  async handleAsyncError(
    operation: () => Promise<any>,
    module: string,
    fallbackValue?: any
  ): Promise<{ success: boolean; data?: any; error?: AppError }> {
    try {
      const data = await operation()
      return { success: true, data }
    } catch (error) {
      const appError = this.handleError(error, module)
      return { 
        success: false, 
        error: appError,
        data: fallbackValue 
      }
    }
  }

  /**
   * 同期エラーをハンドル
   */
  handleSyncError(
    operation: () => any,
    module: string,
    fallbackValue?: any
  ): { success: boolean; data?: any; error?: AppError } {
    try {
      const data = operation()
      return { success: true, data }
    } catch (error) {
      const appError = this.handleError(error, module)
      return { 
        success: false, 
        error: appError,
        data: fallbackValue 
      }
    }
  }

  /**
   * バリデーションエラーを作成
   */
  createValidationError(field: string, value: any, rule: string): AppError {
    return this.createError(
      'VALIDATION_ERROR',
      `Validation failed for field '${field}': ${rule}`,
      { field, value, rule }
    )
  }

  /**
   * ネットワークエラーを作成
   */
  createNetworkError(url: string, status?: number, statusText?: string): AppError {
    return this.createError(
      'NETWORK_ERROR',
      `Network request failed: ${url}`,
      { url, status, statusText }
    )
  }

  /**
   * 認証エラーを作成
   */
  createAuthError(reason: string): AppError {
    return this.createError(
      'AUTH_ERROR',
      `Authentication failed: ${reason}`,
      { reason }
    )
  }

  /**
   * データベースエラーを作成
   */
  createDatabaseError(operation: string, table?: string): AppError {
    return this.createError(
      'DATABASE_ERROR',
      `Database operation failed: ${operation}`,
      { operation, table }
    )
  }

  /**
   * 暗号化エラーを作成
   */
  createCryptoError(operation: string): AppError {
    return this.createError(
      'CRYPTO_ERROR',
      `Cryptographic operation failed: ${operation}`,
      { operation }
    )
  }

  /**
   * 同期エラーを作成
   */
  createSyncError(phase: string, details?: any): AppError {
    return this.createError(
      'SYNC_ERROR',
      `Synchronization failed at phase: ${phase}`,
      { phase, ...details }
    )
  }

  /**
   * AppErrorかどうかをチェック
   */
  private isAppError(error: any): error is AppError {
    return error && 
           typeof error.code === 'string' && 
           typeof error.message === 'string' &&
           typeof error.timestamp === 'number'
  }

  /**
   * ユーザーにエラーを通知
   */
  private notifyUser(error: AppError): void {
    // Toast通知があれば使用
    if (window.showToast?.error) {
      const userMessage = this.getUserFriendlyMessage(error)
      window.showToast.error('エラー', userMessage)
    }
  }

  /**
   * ユーザーフレンドリーなメッセージを取得
   */
  private getUserFriendlyMessage(error: AppError): string {
    const errorMessages: Record<string, string> = {
      'NETWORK_ERROR': 'ネットワーク接続に問題があります',
      'AUTH_ERROR': '認証に失敗しました',
      'DATABASE_ERROR': 'データの保存に失敗しました',
      'CRYPTO_ERROR': 'データの暗号化に失敗しました',
      'SYNC_ERROR': 'データの同期に失敗しました',
      'VALIDATION_ERROR': '入力データが正しくありません',
      'GENERIC_ERROR': '予期しないエラーが発生しました',
      'UNKNOWN_ERROR': '不明なエラーが発生しました'
    }

    return errorMessages[error.code] || error.message
  }

  /**
   * エラー復旧を試行
   */
  async attemptRecovery(error: AppError, module: string): Promise<boolean> {
    logger.info(module, `Attempting recovery for error: ${error.code}`)

    try {
      switch (error.code) {
        case 'NETWORK_ERROR':
          // ネットワーク復旧を待つ
          await this.waitForNetwork()
          return true

        case 'DATABASE_ERROR':
          // データベース接続を再試行
          return await this.retryDatabaseConnection()

        case 'AUTH_ERROR':
          // 認証の再試行（必要に応じて）
          return false // 通常は手動対応が必要

        default:
          return false
      }
    } catch (recoveryError) {
      logger.error(module, 'Recovery attempt failed', recoveryError)
      return false
    }
  }

  /**
   * ネットワーク復旧を待つ
   */
  private async waitForNetwork(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const checkConnection = () => {
        if (navigator.onLine) {
          resolve()
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Network timeout'))
        } else {
          setTimeout(checkConnection, 1000)
        }
      }
      
      checkConnection()
    })
  }

  /**
   * データベース接続を再試行
   */
  private async retryDatabaseConnection(): Promise<boolean> {
    // 実装は具体的なデータベース操作による
    return false
  }

  /**
   * エラー統計を取得
   */
  getErrorStats(): any {
    // ログから統計を取得
    const errorLogs = logger.getLogsByLevel('error')
    const stats = {
      total: errorLogs.length,
      byCode: {} as Record<string, number>,
      byModule: {} as Record<string, number>,
      recent: errorLogs.slice(-10)
    }

    for (const log of errorLogs) {
      const code = log.data?.code || 'UNKNOWN'
      stats.byCode[code] = (stats.byCode[code] || 0) + 1
      stats.byModule[log.module] = (stats.byModule[log.module] || 0) + 1
    }

    return stats
  }
}

// シングルトンインスタンス
export const errorHandler = new AppErrorHandler()

// 便利な関数エクスポート
export const handleError = (error: any, module: string) => errorHandler.handleError(error, module)
export const handleAsyncError = (operation: () => Promise<any>, module: string, fallback?: any) => 
  errorHandler.handleAsyncError(operation, module, fallback)

export default errorHandler