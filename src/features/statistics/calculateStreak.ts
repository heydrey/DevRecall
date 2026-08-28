import type { ReviewEvent } from '../progress/types'

function localDateKey(date: Date): string {
  return date.toLocaleDateString('sv-SE')
}

export function calculateCurrentStreak(events: readonly ReviewEvent[], now = new Date()): number {
  const activeDays = new Set(events.map((event) => localDateKey(new Date(event.reviewedAt))))
  const cursor = new Date(now)

  // До первого занятия сегодня серия за предыдущие дни остаётся действующей.
  if (!activeDays.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (activeDays.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
