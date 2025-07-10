// 認証関連の型定義

export interface GoogleAuthUser {
  id: string
  email: string
  name: string
  picture?: string
}

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  user: GoogleAuthUser | null
}

export interface SessionState {
  isActive: boolean
  startTime: number
  lastActivity: number
  timeoutWarning: boolean
}

export type AuthMethod = 'google' | 'local'

export interface AuthResult {
  success: boolean
  error?: string
  userType?: 'new_user' | 'existing_user'
}