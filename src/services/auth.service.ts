import { CryptoService } from './crypto.service'
import { secureStorage, type AuthState } from './storage.service'
import { googleAuthService } from './google-auth.service'

export interface LoginResult {
  success: boolean
  error?: string
}

export class AuthService {
  private idleTimer: number | null = null
  private warningTimer: number | null = null
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private readonly WARNING_TIME = 25 * 60 * 1000 // 25 minutes
  private onWarningCallback?: () => void
  private onLogoutCallback?: () => void
  
  // Google認証からの暗号化キー設定
  async setupEncryptionFromGoogleAuth(): Promise<LoginResult> {
    try {
      // Google認証状態をチェック
      if (!googleAuthService.isAuthenticated.value || !googleAuthService.user.value) {
        return {
          success: false,
          error: 'Google認証が必要です'
        }
      }

      const user = googleAuthService.user.value
      if (!user.id || !user.email) {
        return {
          success: false,
          error: 'Google認証情報が不完全です'
        }
      }

      // Google認証情報から暗号化キーを生成
      const encryptionKey = await CryptoService.deriveKeyFromGoogleAuth(user.id, user.email)
      
      // 暗号化キーを設定
      secureStorage.setEncryptionKey(encryptionKey)
      
      // 認証状態を設定（パスワードハッシュは不要）
      await secureStorage.setAuthState({
        isAuthenticated: true
      })
      
      // 暗号化されていないデータがあれば移行
      await secureStorage.migrateUnencryptedData()
      
      // 初期データを確実に同期済みとしてマーク
      try {
        const { metadataService } = await import('./metadata.service')
        await metadataService.forceResetAllMetadata()
        console.log('[DEBUG] setupEncryptionFromGoogleAuth - initial data marked as synced')
      } catch (error) {
        console.warn('[DEBUG] setupEncryptionFromGoogleAuth - failed to mark initial data as synced:', error)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Failed to setup encryption from Google auth:', error)
      return {
        success: false,
        error: '暗号化キーの設定に失敗しました'
      }
    }
  }
  
  async logout(): Promise<void> {
    console.log('[DEBUG] authService.logout() called - Stack trace:')
    console.trace()
    this.clearTimers()
    secureStorage.clearEncryptionKey()
    
    const authState = await secureStorage.getAuthState()
    console.log('[DEBUG] logout() - setting isAuthenticated to false')
    await secureStorage.setAuthState({
      ...authState,
      isAuthenticated: false
    })
  }
  
  async resetAndClearData(): Promise<void> {
    try {
      this.clearTimers()
      
      // Clear encryption key first
      secureStorage.clearEncryptionKey()
      
      // Force clear all application data (ignores lock state)
      await secureStorage.forceReset()
      
      // Clear local storage
      localStorage.clear()
      
      // Clear session storage
      sessionStorage.clear()
      
      // Clear IndexedDB databases
      await this.clearIndexedDB('CryptoPortfolioDB')
      await this.clearIndexedDB('CryptoPortfolioDBV2')
      
      console.log('All data cleared successfully')
    } catch (error) {
      console.error('Failed to clear data:', error)
      throw error
    }
  }
  
  private clearIndexedDB(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(dbName)
      deleteReq.onerror = () => reject(deleteReq.error)
      deleteReq.onsuccess = () => resolve()
      deleteReq.onblocked = () => resolve() // Treat blocked as success
    })
  }
  
  async isAuthenticated(): Promise<boolean> {
    const authState = await secureStorage.getAuthState()
    return authState.isAuthenticated || false
  }
  
  async isUnlockedAndAuthenticated(): Promise<boolean> {
    const isAuth = await this.isAuthenticated()
    return isAuth && secureStorage.isUnlocked()
  }
  
  // Google認証情報を使用してストレージをアンロック
  async unlockWithGoogleAuth(): Promise<LoginResult> {
    try {
      // Google認証状態をチェック
      if (!googleAuthService.isAuthenticated.value || !googleAuthService.user.value) {
        return {
          success: false,
          error: 'Google認証が必要です'
        }
      }

      const user = googleAuthService.user.value
      if (!user.id || !user.email) {
        return {
          success: false,
          error: 'Google認証情報が不完全です'
        }
      }

      // Google認証情報から暗号化キーを生成
      const encryptionKey = await CryptoService.deriveKeyFromGoogleAuth(user.id, user.email)
      
      // 暗号化キーを設定
      secureStorage.setEncryptionKey(encryptionKey)
      
      // 認証状態を更新
      const authState = await secureStorage.getAuthState()
      const newAuthState = {
        ...authState,
        isAuthenticated: true
      }
      console.log('[DEBUG] Setting auth state to:', newAuthState)
      await secureStorage.setAuthState(newAuthState)
      
      const verifyState = await secureStorage.getAuthState()
      console.log('[DEBUG] Verified auth state after setting:', verifyState)
      
      // 初期データを確実に同期済みとしてマーク
      try {
        const { metadataService } = await import('./metadata.service')
        await metadataService.forceResetAllMetadata()
        console.log('[DEBUG] unlockWithGoogleAuth - initial data marked as synced')
      } catch (error) {
        console.warn('[DEBUG] unlockWithGoogleAuth - failed to mark initial data as synced:', error)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Unlock with Google auth failed:', error)
      return {
        success: false,
        error: 'ストレージのアンロックに失敗しました'
      }
    }
  }
  
  private startIdleTimer(): void {
    this.clearTimers()
    
    this.warningTimer = window.setTimeout(() => {
      if (this.onWarningCallback) {
        this.onWarningCallback()
      }
    }, this.WARNING_TIME)
    
    this.idleTimer = window.setTimeout(() => {
      if (this.onLogoutCallback) {
        this.onLogoutCallback()
      }
    }, this.IDLE_TIMEOUT)
  }
  
  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer)
      this.warningTimer = null
    }
  }
  
  resetIdleTimer(): void {
    if (this.idleTimer || this.warningTimer) {
      this.startIdleTimer()
    }
  }
  
  extendSession(): void {
    this.resetIdleTimer()
  }
  
  onWarning(callback: () => void): void {
    this.onWarningCallback = callback
  }
  
  onTimeout(callback: () => void): void {
    this.onLogoutCallback = callback
  }
  
  getRemainingTime(): number {
    // 簡略化のため、固定値を返す
    return this.IDLE_TIMEOUT
  }
}

export const authService = new AuthService()