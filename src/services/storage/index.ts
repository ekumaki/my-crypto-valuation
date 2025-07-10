// ストレージサービスのメインエクスポート

export { secureStorageService } from './secure-storage.service'
export { encryptionManagerService } from '../encryption/encryption-manager.service'

// 型定義
export type { AuthState } from './secure-storage.service'
export type { EncryptedHolding } from '../encryption/encryption-manager.service'

// 下位互換性のための統合インターフェース
class StorageServiceAdapter {
  // SecureStorageServiceのメソッドを委譲
  async saveEncryptedHolding(holding: any) {
    return secureStorageService.saveEncryptedHolding(holding)
  }

  async getDecryptedHolding(id: string) {
    return secureStorageService.getDecryptedHolding(id)
  }

  async getAllDecryptedHoldings() {
    return secureStorageService.getAllDecryptedHoldings()
  }

  async getDecryptedHoldingsBySymbol(symbol: string) {
    return secureStorageService.getDecryptedHoldingsBySymbol(symbol)
  }

  async updateEncryptedHolding(holding: any) {
    return secureStorageService.updateEncryptedHolding(holding)
  }

  async deleteEncryptedHolding(id: string) {
    return secureStorageService.deleteEncryptedHolding(id)
  }

  async bulkSaveEncryptedHoldings(holdings: any[]) {
    return secureStorageService.bulkSaveEncryptedHoldings(holdings)
  }

  // 認証関連
  async saveAuthState(authState: any) {
    return secureStorageService.saveAuthState(authState)
  }

  async getAuthState() {
    return secureStorageService.getAuthState()
  }

  async clearAuthState() {
    return secureStorageService.clearAuthState()
  }

  // 暗号化管理
  setEncryptionKey(key: CryptoKey) {
    encryptionManagerService.setEncryptionKey(key)
  }

  getEncryptionKey() {
    return encryptionManagerService.getEncryptionKey()
  }

  clearEncryptionKey() {
    encryptionManagerService.clearEncryptionKey()
  }

  isUnlocked() {
    return encryptionManagerService.isUnlocked()
  }

  // 統計
  async getStorageStats() {
    return secureStorageService.getStorageStats()
  }

  getEncryptionStats() {
    return encryptionManagerService.getEncryptionStats()
  }

  // 移行
  async migrateToEncryption() {
    return secureStorageService.migrateToEncryption()
  }
}

// 下位互換性のためのデフォルトエクスポート
export const storageService = new StorageServiceAdapter()
export default storageService