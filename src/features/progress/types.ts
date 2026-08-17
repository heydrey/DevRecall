import type { CardLevel } from '../content/types'

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
}

export interface ProgressSnapshot {
  version: 1
  progress: Record<string, CardProgress>
  reviewEvents: ReviewEvent[]
  settings: UserSettings
}
