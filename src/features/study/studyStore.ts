import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { StaticCardRepository } from '../content/StaticCardRepository'
import type { Card } from '../content/types'
import { useProgressStore } from '../progress/progressStore'
import type { ReviewRating } from '../progress/types'

export type StudyMode = 'today' | 'topic' | 'favorites' | 'difficult'

const repository = new StaticCardRepository()

export const useStudyStore = defineStore('study', () => {
  const cards = ref<Card[]>([])
  const currentIndex = ref(0)
  const answerVisible = ref(false)
  const startedAt = ref<string | null>(null)
  const finished = ref(false)
  const ratings = ref<Record<ReviewRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const mode = ref<StudyMode>('today')

  const currentCard = computed(() => cards.value[currentIndex.value] ?? null)
  const completedCount = computed(() => Math.min(currentIndex.value, cards.value.length))
  const progressPercent = computed(() => {
    if (!cards.value.length) return 0
    return Math.round((completedCount.value / cards.value.length) * 100)
  })

  async function start(nextMode: StudyMode, topicId = 'javascript'): Promise<void> {
    const progressStore = useProgressStore()
    const allCards = await repository.getCardsByTopic(topicId)
    const due = allCards.filter((card) => progressStore.isDue(card.id))
    const fresh = allCards.filter((card) => !progressStore.progress[card.id])
    const studied = allCards.filter((card) => progressStore.progress[card.id] && !progressStore.isDue(card.id))

    mode.value = nextMode
    if (nextMode === 'favorites') {
      cards.value = allCards.filter((card) => progressStore.isFavorite(card.id))
    } else if (nextMode === 'difficult') {
      cards.value = progressStore.difficultCards(allCards)
    } else if (nextMode === 'topic') {
      cards.value = [...due, ...fresh, ...studied]
    } else {
      cards.value = [
        ...due.slice(0, progressStore.settings.dailyReviewLimit),
        ...fresh.slice(0, progressStore.settings.dailyNewCards),
      ]
      if (!cards.value.length) cards.value = studied.slice(0, 10)
    }

    currentIndex.value = 0
    answerVisible.value = false
    finished.value = cards.value.length === 0
    startedAt.value = new Date().toISOString()
    ratings.value = { again: 0, hard: 0, good: 0, easy: 0 }
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
    completedCount,
    progressPercent,
    start,
    revealAnswer,
    rate,
    toggleFavorite,
  }
})
