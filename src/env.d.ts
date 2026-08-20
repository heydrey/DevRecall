/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_TELEGRAM_MODE?: 'auto' | 'disabled'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

interface TelegramWebAppInsets {
  top: number
  bottom: number
  left: number
  right: number
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: { user?: TelegramWebAppUser }
  colorScheme: 'light' | 'dark'
  platform: string
  viewportHeight: number
  viewportStableHeight: number
  safeAreaInset?: TelegramWebAppInsets
  contentSafeAreaInset?: TelegramWebAppInsets
  ready(): void
  expand(): void
  onEvent(event: string, callback: () => void): void
  offEvent(event: string, callback: () => void): void
  setHeaderColor?(color: string): void
  setBackgroundColor?(color: string): void
  disableVerticalSwipes?(): void
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp }
}
