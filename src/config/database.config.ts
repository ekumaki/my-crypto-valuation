// データベース設定

export const DATABASE_CONFIG = {
  name: 'cryptoPortfolioV2',
  version: 1,
  
  // テーブル定義
  stores: {
    locations: 'id, name, type, isCustom',
    holdings: 'id, locationId, symbol, quantity, createdAt, updatedAt',
    prices: '[symbol+date], priceJpy, fetchedAt',
    tokens: '&symbol, name, id'
  },
  
  // データ保持期間
  retention: {
    prices: 30 * 24 * 60 * 60 * 1000, // 30日
    debugLogs: 7 * 24 * 60 * 60 * 1000, // 7日
  },
  
  // パフォーマンス設定
  performance: {
    batchSize: 100,
    maxConcurrentOperations: 5,
    indexedDBTimeout: 5000
  }
} as const