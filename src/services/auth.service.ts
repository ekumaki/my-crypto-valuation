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
    const maxRetries = 3
    let attempts = 0
    
    while (attempts < maxRetries) {
      attempts++
      console.log(`[AuthService] setupEncryptionFromGoogleAuth attempt ${attempts}/${maxRetries}`)
      
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

        // データベース接続を確認
        const { dbV2 } = await import('./db-v2')
        await dbV2.ensureConnection()
        console.log('[AuthService] Database connection verified')

        // Google認証情報から暗号化キーを生成
        const encryptionKey = await CryptoService.deriveKeyFromGoogleAuth(user.id, user.email)
        
        // 暗号化キーを設定
        secureStorage.setEncryptionKey(encryptionKey)
        console.log('[AuthService] Encryption key set successfully')
        
        // 認証状態を設定（パスワードハッシュは不要）
        await secureStorage.setAuthState({
          isAuthenticated: true
        })
        console.log('[AuthService] Auth state set successfully')
        
        // 暗号化されていないデータがあれば移行
        try {
          await secureStorage.migrateUnencryptedData()
          console.log('[AuthService] Unencrypted data migration completed')
        } catch (migrationError) {
          console.warn('[AuthService] Data migration failed, continuing...', migrationError)
          // 移行失敗でも続行
        }
        
        // 初期データを確実に同期済みとしてマーク
        try {
          const { metadataService } = await import('./metadata.service')
          await metadataService.forceResetAllMetadata()
          console.log('[AuthService] Initial data marked as synced')
        } catch (error) {
          console.warn('[AuthService] Failed to mark initial data as synced:', error)
        }
        
        // 同期サービスを有効化
        try {
          const { syncService } = await import('./sync.service')
          await syncService.enableSync()
          console.log('[AuthService] Sync service enabled after successful authentication')
        } catch (error) {
          console.warn('[AuthService] Failed to enable sync service:', error)
        }
        
        console.log('[AuthService] setupEncryptionFromGoogleAuth completed successfully')
        return { success: true }
      } catch (error: any) {
        console.error(`[AuthService] setupEncryptionFromGoogleAuth attempt ${attempts} failed:`, error)
        
        // DatabaseClosedError の場合は再試行
        if (error.name === 'DatabaseClosedError' && attempts < maxRetries) {
          console.log('[AuthService] Database closed, retrying after delay...')
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
          continue
        }
        
        // 最終試行または他のエラーの場合
        if (attempts >= maxRetries) {
          console.error('[AuthService] All setupEncryptionFromGoogleAuth attempts failed')
          return {
            success: false,
            error: '暗号化キーの設定に失敗しました（最大試行回数に達しました）'
          }
        }
        
        return {
          success: false,
          error: `暗号化キーの設定に失敗しました: ${error.message}`
        }
      }
    }
    
    return {
      success: false,
      error: '暗号化キーの設定に失敗しました'
    }
  }
  
  async logout(): Promise<void> {
    try {
      console.log('[AuthService] Starting logout process...')
      
      // 1. タイマーをクリア
      this.clearTimers()
      
      // 2. 同期サービスを無効化
      try {
        const { syncService } = await import('./sync.service')
        await syncService.disableSync()
        console.log('[AuthService] Sync service disabled')
      } catch (error) {
        console.warn('[AuthService] Failed to disable sync service:', error)
      }
      
      // 3. ローカルデータベースをクリア
      await this.clearIndexedDB('cryptoPortfolioV2')
      console.log('[AuthService] Local database cleared')
      
      // 4. 暗号化キーをクリア
      secureStorage.clearEncryptionKey()
      console.log('[AuthService] Encryption key cleared')
      
      // 5. 認証状態をクリア
      await secureStorage.clearAuthState()
      console.log('[AuthService] Auth state cleared')
      
      // 6. セッションストレージをクリア
      try {
        sessionStorage.clear()
      } catch (error) {
        console.warn('[AuthService] Failed to clear session storage:', error)
      }
      
      // 7. ローカルストレージの認証関連データをクリア
      try {
        localStorage.removeItem('syncStatus')
        localStorage.removeItem('globalSyncTime')
        localStorage.removeItem('google_auth_state')
      } catch (error) {
        console.warn('[AuthService] Failed to clear some local storage items:', error)
      }
      
      console.log('[AuthService] Logout completed successfully')
    } catch (error) {
      console.error('[AuthService] Logout failed:', error)
      throw error
    }
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

  /**
   * Google認証からのログアウト
   */
  async logoutFromGoogle(): Promise<void> {
    try {
      console.log('[AuthService] Starting Google logout...')
      
      // 1. ローカルデータのログアウト処理
      await this.logout()
      
      // 2. Google認証サービスからのサインアウト
      await googleAuthService.signOut()
      console.log('[AuthService] Google auth sign out completed')
      
    } catch (error) {
      console.error('[AuthService] Google logout failed:', error)
      throw error
    }
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