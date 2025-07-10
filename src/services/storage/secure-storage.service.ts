// セキュアストレージサービス - データベース操作に特化

import { dbV2 } from '../db-v2'
import { encryptionManagerService, type EncryptedHolding } from '../encryption/encryption-manager.service'
import type { Holding, Location } from '@/types/database'

export interface AuthState {
  isAuthenticated: boolean
  passwordHash?: string
  salt?: string
}

export class SecureStorageService {
  /**
   * 暗号化されたHoldingを保存
   */
  async saveEncryptedHolding(holding: Holding): Promise<string> {
    try {
      if (!encryptionManagerService.isUnlocked()) {
        throw new Error('暗号化キーが設定されていません')
      }

      const encryptedHolding = await encryptionManagerService.encryptHolding(holding)
      const id = await dbV2.holdings.put(encryptedHolding as any)
      
      console.log('[SecureStorage] Holding saved with encryption:', id)
      return typeof id === 'string' ? id : id.toString()
    } catch (error) {
      console.error('[SecureStorage] Failed to save encrypted holding:', error)
      throw error
    }
  }

  /**
   * 暗号化されたHoldingを取得
   */
  async getDecryptedHolding(id: string): Promise<Holding | null> {
    try {
      if (!encryptionManagerService.isUnlocked()) {
        throw new Error('暗号化キーが設定されていません')
      }

      const encryptedHolding = await dbV2.holdings.get(id) as EncryptedHolding
      if (!encryptedHolding) {
        return null
      }

      if (!encryptedHolding.isEncrypted) {
        // 暗号化されていない場合はそのまま返す（後方互換性）
        return encryptedHolding as any
      }

      return await encryptionManagerService.decryptHolding(encryptedHolding)
    } catch (error) {
      console.error('[SecureStorage] Failed to get decrypted holding:', error)
      throw error
    }
  }

  /**
   * すべての暗号化されたHoldingを取得
   */
  async getAllDecryptedHoldings(): Promise<Holding[]> {
    try {
      if (!encryptionManagerService.isUnlocked()) {
        throw new Error('暗号化キーが設定されていません')
      }

      const allHoldings = await dbV2.holdings.toArray()
      const encryptedHoldings = allHoldings.filter(h => (h as any).isEncrypted) as EncryptedHolding[]
      const unencryptedHoldings = allHoldings.filter(h => !(h as any).isEncrypted) as Holding[]

      // 暗号化されたものを復号化
      const decryptedHoldings = encryptedHoldings.length > 0 
        ? await encryptionManagerService.decryptHoldings(encryptedHoldings)
        : []

      return [...unencryptedHoldings, ...decryptedHoldings]
    } catch (error) {
      console.error('[SecureStorage] Failed to get all decrypted holdings:', error)
      throw error
    }
  }

  /**
   * シンボル別の暗号化されたHoldingを取得
   */
  async getDecryptedHoldingsBySymbol(symbol: string): Promise<Holding[]> {
    try {
      if (!encryptionManagerService.isUnlocked()) {
        throw new Error('暗号化キーが設定されていません')
      }

      const holdings = await dbV2.holdings.where('symbol').equals(symbol).toArray()
      const encryptedHoldings = holdings.filter(h => (h as any).isEncrypted) as EncryptedHolding[]
      const unencryptedHoldings = holdings.filter(h => !(h as any).isEncrypted) as Holding[]

      const decryptedHoldings = encryptedHoldings.length > 0
        ? await encryptionManagerService.decryptHoldings(encryptedHoldings)
        : []

      return [...unencryptedHoldings, ...decryptedHoldings]
    } catch (error) {
      console.error('[SecureStorage] Failed to get decrypted holdings by symbol:', error)
      throw error
    }
  }

  /**
   * 暗号化されたHoldingを更新
   */
  async updateEncryptedHolding(holding: Holding): Promise<void> {
    try {
      if (!encryptionManagerService.isUnlocked()) {
        throw new Error('暗号化キーが設定されていません')
      }

      holding.updatedAt = Date.now()
      const encryptedHolding = await encryptionManagerService.encryptHolding(holding)
      await dbV2.holdings.put(encryptedHolding as any)
      
      console.log('[SecureStorage] Holding updated with encryption:', holding.id)
    } catch (error) {
      console.error('[SecureStorage] Failed to update encrypted holding:', error)
      throw error
    }
  }

