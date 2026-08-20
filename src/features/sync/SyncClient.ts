import type { SyncRequest, SyncResponse } from './types'

export interface SyncClient {
  sync(request: SyncRequest, telegramInitData: string): Promise<SyncResponse>
}

export class SyncDisabledError extends Error {
  constructor() {
    super('Синхронизация пока не подключена.')
    this.name = 'SyncDisabledError'
  }
}
