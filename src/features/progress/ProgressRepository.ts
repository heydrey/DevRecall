import type { ProgressSnapshot } from './types'

export interface ProgressBackupPayload {
  snapshot: ProgressSnapshot
  rawLegacyBackup?: string
}

export interface ProgressRepository {
  load(): Promise<ProgressSnapshot>
  save(snapshot: ProgressSnapshot): Promise<void>
  exportBackup(): Promise<ProgressBackupPayload>
  importBackup(value: unknown): Promise<ProgressSnapshot>
  clear(): Promise<void>
}
