import CryptoJS from 'crypto-js'
import { SYNC_CONFIG, ERROR_MESSAGES } from '@/config/google-drive.config'

export interface EncryptedData {
  data: string
  iv: string
  salt: string
  tag: string
  version: string
}

export interface CloudBackupData {
  portfolioData: any
  timestamp: number
  version: string
  checksum: string
}

class CloudEncryptionService {
  private readonly ENCRYPTION_VERSION = '1.0'
  private readonly PBKDF2_ITERATIONS = 10000
  private readonly KEY_SIZE = 256 / 32 // 32 bytes for AES-256

  constructor() {}

  /**
   * Derives a key from password using PBKDF2
   */
  private deriveKey(password: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: this.KEY_SIZE,
      iterations: this.PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    })
  }

  /**
   * Generates a random salt
   */
  private generateSalt(): CryptoJS.lib.WordArray {
    return CryptoJS.lib.WordArray.random(128 / 8) // 16 bytes
  }

  /**
   * Generates a random IV
   */
  private generateIV(): CryptoJS.lib.WordArray {
    return CryptoJS.lib.WordArray.random(128 / 8) // 16 bytes for CBC
  }

  /**
   * Calculates SHA-256 checksum of data
   */
  private calculateChecksum(data: string): string {
    return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex)
  }

  /**
   * Encrypts portfolio data with password
   */
  async encryptPortfolioData(portfolioData: any, password: string): Promise<EncryptedData> {
    try {
      // Prepare backup data
      const backupData: CloudBackupData = {
        portfolioData,
        timestamp: Date.now(),
        version: this.ENCRYPTION_VERSION,
        checksum: this.calculateChecksum(JSON.stringify(portfolioData))
      }

      const dataToEncrypt = JSON.stringify(backupData)
      
      // Generate salt and IV
      const salt = this.generateSalt()
      const iv = this.generateIV()
      
      // Derive key from password
      const key = this.deriveKey(password, salt)
      
      // Encrypt using AES-CBC
      const encrypted = CryptoJS.AES.encrypt(dataToEncrypt, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      })

      return {
        data: encrypted.toString(),
        iv: iv.toString(CryptoJS.enc.Base64),
        salt: salt.toString(CryptoJS.enc.Base64),
        tag: '', // Not used in CBC mode
        version: this.ENCRYPTION_VERSION
      }
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error(ERROR_MESSAGES.ENCRYPTION_FAILED)
    }
  }

  /**
   * Decrypts portfolio data with password
   */
  async decryptPortfolioData(encryptedData: EncryptedData, password: string): Promise<CloudBackupData> {
    try {
      // Parse encrypted data
      const iv = CryptoJS.enc.Base64.parse(encryptedData.iv)
      const salt = CryptoJS.enc.Base64.parse(encryptedData.salt)
      
      // Derive key from password
      const key = this.deriveKey(password, salt)
      
      // Decrypt using AES-CBC
      const decrypted = CryptoJS.AES.decrypt(encryptedData.data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      })
      
      const decryptedData = decrypted.toString(CryptoJS.enc.Utf8)
      
      if (!decryptedData) {
        throw new Error('Invalid password or corrupted data')
      }
      
      // Parse and validate backup data
      const backupData: CloudBackupData = JSON.parse(decryptedData)
      
      // Verify checksum
      const calculatedChecksum = this.calculateChecksum(JSON.stringify(backupData.portfolioData))
      if (calculatedChecksum !== backupData.checksum) {
        throw new Error('Data integrity check failed')
      }
      
      return backupData
    } catch (error) {
      console.error('Decryption failed:', error)
      if (error.message.includes('Invalid password') || error.message.includes('Malformed UTF-8')) {
        throw new Error(ERROR_MESSAGES.INVALID_PASSWORD)
      }
      throw new Error(ERROR_MESSAGES.DECRYPTION_FAILED)
    }
  }

  /**
   * Validates password strength
   */
  validatePassword(password: string): { isValid: boolean, errors: string[] } {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push('パスワードは8文字以上である必要があります')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('小文字を含む必要があります')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('大文字を含む必要があります')
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('数字を含む必要があります')
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('特殊文字を含む必要があります')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Generates a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    
    const allChars = lowercase + uppercase + numbers + symbols
    
    let password = ''
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  /**
   * Tests encryption/decryption with sample data
   */
  async testEncryption(password: string): Promise<boolean> {
    try {
      const testData = {
        holdings: [{ token: 'BTC', amount: 1.5, location: 'Wallet' }],
        timestamp: Date.now()
      }
      
      const encrypted = await this.encryptPortfolioData(testData, password)
      const decrypted = await this.decryptPortfolioData(encrypted, password)
      
      return JSON.stringify(testData) === JSON.stringify(decrypted.portfolioData)
    } catch (error) {
      console.error('Encryption test failed:', error)
      return false
    }
  }
}

// Create and export singleton instance
export const cloudEncryptionService = new CloudEncryptionService()
export default cloudEncryptionService