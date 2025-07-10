// 暗号化管理サービス

import { CryptoService, type EncryptedData } from '../crypto.service'
import { ENCRYPTION_CONFIG } from '@/config/encryption.config'
import type { Holding } from '@/types/database'

export interface EncryptedHolding extends Omit<Holding, 'quantity' | 'note' | 'locationId'> {
  encryptedQuantity: string
  encryptedNote?: string
  encryptedLocationId: string
  isEncrypted: boolean
}

export class EncryptionManagerService {
  private encryptionKey: CryptoKey | null = null
  private keyCache = new Map<string, { key: CryptoKey; timestamp: number }>()

  /**
   * 暗号化キーを設定
   */
  setEncryptionKey(key: CryptoKey) {
    this.encryptionKey = key
    console.log('[EncryptionManager] Encryption key set')
  }

  /**
   * 暗号化キーを取得
   */
  getEncryptionKey(): CryptoKey | null {
    return this.encryptionKey
  }

  /**
   * 暗号化キーをクリア
   */
  clearEncryptionKey() {
    this.encryptionKey = null
    this.clearKeyCache()
    console.log('[EncryptionManager] Encryption key cleared')
  }

  /**
   * 暗号化が利用可能かチェック
   */
  isUnlocked(): boolean {
    return this.encryptionKey !== null
  }

  /**
   * 文字列フィールドを暗号化
   */
  async encryptField(value: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available')
    }

    try {
      const encrypted = await CryptoService.encrypt(value, this.encryptionKey)
      return JSON.stringify(encrypted)
    } catch (error) {
      console.error('[EncryptionManager] Failed to encrypt field:', error)
      throw new Error('フィールドの暗号化に失敗しました')
    }
  }

  /**
   * 文字列フィールドを復号化
   */
  async decryptField(encryptedValue: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available')
    }

    try {
      const encrypted: EncryptedData = JSON.parse(encryptedValue)
      return await CryptoService.decrypt(encrypted, this.encryptionKey)
    } catch (error) {
      console.error('[EncryptionManager] Failed to decrypt field:', error)
      throw new Error('フィールドの復号化に失敗しました')
    }
  }

  /**
   * Holdingオブジェクトを暗号化
   */
  async encryptHolding(holding: Holding): Promise<EncryptedHolding> {
    try {
      const [encryptedQuantity, encryptedLocationId, encryptedNote] = await Promise.all([
        this.encryptField(holding.quantity.toString()),
        this.encryptField(holding.locationId),
        holding.note ? this.encryptField(holding.note) : Promise.resolve(undefined)
      ])

      return {
        id: holding.id,
        symbol: holding.symbol,
        createdAt: holding.createdAt,
        updatedAt: holding.updatedAt,
        encryptedQuantity,
        encryptedLocationId,
        encryptedNote,
        isEncrypted: true
      }
    } catch (error) {
      console.error('[EncryptionManager] Failed to encrypt holding:', error)
      throw new Error('Holdingの暗号化に失敗しました')
    }
  }

  /**
   * Holdingオブジェクトを復号化
   */
  async decryptHolding(encryptedHolding: EncryptedHolding): Promise<Holding> {
    try {
      const [quantityStr, locationId, note] = await Promise.all([
        this.decryptField(encryptedHolding.encryptedQuantity),
        this.decryptField(encryptedHolding.encryptedLocationId),
        encryptedHolding.encryptedNote 
          ? this.decryptField(encryptedHolding.encryptedNote) 
          : Promise.resolve(undefined)
      ])

      const quantity = parseFloat(quantityStr)
      if (isNaN(quantity)) {
        throw new Error('Invalid quantity after decryption')
      }

      return {
        id: encryptedHolding.id,
        symbol: encryptedHolding.symbol,
        quantity,
        locationId,
        note,
        createdAt: encryptedHolding.createdAt,
        updatedAt: encryptedHolding.updatedAt
      }
    } catch (error) {
      console.error('[EncryptionManager] Failed to decrypt holding:', error)
      throw new Error('Holdingの復号化に失敗しました')
    }
  }

  /**
   * 複数のHoldingを一括暗号化
   */
  async encryptHoldings(holdings: Holding[]): Promise<EncryptedHolding[]> {
    if (!this.isUnlocked()) {
      throw new Error('Encryption key not available')
    }

    try {
      const chunkSize = 10 // バッチサイズ
      const results: EncryptedHolding[] = []

      for (let i = 0; i < holdings.length; i += chunkSize) {
        const chunk = holdings.slice(i, i + chunkSize)
        const encryptedChunk = await Promise.all(
          chunk.map(holding => this.encryptHolding(holding))
        )
        results.push(...encryptedChunk)
      }

      return results
    } catch (error) {
      console.error('[EncryptionManager] Failed to encrypt holdings batch:', error)
      throw error
    }
  }

  /**
   * 複数のHoldingを一括復号化
   */
  async decryptHoldings(encryptedHoldings: EncryptedHolding[]): Promise<Holding[]> {
    if (!this.isUnlocked()) {
      throw new Error('Encryption key not available')
    }

    try {
      const chunkSize = 10 // バッチサイズ
      const results: Holding[] = []

      for (let i = 0; i < encryptedHoldings.length; i += chunkSize) {
        const chunk = encryptedHoldings.slice(i, i + chunkSize)
        const decryptedChunk = await Promise.all(
          chunk.map(holding => this.decryptHolding(holding))
        )
        results.push(...decryptedChunk)
      }

      return results
    } catch (error) {
      console.error('[EncryptionManager] Failed to decrypt holdings batch:', error)
      throw error
    }
  }

  /**
   * キーキャッシュをクリア
   */
  private clearKeyCache() {
    this.keyCache.clear()
  }

  /**
   * キーキャッシュのクリーンアップ（期限切れアイテムを削除）
   */
  private cleanupKeyCache() {
    const now = Date.now()
    const ttl = ENCRYPTION_CONFIG.cache.keyTtl

    for (const [id, entry] of this.keyCache.entries()) {
      if (now - entry.timestamp > ttl) {
        this.keyCache.delete(id)
      }
    }
  }

  /**
   * 暗号化統計を取得
   */
  getEncryptionStats() {
    return {
      isUnlocked: this.isUnlocked(),
      cacheSize: this.keyCache.size,
      algorithm: ENCRYPTION_CONFIG.algorithm,
      keyDerivation: ENCRYPTION_CONFIG.keyDerivation.algorithm
    }
  }
}

// シングルトンインスタンス
export const encryptionManagerService = new EncryptionManagerService()