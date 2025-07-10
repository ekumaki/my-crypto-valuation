// アプリケーション定数

// セッション設定
export const SESSION_CONFIG = {
  timeout: 30 * 60 * 1000, // 30分
  warningTime: 5 * 60 * 1000, // 5分前に警告
  extendTime: 10 * 60 * 1000, // 10分延長
  maxExtensions: 3
} as const

// ロケーション設定
export const LOCATION_CONFIG = {
  types: {
    domestic_cex: '国内取引所',
    global_cex: '海外取引所',
    sw_wallet: 'ソフトウェアウォレット',
    hw_wallet: 'ハードウェアウォレット',
    custom: 'カスタム'
  },
  
  defaultLocations: [
    { name: 'Coincheck', type: 'domestic_cex' },
    { name: 'bitFlyer', type: 'domestic_cex' },
    { name: 'GMOコイン', type: 'domestic_cex' },
    { name: 'Binance', type: 'global_cex' },
    { name: 'MetaMask', type: 'sw_wallet' },
    { name: 'Ledger', type: 'hw_wallet' }
  ]
} as const

// API設定
export const API_CONFIG = {
  coingecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
    rateLimit: 1000, // 1秒間隔
    timeout: 10000, // 10秒
    retryAttempts: 3
  }
} as const

// UI設定
export const UI_CONFIG = {
  toast: {
    duration: 3000, // 3秒
    position: 'top-right'
  },
  
  table: {
    defaultPageSize: 20,
    maxPageSize: 100
  },
  
  modal: {
    closeOnEscape: true,
    closeOnBackdrop: true
  }
} as const

// バリデーション設定
export const VALIDATION_CONFIG = {
  quantity: {
    min: 0.00000001,
    max: 999999999999,
    precision: 8
  },
  
  symbol: {
    minLength: 1,
    maxLength: 10,
    pattern: /^[A-Z0-9]+$/
  },
  
  note: {
    maxLength: 500
  }
} as const