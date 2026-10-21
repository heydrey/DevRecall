import { ApiError, authorizationInitData, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js'
import { resolveUser } from './_lib/database.js'
import { verifyTelegramInitData } from './_lib/telegram.js'

interface NoteInput {
  id: string
  title: string
  body: string
  links: string[]
  isDone: boolean
  updatedAt: string
  deletedAt: string | null
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function checkDatabaseError(error: { code?: string } | null): void {
  if (!error) return
  if (error.code === '42P01' || error.code === 'PGRST205') {
    throw new ApiError(503, 'Серверное хранилище заметок ещё не настроено. Записи сохранены на устройстве.')
  }
  throw error
}

function parseNote(value: unknown): NoteInput {
  if (!value || typeof value !== 'object') throw new ApiError(422, 'Некорректная заметка.')
  const note = value as Record<string, unknown>
  if (typeof note.id !== 'string' || !uuid.test(note.id)
    || typeof note.title !== 'string' || !note.title.trim() || note.title.length > 160
    || typeof note.body !== 'string' || note.body.length > 20_000
    || typeof note.isDone !== 'boolean'
    || typeof note.updatedAt !== 'string' || !Number.isFinite(Date.parse(note.updatedAt))
    || (note.deletedAt !== null && (typeof note.deletedAt !== 'string' || !Number.isFinite(Date.parse(note.deletedAt))))) {
    throw new ApiError(422, 'Некорректные поля заметки.')
  }
  if (!Array.isArray(note.links) || note.links.length > 20 || note.links.some((link) => typeof link !== 'string' || link.length > 2048 || !/^https?:\/\//i.test(link))) {
    throw new ApiError(422, 'В заметке допускаются только ссылки http и https.')
  }
  return note as unknown as NoteInput
}

function mapNote(row: Record<string, unknown>): NoteInput {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    links: Array.isArray(row.links) ? row.links.filter((link): link is string => typeof link === 'string') : [],
    isDone: Boolean(row.is_done),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Метод не поддерживается.' })
    return
  }
  try {
    const raw = request.body as { changes?: unknown } | null
    if (!raw || JSON.stringify(raw).length > 500_000 || !Array.isArray(raw.changes) || raw.changes.length > 100) {
      throw new ApiError(422, 'Некорректный запрос заметок.')
    }
    const changes = raw.changes.map(parseNote)
    const telegramUser = verifyTelegramInitData(authorizationInitData(request))
    const { client, row: user } = await resolveUser(telegramUser)

    for (const note of changes) {
      const { data: existing, error: readError } = await client.from('learning_notes')
        .select('user_id, updated_at').eq('id', note.id).maybeSingle()
      checkDatabaseError(readError)
      if (existing && existing.user_id !== user.id) throw new ApiError(409, 'Заметка принадлежит другому профилю.')
      if (existing && Date.parse(existing.updated_at) >= Date.parse(note.updatedAt)) continue
      const row = {
        id: note.id,
        user_id: user.id,
        title: note.title.trim(),
        body: note.body,
        links: note.links,
        is_done: note.isDone,
        updated_at: note.updatedAt,
        deleted_at: note.deletedAt,
      }
      const { error } = existing
        ? await client.from('learning_notes').update(row).eq('id', note.id).eq('user_id', user.id).lt('updated_at', note.updatedAt)
        : await client.from('learning_notes').insert(row)
      checkDatabaseError(error)
    }

    const { data, error } = await client.from('learning_notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(2000)
    checkDatabaseError(error)
    response.status(200).json({ notes: (data ?? []).map(mapNote), acknowledgedIds: changes.map((note) => note.id) })
  } catch (error) {
    sendError(response, error)
  }
}
