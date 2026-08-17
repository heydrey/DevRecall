import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Card } from '../content/types'
import type {
  CardProgress,
  ProgressSnapshot,
  ReviewEvent,
  ReviewRating,
  UserSettings,
} from './types'

const STORAGE_KEY = 'devrecall:v1'

const defaultSettings: UserSettings = {
  dailyNewCards: 20,
  dailyReviewLimit: 100,
  theme: 'system',
  preferredLevel: 'all',
}

function createEmptySnapshot(): ProgressSnapshot {
  return {
    version: 1,
    progress: {},
    reviewEvents: [],
    settings: { ...defaultSettings },
  }
}

function loadSnapshot(): ProgressSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptySnapshot()
    const parsed = JSON.parse(raw) as Partial<ProgressSnapshot>
    return {
      version: 1,
      progress: parsed.progress ?? {},
      reviewEvents: parsed.reviewEvents ?? [],
      settings: { ...defaultSettings, ...parsed.settings },
    }
  } catch {
    return createEmptySnapshot()
  }
}

function nextInterval(previous: number, rating: ReviewRating): number {
  if (rating === 'again') return 1
  if (rating === 'hard') return Math.max(1, Math.round(previous * 1.5))
  if (rating === 'good') return Math.max(3, Math.round(previous * 2.5))
  return Math.max(7, Math.round(previous * 4))
}

function addDays(date: Date, days: number): string {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString()
}

export const useProgressStore = defineStore('progress', () => {
  const initial = loadSnapshot()
  const progress = ref<Record<string, CardProgress>>(initial.progress)
  const reviewEvents = ref<ReviewEvent[]>(initial.reviewEvents)
  const settings = ref<UserSettings>(initial.settings)

  const snapshot = computed<ProgressSnapshot>(() => ({
    version: 1,
    progress: progress.value,
    reviewEvents: reviewEvents.value,
    settings: settings.value,
  }))

  watch(
    snapshot,
    (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)),
    { deep: true },
  )

  function getCardProgress(cardId: string): CardProgress {
    return progress.value[cardId] ?? {
      cardId,
      status: 'new',
      repetitions: 0,
      correctCount: 0,
      wrongCount: 0,
      currentIntervalDays: 0,
      favorite: false,
    }
  }

  function recordReview(cardId: string, rating: ReviewRating): void {
    const previous = getCardProgress(cardId)
    const reviewedAt = new Date()
    const interval = nextInterval(previous.currentIntervalDays || 1, rating)
    const isCorrect = rating === 'good' || rating === 'easy'
    const repetitions = previous.repetitions + 1
    const status = interval >= 21 && isCorrect ? 'mastered' : repetitions === 1 ? 'learning' : 'review'

    progress.value = {
      ...progress.value,
      [cardId]: {
        ...previous,
        status,
        repetitions,
        correctCount: previous.correctCount + (isCorrect ? 1 : 0),
        wrongCount: previous.wrongCount + (rating === 'again' ? 1 : 0),
        currentIntervalDays: interval,
        lastRating: rating,
        lastReviewedAt: reviewedAt.toISOString(),
        nextReviewAt: addDays(reviewedAt, interval),
      },
    }

    reviewEvents.value = [
      ...reviewEvents.value,
      {
        id: crypto.randomUUID(),
        cardId,
        rating,
        reviewedAt: reviewedAt.toISOString(),
        previousIntervalDays: previous.currentIntervalDays,
        nextIntervalDays: interval,
      },
    ]
  }

  function toggleFavorite(cardId: string): boolean {
    const previous = getCardProgress(cardId)
    const favorite = !previous.favorite
    progress.value = {
      ...progress.value,
      [cardId]: { ...previous, favorite },
    }
    return favorite
  }

  function isFavorite(cardId: string): boolean {
    return Boolean(progress.value[cardId]?.favorite)
  }

  function isDue(cardId: string, now = new Date()): boolean {
    const value = progress.value[cardId]
    return Boolean(value?.nextReviewAt && new Date(value.nextReviewAt) <= now)
  }

  function difficultCards(cards: Card[]): Card[] {
    return cards.filter((card) => {
      const value = progress.value[card.id]
      return value && (value.wrongCount >= 2 || value.lastRating === 'again' || value.lastRating === 'hard')
    })
  }

  function updateSettings(patch: Partial<UserSettings>): void {
    settings.value = { ...settings.value, ...patch }
  }

  function resetProgress(): void {
    const empty = createEmptySnapshot()
    progress.value = empty.progress
    reviewEvents.value = empty.reviewEvents
    settings.value = empty.settings
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    progress,
    reviewEvents,
    settings,
    getCardProgress,
    recordReview,
    toggleFavorite,
    isFavorite,
    isDue,
    difficultCards,
    updateSettings,
    resetProgress,
  }
})
