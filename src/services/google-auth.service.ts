import { ref, computed } from 'vue'
import { GOOGLE_DRIVE_CONFIG, ERROR_MESSAGES } from '@/config/google-drive.config'

export interface GoogleAuthUser {
  id: string
  email: string
  name: string
  picture?: string
}

class GoogleAuthService {
  private _isInitialized = ref(false)
  private _isAuthenticated = ref(false)
  private _isLoading = ref(false)
  private _user = ref<GoogleAuthUser | null>(null)
  private _error = ref<string | null>(null)
  
  private authInstance: any = null
  private gapiLoaded = false
  private accessToken: string | null = null

  constructor() {
    this.loadPersistedAuthState()
    this.initializeGoogleAPI()
  }

  // Reactive getters
  get isInitialized() { return computed(() => this._isInitialized.value) }
  get isAuthenticated() { return computed(() => this._isAuthenticated.value) }
  get isLoading() { return computed(() => this._isLoading.value) }
  get user() { return computed(() => this._user.value) }
  get error() { return computed(() => this._error.value) }

  private async initializeGoogleAPI(): Promise<void> {
    try {
      this._isLoading.value = true
      this._error.value = null

      // Check if Client ID is configured
      if (!GOOGLE_DRIVE_CONFIG.clientId) {
        console.warn('Google Drive Client ID not configured')
        this._error.value = 'Google Drive Client ID が設定されていません'
        this._isInitialized.value = false
        return
      }

      // Load Google API if not already loaded
      if (!this.gapiLoaded) {
        await this.loadGoogleAPI()
      }

      // Initialize gapi client
      await new Promise<void>((resolve, reject) => {
        ;(window as any).gapi.load('client', {
          callback: resolve,
          onerror: reject
        })
      })

      // Initialize the API client
      await (window as any).gapi.client.init({
        apiKey: GOOGLE_DRIVE_CONFIG.apiKey,
        discoveryDocs: [GOOGLE_DRIVE_CONFIG.discoveryDoc]
      })

      // Initialize Google Identity Services
      ;(window as any).google.accounts.id.initialize({
        client_id: GOOGLE_DRIVE_CONFIG.clientId,
        callback: this.handleCredentialResponse.bind(this)
      })

      // Initialize OAuth for Drive API access
      this.authInstance = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_DRIVE_CONFIG.clientId,
        scope: GOOGLE_DRIVE_CONFIG.scopes.join(' '),
        callback: this.handleTokenResponse.bind(this)
      })

      // Restore token if available and set it for gapi client
      if (this.accessToken) {
        ;(window as any).gapi.client.setToken({ access_token: this.accessToken })
      }

