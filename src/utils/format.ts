export function formatCurrency(amount: number, currency = 'JPY'): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Math.floor(amount * 100) / 100)
}

export function formatNumber(num: number, decimals = 8): string {
  if (num === 0) return '0'
  
  // For very small numbers, show more decimals
  if (num < 0.001) {
    return num.toFixed(8).replace(/\.?0+$/, '')
  }
  
  // For larger numbers, show fewer decimals
  if (num >= 1) {
    return num.toFixed(Math.min(decimals, 4)).replace(/\.?0+$/, '')
  }
  
  return num.toFixed(decimals).replace(/\.?0+$/, '')
}

export function formatPercentage(num: number, decimals = 2): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num / 100)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B'
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M'
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K'
  }
  return num.toString()
}