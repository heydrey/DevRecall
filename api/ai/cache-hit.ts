import { resolveUser } from '../_lib/database.js'
import { ApiError, allowOnly, authorizationInitData, sendError, type ApiRequest, type ApiResponse } from '../_lib/http.js'
import { verifyTelegramInitData } from '../_lib/telegram.js'

function parseBody(body: unknown): { cardId: string; mode: 'simple' | 'deep' } {
  if (!body || typeof body !== 'object') throw new ApiError(422, 'Некорректные данные использования ИИ.')
  const value = body as Record<string, unknown>
  if (typeof value.cardId !== 'string' || !value.cardId || value.cardId.length > 160) throw new ApiError(422, 'Некорректная карточка.')
  if (value.mode !== 'simple' && value.mode !== 'deep') throw new ApiError(422, 'Некорректный режим объяснения.')
  return { cardId: value.cardId, mode: value.mode }
}

function aiConfiguration(): { provider: string; model: string } {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')
  const model = provider === 'gemini'
    ? process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite'
    : process.env.GROQ_MODEL?.trim() || 'qwen/qwen3.6-27b'
  return { provider, model }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (!allowOnly(request, response, 'POST')) return
  try {
    const body = parseBody(request.body)
    const telegramUser = verifyTelegramInitData(authorizationInitData(request))
    const { client, row: user } = await resolveUser(telegramUser)
    const ai = aiConfiguration()
    const { error } = await client.from('ai_usage_events').insert({
      user_id: user.id,
      provider: ai.provider,
      model: ai.model,
      mode: body.mode,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      rate_limits: { cacheHit: true, cardId: body.cardId },
    })
    if (error) throw new ApiError(500, `Не удалось записать использование ИИ [${error.code}].`)
    response.status(200).json({ recorded: true, cacheHit: true })
  } catch (error) {
    sendError(response, error)
  }
}
