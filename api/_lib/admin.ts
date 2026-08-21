import { ApiError } from './http.js'

function adminIds(): Set<number> {
  return new Set(
    (process.env.ADMIN_TELEGRAM_USER_IDS ?? '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  )
}

export function assertAdmin(telegramUserId: number): void {
  const ids = adminIds()
  if (!ids.size) throw new ApiError(503, 'Администратор пока не настроен.')
  if (!ids.has(telegramUserId)) throw new ApiError(403, 'У вас нет доступа к панели администратора.')
}
