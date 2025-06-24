import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dbServiceV2, dbV2, type Location, type LocationType } from '@/services/db-v2'

export const useLocationsStore = defineStore('locations', () => {
  const locations = ref<Location[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function ensureInitialLocationsExist() {
    console.log('[DEBUG] ensureInitialLocationsExist - checking if initial data exists...')
    
    // Check if locations exist
    const locationCount = await dbV2.locations.count()
    console.log('[DEBUG] ensureInitialLocationsExist - location count:', locationCount)
    
    if (locationCount === 0) {
      console.log('[DEBUG] ensureInitialLocationsExist - populating locations...')
      const presetLocations = [
        // Domestic CEX
        { id: 'bitflyer', name: 'bitFlyer', type: 'domestic_cex' as const, isCustom: false },
        { id: 'coincheck', name: 'Coincheck', type: 'domestic_cex' as const, isCustom: false },
        { id: 'bitbank', name: 'bitbank', type: 'domestic_cex' as const, isCustom: false },
        { id: 'gmo-coin', name: 'GMO Coin', type: 'domestic_cex' as const, isCustom: false },
        { id: 'sbi-vc', name: 'SBI VC Trade', type: 'domestic_cex' as const, isCustom: false },
        
        // Global CEX
        { id: 'binance', name: 'Binance', type: 'global_cex' as const, isCustom: false },
        { id: 'coinbase', name: 'Coinbase', type: 'global_cex' as const, isCustom: false },
        { id: 'kraken', name: 'Kraken', type: 'global_cex' as const, isCustom: false },
        { id: 'bybit', name: 'Bybit', type: 'global_cex' as const, isCustom: false },
        { id: 'okx', name: 'OKX', type: 'global_cex' as const, isCustom: false },
        
        // Software Wallets
        { id: 'metamask', name: 'MetaMask', type: 'sw_wallet' as const, isCustom: false },
        { id: 'trust-wallet', name: 'Trust Wallet', type: 'sw_wallet' as const, isCustom: false },
        { id: 'phantom', name: 'Phantom', type: 'sw_wallet' as const, isCustom: false },
        { id: 'keplr', name: 'Keplr', type: 'sw_wallet' as const, isCustom: false },
        { id: 'backpack', name: 'Backpack', type: 'sw_wallet' as const, isCustom: false },
        
        // Hardware Wallets
        { id: 'ledger', name: 'Ledger', type: 'hw_wallet' as const, isCustom: false },
        { id: 'trezor', name: 'Trezor', type: 'hw_wallet' as const, isCustom: false }
      ]
      
      try {
        await dbV2.locations.bulkAdd(presetLocations)
        console.log('[DEBUG] ensureInitialLocationsExist - locations populated successfully')
      } catch (error) {
        console.error('[DEBUG] ensureInitialLocationsExist - failed to populate locations:', error)
      }
    }
  }

  async function loadLocations() {
    try {
      isLoading.value = true
      error.value = null
      
      console.log('[DEBUG] loadLocations - starting to load locations...')
      
      // Check database state first
      const dbLocationCount = await dbV2.locations.count()
      console.log('[DEBUG] loadLocations - database location count:', dbLocationCount)
      
      if (dbLocationCount === 0) {
        console.log('[DEBUG] loadLocations - no locations found, ensuring initial data exists...')
        await ensureInitialLocationsExist()
      }
      
      locations.value = await dbServiceV2.getLocations()
      console.log('[DEBUG] loadLocations - loaded locations:', locations.value.length)
      console.log('[DEBUG] loadLocations - location details:', locations.value.map(l => ({ id: l.id, name: l.name, type: l.type })))
    } catch (err) {
      error.value = '場所の読み込みに失敗しました'
      console.error('Failed to load locations:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function addCustomLocation(name: string) {
    try {
      error.value = null
      const location = await dbServiceV2.addCustomLocation(name)
      locations.value.push(location)
      console.log('[DEBUG] Added custom location:', location)
      return location
    } catch (err) {
      error.value = 'カスタム場所の追加に失敗しました'
      console.error('Failed to add custom location:', err)
      throw err
    }
  }

  function getLocationsByType(type: LocationType): Location[] {
    const filtered = locations.value.filter(location => location.type === type)
    console.log(`[DEBUG] getLocationsByType(${type}):`, filtered.length, 'locations')
    return filtered
  }

  function getLocation(id: string): Location | undefined {
    return locations.value.find(location => location.id === id)
  }

  function clearError() {
    error.value = null
  }

  return {
    locations,
    isLoading,
    error,
    loadLocations,
    addCustomLocation,
    getLocationsByType,
    getLocation,
    clearError
  }
})