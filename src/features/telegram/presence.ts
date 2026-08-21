import { getTelegramWebApp } from './telegramWebApp'

let timer: number | undefined

async function ping(): Promise<void> {
  const initData = getTelegramWebApp()?.initData
  if (!initData || !navigator.onLine) return
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
  try {
    await globalThis.fetch(`${baseUrl}/api/presence`, {
      method: 'POST',
      headers: { Authorization: `tma ${initData}` },
    })
  } catch {
    // Сигнал активности не должен мешать обучению и офлайн-режиму.
  }
}

export function startPresenceTracking(): () => void {
  if (!getTelegramWebApp()) return () => undefined
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') void ping() }
  void ping()
  timer = window.setInterval(() => void ping(), 120_000)
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
