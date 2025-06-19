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

  constructor() {
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

      // Load Google API if not already loaded
      if (!this.gapiLoaded) {
        await this.loadGoogleAPI()
      }

      // Initialize gapi
      await new Promise<void>((resolve, reject) => {
        window.gapi.load('auth2:client', {
          callback: resolve,
          onerror: reject
        })
      })

      // Initialize the auth client
      await window.gapi.client.init({
        apiKey: GOOGLE_DRIVE_CONFIG.apiKey,
        clientId: GOOGLE_DRIVE_CONFIG.clientId,
        discoveryDocs: [GOOGLE_DRIVE_CONFIG.discoveryDoc],
        scope: GOOGLE_DRIVE_CONFIG.scopes.join(' ')
      })

      this.authInstance = window.gapi.auth2.getAuthInstance()
      
      // Check if user is already signed in
      if (this.authInstance.isSignedIn.get()) {
        this.handleAuthSuccess()
      }

      // Listen for sign-in state changes
      this.authInstance.isSignedIn.listen((isSignedIn: boolean) => {
        if (isSignedIn) {
          this.handleAuthSuccess()
        } else {
          this.handleSignOut()
        }
      })

      this._isInitialized.value = true
    } catch (error) {
      console.error('Failed to initialize Google API:', error)
      this._error.value = ERROR_MESSAGES.AUTH_FAILED
    } finally {
      this._isLoading.value = false
    }
  }

  private async loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if gapi is already loaded
      if (window.gapi) {
        this.gapiLoaded = true
        resolve()
        return
      }

      // Create script element
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => {
        this.gapiLoaded = true
        resolve()
      }
      script.onerror = () => {
        reject(new Error('Failed to load Google API'))
      }
      
      document.head.appendChild(script)
    })
  }

  private handleAuthSuccess(): void {
    const currentUser = this.authInstance.currentUser.get()
    const profile = currentUser.getBasicProfile()
    
    this._user.value = {
      id: profile.getId(),
      email: profile.getEmail(),
      name: profile.getName(),
      picture: profile.getImageUrl()
    }
    
    this._isAuthenticated.value = true
    this._error.value = null
  }

  private handleSignOut(): void {
    this._user.value = null
    this._isAuthenticated.value = false
  }

  async signIn(): Promise<void> {
    try {
      this._isLoading.value = true
      this._error.value = null

      if (!this.authInstance) {
        throw new Error('Google Auth not initialized')
      }

      await this.authInstance.signIn()
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
    if (!this.authInstance || !this._isAuthenticated.value) {
      return null
    }

    const currentUser = this.authInstance.currentUser.get()
    const authResponse = currentUser.getAuthResponse()
    return authResponse.access_token
  }

  async refreshToken(): Promise<string | null> {
    try {
      if (!this.authInstance || !this._isAuthenticated.value) {
        return null
      }

      const currentUser = this.authInstance.currentUser.get()
      const authResponse = await currentUser.reloadAuthResponse()
      return authResponse.access_token
    } catch (error) {
      console.error('Failed to refresh token:', error)
      this._error.value = 'トークンの更新に失敗しました'
      return null
    }
  }

  clearError(): void {
    this._error.value = null
  }
}

// Create and export singleton instance
export const googleAuthService = new GoogleAuthService()
export default googleAuthService