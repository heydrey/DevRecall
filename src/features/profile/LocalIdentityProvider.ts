import type { AppUser, UserIdentityProvider } from './types'

const LOCAL_USER_KEY = 'devrecall:local-user-id:v1'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export class LocalIdentityProvider implements UserIdentityProvider {
  constructor(private readonly storage: StorageLike = localStorage) {}

  async getUser(): Promise<AppUser> {
    let id = this.storage.getItem(LOCAL_USER_KEY)
    if (!id) {
      id = crypto.randomUUID()
      this.storage.setItem(LOCAL_USER_KEY, id)
    }
    return { id, displayName: 'Локальный профиль', mode: 'local' }
  }

  getTelegramInitData(): string | null {
    return null
  }
}
