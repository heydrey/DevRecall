import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useProfileStore } from '../profile/profileStore'
import type { LearningNote, NoteDraft } from './types'

const STORAGE_PREFIX = 'devrecall:learning-notes:v1:'

interface SavedNotes {
  notes: LearningNote[]
  pendingIds: string[]
}

function validNote(value: unknown): value is LearningNote {
  if (!value || typeof value !== 'object') return false
  const note = value as Partial<LearningNote>
  return typeof note.id === 'string' && typeof note.title === 'string' && typeof note.body === 'string'
    && Array.isArray(note.links) && note.links.every((link) => typeof link === 'string')
    && typeof note.isDone === 'boolean' && typeof note.updatedAt === 'string'
    && (note.deletedAt === null || typeof note.deletedAt === 'string')
}

function readSaved(key: string): SavedNotes {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '') as Partial<SavedNotes>
    return {
      notes: Array.isArray(value.notes) ? value.notes.filter(validNote).map((note) => ({
        ...note,
        shortAnswer: typeof note.shortAnswer === 'string' ? note.shortAnswer : '',
      })) : [],
      pendingIds: Array.isArray(value.pendingIds) ? value.pendingIds.filter((id): id is string => typeof id === 'string') : [],
    }
  } catch {
    return { notes: [], pendingIds: [] }
  }
}

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') || window.location.origin
}

function nextUpdatedAt(previous?: string): string {
  const now = Date.now()
  return new Date(previous ? Math.max(now, Date.parse(previous) + 1) : now).toISOString()
}

export const useNotesStore = defineStore('learning-notes', () => {
  const profile = useProfileStore()
  const notes = ref<LearningNote[]>([])
  const pendingIds = ref<string[]>([])
  const status = ref<'local' | 'syncing' | 'synced' | 'offline' | 'error'>('local')
  const error = ref<string | null>(null)
  const loadedKey = ref<string | null>(null)
  let syncing = false
  let timer: number | undefined

  const visibleNotes = computed(() => notes.value.filter((note) => !note.deletedAt)
    .sort((a, b) => Number(a.isDone) - Number(b.isDone) || b.updatedAt.localeCompare(a.updatedAt)))
  const pendingCount = computed(() => pendingIds.value.length)

  function key(): string {
    return `${STORAGE_PREFIX}${profile.user?.id ?? 'local'}`
  }

  function ensureLoaded(): void {
    const current = key()
    if (loadedKey.value === current) return
    const saved = readSaved(current)
    notes.value = saved.notes
    pendingIds.value = saved.pendingIds
    loadedKey.value = current
    status.value = 'local'
    error.value = null
  }

  function persist(): void {
    try {
      localStorage.setItem(key(), JSON.stringify({ notes: notes.value, pendingIds: pendingIds.value }))
    } catch {
      error.value = 'Не удалось сохранить заметки на устройстве. Освободите место и повторите.'
      status.value = 'error'
    }
  }

  function queue(note: LearningNote): void {
    notes.value = [...notes.value.filter((item) => item.id !== note.id), note]
    pendingIds.value = [...new Set([...pendingIds.value, note.id])]
    persist()
    scheduleSync()
  }

  function save(draft: NoteDraft, id?: string): LearningNote {
    ensureLoaded()
    const existing = id ? notes.value.find((note) => note.id === id && !note.deletedAt) : undefined
    const note: LearningNote = {
      id: existing?.id ?? crypto.randomUUID(),
      title: draft.title.trim(),
      shortAnswer: draft.shortAnswer.trim(),
      body: draft.body.trim(),
      links: draft.links,
      isDone: draft.isDone,
      updatedAt: nextUpdatedAt(existing?.updatedAt),
      deletedAt: null,
    }
    queue(note)
    return note
  }

  function remove(id: string): void {
    ensureLoaded()
    const existing = notes.value.find((note) => note.id === id && !note.deletedAt)
    if (!existing) return
    const now = nextUpdatedAt(existing.updatedAt)
    queue({ ...existing, updatedAt: now, deletedAt: now })
  }

  function setDone(id: string, isDone: boolean): void {
    ensureLoaded()
    const existing = notes.value.find((note) => note.id === id && !note.deletedAt)
    if (!existing) return
    queue({ ...existing, isDone, updatedAt: nextUpdatedAt(existing.updatedAt) })
  }

  function scheduleSync(): void {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void sync(), 500)
  }

  async function sync(): Promise<void> {
    ensureLoaded()
    if (syncing) return
    const initData = profile.getTelegramInitData()
    if (!initData) {
      status.value = 'local'
      return
    }
    if (!navigator.onLine) {
      status.value = 'offline'
      return
    }
    const currentKey = loadedKey.value
    const changes = notes.value.filter((note) => pendingIds.value.includes(note.id)).slice(0, 10)
    syncing = true
    status.value = 'syncing'
    error.value = null
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(`${apiBase()}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `tma ${initData}` },
        body: JSON.stringify({ changes }),
        signal: controller.signal,
      })
      const payload = await response.json() as { notes?: unknown; error?: string }
      if (!response.ok) throw new Error(payload.error ?? `Ошибка синхронизации заметок: HTTP ${response.status}`)
      if (!Array.isArray(payload.notes) || !payload.notes.every(validNote)) throw new Error('Сервер вернул некорректные заметки.')
      if (currentKey !== loadedKey.value) return

      // Edits made while the request was in flight remain pending and win over the response.
      const sent = new Map(changes.map((note) => [note.id, note.updatedAt]))
      pendingIds.value = pendingIds.value.filter((id) => {
        const current = notes.value.find((note) => note.id === id)
        return !sent.has(id) || current?.updatedAt !== sent.get(id)
      })
      const localPending = new Map(notes.value.filter((note) => pendingIds.value.includes(note.id)).map((note) => [note.id, note]))
      notes.value = [...new Map([...payload.notes as LearningNote[], ...localPending.values()]
        .map((note) => [note.id, note])).values()]
      persist()
      status.value = 'synced'
    } catch (cause) {
      status.value = navigator.onLine ? 'error' : 'offline'
      error.value = cause instanceof Error ? cause.message : 'Не удалось синхронизировать заметки.'
    } finally {
      syncing = false
      window.clearTimeout(timeout)
      if (pendingIds.value.length && status.value === 'synced') scheduleSync()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void sync())
  }

  return { notes, visibleNotes, pendingCount, status, error, ensureLoaded, save, remove, setDone, sync }
})
