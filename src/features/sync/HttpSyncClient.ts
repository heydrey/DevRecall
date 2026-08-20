import type { SyncClient } from './SyncClient'
import type { SyncRequest, SyncResponse } from './types'

function isSyncResponse(value: unknown): value is SyncResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<SyncResponse>
  return Array.isArray(response.acknowledgedMutationIds)
    && typeof response.cursor === 'string'
    && typeof response.serverTime === 'string'
    && Boolean(response.user && typeof response.user === 'object')
    && Boolean(response.changedProgress && typeof response.changedProgress === 'object')
}

export class HttpSyncClient implements SyncClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async sync(request: SyncRequest, telegramInitData: string): Promise<SyncResponse> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `tma ${telegramInitData}` },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Ошибка синхронизации: HTTP ${response.status}`)
      const value = await response.json() as unknown
      if (!isSyncResponse(value)) throw new Error('Сервер вернул некорректный ответ синхронизации.')
      return value
    } finally {
      window.clearTimeout(timeout)
    }
  }
}
