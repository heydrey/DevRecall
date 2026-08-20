import { allowOnly, type ApiRequest, type ApiResponse } from './_lib/http.js'

interface TelegramGetMeResponse {
  ok: boolean
  result?: { username?: string }
}

async function telegramStatus(): Promise<{ configured: boolean; ok: boolean; username?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return { configured: false, ok: false }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const result = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: controller.signal,
    })
    const body = await result.json() as TelegramGetMeResponse
    return { configured: true, ok: result.ok && body.ok, username: body.result?.username }
  } catch {
    return { configured: true, ok: false }
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (!allowOnly(request, response, 'GET')) return
  const telegram = await telegramStatus()
  response.status(telegram.ok ? 200 : 503).json({ status: telegram.ok ? 'ok' : 'degraded', telegram, time: new Date().toISOString() })
}
