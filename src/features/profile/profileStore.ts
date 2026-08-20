import { ref } from 'vue'
import { defineStore } from 'pinia'
import { LocalIdentityProvider } from './LocalIdentityProvider'
import { TelegramIdentityProvider } from './TelegramIdentityProvider'
import type { AppUser } from './types'

const telegramIdentityProvider = new TelegramIdentityProvider()
const identityProvider = telegramIdentityProvider.isAvailable()
  ? telegramIdentityProvider
  : new LocalIdentityProvider()

export const useProfileStore = defineStore('profile', () => {
  const user = ref<AppUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    if (user.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      user.value = await identityProvider.getUser()
    } catch {
      error.value = 'Не удалось загрузить профиль.'
    } finally {
      loading.value = false
    }
  }

  function setUser(nextUser: AppUser): void {
    user.value = nextUser
  }

  function getTelegramInitData(): string | null {
    return identityProvider.getTelegramInitData()
  }

  return { user, loading, error, load, setUser, getTelegramInitData }
})
