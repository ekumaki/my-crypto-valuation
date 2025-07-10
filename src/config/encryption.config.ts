// 暗号化設定

export const ENCRYPTION_CONFIG = {
  // アルゴリズム設定
  algorithm: 'AES-256-GCM',
  keyDerivation: {
    algorithm: 'PBKDF2',
    iterations: 100000,
    saltLength: 16,
    keyLength: 32
  },
  
  // IV設定
  ivLength: 12,
  
  // タグ設定
  tagLength: 16,
  
  // パスワード要件
  password: {
    minLength: 8,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false
  },
  
  // キャッシュ設定
  cache: {
    keyTtl: 60 * 60 * 1000, // 1時間
    maxCacheSize: 10
  }
} as const