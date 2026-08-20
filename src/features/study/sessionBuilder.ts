import type { Card } from '../content/types'
import type { CardProgress } from '../progress/types'

export type RandomPool = 'all' | 'difficult' | 'favorites' | 'unseen'
export type SessionMinutes = 5 | 10 | 20 | 0

export interface RandomSessionOptions {
  topicId: string | 'all'
  pool: RandomPool
  minutes: SessionMinutes
}

export const SESSION_CARD_LIMITS: Record<SessionMinutes, number> = {
  5: 8,
  10: 16,
  20: 32,
  0: Number.POSITIVE_INFINITY,
}

export function shuffleCards(cards: Card[], random = Math.random): Card[] {
  const result = [...cards]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    const current = result[index]
    result[index] = result[target] as Card
    result[target] = current as Card
  }
  return result
}

export interface PlannedSessionOptions {
  progress: Record<string, CardProgress>
  dailyReviewLimit: number
  dailyNewCards: number
  now?: Date
  random?: () => number
}

function dueTimestamp(card: Card, progress: Record<string, CardProgress>): number {
  const value = progress[card.id]
  const dueAt = value?.fsrs?.due ?? value?.nextReviewAt
  return dueAt ? new Date(dueAt).getTime() : Number.POSITIVE_INFINITY
}

export function buildPlannedSession(cards: Card[], options: PlannedSessionOptions): Card[] {
  const now = options.now ?? new Date()
  const due = cards
    .filter((card) => dueTimestamp(card, options.progress) <= now.getTime())
    .sort((left, right) => dueTimestamp(left, options.progress) - dueTimestamp(right, options.progress))
    .slice(0, options.dailyReviewLimit)
  const dueIds = new Set(due.map((card) => card.id))
  const unseen = shuffleCards(
    cards.filter((card) => !(options.progress[card.id]?.repetitions ?? 0) && !dueIds.has(card.id)),
    options.random,
  ).slice(0, options.dailyNewCards)
  return [...due, ...unseen]
}

export interface RandomSessionContext {
  progress: Record<string, CardProgress>
  difficultCardIds: Set<string>
  random?: () => number
}

export function buildRandomSession(
  cards: Card[],
  options: RandomSessionOptions,
  context: RandomSessionContext,
): Card[] {
  const filtered = cards.filter((card) => {
    if (options.topicId !== 'all' && card.topicId !== options.topicId) return false
    if (options.pool === 'favorites') return Boolean(context.progress[card.id]?.favorite)
    if (options.pool === 'difficult') return context.difficultCardIds.has(card.id)
    if (options.pool === 'unseen') return !(context.progress[card.id]?.repetitions ?? 0)
    return true
  })
  return shuffleCards(filtered, context.random).slice(0, SESSION_CARD_LIMITS[options.minutes])
}
