import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError, allowOnly, authorizationInitData, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js'
import { publicUser, resolveUser } from './_lib/database.js'
import { createNewFsrsCard, fsrsDueAt, scheduleFsrsReview, type FsrsCardData, type ReviewRating } from './_lib/fsrs.js'
import { verifyTelegramInitData } from './_lib/telegram.js'

type CardStatus = 'new' | 'learning' | 'review' | 'mastered'
interface CardProgress {
  cardId: string
  status: CardStatus
  repetitions: number
  correctCount: number
  wrongCount: number
  currentIntervalDays: number
  lastRating?: ReviewRating
  lastReviewedAt?: string
  nextReviewAt?: string
  favorite: boolean
  fsrs?: FsrsCardData
}
interface ReviewEvent {
  id: string
  cardId: string
  rating: ReviewRating
  reviewedAt: string
  previousIntervalDays: number
  nextIntervalDays: number
}
interface UserSettings {
  dailyNewCards: number
  dailyReviewLimit: number
  theme: 'system' | 'light' | 'dark'
  preferredLevel: 'junior' | 'middle' | 'senior' | 'all'
  sessionMinutes: 5 | 10 | 20 | 0
}

type Mutation =
  | { id: string; type: 'review.recorded'; createdAt: string; cardId: string; rating: ReviewRating; reviewedAt: string }
  | { id: string; type: 'favorite.changed'; createdAt: string; cardId: string; favorite: boolean }
  | { id: string; type: 'settings.updated'; createdAt: string; patch: Partial<UserSettings> }

const ratings = new Set<ReviewRating>(['again', 'hard', 'good', 'easy'])
const defaultSettings: UserSettings = {
  dailyNewCards: 20,
  dailyReviewLimit: 100,
  theme: 'system',
  preferredLevel: 'all',
  sessionMinutes: 10,
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function parseBody(body: unknown): { deviceId: string; platform?: string; cursor?: string; mutations: Mutation[] } {
  if (!body || typeof body !== 'object') throw new ApiError(422, 'Некорректный запрос синхронизации.')
  if (JSON.stringify(body).length > 524_288) throw new ApiError(413, 'Запрос синхронизации слишком большой.')
  const value = body as Record<string, unknown>
  if (typeof value.deviceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.deviceId)) throw new ApiError(422, 'Некорректный идентификатор устройства.')
  if (!Array.isArray(value.mutations) || value.mutations.length > 500) throw new ApiError(422, 'Слишком много изменений для одной синхронизации.')

  const mutations = value.mutations.map((item) => {
    if (!item || typeof item !== 'object') throw new ApiError(422, 'Некорректное изменение.')
    const mutation = item as Record<string, unknown>
    if (typeof mutation.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(mutation.id) || !validIso(mutation.createdAt)) {
      throw new ApiError(422, 'Некорректный идентификатор изменения.')
    }
    if (mutation.type === 'review.recorded') {
      if (typeof mutation.cardId !== 'string' || !ratings.has(mutation.rating as ReviewRating) || !validIso(mutation.reviewedAt)) throw new ApiError(422, 'Некорректный ответ на карточку.')
      return mutation as unknown as Mutation
    }
    if (mutation.type === 'favorite.changed') {
      if (typeof mutation.cardId !== 'string' || typeof mutation.favorite !== 'boolean') throw new ApiError(422, 'Некорректное изменение избранного.')
      return mutation as unknown as Mutation
    }
    if (mutation.type === 'settings.updated' && mutation.patch && typeof mutation.patch === 'object') return mutation as unknown as Mutation
    throw new ApiError(422, 'Неизвестный тип изменения.')
  })

  return {
    deviceId: value.deviceId,
    platform: typeof value.platform === 'string' ? value.platform.slice(0, 50) : undefined,
    cursor: typeof value.cursor === 'string' ? value.cursor : undefined,
    mutations,
  }
}

async function addChange(client: SupabaseClient, userId: string, entityType: string, entityKey: string): Promise<void> {
  const { error } = await client.from('sync_changes').insert({ user_id: userId, entity_type: entityType, entity_key: entityKey })
  if (error) throw new ApiError(500, 'Не удалось записать изменение синхронизации.')
}

