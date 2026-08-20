import {
  createNewFsrsCard,
  scheduleFsrsReview,
  type FsrsCardData,
} from '../scheduling/fsrsScheduler'
import {
  DEFAULT_USER_SETTINGS,
  type CardProgress,
  type CardStatus,
  type MigrationResult,
  type ProgressSnapshotV2,
  type ReviewEvent,
  type ReviewRating,
  type UserSettings,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isRating(value: unknown): value is ReviewRating {
  return value === 'again' || value === 'hard' || value === 'good' || value === 'easy'
}

function isStatus(value: unknown): value is CardStatus {
  return value === 'new' || value === 'learning' || value === 'review' || value === 'mastered'
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function normalizeSettings(value: unknown): UserSettings {
  if (!isRecord(value)) return { ...DEFAULT_USER_SETTINGS }
  const sessionMinutes = value.sessionMinutes
  return {
    dailyNewCards: asNumber(value.dailyNewCards, DEFAULT_USER_SETTINGS.dailyNewCards),
    dailyReviewLimit: asNumber(value.dailyReviewLimit, DEFAULT_USER_SETTINGS.dailyReviewLimit),
    theme: value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
      ? value.theme
      : DEFAULT_USER_SETTINGS.theme,
    preferredLevel: value.preferredLevel === 'basic'
      || value.preferredLevel === 'middle'
      || value.preferredLevel === 'advanced'
      || value.preferredLevel === 'all'
      ? value.preferredLevel
      : DEFAULT_USER_SETTINGS.preferredLevel,
    sessionMinutes: sessionMinutes === 0 || sessionMinutes === 5 || sessionMinutes === 10 || sessionMinutes === 20
      ? sessionMinutes
      : DEFAULT_USER_SETTINGS.sessionMinutes,
  }
}

function normalizeFsrs(value: unknown): FsrsCardData | undefined {
  if (!isRecord(value) || typeof value.due !== 'string') return undefined
  return {
    due: value.due,
    stability: asNumber(value.stability),
    difficulty: asNumber(value.difficulty),
    elapsedDays: asNumber(value.elapsedDays),
    scheduledDays: asNumber(value.scheduledDays),
    learningSteps: asNumber(value.learningSteps),
    reps: asNumber(value.reps),
    lapses: asNumber(value.lapses),
    state: asNumber(value.state) as FsrsCardData['state'],
    lastReview: asOptionalString(value.lastReview),
  }
}

function normalizeProgressEntry(cardId: string, value: unknown, now: Date, migrate: boolean): CardProgress {
  const source = isRecord(value) ? value : {}
  const repetitions = asNumber(source.repetitions)
  const lastRating = isRating(source.lastRating) ? source.lastRating : undefined
  const lastReviewedAt = asOptionalString(source.lastReviewedAt)
  const nextReviewAt = asOptionalString(source.nextReviewAt)
  let fsrsCard = normalizeFsrs(source.fsrs)

  if (migrate && !fsrsCard && (repetitions > 0 || lastReviewedAt || nextReviewAt)) {
    const reviewedAt = lastReviewedAt ? new Date(lastReviewedAt) : now
    const safeReviewedAt = Number.isNaN(reviewedAt.getTime()) ? now : reviewedAt
    const initial = createNewFsrsCard(safeReviewedAt)
    fsrsCard = scheduleFsrsReview(initial, lastRating ?? 'good', safeReviewedAt).card
    if (nextReviewAt && !Number.isNaN(new Date(nextReviewAt).getTime())) {
      fsrsCard = { ...fsrsCard, due: nextReviewAt }
    }
  }

  return {
    cardId: typeof source.cardId === 'string' ? source.cardId : cardId,
    status: isStatus(source.status) ? source.status : repetitions ? 'review' : 'new',
    repetitions,
    correctCount: asNumber(source.correctCount),
    wrongCount: asNumber(source.wrongCount),
    currentIntervalDays: asNumber(source.currentIntervalDays, fsrsCard?.scheduledDays ?? 0),
    lastRating,
    lastReviewedAt,
    nextReviewAt: fsrsCard?.due ?? nextReviewAt,
    favorite: Boolean(source.favorite),
    fsrs: fsrsCard,
  }
}

function normalizeEvents(value: unknown): ReviewEvent[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((event) => ({
    id: typeof event.id === 'string' ? event.id : crypto.randomUUID(),
    cardId: typeof event.cardId === 'string' ? event.cardId : '',
    rating: isRating(event.rating) ? event.rating : 'good',
    reviewedAt: typeof event.reviewedAt === 'string' ? event.reviewedAt : new Date(0).toISOString(),
    previousIntervalDays: asNumber(event.previousIntervalDays),
    nextIntervalDays: asNumber(event.nextIntervalDays),
  })).filter((event) => event.cardId)
}

function emptySnapshot(): ProgressSnapshotV2 {
  return {
    version: 2,
    progress: {},
    reviewEvents: [],
    settings: { ...DEFAULT_USER_SETTINGS },
  }
}

export function migrateProgressSnapshot(value: unknown, now = new Date()): MigrationResult {
  if (!isRecord(value)) return { snapshot: emptySnapshot(), migrated: false }
  const isVersionTwo = value.version === 2
  const shouldMigrate = !isVersionTwo
  const rawProgress = isRecord(value.progress) ? value.progress : {}
  const progress = Object.fromEntries(
    Object.entries(rawProgress).map(([cardId, entry]) => [
      cardId,
      normalizeProgressEntry(cardId, entry, now, shouldMigrate),
    ]),
  )

  return {
    snapshot: {
      version: 2,
      progress,
      reviewEvents: normalizeEvents(value.reviewEvents),
      settings: normalizeSettings(value.settings),
    },
    migrated: shouldMigrate,
    sourceBackup: shouldMigrate ? JSON.stringify(value) : undefined,
  }
}
