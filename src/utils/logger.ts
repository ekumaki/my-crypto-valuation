// 統一ロギングシステム

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: number
  level: LogLevel
  module: string
  message: string
  data?: any
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private isDevelopment = import.meta.env.DEV

  /**
   * デバッグログ
   */
  debug(module: string, message: string, data?: any): void {
    this.log('debug', module, message, data)
  }

  /**
   * 情報ログ
   */
  info(module: string, message: string, data?: any): void {
    this.log('info', module, message, data)
  }

  /**
   * 警告ログ
   */
  warn(module: string, message: string, data?: any): void {
    this.log('warn', module, message, data)
  }

  /**
   * エラーログ
   */
  error(module: string, message: string, data?: any): void {
    this.log('error', module, message, data)
  }

  /**
   * ログを記録
   */
  private log(level: LogLevel, module: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      module,
      message,
      data
    }

    // メモリ内ログに保存
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift() // 古いログを削除
    }

    // コンソール出力
    this.outputToConsole(entry)

    // 永続化（エラーログのみ）
    if (level === 'error') {
      this.persistLog(entry)
    }
  }

  /**
   * コンソールに出力
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString()
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]`
    const message = `${prefix} ${entry.message}`

    switch (entry.level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(message, entry.data || '')
        }
        break
      case 'info':
        console.info(message, entry.data || '')
        break
      case 'warn':
        console.warn(message, entry.data || '')
        break
      case 'error':
        console.error(message, entry.data || '')
        break
    }
  }

  /**
   * ログを永続化
   */
  private persistLog(entry: LogEntry): void {
    try {
      const key = `error_log_${entry.timestamp}`
      const value = JSON.stringify(entry)
      localStorage.setItem(key, value)

      // 古いエラーログをクリーンアップ
      this.cleanupOldErrorLogs()
    } catch (error) {
      console.error('Failed to persist log:', error)
    }
  }

  /**
   * 古いエラーログをクリーンアップ
   */
  private cleanupOldErrorLogs(): void {
    try {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('error_log_')) {
          const timestamp = parseInt(key.replace('error_log_', ''))
          if (timestamp < oneWeekAgo) {
            keysToRemove.push(key)
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Failed to cleanup old error logs:', error)
    }
  }

  /**
   * 最近のログを取得
   */
  getRecentLogs(count = 100): LogEntry[] {
    return this.logs.slice(-count)
  }

  /**
   * 指定レベル以上のログを取得
   */
  getLogsByLevel(minLevel: LogLevel): LogEntry[] {
    const levelOrder: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const minIndex = levelOrder.indexOf(minLevel)
    
    return this.logs.filter(log => {
      const logIndex = levelOrder.indexOf(log.level)
      return logIndex >= minIndex
    })
  }

  /**
   * 指定モジュールのログを取得
   */
  getLogsByModule(module: string): LogEntry[] {
    return this.logs.filter(log => log.module === module)
  }

  /**
   * ログをクリア
   */
  clearLogs(): void {
    this.logs = []
  }

  /**
   * ログ統計を取得
   */
  getLogStats() {
    const stats = {
      total: this.logs.length,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      modules: new Set<string>()
    }

    for (const log of this.logs) {
      stats[log.level]++
      stats.modules.add(log.module)
    }

    return {
      ...stats,
      modules: Array.from(stats.modules)
    }
  }

  /**
   * ログをエクスポート
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * パフォーマンス測定用のタイマーを作成
   */
  createTimer(module: string, operation: string) {
    const startTime = performance.now()
    
    return {
      end: () => {
        const duration = performance.now() - startTime
        this.info(module, `${operation} completed in ${duration.toFixed(2)}ms`)
        return duration
      }
    }
  }
}

// シングルトンインスタンス
export const logger = new Logger()

// 便利な関数エクスポート
export const debugLog = (module: string, message: string, data?: any) => logger.debug(module, message, data)
export const infoLog = (module: string, message: string, data?: any) => logger.info(module, message, data)
export const warnLog = (module: string, message: string, data?: any) => logger.warn(module, message, data)
export const errorLog = (module: string, message: string, data?: any) => logger.error(module, message, data)

export default logger