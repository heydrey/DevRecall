import type { ReviewEvent } from '../progress/types'

/** Наблюдаемые результаты по самооценкам, не обещание «выучено навсегда». */
export function learningInsights(events: ReviewEvent[], now = new Date()) {
  const day = 86_400_000
  const histories = new Map<string, ReviewEvent[]>()
  for (const event of events) {
    const time = Date.parse(event.reviewedAt)
    if (!Number.isFinite(time) || time > now.getTime()) continue
    const history = histories.get(event.cardId) ?? []
    history.push(event)
    histories.set(event.cardId, history)
  }
  const retained: string[] = []
  const improved: string[] = []
  for (const [id, history] of histories) {
    history.sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id))
    const last = history[history.length - 1]
    const previous = history[history.length - 2]
    if (!last || !previous || last.rating === 'again') continue
    const time = Date.parse(last.reviewedAt)
    if (now.getTime() - time > 7 * day || time - Date.parse(previous.reviewedAt) < day) continue
    retained.push(id)
    if (history.slice(0, -1).some(event => event.rating === 'again')) improved.push(id)
  }
  return { retained, improved }
}
