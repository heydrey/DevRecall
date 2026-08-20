import type { AppUser } from '../profile/types'
import type { ProgressBackupPayload } from '../progress/ProgressRepository'
import type { SyncMutation } from '../sync/types'
import { devRecallBackupSchema, type DevRecallBackup } from './backupSchema'

export function createBackup(
  progress: ProgressBackupPayload,
  outbox: SyncMutation[],
  user?: AppUser | null,
): DevRecallBackup {
  return {
    format: 'devrecall-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    progress,
    outbox,
    profile: user ? { id: user.id, displayName: user.displayName, mode: user.mode } : undefined,
  }
}

export function downloadBackup(backup: DevRecallBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `devrecall-backup-${new Date().toLocaleDateString('sv-SE')}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function parseBackupText(text: string): DevRecallBackup {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Файл не является корректным JSON.')
  }
  const parsed = devRecallBackupSchema.safeParse(value)
  if (!parsed.success) throw new Error('Файл не похож на резервную копию DevRecall.')
  return parsed.data as unknown as DevRecallBackup
}

export async function parseBackupFile(file: File): Promise<DevRecallBackup> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Файл резервной копии слишком большой.')
  return parseBackupText(await file.text())
}

export function mergeOutbox(current: SyncMutation[], imported: SyncMutation[]): SyncMutation[] {
  const byId = new Map<string, SyncMutation>()
  ;[...current, ...imported].forEach((mutation) => byId.set(mutation.id, mutation))
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}
