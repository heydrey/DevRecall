import { createHmac, timingSafeEqual } from 'node:crypto'
import { ApiError } from './http.js'

export interface VerifiedTelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

function requiredBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) throw new ApiError(500, 'Telegram не настроен на сервере.')
  return token
}

export function verifyTelegramInitData(rawInitData: string, now = Date.now()): VerifiedTelegramUser {
  if (!rawInitData || rawInitData.length > 16_384) throw new ApiError(401, 'Некорректные данные Telegram.')

  const params = new URLSearchParams(rawInitData)
  const receivedHash = params.get('hash')
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) throw new ApiError(401, 'Подпись Telegram отсутствует.')

  params.delete('hash')
  params.delete('signature')
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(requiredBotToken()).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest()
  const receivedBuffer = Buffer.from(receivedHash, 'hex')
  if (receivedBuffer.length !== expectedHash.length || !timingSafeEqual(receivedBuffer, expectedHash)) {
    throw new ApiError(401, 'Подпись Telegram недействительна.')
  }

  const authDate = Number(params.get('auth_date'))
  const maxAgeSeconds = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? 86_400)
  const ageSeconds = Math.floor(now / 1000) - authDate
  if (!Number.isFinite(authDate) || ageSeconds < -60 || ageSeconds > maxAgeSeconds) {
    throw new ApiError(401, 'Сессия Telegram устарела. Откройте приложение заново.')
  }

  try {
    const user = JSON.parse(params.get('user') ?? '') as Partial<VerifiedTelegramUser>
    if (!Number.isSafeInteger(user.id) || typeof user.first_name !== 'string' || !user.first_name.trim()) {
      throw new Error('invalid user')
    }
    return user as VerifiedTelegramUser
  } catch {
    throw new ApiError(401, 'Telegram не передал пользователя.')
  }
}