      this._isInitialized.value = true
      console.log('Google API initialized successfully')
    } catch (error: any) {
      console.error('Failed to initialize Google API:', error)
      console.error('Error details:', error.message || error)
      console.error('Client ID:', GOOGLE_DRIVE_CONFIG.clientId)
      this._error.value = ERROR_MESSAGES.AUTH_FAILED
    } finally {
      this._isLoading.value = false
    }
  }

  private async loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if google is already loaded
      if ((window as any).google && (window as any).gapi) {
        console.log('Google APIs already loaded')
        this.gapiLoaded = true
        resolve()
        return
      }

      console.log('Loading Google Identity Services...')
      
      // Load Google Identity Services (new library)
      const gsiScript = document.createElement('script')
      gsiScript.src = 'https://accounts.google.com/gsi/client'
      gsiScript.onload = () => {
        console.log('Google Identity Services loaded')
        
        // Load Google API client library
        const gapiScript = document.createElement('script')
        gapiScript.src = 'https://apis.google.com/js/api.js'
        gapiScript.onload = () => {
          console.log('Google API client loaded successfully')
          this.gapiLoaded = true
          resolve()
        }
        gapiScript.onerror = () => {
          console.error('Failed to load Google API client')
          reject(new Error('Failed to load Google API client'))
        }
        document.head.appendChild(gapiScript)
      }
      gsiScript.onerror = () => {
        console.error('Failed to load Google Identity Services')
        reject(new Error('Failed to load Google Identity Services'))
      }
      
      document.head.appendChild(gsiScript)
    })
  }

  private handleCredentialResponse(response: any): void {
    console.log('ID token received:', response.credential)
    // This is for ID token (sign-in), we mainly need OAuth token for Drive API
  }

  private handleTokenResponse(response: any): void {
    console.log('OAuth token received:', response)
    if (response.access_token) {
      // Store access token
      this.accessToken = response.access_token
      
      // Set access token for gapi client
      ;(window as any).gapi.client.setToken({ access_token: response.access_token })
      
      // Update authentication state
      this._isAuthenticated.value = true
      this._error.value = null
      
      // You could decode the ID token to get user info, but for simplicity:
      this._user.value = {
        id: 'user_id',
        email: 'user@example.com',
        name: 'User Name',
        picture: undefined
      }
      
      // Persist authentication state
      this.persistAuthState()
    }
  }

  private handleSignOut(): void {
    this._user.value = null
    this._isAuthenticated.value = false
    this.accessToken = null
    ;(window as any).gapi.client.setToken(null)
    this.clearPersistedAuthState()
  }

  private loadPersistedAuthState(): void {
    try {
      const authData = localStorage.getItem('google_auth_state')
      if (authData) {
        const parsed = JSON.parse(authData)
        if (parsed.accessToken && parsed.expiresAt > Date.now()) {
          this.accessToken = parsed.accessToken
          this._isAuthenticated.value = true
          this._user.value = parsed.user || {
            id: 'user_id',
            email: 'user@example.com',
            name: 'User Name',
            picture: undefined
          }
        } else {
          // Token expired, clear it
          this.clearPersistedAuthState()
        }
      }
    } catch (error) {
      console.error('Failed to load persisted auth state:', error)
      this.clearPersistedAuthState()
    }
  }

  private persistAuthState(): void {
    try {
      const authData = {
        accessToken: this.accessToken,
        user: this._user.value,
        expiresAt: Date.now() + (3600 * 1000) // 1 hour from now
      }
      localStorage.setItem('google_auth_state', JSON.stringify(authData))
    } catch (error) {
      console.error('Failed to persist auth state:', error)
    }
  }

  private clearPersistedAuthState(): void {
    try {
      localStorage.removeItem('google_auth_state')
    } catch (error) {
      console.error('Failed to clear persisted auth state:', error)
    }
  }

  async signIn(): Promise<void> {
    try {
      this._isLoading.value = true
      this._error.value = null

      if (!this.authInstance) {
        throw new Error('Google Auth not initialized')
      }

      // Request OAuth token
      this.authInstance.requestAccessToken()
    } catch (error) {
      console.error('Sign in failed:', error)
      this._error.value = ERROR_MESSAGES.AUTH_FAILED
      throw error
    } finally {
      this._isLoading.value = false
    }
  }

  async signOut(): Promise<void> {
    try {
      this._isLoading.value = true
      this._error.value = null

      if (this.authInstance) {
        await this.authInstance.signOut()
      }
    } catch (error) {
      console.error('Sign out failed:', error)
      this._error.value = 'サインアウトに失敗しました'
    } finally {
      this._isLoading.value = false
    }
  }

  getAccessToken(): string | null {
    if (!this._isAuthenticated.value) {
      return null
    }

    return this.accessToken
  }

  async refreshToken(): Promise<string | null> {
    try {
      if (!this.authInstance || !this._isAuthenticated.value) {
        return null
      }

      // Request new access token
      this.authInstance.requestAccessToken()
      // The handleTokenResponse will be called with the new token
      return this.accessToken
    } catch (error) {
      console.error('Failed to refresh token:', error)
      this._error.value = 'トークンの更新に失敗しました'
      return null
    }
  }

  clearError(): void {
    this._error.value = null
  }

  async waitForInitialization(): Promise<void> {
    if (this._isInitialized.value) {
      return
    }

    // Wait for initialization to complete
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this._isInitialized.value) {
          resolve()
        } else {
          setTimeout(checkInitialized, 100)
        }
      }
      checkInitialized()
    })
  }

  async forceInitialize(): Promise<void> {
    console.log('Force initializing Google Auth service...')
    this._isInitialized.value = false
    this._error.value = null
    await this.initializeGoogleAPI()
  }
}

// Create and export singleton instance
export const googleAuthService = new GoogleAuthService()
export default googleAuthService