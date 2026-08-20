import type { AppUser } from '../profile/types'
import type { CardProgress, ReviewRating, UserSettings } from '../progress/types'

interface BaseSyncMutation {
  id: string
  createdAt: string
}

export interface ReviewSyncMutation extends BaseSyncMutation {
  type: 'review.recorded'
  cardId: string
  rating: ReviewRating
  reviewedAt: string
}

export interface FavoriteSyncMutation extends BaseSyncMutation {
  type: 'favorite.changed'
  cardId: string
  favorite: boolean
}

export interface SettingsSyncMutation extends BaseSyncMutation {
  type: 'settings.updated'
  patch: Partial<UserSettings>
}

export type SyncMutation = ReviewSyncMutation | FavoriteSyncMutation | SettingsSyncMutation

export interface SyncRequest {
  deviceId: string
  platform?: string
  cursor?: string
  mutations: SyncMutation[]
}

export interface SyncResponse {
  acknowledgedMutationIds: string[]
  cursor: string
  user: AppUser
  changedProgress: Record<string, CardProgress>
  reviewEvents?: Array<{
    id: string
    cardId: string
    rating: ReviewRating
    reviewedAt: string
    previousIntervalDays: number
    nextIntervalDays: number
  }>
  settings?: UserSettings
  serverTime: string
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error'
