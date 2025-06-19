import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dbServiceV2, type Location, type LocationType } from '@/services/db-v2'
import { secureStorage } from '@/services/storage.service'

export const useLocationsStore = defineStore('locations', () => {
  const locations = ref<Location[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadLocations() {
    try {
      isLoading.value = true
      error.value = null
      locations.value = await secureStorage.getLocations()
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
      const location = await secureStorage.addCustomLocation(name)
      locations.value.push(location)
      return location
    } catch (err) {
      error.value = 'カスタム場所の追加に失敗しました'
      console.error('Failed to add custom location:', err)
      throw err
    }
  }

  function getLocationsByType(type: LocationType): Location[] {
    return locations.value.filter(location => location.type === type)
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