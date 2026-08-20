import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as LibraryCard,
  type CardInput,
  type Grade,
} from 'ts-fsrs'
import type { ReviewRating } from '../progress/types'

export const DESIRED_RETENTION = 0.9

export interface FsrsCardData {
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: State
  lastReview?: string
}

export interface FsrsReviewResult {
  card: FsrsCardData
  previousScheduledDays: number
  nextScheduledDays: number
}

const scheduler = fsrs(generatorParameters({ request_retention: DESIRED_RETENTION }))

const ratingMap: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

function serialize(card: LibraryCard): FsrsCardData {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString(),
  }
}

function deserialize(card: FsrsCardData): CardInput {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.lastReview,
  }
}

export function createNewFsrsCard(now = new Date()): FsrsCardData {
  return serialize(createEmptyCard(now))
}

export function scheduleFsrsReview(
  current: FsrsCardData,
  rating: ReviewRating,
  now = new Date(),
): FsrsReviewResult {
  const next = scheduler.next(deserialize(current), now, ratingMap[rating]).card
  return {
    card: serialize(next),
    previousScheduledDays: current.scheduledDays,
    nextScheduledDays: next.scheduled_days,
  }
}

export function fsrsDueAt(card?: FsrsCardData): string | undefined {
  return card?.state === State.New ? undefined : card?.due
}
