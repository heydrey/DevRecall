function webApp(): TelegramWebApp | null {
  if (import.meta.env.VITE_TELEGRAM_MODE === 'disabled') return null
  return window.Telegram?.WebApp ?? null
}

function setInset(prefix: string, inset?: TelegramWebAppInsets): void {
  if (!inset) return
  const root = document.documentElement
  root.style.setProperty(`--${prefix}-top`, `${inset.top}px`)
  root.style.setProperty(`--${prefix}-bottom`, `${inset.bottom}px`)
  root.style.setProperty(`--${prefix}-left`, `${inset.left}px`)
  root.style.setProperty(`--${prefix}-right`, `${inset.right}px`)
}

function applyTelegramLayout(app: TelegramWebApp): void {
  const root = document.documentElement
  root.dataset.telegram = 'true'
  root.dataset.telegramTheme = app.colorScheme
  root.style.setProperty('--tg-viewport-height', `${app.viewportHeight}px`)
  root.style.setProperty('--tg-viewport-stable-height', `${app.viewportStableHeight}px`)
  setInset('tg-safe-area', app.safeAreaInset)
  setInset('tg-content-safe-area', app.contentSafeAreaInset)
}

export function getTelegramWebApp(): TelegramWebApp | null {
  const app = webApp()
  return app?.initData ? app : null
}

export function bootstrapTelegramWebApp(): () => void {
  const app = getTelegramWebApp()
  if (!app) return () => undefined

  const updateLayout = () => applyTelegramLayout(app)
  updateLayout()
  app.onEvent('viewportChanged', updateLayout)
  app.onEvent('safeAreaChanged', updateLayout)
  app.onEvent('contentSafeAreaChanged', updateLayout)
  app.onEvent('themeChanged', updateLayout)
  app.expand()
  app.disableVerticalSwipes?.()
  app.ready()

  return () => {
    app.offEvent('viewportChanged', updateLayout)
    app.offEvent('safeAreaChanged', updateLayout)
    app.offEvent('contentSafeAreaChanged', updateLayout)
    app.offEvent('themeChanged', updateLayout)
  }
}
