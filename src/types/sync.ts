export interface SyncMetadata {
  isNew: boolean
  isModified: boolean
  isDeleted: boolean
  isSynced: boolean
  lastModified: Date
  lastSyncTime: Date | null
  version: number
  syncDisabled?: boolean
}

export interface HoldingWithMetadata {
  id?: number
  symbol: string
  quantity: number
  locationId: number
  note?: string
  metadata: SyncMetadata
}

export interface LocationWithMetadata {
  id: number
  name: string
  type: string
  metadata: SyncMetadata
}

export interface TokenWithMetadata {
  id?: number
  symbol: string
  name: string
  coingeckoId: string
  metadata: SyncMetadata
}

export interface UnsyncedDataDetail {
  type: 'holding' | 'location' | 'token'
  id: string
  name: string
  action: 'created' | 'updated' | 'deleted'
  lastModified: Date
}

export interface UnsyncedDataCount {
  holdings: number
  locations: number
  tokens: number
  total: number
} 