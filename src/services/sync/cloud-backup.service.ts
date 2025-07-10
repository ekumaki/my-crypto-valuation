// クラウドバックアップ操作サービス

import { googleAuthService } from '../google-auth.service'
import { googleDriveApiService, type DriveFile } from '../google-drive-api.service'
import type { CloudBackupData } from './types'
import { SYNC_CONFIG } from '@/config/sync.config'

export class CloudBackupService {
  /**
   * データをクラウドにバックアップする
   */
  async uploadBackup(data: any): Promise<{ success: boolean; message: string }> {
    try {
      if (!googleAuthService.isAuthenticated.value) {
        throw new Error('Google認証が必要です')
      }

      const backupData: CloudBackupData = {
        portfolioData: data,
        timestamp: Date.now(),
        version: '1.0',
        checksum: this.calculateChecksum(data)
      }

      // ファイルサイズチェック
      const dataSize = new Blob([JSON.stringify(backupData)]).size
      if (dataSize > SYNC_CONFIG.limits.maxBackupSize) {
        throw new Error(`バックアップサイズが制限を超えています: ${dataSize} bytes`)
      }

      await googleDriveApiService.uploadFile(
        SYNC_CONFIG.googleDrive.backupFileName,
        JSON.stringify(backupData)
      )

      return {
        success: true,
        message: 'クラウドバックアップが完了しました'
      }
    } catch (error: any) {
      console.error('Cloud backup failed:', error)
      return {
        success: false,
        message: error.message || 'クラウドバックアップに失敗しました'
      }
    }
  }

  /**
   * クラウドからバックアップを復元する
   */
  async downloadBackup(): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      if (!googleAuthService.isAuthenticated.value) {
        throw new Error('Google認証が必要です')
      }

      const backupFile = await googleDriveApiService.findBackupFile()
      if (!backupFile) {
        return {
          success: false,
          message: 'クラウドバックアップファイルが見つかりません'
        }
      }

      const content = await googleDriveApiService.downloadFile(backupFile.id)
      const backupData: CloudBackupData = JSON.parse(content)

      // チェックサムの検証
      const calculatedChecksum = this.calculateChecksum(backupData.portfolioData)
      if (calculatedChecksum !== backupData.checksum) {
        throw new Error('バックアップデータの整合性チェックに失敗しました')
      }

      return {
        success: true,
        data: backupData.portfolioData,
        message: 'クラウドバックアップの復元が完了しました'
      }
    } catch (error: any) {
      console.error('Cloud backup download failed:', error)
      return {
        success: false,
        message: error.message || 'クラウドバックアップの復元に失敗しました'
      }
    }
  }

  /**
   * バックアップファイルの存在確認
   */
  async checkBackupExists(): Promise<boolean> {
    try {
      if (!googleAuthService.isAuthenticated.value) {
        return false
      }

      const backupFile = await googleDriveApiService.findBackupFile()
      return !!backupFile && parseInt(backupFile.size?.toString() || '0') > 0
    } catch (error) {
      console.error('Failed to check backup existence:', error)
      return false
    }
  }

  /**
   * バックアップファイルの情報を取得
   */
  async getBackupInfo(): Promise<DriveFile | null> {
    try {
      if (!googleAuthService.isAuthenticated.value) {
        return null
      }

      return await googleDriveApiService.findBackupFile()
    } catch (error) {
      console.error('Failed to get backup info:', error)
      return null
    }
  }

  /**
   * バックアップファイルを削除
   */
  async deleteBackup(): Promise<{ success: boolean; message: string }> {
    try {
      if (!googleAuthService.isAuthenticated.value) {
        throw new Error('Google認証が必要です')
      }

      const backupFile = await googleDriveApiService.findBackupFile()
      if (!backupFile) {
        return {
          success: true,
          message: 'バックアップファイルは既に存在しません'
        }
      }

      await googleDriveApiService.deleteFile(backupFile.id)

      return {
        success: true,
        message: 'バックアップファイルを削除しました'
      }
    } catch (error: any) {
      console.error('Failed to delete backup:', error)
      return {
        success: false,
        message: error.message || 'バックアップファイルの削除に失敗しました'
      }
    }
  }

  /**
   * データのチェックサムを計算
   */
  private calculateChecksum(data: any): string {
    try {
      const jsonString = JSON.stringify(data)
      let hash = 0
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // 32bit整数に変換
      }
      return hash.toString(16)
    } catch (error) {
      console.error('Failed to calculate checksum:', error)
      return '0'
    }
  }
}

// シングルトンインスタンス
export const cloudBackupService = new CloudBackupService()