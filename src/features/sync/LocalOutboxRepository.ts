import type { SyncMutation } from './types'

const OUTBOX_KEY = 'devrecall:sync-outbox:v1'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function isMutation(value: unknown): value is SyncMutation {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<SyncMutation>
  return typeof item.id === 'string'
    && typeof item.createdAt === 'string'
    && (item.type === 'review.recorded' || item.type === 'favorite.changed' || item.type === 'settings.updated')
}

function uniqueInOrder(mutations: SyncMutation[]): SyncMutation[] {
  const seen = new Set<string>()
  return mutations.filter((mutation) => {
    if (seen.has(mutation.id)) return false
    seen.add(mutation.id)
    return true
  })
}

export class LocalOutboxRepository {
  constructor(private readonly storage: StorageLike = localStorage) {}

  list(): SyncMutation[] {
    const raw = this.storage.getItem(OUTBOX_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? uniqueInOrder(parsed.filter(isMutation)) : []
    } catch {
      return []
    }
  }

  append(mutation: SyncMutation): SyncMutation[] {
    return this.appendMany([mutation])
  }

  appendMany(mutations: SyncMutation[]): SyncMutation[] {
    const next = uniqueInOrder([...this.list(), ...mutations])
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    this.replace(next)
    return next
  }

  acknowledge(ids: string[]): SyncMutation[] {
    const acknowledged = new Set(ids)
    const next = this.list().filter((mutation) => !acknowledged.has(mutation.id))
    this.replace(next)
    return next
  }

  replace(mutations: SyncMutation[]): void {
    this.storage.setItem(OUTBOX_KEY, JSON.stringify(uniqueInOrder(mutations)))
  }

  clear(): void {
    this.storage.removeItem(OUTBOX_KEY)
  }
}