async function applyReview(client: SupabaseClient, userId: string, deviceId: string, mutation: Extract<Mutation, { type: 'review.recorded' }>): Promise<boolean> {
  const row = { id: mutation.id, user_id: userId, device_id: deviceId, card_id: mutation.cardId, rating: mutation.rating, reviewed_at: mutation.reviewedAt, created_at: mutation.createdAt }
  const { error } = await client.from('review_events').insert(row)
  if (!error) return true
  if (error.code !== '23505') throw new ApiError(500, 'Не удалось сохранить ответ на карточку.')

  const { data: existing } = await client.from('review_events').select('card_id, rating, reviewed_at').eq('id', mutation.id).single()
  if (!existing || existing.card_id !== mutation.cardId || existing.rating !== mutation.rating || existing.reviewed_at !== mutation.reviewedAt) {
    throw new ApiError(409, 'Это изменение уже существует с другими данными.')
  }
  return false
}

async function recalculateCard(client: SupabaseClient, userId: string, cardId: string): Promise<{ progress: CardProgress; events: ReviewEvent[] }> {
  const [{ data: rows, error }, { data: existing }] = await Promise.all([
    client.from('review_events').select('id, card_id, rating, reviewed_at').eq('user_id', userId).eq('card_id', cardId).order('reviewed_at').order('id'),
    client.from('card_progress').select('favorite, favorite_updated_at').eq('user_id', userId).eq('card_id', cardId).maybeSingle(),
  ])
  if (error) throw new ApiError(500, 'Не удалось пересчитать карточку.')

  let fsrs: FsrsCardData | undefined
  let correctCount = 0
  let wrongCount = 0
  const events: ReviewEvent[] = []
  for (const row of rows ?? []) {
    const reviewedAt = new Date(row.reviewed_at)
    const rating = row.rating as ReviewRating
    const result = scheduleFsrsReview(fsrs ?? createNewFsrsCard(reviewedAt), rating, reviewedAt)
    fsrs = result.card
    if (rating === 'good' || rating === 'easy') correctCount += 1
    if (rating === 'again') wrongCount += 1
    events.push({ id: row.id, cardId, rating, reviewedAt: row.reviewed_at, previousIntervalDays: result.previousScheduledDays, nextIntervalDays: result.nextScheduledDays })
  }

  const last = events[events.length - 1]
  const isCorrect = last?.rating === 'good' || last?.rating === 'easy'
  const repetitions = events.length
  const status = fsrs && fsrs.scheduledDays >= 21 && isCorrect ? 'mastered' : repetitions === 0 ? 'new' : repetitions === 1 ? 'learning' : 'review'
  const progress: CardProgress = {
    cardId,
    status,
    repetitions,
    correctCount,
    wrongCount,
    currentIntervalDays: fsrs?.scheduledDays ?? 0,
    lastRating: last?.rating,
    lastReviewedAt: last?.reviewedAt,
    nextReviewAt: fsrsDueAt(fsrs),
    favorite: Boolean(existing?.favorite),
    fsrs,
  }

  const { error: upsertError } = await client.from('card_progress').upsert({
    user_id: userId,
    card_id: cardId,
    status: progress.status,
    repetitions,
    correct_count: correctCount,
    wrong_count: wrongCount,
    fsrs: fsrs ?? {},
    favorite: progress.favorite,
    favorite_updated_at: existing?.favorite_updated_at ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,card_id' })
  if (upsertError) throw new ApiError(500, 'Не удалось обновить прогресс карточки.')
  return { progress, events }
}

async function applyFavorite(client: SupabaseClient, userId: string, mutation: Extract<Mutation, { type: 'favorite.changed' }>): Promise<boolean> {
  const { data: current } = await client.from('card_progress').select('*').eq('user_id', userId).eq('card_id', mutation.cardId).maybeSingle()
  if (current?.favorite_updated_at && current.favorite_updated_at >= mutation.createdAt) return false
  const { error } = await client.from('card_progress').upsert({
    user_id: userId,
    card_id: mutation.cardId,
    status: current?.status ?? 'new',
    repetitions: current?.repetitions ?? 0,
    correct_count: current?.correct_count ?? 0,
    wrong_count: current?.wrong_count ?? 0,
    fsrs: current?.fsrs ?? {},
    favorite: mutation.favorite,
    favorite_updated_at: mutation.createdAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,card_id' })
  if (error) throw new ApiError(500, 'Не удалось сохранить избранное.')
  return true
}

async function applySettings(client: SupabaseClient, userId: string, mutation: Extract<Mutation, { type: 'settings.updated' }>): Promise<boolean> {
  const { data: current } = await client.from('user_settings').select('settings, field_updated_at').eq('user_id', userId).maybeSingle()
  const settings = { ...defaultSettings, ...(current?.settings ?? {}) }
  const fieldTimes = { ...(current?.field_updated_at ?? {}) } as Record<string, string>
  let changed = false
  for (const [key, value] of Object.entries(mutation.patch)) {
    if (!fieldTimes[key] || fieldTimes[key] < mutation.createdAt) {
      ;(settings as Record<string, unknown>)[key] = value
      fieldTimes[key] = mutation.createdAt
      changed = true
    }
  }
  if (!changed) return false
  const { error } = await client.from('user_settings').upsert({ user_id: userId, settings, field_updated_at: fieldTimes, updated_at: new Date().toISOString() })
  if (error) throw new ApiError(500, 'Не удалось сохранить настройки.')
  return true
}

function mapProgress(row: Record<string, unknown>): CardProgress {
  const fsrs = row.fsrs && typeof row.fsrs === 'object' && Object.keys(row.fsrs).length ? row.fsrs as unknown as FsrsCardData : undefined
  return {
    cardId: String(row.card_id),
    status: row.status as CardProgress['status'],
    repetitions: Number(row.repetitions),
    correctCount: Number(row.correct_count),
    wrongCount: Number(row.wrong_count),
    currentIntervalDays: fsrs?.scheduledDays ?? 0,
    lastRating: undefined,
    lastReviewedAt: fsrs?.lastReview,
    nextReviewAt: fsrsDueAt(fsrs),
    favorite: Boolean(row.favorite),
    fsrs,
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (!allowOnly(request, response, 'POST')) return
  try {
    const body = parseBody(request.body)
    const telegramUser = verifyTelegramInitData(authorizationInitData(request))
    const { client, row: user } = await resolveUser(telegramUser)
    const { data: device, error: deviceError } = await client.from('devices').upsert({
      user_id: user.id,
      client_device_id: body.deviceId,
      platform: body.platform ?? 'telegram',
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id,client_device_id' }).select('id').single()
    if (deviceError || !device) throw new ApiError(500, 'Не удалось зарегистрировать устройство.')

    const acknowledgedMutationIds: string[] = []
    const affectedCards = new Set<string>()
    for (const mutation of body.mutations.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))) {
      let changed = false
      if (mutation.type === 'review.recorded') {
        changed = await applyReview(client, user.id, device.id, mutation)
        affectedCards.add(mutation.cardId)
        if (changed) await addChange(client, user.id, 'review', mutation.id)
      } else if (mutation.type === 'favorite.changed') {
        changed = await applyFavorite(client, user.id, mutation)
        affectedCards.add(mutation.cardId)
        if (changed) await addChange(client, user.id, 'card_progress', mutation.cardId)
      } else {
        changed = await applySettings(client, user.id, mutation)
        if (changed) await addChange(client, user.id, 'settings', user.id)
      }
      acknowledgedMutationIds.push(mutation.id)
    }

    for (const cardId of affectedCards) {
      if (body.mutations.some((mutation) => mutation.type === 'review.recorded' && mutation.cardId === cardId)) {
        await recalculateCard(client, user.id, cardId)
        await addChange(client, user.id, 'card_progress', cardId)
      }
    }

    const [{ data: progressRows, error: progressError }, { data: settingsRow }, { data: reviewRows, error: reviewError }, { data: cursorRow }] = await Promise.all([
      client.from('card_progress').select('*').eq('user_id', user.id),
      client.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
      client.from('review_events').select('id, card_id, rating, reviewed_at').eq('user_id', user.id).order('reviewed_at').order('id'),
      client.from('sync_changes').select('sequence').eq('user_id', user.id).order('sequence', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (progressError || reviewError) throw new ApiError(500, 'Не удалось получить общий прогресс.')

    const changedProgress: Record<string, CardProgress> = {}
    for (const row of progressRows ?? []) changedProgress[row.card_id] = mapProgress(row)

    const reviewEvents: ReviewEvent[] = []
    const fsrsByCard = new Map<string, FsrsCardData>()
    for (const row of reviewRows ?? []) {
      const reviewedAt = new Date(row.reviewed_at)
      const previous = fsrsByCard.get(row.card_id) ?? createNewFsrsCard(reviewedAt)
      const result = scheduleFsrsReview(previous, row.rating as ReviewRating, reviewedAt)
      fsrsByCard.set(row.card_id, result.card)
      reviewEvents.push({ id: row.id, cardId: row.card_id, rating: row.rating as ReviewRating, reviewedAt: row.reviewed_at, previousIntervalDays: result.previousScheduledDays, nextIntervalDays: result.nextScheduledDays })
    }

    response.status(200).json({
      acknowledgedMutationIds,
      cursor: String(cursorRow?.sequence ?? body.cursor ?? '0'),
      user: publicUser(user),
      changedProgress,
      reviewEvents,
      settings: { ...defaultSettings, ...(settingsRow?.settings ?? {}) },
      serverTime: new Date().toISOString(),
    })
  } catch (error) {
    sendError(response, error)
  }
}
