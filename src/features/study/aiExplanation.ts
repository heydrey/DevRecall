import type { Card } from '../content/types'
import { getTelegramWebApp } from '../telegram/telegramWebApp'

export type ExplanationMode = 'simple' | 'deep'

export interface AiExplanation {
  text: string
  provider: string
  model: string
  cached: boolean
}

const CACHE_PREFIX = 'devrecall:ai-explanation:v1:'

function cacheKey(cardId: string, mode: ExplanationMode): string {
  return `${CACHE_PREFIX}${cardId}:${mode}`
}

function readCache(cardId: string, mode: ExplanationMode): AiExplanation | null {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey(cardId, mode)) ?? '') as Partial<AiExplanation>
    if (typeof value.text !== 'string' || !value.text.trim()) return null
    return { text: value.text, provider: value.provider ?? 'ai', model: value.model ?? '', cached: true }
  } catch {
    return null
  }
}

export function hasCachedExplanation(cardId: string): boolean {
  return Boolean(readCache(cardId, 'simple') || readCache(cardId, 'deep'))
}

export async function isAiExplanationAvailable(): Promise<boolean> {
  if (!navigator.onLine) return false
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
  try {
    const response = await globalThis.fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5_000) })
    const body = await response.json() as { ai?: { configured?: boolean } }
    return Boolean(body.ai?.configured)
  } catch {
    return false
  }
}

function saveCache(cardId: string, mode: ExplanationMode, value: AiExplanation): void {
  try {
    localStorage.setItem(cacheKey(cardId, mode), JSON.stringify({ ...value, cached: false }))
  } catch {
    // Объяснение продолжит работать в текущей сессии, даже если хранилище переполнено.
  }
}

export async function explainCard(card: Card, mode: ExplanationMode): Promise<AiExplanation> {
  const cached = readCache(card.id, mode)
  if (cached) {
    const initData = getTelegramWebApp()?.initData
    if (initData && navigator.onLine) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
      try {
        await globalThis.fetch(`${baseUrl}/api/ai/cache-hit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `tma ${initData}` },
          body: JSON.stringify({ cardId: card.id, mode }),
        })
      } catch {
        // Кэшированный ответ остаётся доступен, даже если метрика временно не записалась.
      }
    }
    return cached
  }
  if (!navigator.onLine) throw new Error('Для нового объяснения нужен интернет. Ранее открытые объяснения доступны офлайн.')

  const initData = getTelegramWebApp()?.initData
  if (!initData) throw new Error('ИИ-наставник доступен внутри Telegram.')

  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await globalThis.fetch(`${baseUrl}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `tma ${initData}` },
      body: JSON.stringify({
        cardId: card.id,
        topic: card.topicId,
        question: card.question,
        answer: card.answer,
        mode,
      }),
      signal: controller.signal,
    })
    const body = await response.json() as { text?: string; provider?: string; model?: string; error?: string }
    if (!response.ok || !body.text) throw new Error(body.error ?? 'Не удалось получить объяснение.')
    const result: AiExplanation = {
      text: body.text,
      provider: body.provider ?? 'ai',
      model: body.model ?? '',
      cached: false,
    }
    saveCache(card.id, mode, result)
    return result
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('ИИ отвечает слишком долго. Попробуйте ещё раз.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
