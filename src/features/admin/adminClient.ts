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
  aiUses: number
  aiApiRequests: number
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
    usesToday: number
    requestsToday: number
    dailyRequestLimit: number
    estimatedRequestsRemaining: number
    tokensToday: number
    dailyTokenLimit: number
    estimatedTokensRemaining: number
    latestRateLimits: Record<string, unknown>
  }
  users: AdminUserMetric[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export async function fetchAdminOverview(page = 1, pageSize = 10): Promise<AdminOverview> {
  const initData = useProfileStore().getTelegramInitData()
  if (!initData) throw new Error('Админ-панель доступна только внутри Telegram.')
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const response = await globalThis.fetch(`${baseUrl}/api/admin/overview?${query}`, {
    headers: { Authorization: `tma ${initData}` },
  })
  const body = await response.json() as AdminOverview & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Не удалось загрузить админ-панель.')
  return body
}
