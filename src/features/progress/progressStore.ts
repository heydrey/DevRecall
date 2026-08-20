import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Card } from '../content/types'
import { createNewFsrsCard, fsrsDueAt, scheduleFsrsReview } from '../scheduling/fsrsScheduler'
import { LocalOutboxRepository } from '../sync/LocalOutboxRepository'
import type { SyncMutation } from '../sync/types'
import { createEmptyProgressSnapshot, LocalProgressRepository } from './LocalProgressRepository'
import type { ProgressBackupPayload } from './ProgressRepository'
import {
  type CardProgress,
  type ProgressSnapshot,
  type ReviewEvent,
  type ReviewRating,
  type UserSettings,
} from './types'

const PERSISTENCE_WARNING = 'Не удалось сохранить прогресс на устройстве. Текущая сессия продолжает работать.'
const progressRepository = new LocalProgressRepository()
const outboxRepository = new LocalOutboxRepository()

interface LoadedSnapshot {
  snapshot: ProgressSnapshot
  warning: string | null
}

function loadSnapshot(): LoadedSnapshot {
  try {
    return { snapshot: progressRepository.loadSync(), warning: null }
  } catch {
    return {
      snapshot: createEmptyProgressSnapshot(),
      warning: 'Не удалось обновить сохранённый прогресс. Старые данные оставлены на устройстве.',
    }
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export const useProgressStore = defineStore('progress', () => {
  const initial = loadSnapshot()
  const progress = ref<Record<string, CardProgress>>(initial.snapshot.progress)
  const reviewEvents = ref<ReviewEvent[]>(initial.snapshot.reviewEvents)
  const settings = ref<UserSettings>(initial.snapshot.settings)
  const persistenceWarning = ref<string | null>(initial.warning)
  const outboxWarning = ref<string | null>(null)
  const pendingSyncCount = ref(outboxRepository.list().length)

  const snapshot = computed<ProgressSnapshot>(() => ({
    version: 2,
    progress: progress.value,
    reviewEvents: reviewEvents.value,
    settings: settings.value,
  }))

  watch(snapshot, (value) => {
    try {
      progressRepository.saveSync(value)
    } catch {
      persistenceWarning.value = PERSISTENCE_WARNING
    }
  }, { deep: true })

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

  function queueMutation(mutation: SyncMutation): void {
    try {
      pendingSyncCount.value = outboxRepository.append(mutation).length
    } catch {
      outboxWarning.value = 'Прогресс сохранён, но изменение пока не добавлено в очередь синхронизации.'
    }
  }

  function recordReview(cardId: string, rating: ReviewRating): void {
    const previous = getCardProgress(cardId)
    const reviewedAt = new Date()
    const reviewedAtIso = reviewedAt.toISOString()
    const eventId = crypto.randomUUID()
    const scheduled = scheduleFsrsReview(previous.fsrs ?? createNewFsrsCard(reviewedAt), rating, reviewedAt)
    const isCorrect = rating === 'good' || rating === 'easy'
    const repetitions = previous.repetitions + 1
    const status = scheduled.nextScheduledDays >= 21 && isCorrect
      ? 'mastered'
      : repetitions === 1 ? 'learning' : 'review'

    progress.value = {
      ...progress.value,
      [cardId]: {
        ...previous,
        status,
        repetitions,
        correctCount: previous.correctCount + (isCorrect ? 1 : 0),
        wrongCount: previous.wrongCount + (rating === 'again' ? 1 : 0),
        currentIntervalDays: scheduled.nextScheduledDays,
        lastRating: rating,
        lastReviewedAt: reviewedAtIso,
        nextReviewAt: fsrsDueAt(scheduled.card),
        fsrs: scheduled.card,
      },
    }

    reviewEvents.value = [...reviewEvents.value, {
      id: eventId,
      cardId,
      rating,
      reviewedAt: reviewedAtIso,
      previousIntervalDays: scheduled.previousScheduledDays,
      nextIntervalDays: scheduled.nextScheduledDays,
    }]
    queueMutation({ id: eventId, type: 'review.recorded', createdAt: reviewedAtIso, cardId, rating, reviewedAt: reviewedAtIso })
  }

  function toggleFavorite(cardId: string): boolean {
    const previous = getCardProgress(cardId)
    const favorite = !previous.favorite
    progress.value = { ...progress.value, [cardId]: { ...previous, favorite } }
    const createdAt = new Date().toISOString()
    queueMutation({ id: crypto.randomUUID(), type: 'favorite.changed', createdAt, cardId, favorite })
    return favorite
  }

  function isFavorite(cardId: string): boolean {
    return Boolean(progress.value[cardId]?.favorite)
  }

  function isDue(cardId: string, now = new Date()): boolean {
    const dueAt = progress.value[cardId]?.fsrs?.due ?? progress.value[cardId]?.nextReviewAt
    return Boolean(dueAt && new Date(dueAt) <= now)
  }

  function difficultCards(cards: Card[]): Card[] {
    return cards.filter((card) => {
      const value = progress.value[card.id]
      return value && (
        (value.fsrs?.difficulty ?? 0) >= 7
        || (value.fsrs?.lapses ?? 0) >= 2
        || value.wrongCount >= 2
        || value.lastRating === 'again'
        || value.lastRating === 'hard'
      )
    })
  }

  function dueTomorrowCount(cards: Card[], now = new Date()): number {
    const tomorrow = startOfDay(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(tomorrow)
    dayAfter.setDate(dayAfter.getDate() + 1)
    return cards.filter((card) => {
      const dueAt = progress.value[card.id]?.fsrs?.due ?? progress.value[card.id]?.nextReviewAt
      if (!dueAt) return false
      const due = new Date(dueAt)
      return due >= tomorrow && due < dayAfter
    }).length
  }

  function updateSettings(patch: Partial<UserSettings>): void {
    settings.value = { ...settings.value, ...patch }
    const createdAt = new Date().toISOString()
    queueMutation({ id: crypto.randomUUID(), type: 'settings.updated', createdAt, patch })
  }

  function clearPersistenceWarning(): void {
    persistenceWarning.value = null
  }

  function clearOutboxWarning(): void {
    outboxWarning.value = null
  }

  function refreshPendingSyncCount(): void {
    pendingSyncCount.value = outboxRepository.list().length
  }

  function prepareTelegramSync(userKey: string): void {
    const seedKey = `devrecall:telegram-seeded:v1:${userKey}`
    if (localStorage.getItem(seedKey)) return

    try {
      const mutations: SyncMutation[] = reviewEvents.value.map((event) => ({
        id: event.id,
        type: 'review.recorded',
        createdAt: event.reviewedAt,
        cardId: event.cardId,
        rating: event.rating,
        reviewedAt: event.reviewedAt,
      }))
      const createdAt = new Date().toISOString()
      for (const item of Object.values(progress.value)) {
        if (item.favorite) mutations.push({ id: crypto.randomUUID(), type: 'favorite.changed', createdAt, cardId: item.cardId, favorite: true })
      }
      mutations.push({ id: crypto.randomUUID(), type: 'settings.updated', createdAt, patch: settings.value })
      pendingSyncCount.value = outboxRepository.appendMany(mutations).length
      localStorage.setItem(seedKey, createdAt)
    } catch {
      outboxWarning.value = 'Не удалось подготовить старый прогресс к синхронизации. Повторим при следующем запуске.'
    }
  }

  function applyRemoteSync(
    changedProgress: Record<string, CardProgress>,
    remoteSettings?: UserSettings,
    remoteReviewEvents: ReviewEvent[] = [],
  ): void {
    progress.value = { ...progress.value, ...changedProgress }
    if (remoteSettings) settings.value = remoteSettings
    if (remoteReviewEvents.length) {
      const byId = new Map(reviewEvents.value.map((event) => [event.id, event]))
      for (const event of remoteReviewEvents) byId.set(event.id, event)
      reviewEvents.value = [...byId.values()].sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt))
    }
  }

  function exportProgressBackup(): ProgressBackupPayload {
    return progressRepository.exportBackupSync()
  }

  function importProgressBackup(value: unknown): ProgressSnapshot {
    const imported = progressRepository.importBackupSync(value)
    progress.value = imported.progress
    reviewEvents.value = imported.reviewEvents
    settings.value = imported.settings
    return imported
  }

  function resetProgress(): void {
    const empty = createEmptyProgressSnapshot()
    progress.value = empty.progress
    reviewEvents.value = empty.reviewEvents
    settings.value = empty.settings
    progressRepository.clearSync()
    outboxRepository.clear()
    pendingSyncCount.value = 0
  }

  return {
    progress,
    reviewEvents,
    settings,
    persistenceWarning,
    outboxWarning,
    pendingSyncCount,
    getCardProgress,
    recordReview,
    toggleFavorite,
    isFavorite,
    isDue,
    difficultCards,
    dueTomorrowCount,
    updateSettings,
    clearPersistenceWarning,
    clearOutboxWarning,
    refreshPendingSyncCount,
    prepareTelegramSync,
    applyRemoteSync,
    exportProgressBackup,
    importProgressBackup,
    resetProgress,
  }
})
