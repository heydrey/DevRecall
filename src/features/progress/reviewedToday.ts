import type { ReviewEvent } from './types'

// Use local calendar boundaries, including days affected by daylight saving time.
export function reviewedTodayIds(events: ReviewEvent[], now = new Date()): Set<string> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  return new Set(events.filter((event) => {
    const timestamp = Date.parse(event.reviewedAt)
    return timestamp >= start && timestamp < end
  }).map((event) => event.cardId))
}
