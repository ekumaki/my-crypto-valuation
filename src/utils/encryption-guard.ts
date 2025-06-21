import { authService } from '@/services/auth.service'
import { useSessionStore } from '@/stores/session.store'

/**
 * Ensures encryption key is available for secure operations.
 * If not unlocked, prompts user for password.
 */
export async function ensureUnlocked(): Promise<boolean> {
  // Check if already unlocked
  if (await authService.isUnlockedAndAuthenticated()) {
    return true
  }

  // Check if authenticated at all
  if (!(await authService.isAuthenticated())) {
    return false
  }

  // Request unlock from user
  const sessionStore = useSessionStore()
  return await sessionStore.requestUnlock()
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