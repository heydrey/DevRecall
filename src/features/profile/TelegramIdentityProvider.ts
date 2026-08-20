import { getTelegramWebApp } from '../telegram/telegramWebApp'
import type { AppUser, UserIdentityProvider } from './types'

export class TelegramIdentityProvider implements UserIdentityProvider {
  isAvailable(): boolean {
    return Boolean(getTelegramWebApp()?.initData)
  }

  async getUser(): Promise<AppUser> {
    const app = getTelegramWebApp()
    const telegramUser = app?.initDataUnsafe.user
    if (!app || !telegramUser) throw new Error('Telegram не передал данные пользователя.')

    return {
      id: `telegram:${telegramUser.id}`,
      telegramId: String(telegramUser.id),
      displayName: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
      photoUrl: telegramUser.photo_url,
      mode: 'telegram',
    }
  }

  getTelegramInitData(): string | null {
    return getTelegramWebApp()?.initData || null
  }
}
