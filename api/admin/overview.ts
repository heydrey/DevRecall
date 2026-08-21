import { assertAdmin } from '../_lib/admin.js'
import { resolveUser } from '../_lib/database.js'
import { ApiError, allowOnly, authorizationInitData, sendError, type ApiRequest, type ApiResponse } from '../_lib/http.js'
import { verifyTelegramInitData } from '../_lib/telegram.js'

interface UserRow {
  id: string
  telegram_id: number
  display_name: string
  created_at: string
  updated_at: string
}

interface DeviceRow { user_id: string; last_seen_at: string }
interface ReviewRow { user_id: string; reviewed_at: string }
interface ProgressRow { user_id: string; repetitions: number }
interface AiUsageRow {
  user_id: string
  provider: string
  model: string
  total_tokens: number
  rate_limits: Record<string, unknown> | null
  created_at: string
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function newer(left: string | undefined, right: string | undefined): string | undefined {
  if (!left) return right
  if (!right) return left
  return left > right ? left : right
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (!allowOnly(request, response, 'GET')) return
  try {
    const telegramUser = verifyTelegramInitData(authorizationInitData(request))
    assertAdmin(telegramUser.id)
    const { client } = await resolveUser(telegramUser)

    const [usersResult, devicesResult, reviewsResult, progressResult, aiResult] = await Promise.all([
      client.from('users').select('id, telegram_id, display_name, created_at, updated_at').order('created_at', { ascending: false }),
      client.from('devices').select('user_id, last_seen_at'),
      client.from('review_events').select('user_id, reviewed_at'),
      client.from('card_progress').select('user_id, repetitions'),
      client.from('ai_usage_events').select('user_id, provider, model, total_tokens, rate_limits, created_at').order('created_at', { ascending: false }),
    ])

    const requiredError = usersResult.error ?? devicesResult.error ?? reviewsResult.error ?? progressResult.error
    if (requiredError) throw new ApiError(500, `Не удалось получить метрики [${requiredError.code}]: ${requiredError.message}`)

    const users = (usersResult.data ?? []) as UserRow[]
    const devices = (devicesResult.data ?? []) as DeviceRow[]
    const reviews = (reviewsResult.data ?? []) as ReviewRow[]
    const progress = (progressResult.data ?? []) as ProgressRow[]
    const aiUsageAvailable = !aiResult.error
    const aiUsage = aiUsageAvailable ? (aiResult.data ?? []) as AiUsageRow[] : []
    const now = Date.now()
    const activeNowSince = now - 5 * 60_000
    const daySince = now - 24 * 60 * 60_000
    const weekSince = now - 7 * 24 * 60 * 60_000

    const lastSeenByUser = new Map<string, string>()
    const devicesByUser = new Map<string, number>()
    for (const device of devices) {
      lastSeenByUser.set(device.user_id, newer(lastSeenByUser.get(device.user_id), device.last_seen_at) ?? device.last_seen_at)
      devicesByUser.set(device.user_id, (devicesByUser.get(device.user_id) ?? 0) + 1)
    }

    const reviewsByUser = new Map<string, number>()
    for (const review of reviews) reviewsByUser.set(review.user_id, (reviewsByUser.get(review.user_id) ?? 0) + 1)
    const cardsByUser = new Map<string, number>()
    for (const card of progress) {
      if (card.repetitions > 0) cardsByUser.set(card.user_id, (cardsByUser.get(card.user_id) ?? 0) + 1)
    }
    const aiByUser = new Map<string, number>()
    for (const event of aiUsage) aiByUser.set(event.user_id, (aiByUser.get(event.user_id) ?? 0) + 1)

    const userMetrics = users.map((user) => {
      const lastSeenAt = newer(user.updated_at, lastSeenByUser.get(user.id)) ?? user.updated_at
      return {
        telegramId: String(user.telegram_id),
        displayName: user.display_name,
        joinedAt: user.created_at,
        lastSeenAt,
        onlineNow: Date.parse(lastSeenAt) >= activeNowSince,
        deviceCount: devicesByUser.get(user.id) ?? 0,
        reviewCount: reviewsByUser.get(user.id) ?? 0,
        studiedCards: cardsByUser.get(user.id) ?? 0,
        aiRequests: aiByUser.get(user.id) ?? 0,
      }
    }).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))

    const todayAi = aiUsage.filter((event) => Date.parse(event.created_at) >= daySince)
    const dailyRequestLimit = numberEnv('GROQ_DAILY_REQUEST_LIMIT', 1_000)
    const dailyTokenLimit = numberEnv('GROQ_DAILY_TOKEN_LIMIT', 200_000)
    const requestsToday = todayAi.length
    const tokensToday = todayAi.reduce((sum, event) => sum + Number(event.total_tokens || 0), 0)
    const latestAi = aiUsage[0]

    response.status(200).json({
      serverTime: new Date(now).toISOString(),
      metrics: {
        totalUsers: users.length,
        onlineNow: userMetrics.filter((user) => user.onlineNow).length,
        active24h: userMetrics.filter((user) => Date.parse(user.lastSeenAt) >= daySince).length,
        active7d: userMetrics.filter((user) => Date.parse(user.lastSeenAt) >= weekSince).length,
        reviews24h: reviews.filter((event) => Date.parse(event.reviewed_at) >= daySince).length,
        reviews7d: reviews.filter((event) => Date.parse(event.reviewed_at) >= weekSince).length,
        cardsStarted: progress.filter((card) => card.repetitions > 0).length,
      },
      ai: {
        trackingAvailable: aiUsageAvailable,
        trackingError: aiUsageAvailable ? undefined : 'Примените миграцию ai_usage_events в Supabase.',
        provider: latestAi?.provider ?? process.env.AI_PROVIDER?.trim() ?? 'groq',
        model: latestAi?.model ?? process.env.GROQ_MODEL?.trim() ?? process.env.GEMINI_MODEL?.trim() ?? 'не настроена',
        requestsToday,
        dailyRequestLimit,
        estimatedRequestsRemaining: Math.max(0, dailyRequestLimit - requestsToday),
        tokensToday,
        dailyTokenLimit,
        estimatedTokensRemaining: Math.max(0, dailyTokenLimit - tokensToday),
        latestRateLimits: latestAi?.rate_limits ?? {},
      },
      users: userMetrics,
    })
  } catch (error) {
    sendError(response, error)
  }
}
