import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { StaticCardRepository } from '../content/StaticCardRepository'
import type { Card } from '../content/types'
import { useProgressStore } from '../progress/progressStore'
import type { ReviewRating } from '../progress/types'
import {
  buildPlannedSession,
  buildRandomSession,
  shuffleCards,
  type RandomSessionOptions,
} from './sessionBuilder'

export type StudyMode = 'today' | 'topic' | 'section' | 'favorites' | 'difficult' | 'random' | 'mistakes'

const repository = new StaticCardRepository()
const LAST_TOPIC_FIRST_CARD_KEY = 'devrecall:last-topic-first-card:v1'

function shuffledTopicCards(source: Card[], scope: string): Card[] {
  const shuffled = shuffleCards(source)
  if (!shuffled.length) return shuffled

  let previousByScope: Record<string, string> = {}
  try {
    previousByScope = JSON.parse(localStorage.getItem(LAST_TOPIC_FIRST_CARD_KEY) ?? '{}') as Record<string, string>
  } catch {
    previousByScope = {}
  }

  if (shuffled.length > 1 && shuffled[0]?.id === previousByScope[scope]) {
    const replacementIndex = 1 + Math.floor(Math.random() * (shuffled.length - 1))
    const first = shuffled[0] as Card
    shuffled[0] = shuffled[replacementIndex] as Card
    shuffled[replacementIndex] = first
  }

  previousByScope[scope] = shuffled[0]?.id ?? ''
  try {
    localStorage.setItem(LAST_TOPIC_FIRST_CARD_KEY, JSON.stringify(previousByScope))
  } catch {
    // Перемешивание продолжает работать, даже если локальное хранилище недоступно.
  }
  return shuffled
}

export const useStudyStore = defineStore('study', () => {
  const cards = ref<Card[]>([])
  const currentIndex = ref(0)
  const answerVisible = ref(false)
  const hintStage = ref<0 | 1 | 2>(0)
  const learningMode = ref(false)
  const startedAt = ref<string | null>(null)
  const finished = ref(false)
  const ratings = ref<Record<ReviewRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const mode = ref<StudyMode>('today')
  const randomOptions = ref<RandomSessionOptions | null>(null)
  const sessionCardIds = ref<string[]>([])
  const mistakeCardIds = ref<string[]>([])
  const answeredCardIds = ref<string[]>([])
  const requeuedCardIds = ref<string[]>([])
  const newCardIds = ref<string[]>([])
  const learnedNewCardIds = ref<string[]>([])
  const currentStreak = ref(0)
  const bestStreak = ref(0)
  const lastTopicId = ref('javascript')
  const lastSectionId = ref<string | undefined>()

  const currentCard = computed(() => cards.value[currentIndex.value] ?? null)
  const completedCount = computed(() => Math.min(currentIndex.value, cards.value.length))
  const completedUniqueCount = computed(() => answeredCardIds.value.length)
  const newCardsLearnedCount = computed(() => learnedNewCardIds.value.length)
  const rememberedCount = computed(() => ratings.value.hard + ratings.value.good + ratings.value.easy)
  const progressPercent = computed(() => {
    if (!cards.value.length) return 0
    return Math.round((completedCount.value / cards.value.length) * 100)
  })

  function resetSession(nextMode: StudyMode, nextCards: Card[]): void {
    const progressStore = useProgressStore()
    mode.value = nextMode
    cards.value = nextCards
    sessionCardIds.value = nextCards.map((card) => card.id)
    mistakeCardIds.value = []
    currentIndex.value = 0
    answerVisible.value = false
    hintStage.value = 0
    learningMode.value = false
    finished.value = nextCards.length === 0
    startedAt.value = new Date().toISOString()
    ratings.value = { again: 0, hard: 0, good: 0, easy: 0 }
    answeredCardIds.value = []
    requeuedCardIds.value = []
    newCardIds.value = [...new Set(nextCards
      .filter((card) => !(progressStore.progress[card.id]?.repetitions ?? 0))
      .map((card) => card.id))]
    learnedNewCardIds.value = []
    currentStreak.value = 0
    bestStreak.value = 0
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
      const sessionMode = nextMode === 'section' ? 'section' : 'topic'
      const scope = sessionMode === 'section' ? `${topicId}:${sectionId ?? 'all'}` : topicId
      resetSession(sessionMode, shuffledTopicCards(source, scope))
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

  function revealHint(): void {
    hintStage.value = hintStage.value === 0 ? 1 : 2
  }

  function startLearning(): void {
    learningMode.value = true
    answerVisible.value = true
  }

  function rate(rating: ReviewRating): void {
    const progressStore = useProgressStore()
    const card = currentCard.value
    if (!card || !answerVisible.value) return

    const effectiveRating: ReviewRating = learningMode.value ? 'again' : rating
    progressStore.recordReview(card.id, effectiveRating)
    ratings.value = { ...ratings.value, [effectiveRating]: ratings.value[effectiveRating] + 1 }

    if (!answeredCardIds.value.includes(card.id)) answeredCardIds.value = [...answeredCardIds.value, card.id]
    if (newCardIds.value.includes(card.id) && !learnedNewCardIds.value.includes(card.id)) {
      learnedNewCardIds.value = [...learnedNewCardIds.value, card.id]
    }

    if (effectiveRating === 'good' || effectiveRating === 'easy') {
      currentStreak.value += 1
      bestStreak.value = Math.max(bestStreak.value, currentStreak.value)
    } else {
      currentStreak.value = 0
    }

    if ((effectiveRating === 'again' || effectiveRating === 'hard') && !mistakeCardIds.value.includes(card.id)) {
      mistakeCardIds.value = [...mistakeCardIds.value, card.id]
    }
    if (effectiveRating === 'again' && !requeuedCardIds.value.includes(card.id)) {
      const insertAt = Math.min(currentIndex.value + 5, cards.value.length)
      cards.value.splice(insertAt, 0, card)
      requeuedCardIds.value = [...requeuedCardIds.value, card.id]
    }

    currentIndex.value += 1
    answerVisible.value = false
    hintStage.value = 0
    learningMode.value = false
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
    hintStage,
    learningMode,
    startedAt,
    finished,
    ratings,
    mode,
    randomOptions,
    sessionCardIds,
    mistakeCardIds,
    answeredCardIds,
    requeuedCardIds,
    newCardIds,
    learnedNewCardIds,
    currentStreak,
    bestStreak,
    completedCount,
    completedUniqueCount,
    newCardsLearnedCount,
    rememberedCount,
    progressPercent,
    start,
    startRandom,
    repeatMistakes,
    restartSession,
    revealAnswer,
    revealHint,
    startLearning,
    rate,
    toggleFavorite,
  }
})
