export interface EncryptedData {
  ciphertext: string
  iv: string
  salt?: string
}

export interface KeyDerivationResult {
  key: CryptoKey
  salt: Uint8Array
}

export class CryptoService {
  private static readonly ITERATIONS = 150000
  private static readonly KEY_LENGTH = 256
  private static readonly SALT_LENGTH = 16
  private static readonly IV_LENGTH = 12
  
  static async deriveKey(password: string, salt?: Uint8Array): Promise<KeyDerivationResult> {
    const encoder = new TextEncoder()
    const passwordBuffer = encoder.encode(password)
    
    const actualSalt = salt || crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH))
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    )
    
    return { key, salt: actualSalt }
  }
  
  static async encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedData> {
    const encoder = new TextEncoder()
    const plaintextBuffer = encoder.encode(plaintext)
    
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH))
    
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      plaintextBuffer
    )
    
    return {
      ciphertext: this.arrayBufferToBase64(ciphertextBuffer),
      iv: this.arrayBufferToBase64(iv)
    }
  }
  
  static async decrypt(encryptedData: EncryptedData, key: CryptoKey): Promise<string> {
    const ciphertextBuffer = this.base64ToArrayBuffer(encryptedData.ciphertext)
    const iv = this.base64ToArrayBuffer(encryptedData.iv)
    
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertextBuffer
    )
    
    const decoder = new TextDecoder()
    return decoder.decode(plaintextBuffer)
  }
  
  static async hashPassword(password: string, salt?: Uint8Array): Promise<{ hash: string, salt: string }> {
    const encoder = new TextEncoder()
    const passwordBuffer = encoder.encode(password)
    
    const actualSalt = salt || crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH))
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )
    
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: actualSalt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    )
    
    return {
      hash: this.arrayBufferToBase64(hashBuffer),
      salt: this.arrayBufferToBase64(actualSalt)
    }
  }
  
  static async verifyPassword(password: string, hashedPassword: string, salt: string): Promise<boolean> {
    const saltBuffer = new Uint8Array(this.base64ToArrayBuffer(salt))
    const { hash } = await this.hashPassword(password, saltBuffer)
    return hash === hashedPassword
  }
  
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
  
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
}