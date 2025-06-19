import { googleAuthService } from './google-auth.service'
import { GOOGLE_DRIVE_CONFIG, SYNC_CONFIG, ERROR_MESSAGES } from '@/config/google-drive.config'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size: number
  parents?: string[]
}

export interface FileMetadata {
  name: string
  parents?: string[]
  mimeType?: string
}

export interface FileUploadOptions {
  data: string
  metadata: FileMetadata
  media?: {
    mimeType: string
    body: string
  }
}

class GoogleDriveApiService {
  private appFolderId: string | null = null

  constructor() {}

  private async ensureAuthenticated(): Promise<void> {
    if (!googleAuthService.isAuthenticated.value) {
      throw new Error('Not authenticated with Google')
    }
  }

  private async makeApiRequest(
    method: string,
    url: string,
    options: {
      headers?: Record<string, string>
      body?: string
    } = {}
  ): Promise<any> {
    await this.ensureAuthenticated()
    
    const token = googleAuthService.getAccessToken()
    if (!token) {
      throw new Error('No access token available')
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body
    })

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        const newToken = await googleAuthService.refreshToken()
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`
          const retryResponse = await fetch(url, {
            method,
            headers,
            body: options.body
          })
          if (!retryResponse.ok) {
            throw new Error(`API request failed: ${retryResponse.status}`)
          }
          return retryResponse.json()
        }
      }
      throw new Error(`API request failed: ${response.status}`)
    }

    return response.json()
  }

  private async getOrCreateAppFolder(): Promise<string> {
    if (this.appFolderId) {
      return this.appFolderId
    }

    try {
      // Search for existing app folder
      const searchResponse = await this.makeApiRequest(
        'GET',
        `https://www.googleapis.com/drive/v3/files?q=name='${GOOGLE_DRIVE_CONFIG.appFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      )

      if (searchResponse.files && searchResponse.files.length > 0) {
        this.appFolderId = searchResponse.files[0].id
        return this.appFolderId
      }

      // Create new app folder
      const createResponse = await this.makeApiRequest(
        'POST',
        'https://www.googleapis.com/drive/v3/files',
        {
          body: JSON.stringify({
            name: GOOGLE_DRIVE_CONFIG.appFolder,
            mimeType: 'application/vnd.google-apps.folder'
          })
        }
      )

      this.appFolderId = createResponse.id
      return this.appFolderId
    } catch (error) {
      console.error('Failed to get or create app folder:', error)
      throw new Error(ERROR_MESSAGES.UPLOAD_FAILED)
    }
  }

  async listFiles(folderId?: string): Promise<DriveFile[]> {
    try {
      const targetFolderId = folderId || await this.getOrCreateAppFolder()
      
      const response = await this.makeApiRequest(
        'GET',
        `https://www.googleapis.com/drive/v3/files?q='${targetFolderId}' in parents and trashed=false&fields=files(id,name,mimeType,modifiedTime,size,parents)`
      )

      return response.files || []
    } catch (error) {
      console.error('Failed to list files:', error)
      throw new Error(ERROR_MESSAGES.DOWNLOAD_FAILED)
    }
  }

  async getFile(fileId: string): Promise<DriveFile> {
    try {
      const response = await this.makeApiRequest(
        'GET',
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,parents`
      )

      return response
    } catch (error) {
      console.error('Failed to get file metadata:', error)
      throw new Error(ERROR_MESSAGES.DOWNLOAD_FAILED)
    }
  }

  async downloadFile(fileId: string): Promise<string> {
    try {
      await this.ensureAuthenticated()
      
      const token = googleAuthService.getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      return await response.text()
    } catch (error) {
      console.error('Failed to download file:', error)
      throw new Error(ERROR_MESSAGES.DOWNLOAD_FAILED)
    }
  }

  async uploadFile(options: FileUploadOptions): Promise<DriveFile> {
    try {
      const appFolderId = await this.getOrCreateAppFolder()
      
      // Ensure the file is placed in the app folder
      if (!options.metadata.parents) {
        options.metadata.parents = [appFolderId]
      }

      const boundary = '-------314159265358979323846'
      const delimiter = `\r\n--${boundary}\r\n`
      const close_delim = `\r\n--${boundary}--`

      let body = delimiter
      body += 'Content-Type: application/json\r\n\r\n'
      body += JSON.stringify(options.metadata) + delimiter
      body += `Content-Type: ${options.media?.mimeType || 'application/json'}\r\n\r\n`
      body += options.data
      body += close_delim

      const response = await this.makeApiRequest(
        'POST',
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,parents',
        {
          headers: {
            'Content-Type': `multipart/related; boundary="${boundary}"`
          },
          body
        }
      )

      return response
    } catch (error) {
      console.error('Failed to upload file:', error)
      throw new Error(ERROR_MESSAGES.UPLOAD_FAILED)
    }
  }

  async updateFile(fileId: string, data: string, metadata?: Partial<FileMetadata>): Promise<DriveFile> {
    try {
      const boundary = '-------314159265358979323846'
      const delimiter = `\r\n--${boundary}\r\n`
      const close_delim = `\r\n--${boundary}--`

      let body = ''
      
      if (metadata) {
        body += delimiter
        body += 'Content-Type: application/json\r\n\r\n'
        body += JSON.stringify(metadata)
      }
      
      body += delimiter
      body += 'Content-Type: application/json\r\n\r\n'
      body += data
      body += close_delim

      const response = await this.makeApiRequest(
        'PATCH',
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,parents`,
        {
          headers: {
            'Content-Type': `multipart/related; boundary="${boundary}"`
          },
          body
        }
      )

      return response
    } catch (error) {
      console.error('Failed to update file:', error)
      throw new Error(ERROR_MESSAGES.UPLOAD_FAILED)
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.makeApiRequest(
        'DELETE',
        `https://www.googleapis.com/drive/v3/files/${fileId}`
      )
    } catch (error) {
      console.error('Failed to delete file:', error)
      throw new Error('ファイルの削除に失敗しました')
    }
  }

  async findBackupFile(): Promise<DriveFile | null> {
    try {
      const appFolderId = await this.getOrCreateAppFolder()
      
      const response = await this.makeApiRequest(
        'GET',
        `https://www.googleapis.com/drive/v3/files?q=name='${GOOGLE_DRIVE_CONFIG.backupFileName}' and '${appFolderId}' in parents and trashed=false&fields=files(id,name,mimeType,modifiedTime,size,parents)&orderBy=modifiedTime desc`
      )

      return response.files && response.files.length > 0 ? response.files[0] : null
    } catch (error) {
      console.error('Failed to find backup file:', error)
      return null
    }
  }

  async getQuotaInfo(): Promise<{used: number, limit: number}> {
    try {
      const response = await this.makeApiRequest(
        'GET',
        'https://www.googleapis.com/drive/v3/about?fields=storageQuota'
      )

      const quota = response.storageQuota
      return {
        used: parseInt(quota.usage || '0'),
        limit: parseInt(quota.limit || '0')
      }
    } catch (error) {
      console.error('Failed to get quota info:', error)
      return { used: 0, limit: 0 }
    }
  }
}

// Create and export singleton instance
export const googleDriveApiService = new GoogleDriveApiService()
export default googleDriveApiService