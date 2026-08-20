import { migrateProgressSnapshot } from './migrateProgress'
import type { ProgressBackupPayload, ProgressRepository } from './ProgressRepository'
import { DEFAULT_USER_SETTINGS, type ProgressSnapshot } from './types'

const STORAGE_KEY = 'devrecall:v2'
const LEGACY_STORAGE_KEY = 'devrecall:v1'
const LEGACY_BACKUP_KEY = 'devrecall:v1:backup'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function createEmptyProgressSnapshot(): ProgressSnapshot {
  return { version: 2, progress: {}, reviewEvents: [], settings: { ...DEFAULT_USER_SETTINGS } }
}

export class LocalProgressRepository implements ProgressRepository {
  constructor(private readonly storage: StorageLike = localStorage) {}

  loadSync(): ProgressSnapshot {
    const currentRaw = this.storage.getItem(STORAGE_KEY)
    if (currentRaw) return migrateProgressSnapshot(JSON.parse(currentRaw)).snapshot

    const legacyRaw = this.storage.getItem(LEGACY_STORAGE_KEY)
    if (!legacyRaw) return createEmptyProgressSnapshot()

    const result = migrateProgressSnapshot(JSON.parse(legacyRaw))
    if (result.sourceBackup) this.storage.setItem(LEGACY_BACKUP_KEY, result.sourceBackup)
    this.saveSync(result.snapshot)
    return result.snapshot
  }

  saveSync(snapshot: ProgressSnapshot): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }

  exportBackupSync(): ProgressBackupPayload {
    return {
      snapshot: this.loadSync(),
      rawLegacyBackup: this.storage.getItem(LEGACY_BACKUP_KEY) ?? undefined,
    }
  }

  importBackupSync(value: unknown): ProgressSnapshot {
    const source = isRecord(value) && 'snapshot' in value ? value.snapshot : value
    const result = migrateProgressSnapshot(source)
    this.saveSync(result.snapshot)
    return result.snapshot
  }

  clearSync(): void {
    this.storage.removeItem(STORAGE_KEY)
    this.storage.removeItem(LEGACY_STORAGE_KEY)
    this.storage.removeItem(LEGACY_BACKUP_KEY)
  }

  async load(): Promise<ProgressSnapshot> { return this.loadSync() }
  async save(snapshot: ProgressSnapshot): Promise<void> { this.saveSync(snapshot) }
  async exportBackup(): Promise<ProgressBackupPayload> { return this.exportBackupSync() }
  async importBackup(value: unknown): Promise<ProgressSnapshot> { return this.importBackupSync(value) }
  async clear(): Promise<void> { this.clearSync() }
}
