// データベース関連の型定義

export type LocationType = 'domestic_cex' | 'global_cex' | 'sw_wallet' | 'hw_wallet' | 'custom'

export interface Location {
  id: string
  name: string
  type: LocationType
  isCustom: boolean
}

export interface Holding {
  id: string
  locationId: string
  symbol: string
  quantity: number
  note?: string
  createdAt: number
  updatedAt: number
}

export interface Price {
  symbol: string
  date: string
  priceJpy: number
  fxRate?: number
  fetchedAt: number
}

export interface Token {
  symbol: string
  name: string
  id: string
  iconUrl?: string
}

// 集計データ用の型
export interface AggregatedHolding {
  symbol: string
  totalQuantity: number
  locations: Array<{
    id: string
    name: string
    quantity: number
    note?: string
  }>
}