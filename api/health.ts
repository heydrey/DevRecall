import { allowOnly, type ApiRequest, type ApiResponse } from './_lib/http.js'
import { database } from './_lib/database.js'

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

async function databaseStatus(): Promise<{ configured: boolean; ok: boolean; code?: string; message?: string }> {
  const configured = Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  if (!configured) return { configured: false, ok: false, message: 'Не заданы SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY.' }
  try {
    const client = database()
    const { error } = await client.from('users').select('id').limit(1)
    if (error) return { configured: true, ok: false, code: error.code, message: error.message }
    return { configured: true, ok: true }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка базы.',
    }
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (!allowOnly(request, response, 'GET')) return
  const [telegram, database] = await Promise.all([telegramStatus(), databaseStatus()])
  const ok = telegram.ok && database.ok
  response.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', telegram, database, time: new Date().toISOString() })
}
