import { googleAuthService } from '@/services/google-auth.service'
import { authService } from '@/services/auth.service'

/**
 * Google認証とストレージのアンロック状態を確認するガード関数
 */
export async function ensureUnlocked(): Promise<boolean> {
  try {
    // Google認証状態をチェック
    if (!googleAuthService.isAuthenticated.value) {
      console.log('[DEBUG] ensureUnlocked - not authenticated with Google')
      return false
    }

    // ストレージのアンロック状態をチェック
    const { secureStorage } = await import('@/services/storage.service')
    if (secureStorage.isUnlocked()) {
      console.log('[DEBUG] ensureUnlocked - storage already unlocked')
      return true
    }

    // Google認証情報を使用してストレージをアンロック
    const unlockResult = await authService.unlockWithGoogleAuth()
    if (unlockResult.success) {
      console.log('[DEBUG] ensureUnlocked - successfully unlocked with Google auth')
      return true
    } else {
      console.log('[DEBUG] ensureUnlocked - failed to unlock with Google auth:', unlockResult.error)
      return false
    }
  } catch (error) {
    console.error('[DEBUG] ensureUnlocked - error:', error)
    return false
  }
}

/**
 * Wrapper for functions that require encryption access.
 * Automatically handles unlock prompt if needed.
 */
export async function withEncryption<T>(
  operation: () => Promise<T>,
  fallback?: () => T
): Promise<T | undefined> {
  if (await ensureUnlocked()) {
    return await operation()
  }
  
  return fallback ? fallback() : undefined
}