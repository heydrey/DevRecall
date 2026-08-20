import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { StaticCardRepository } from '../content/StaticCardRepository'
import type { Card } from '../content/types'
import { useProgressStore } from '../progress/progressStore'
import type { ReviewRating } from '../progress/types'
import {
  buildFocusedSession,
  buildPlannedSession,
  buildRandomSession,
  type RandomSessionOptions,
} from './sessionBuilder'

export type StudyMode = 'today' | 'topic' | 'section' | 'favorites' | 'difficult' | 'random' | 'mistakes'

const repository = new StaticCardRepository()

export const useStudyStore = defineStore('study', () => {
  const cards = ref<Card[]>([])
  const currentIndex = ref(0)
  const answerVisible = ref(false)
  const startedAt = ref<string | null>(null)
  const finished = ref(false)
  const ratings = ref<Record<ReviewRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const mode = ref<StudyMode>('today')
  const randomOptions = ref<RandomSessionOptions | null>(null)
  const sessionCardIds = ref<string[]>([])
  const mistakeCardIds = ref<string[]>([])
  const lastTopicId = ref('javascript')
  const lastSectionId = ref<string | undefined>()

  const currentCard = computed(() => cards.value[currentIndex.value] ?? null)
  const completedCount = computed(() => Math.min(currentIndex.value, cards.value.length))
  const progressPercent = computed(() => {
    if (!cards.value.length) return 0
    return Math.round((completedCount.value / cards.value.length) * 100)
  })

  function resetSession(nextMode: StudyMode, nextCards: Card[]): void {
    mode.value = nextMode
    cards.value = nextCards
    sessionCardIds.value = nextCards.map((card) => card.id)
    mistakeCardIds.value = []
    currentIndex.value = 0
    answerVisible.value = false
    finished.value = nextCards.length === 0
    startedAt.value = new Date().toISOString()
    ratings.value = { again: 0, hard: 0, good: 0, easy: 0 }
  }

  async function start(nextMode: StudyMode, topicId = 'javascript', sectionId?: string): Promise<void> {
    const progressStore = useProgressStore()
    lastTopicId.value = topicId
    lastSectionId.value = sectionId
    randomOptions.value = null

    if (nextMode === 'today') {
      const allCards = await repository.getCards()
      resetSession('today', buildPlannedSession(allCards, {
        progress: progressStore.progress,
        dailyReviewLimit: progressStore.settings.dailyReviewLimit,
        dailyNewCards: progressStore.settings.dailyNewCards,
      }))
      return
    }

    const topicCards = nextMode === 'topic' || nextMode === 'section'
      ? await repository.getCardsByTopic(topicId)
      : null
    const source = topicCards
      ? nextMode === 'section' && sectionId
        ? topicCards.filter((card) => card.sectionId === sectionId)
        : topicCards
      : await repository.getCards()

    if (nextMode === 'favorites') {
      resetSession('favorites', source.filter((card) => progressStore.isFavorite(card.id)))
    } else if (nextMode === 'difficult') {
      resetSession('difficult', progressStore.difficultCards(source))
    } else {
      resetSession(nextMode === 'section' ? 'section' : 'topic', buildFocusedSession(source, progressStore.progress))
    }
  }

  async function startRandom(options: RandomSessionOptions): Promise<void> {
    const progressStore = useProgressStore()
    const allCards = await repository.getCards()
    const difficultCardIds = new Set(progressStore.difficultCards(allCards).map((card) => card.id))
    randomOptions.value = { ...options }
    resetSession('random', buildRandomSession(allCards, options, {
      progress: progressStore.progress,
      difficultCardIds,
    }))
  }

  async function repeatMistakes(): Promise<void> {
    const allCards = await repository.getCards()
    const ids = new Set(mistakeCardIds.value)
    resetSession('mistakes', allCards.filter((card) => ids.has(card.id)))
  }

  async function restartSession(): Promise<void> {
    if (mode.value === 'random' && randomOptions.value) {
      await startRandom(randomOptions.value)
      return
    }
    if (mode.value === 'mistakes') {
      await repeatMistakes()
      return
    }
    await start(mode.value, lastTopicId.value, lastSectionId.value)
  }

  function revealAnswer(): void {
    answerVisible.value = true
  }

  function rate(rating: ReviewRating): void {
    const progressStore = useProgressStore()
    const card = currentCard.value
    if (!card || !answerVisible.value) return

    progressStore.recordReview(card.id, rating)
    ratings.value = { ...ratings.value, [rating]: ratings.value[rating] + 1 }

    if ((rating === 'again' || rating === 'hard') && !mistakeCardIds.value.includes(card.id)) {
      mistakeCardIds.value = [...mistakeCardIds.value, card.id]
    }
    if (rating === 'again' && cards.value.length > 1) {
      const insertAt = Math.min(currentIndex.value + 5, cards.value.length)
      cards.value.splice(insertAt, 0, card)
    }

    currentIndex.value += 1
    answerVisible.value = false
    finished.value = currentIndex.value >= cards.value.length
  }

  function toggleFavorite(): void {
    const card = currentCard.value
    if (card) useProgressStore().toggleFavorite(card.id)
  }

  return {
    cards,
    currentIndex,
    currentCard,
    answerVisible,
    startedAt,
    finished,
    ratings,
    mode,
    randomOptions,
    sessionCardIds,
    mistakeCardIds,
    completedCount,
    progressPercent,
    start,
    startRandom,
    repeatMistakes,
    restartSession,
    revealAnswer,
    rate,
    toggleFavorite,
  }
})
