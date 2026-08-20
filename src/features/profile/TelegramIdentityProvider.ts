import { getTelegramWebApp } from '../telegram/telegramWebApp'
import type { AppUser, UserIdentityProvider } from './types'

export class TelegramIdentityProvider implements UserIdentityProvider {
  isAvailable(): boolean {
    return Boolean(getTelegramWebApp()?.initData)
  }

  async getUser(): Promise<AppUser> {
    const app = getTelegramWebApp()
    if (!app) throw new Error('Откройте приложение в Telegram.')

    const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(`${baseUrl}/api/auth/telegram`, {
        method: 'POST',
        headers: { Authorization: `tma ${app.initData}` },
        signal: controller.signal,
      })
      const body = await response.json() as { user?: AppUser; error?: string }
      if (!response.ok || !body.user) {
        throw new Error(body.error ?? 'Не удалось подтвердить вход через Telegram.')
      }
      return body.user
    } finally {
      window.clearTimeout(timeout)
    }
  }

  getTelegramInitData(): string | null {
    return getTelegramWebApp()?.initData || null
  }
}
