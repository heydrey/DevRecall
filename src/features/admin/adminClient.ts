import { useProfileStore } from '../profile/profileStore'

export interface AdminUserMetric {
  telegramId: string
  displayName: string
  joinedAt: string
  lastSeenAt: string
  onlineNow: boolean
  deviceCount: number
  reviewCount: number
  studiedCards: number
  aiRequests: number
}

export interface AdminOverview {
  serverTime: string
  metrics: {
    totalUsers: number
    onlineNow: number
    active24h: number
    active7d: number
    reviews24h: number
    reviews7d: number
    cardsStarted: number
  }
  ai: {
    trackingAvailable: boolean
    trackingError?: string
    provider: string
    model: string
    requestsToday: number
    dailyRequestLimit: number
    estimatedRequestsRemaining: number
    tokensToday: number
    dailyTokenLimit: number
    estimatedTokensRemaining: number
    latestRateLimits: Record<string, unknown>
  }
  users: AdminUserMetric[]
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const initData = useProfileStore().getTelegramInitData()
  if (!initData) throw new Error('Админ-панель доступна только внутри Telegram.')
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
  const response = await globalThis.fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Authorization: `tma ${initData}` },
  })
  const body = await response.json() as AdminOverview & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Не удалось загрузить админ-панель.')
  return body
}
