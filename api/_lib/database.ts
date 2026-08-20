import { createClient } from '@supabase/supabase-js'
import { ApiError } from './http.js'
import type { VerifiedTelegramUser } from './telegram.js'

export function database() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new ApiError(500, 'База данных не настроена на сервере.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function resolveUser(telegramUser: VerifiedTelegramUser) {
  const client = database()
  const displayName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ')
  const { data, error } = await client.from('users').upsert({
    telegram_id: telegramUser.id,
    display_name: displayName,
    photo_url: telegramUser.photo_url ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'telegram_id' }).select('id, telegram_id, display_name, photo_url').single()

  if (error || !data) throw new ApiError(500, 'Не удалось создать профиль Telegram.')
  return { client, row: data }
}

export function publicUser(row: { id: string; telegram_id: number; display_name: string; photo_url: string | null }) {
  return {
    id: row.id,
    telegramId: String(row.telegram_id),
    displayName: row.display_name,
    photoUrl: row.photo_url ?? undefined,
    mode: 'telegram' as const,
  }
}
