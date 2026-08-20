import type { CardLevel } from '../content/types'
import type { FsrsCardData } from '../scheduling/fsrsScheduler'

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'
export type CardStatus = 'new' | 'learning' | 'review' | 'mastered'

export interface CardProgress {
  cardId: string
  status: CardStatus
  repetitions: number
  correctCount: number
  wrongCount: number
  currentIntervalDays: number
  lastRating?: ReviewRating
  lastReviewedAt?: string
  nextReviewAt?: string
  favorite: boolean
  fsrs?: FsrsCardData
}

export interface ReviewEvent {
  id: string
  cardId: string
  rating: ReviewRating
  reviewedAt: string
  previousIntervalDays: number
  nextIntervalDays: number
}

export interface UserSettings {
  dailyNewCards: number
  dailyReviewLimit: number
  theme: 'system' | 'light' | 'dark'
  preferredLevel: CardLevel | 'all'
  sessionMinutes: 5 | 10 | 20 | 0
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  dailyNewCards: 20,
  dailyReviewLimit: 100,
  theme: 'system',
  preferredLevel: 'all',
  sessionMinutes: 10,
}

export interface ProgressSnapshotV1 {
  version: 1
  progress: Record<string, CardProgress>
  reviewEvents: ReviewEvent[]
  settings: Omit<UserSettings, 'sessionMinutes'> & { sessionMinutes?: UserSettings['sessionMinutes'] }
}

export interface ProgressSnapshotV2 {
  version: 2
  progress: Record<string, CardProgress>
  reviewEvents: ReviewEvent[]
  settings: UserSettings
}

export type ProgressSnapshot = ProgressSnapshotV2

export interface MigrationResult {
  snapshot: ProgressSnapshotV2
  migrated: boolean
  sourceBackup?: string
}
