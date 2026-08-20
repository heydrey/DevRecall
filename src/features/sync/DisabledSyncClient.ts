import { SyncDisabledError, type SyncClient } from './SyncClient'
import type { SyncRequest, SyncResponse } from './types'

export class DisabledSyncClient implements SyncClient {
  async sync(_request: SyncRequest, _telegramInitData: string): Promise<SyncResponse> {
    throw new SyncDisabledError()
  }
}
