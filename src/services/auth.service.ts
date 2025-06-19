import { CryptoService } from './crypto.service'
import { secureStorage, type AuthState } from './storage.service'

export interface LoginResult {
  success: boolean
  error?: string
}

export interface PasswordValidation {
  isValid: boolean
  errors: string[]
}

export class AuthService {
  private idleTimer: number | null = null
  private warningTimer: number | null = null
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private readonly WARNING_TIME = 25 * 60 * 1000 // 25 minutes
  private onWarningCallback?: () => void
  private onLogoutCallback?: () => void
  
  async isFirstTimeSetup(): Promise<boolean> {
    const authState = await secureStorage.getAuthState()
    return !authState.passwordHash
  }
  
  async setupPassword(password: string): Promise<LoginResult> {
    const validation = this.validatePassword(password)
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      }
    }
    
    try {
      const { hash, salt } = await CryptoService.hashPassword(password)
      const { key } = await CryptoService.deriveKey(password)
      
      await secureStorage.setAuthState({
        isAuthenticated: true,
        passwordHash: hash,
        salt
      })
      
      secureStorage.setEncryptionKey(key)
      
      await secureStorage.migrateUnencryptedData()
      
      this.startIdleTimer()
      
      return { success: true }
    } catch (error) {
      console.error('Failed to setup password:', error)
      return {
        success: false,
        error: 'パスワードの設定に失敗しました'
      }
    }
  }
  
  async login(password: string): Promise<LoginResult> {
    try {
      const authState = await secureStorage.getAuthState()
      
      if (!authState.passwordHash || !authState.salt) {
        return {
          success: false,
          error: 'パスワードが設定されていません'
        }
      }
      
      const isValid = await CryptoService.verifyPassword(
        password,
        authState.passwordHash,
        authState.salt
      )
      
      if (!isValid) {
        return {
          success: false,
          error: 'パスワードが正しくありません'
        }
      }
      
      const saltBuffer = new Uint8Array(this.base64ToArrayBuffer(authState.salt))
      const { key } = await CryptoService.deriveKey(password, saltBuffer)
      
      secureStorage.setEncryptionKey(key)
      
      await secureStorage.setAuthState({
        ...authState,
        isAuthenticated: true
      })
      
      this.startIdleTimer()
      
      return { success: true }
    } catch (error) {
      console.error('Login failed:', error)
      return {
        success: false,
        error: 'ログインに失敗しました'
      }
    }
  }
  
  async changePassword(currentPassword: string, newPassword: string): Promise<LoginResult> {
    const validation = this.validatePassword(newPassword)
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      }
    }
    
    try {
      const authState = await secureStorage.getAuthState()
      
      if (!authState.passwordHash || !authState.salt) {
        return {
          success: false,
          error: 'パスワードが設定されていません'
        }
      }
      
      const isCurrentValid = await CryptoService.verifyPassword(
        currentPassword,
        authState.passwordHash,
        authState.salt
      )
      
      if (!isCurrentValid) {
        return {
          success: false,
          error: '現在のパスワードが正しくありません'
        }
      }
      
      const { hash, salt } = await CryptoService.hashPassword(newPassword)
      const { key } = await CryptoService.deriveKey(newPassword)
      
      const allHoldings = await secureStorage.getHoldings()
      
      secureStorage.setEncryptionKey(key)
      
      for (const holding of allHoldings) {
        await secureStorage.updateHolding(holding.id, {
          quantity: holding.quantity,
          locationId: holding.locationId,
          note: holding.note,
          symbol: holding.symbol
        })
      }
      
      await secureStorage.setAuthState({
        isAuthenticated: true,
        passwordHash: hash,
        salt
      })
      
      return { success: true }
    } catch (error) {
      console.error('Failed to change password:', error)
      return {
        success: false,
        error: 'パスワードの変更に失敗しました'
      }
    }
  }
  
  async logout(): Promise<void> {
    this.clearTimers()
    secureStorage.clearEncryptionKey()
    
    const authState = await secureStorage.getAuthState()
    await secureStorage.setAuthState({
      ...authState,
      isAuthenticated: false
    })
  }
  
  async resetAndClearData(): Promise<void> {
    this.clearTimers()
    await secureStorage.clearAuthState()
    secureStorage.clearEncryptionKey()
  }
  
  async isAuthenticated(): Promise<boolean> {
    const authState = await secureStorage.getAuthState()
    return authState.isAuthenticated && secureStorage.isUnlocked()
  }
  
  validatePassword(password: string): PasswordValidation {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push('パスワードは8文字以上である必要があります')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('大文字を含む必要があります')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('小文字を含む必要があります')
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('数字を含む必要があります')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  getPasswordStrength(password: string): number {
    let score = 0
    
    if (password.length >= 8) score += 25
    if (password.length >= 12) score += 25
    if (/[A-Z]/.test(password)) score += 12.5
    if (/[a-z]/.test(password)) score += 12.5
    if (/[0-9]/.test(password)) score += 12.5
    if (/[^A-Za-z0-9]/.test(password)) score += 12.5
    
    return Math.min(100, score)
  }
  
  private startIdleTimer(): void {
    this.clearTimers()
    
    this.warningTimer = window.setTimeout(() => {
      this.onWarningCallback?.()
    }, this.WARNING_TIME)
    
    this.idleTimer = window.setTimeout(() => {
      this.logout()
      this.onLogoutCallback?.()
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
    if (secureStorage.isUnlocked()) {
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
    if (!this.idleTimer) return 0
    return this.IDLE_TIMEOUT
  }
  
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
}

export const authService = new AuthService()