import { getTelegramWebApp } from '../telegram/telegramWebApp'
import type { AppUser, UserIdentityProvider } from './types'

const VERIFIED_USER_KEY = 'devrecall:verified-telegram-user:v1'

function cachedVerifiedUser(): AppUser | null {
  try {
    const value = JSON.parse(localStorage.getItem(VERIFIED_USER_KEY) ?? '') as Partial<AppUser>
    if (value.mode !== 'telegram' || typeof value.id !== 'string' || typeof value.telegramId !== 'string' || typeof value.displayName !== 'string') return null
    const currentTelegramId = getTelegramWebApp()?.initDataUnsafe.user?.id
    if (currentTelegramId && value.telegramId !== String(currentTelegramId)) return null
    return value as AppUser
  } catch {
    return null
  }
}

export class TelegramIdentityProvider implements UserIdentityProvider {
  isAvailable(): boolean {
    return Boolean(getTelegramWebApp()?.initData)
  }

  async getUser(): Promise<AppUser> {
    const app = getTelegramWebApp()
    if (!app) throw new Error('Откройте приложение в Telegram.')

    if (!navigator.onLine) {
      const cached = cachedVerifiedUser()
      if (cached) return cached
      throw new Error('Для первого входа нужен интернет. Затем DevRecall сможет работать офлайн.')
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/auth/telegram`, {
          method: 'POST',
          headers: { Authorization: `tma ${app.initData}` },
          signal: controller.signal,
        })
      } catch (error) {
        const cached = cachedVerifiedUser()
        if (cached) return cached
        throw error
      }
      const body = await response.json() as { user?: AppUser; error?: string }
      if (!response.ok || !body.user) {
        throw new Error(body.error ?? 'Не удалось подтвердить вход через Telegram.')
      }
      localStorage.setItem(VERIFIED_USER_KEY, JSON.stringify(body.user))
      return body.user
    } finally {
      window.clearTimeout(timeout)
    }
  }

  getTelegramInitData(): string | null {
    return getTelegramWebApp()?.initData || null
  }
}