  /**
   * 暗号化されたHoldingを削除
   */
  async deleteEncryptedHolding(id: string): Promise<void> {
    try {
      await dbV2.holdings.delete(id)
      console.log('[SecureStorage] Holding deleted:', id)
    } catch (error) {
      console.error('[SecureStorage] Failed to delete holding:', error)
      throw error
    }
  }

  /**
   * 複数のHoldingを一括で暗号化して保存
   */
  async bulkSaveEncryptedHoldings(holdings: Holding[]): Promise<void> {
    try {
      if (!encryptionManagerService.isUnlocked()) {
        throw new Error('暗号化キーが設定されていません')
      }

      const encryptedHoldings = await encryptionManagerService.encryptHoldings(holdings)
      await dbV2.holdings.bulkPut(encryptedHoldings as any[])
      
      console.log('[SecureStorage] Bulk holdings saved with encryption:', holdings.length)
    } catch (error) {
      console.error('[SecureStorage] Failed to bulk save encrypted holdings:', error)
      throw error
    }
  }

  /**
   * 認証状態を保存
   */
  async saveAuthState(authState: AuthState): Promise<void> {
    try {
      localStorage.setItem('authState', JSON.stringify(authState))
      console.log('[SecureStorage] Auth state saved')
    } catch (error) {
      console.error('[SecureStorage] Failed to save auth state:', error)
      throw error
    }
  }

  /**
   * 認証状態を取得
   */
  async getAuthState(): Promise<AuthState | null> {
    try {
      const authStateJson = localStorage.getItem('authState')
      return authStateJson ? JSON.parse(authStateJson) : null
    } catch (error) {
      console.error('[SecureStorage] Failed to get auth state:', error)
      return null
    }
  }

  /**
   * 認証状態をクリア
   */
  async clearAuthState(): Promise<void> {
    try {
      localStorage.removeItem('authState')
      console.log('[SecureStorage] Auth state cleared')
    } catch (error) {
      console.error('[SecureStorage] Failed to clear auth state:', error)
    }
  }

  /**
   * 暗号化されていないデータを暗号化に移行
   */
  async migrateToEncryption(): Promise<{ migrated: number; errors: number }> {
    try {
      if (!encryptionManagerService.isUnlocked()) {
        throw new Error('暗号化キーが設定されていません')
      }

      const allHoldings = await dbV2.holdings.toArray()
      const unencryptedHoldings = allHoldings.filter(h => !(h as any).isEncrypted) as Holding[]

      if (unencryptedHoldings.length === 0) {
        return { migrated: 0, errors: 0 }
      }

      let migrated = 0
      let errors = 0

      for (const holding of unencryptedHoldings) {
        try {
          await this.updateEncryptedHolding(holding)
          migrated++
        } catch (error) {
          console.error('[SecureStorage] Failed to migrate holding:', holding.id, error)
          errors++
        }
      }

      console.log(`[SecureStorage] Migration completed: ${migrated} migrated, ${errors} errors`)
      return { migrated, errors }
    } catch (error) {
      console.error('[SecureStorage] Migration failed:', error)
      throw error
    }
  }

  /**
   * ストレージ統計を取得
   */
  async getStorageStats() {
    try {
      const [totalHoldings, encryptedCount, locationCount] = await Promise.all([
        dbV2.holdings.count(),
        dbV2.holdings.where('isEncrypted').equals(true).count(),
        dbV2.locations.count()
      ])

      return {
        totalHoldings,
        encryptedHoldings: encryptedCount,
        unencryptedHoldings: totalHoldings - encryptedCount,
        locations: locationCount,
        encryptionRate: totalHoldings > 0 ? (encryptedCount / totalHoldings) * 100 : 0
      }
    } catch (error) {
      console.error('[SecureStorage] Failed to get storage stats:', error)
      return {
        totalHoldings: 0,
        encryptedHoldings: 0,
        unencryptedHoldings: 0,
        locations: 0,
        encryptionRate: 0
      }
    }
  }
}

// シングルトンインスタンス
export const secureStorageService = new SecureStorageService()