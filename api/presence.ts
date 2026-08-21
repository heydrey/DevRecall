import { publicUser, resolveUser } from './_lib/database.js'
import { allowOnly, authorizationInitData, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js'
import { verifyTelegramInitData } from './_lib/telegram.js'

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (!allowOnly(request, response, 'POST')) return
  try {
    const telegramUser = verifyTelegramInitData(authorizationInitData(request))
    const { row } = await resolveUser(telegramUser)
    response.status(200).json({ user: publicUser(row), seenAt: new Date().toISOString() })
  } catch (error) {
    sendError(response, error)
  }
}
