export interface AppUser {
  id: string
  telegramId?: string
  displayName: string
  photoUrl?: string
  mode: 'local' | 'telegram'
}

export interface UserIdentityProvider {
  getUser(): Promise<AppUser>
  getTelegramInitData(): string | null
}
