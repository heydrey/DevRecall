<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, BookOpenCheck, CircleCheck, Layers3, RotateCcw, Search } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownContent from '../../shared/markdown/MarkdownContent.vue'
import { StaticCardRepository } from '../content/StaticCardRepository'
import type { Card, Topic } from '../content/types'
import { buildSessionQuiz, type QuizQuestion } from '../study/quizBuilder'
import { hasCachedLesson } from '../study/aiExplanation'
import LessonPanel from '../study/LessonPanel.vue'

const route = useRoute()
const router = useRouter()
const repository = new StaticCardRepository()
const COMPLETED_LESSONS_KEY = 'devrecall:learning-completed:v1'
const topics = ref<Topic[]>([])
const cards = ref<Card[]>([])
const loading = ref(true)
const sectionId = ref('')
const search = ref('')
const readIds = ref<string[]>([])
const quizQuestions = ref<QuizQuestion[]>([])
const quizIndex = ref(0)
const selectedOptionId = ref<string | null>(null)
const correctCount = ref(0)
const quizActive = ref(false)
const quizFinished = ref(false)

onMounted(async () => {
  try {
    const [loadedTopics, loadedCards] = await Promise.all([repository.getTopics(), repository.getCards()])
    topics.value = loadedTopics
    cards.value = loadedCards
    refreshReadIds()
  } finally {
    loading.value = false
  }
})

const topicId = computed(() => {
  const requested = String(route.query.topicId ?? 'javascript')
  return topics.value.some((topic) => topic.id === requested) ? requested : (topics.value[0]?.id ?? 'javascript')
})
const topic = computed(() => topics.value.find((item) => item.id === topicId.value) ?? null)
const topicCards = computed(() => cards.value.filter((card) => card.topicId === topicId.value))
const filteredCards = computed(() => topicCards.value.filter((card) =>
  (!sectionId.value || card.sectionId === sectionId.value)
  && card.question.toLocaleLowerCase('ru').includes(search.value.trim().toLocaleLowerCase('ru'))))
const currentCard = computed(() => topicCards.value.find((card) => card.id === route.query.cardId) ?? null)
const nextCard = computed(() => {
  if (!currentCard.value) return null
  const index = topicCards.value.findIndex((card) => card.id === currentCard.value?.id)
  return topicCards.value[index + 1] ?? null
})
const readCards = computed(() => topicCards.value.filter((card) => readIds.value.includes(card.id)))
const currentQuizQuestion = computed(() => quizQuestions.value[quizIndex.value] ?? null)
const answerCorrect = computed(() => selectedOptionId.value === currentQuizQuestion.value?.correctOptionId)

watch(topicId, () => {
  sectionId.value = ''
  search.value = ''
  refreshReadIds()
  quizActive.value = false
})

function refreshReadIds(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(COMPLETED_LESSONS_KEY) ?? '[]') as unknown
    const completedIds = new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [])
    readIds.value = topicCards.value.filter((card) => completedIds.has(card.id) && hasCachedLesson(card)).map((card) => card.id)
  } catch {
    readIds.value = []
  }
}

function chooseTopic(id: string): void {
  void router.push({ path: '/learn', query: { topicId: id } })
}

function openCard(card: Card): void {
  void router.push({ path: '/learn', query: { topicId: card.topicId, cardId: card.id } })
}

function closeCard(): void {
  void router.push({ path: '/learn', query: { topicId: topicId.value } })
}

function markRead(cardId: string): void {
  if (!topicCards.value.some((card) => card.id === cardId)) return
  if (!readIds.value.includes(cardId)) readIds.value = [...readIds.value, cardId]
  try {
    const saved = JSON.parse(localStorage.getItem(COMPLETED_LESSONS_KEY) ?? '[]') as unknown
    const ids = new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [])
    ids.add(cardId)
    localStorage.setItem(COMPLETED_LESSONS_KEY, JSON.stringify([...ids]))
  } catch {
    // В текущей сессии мини-тест остаётся доступен и без локального хранилища.
  }
}

function startQuiz(): void {
  quizQuestions.value = buildSessionQuiz(readCards.value)
  if (!quizQuestions.value.length) return
  quizIndex.value = 0
  selectedOptionId.value = null
  correctCount.value = 0
  quizFinished.value = false
  quizActive.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function selectOption(id: string): void {
  if (selectedOptionId.value || !currentQuizQuestion.value) return
  selectedOptionId.value = id
  if (id === currentQuizQuestion.value.correctOptionId) correctCount.value += 1
}

function nextQuestion(): void {
  if (!selectedOptionId.value) return
  if (quizIndex.value === quizQuestions.value.length - 1) quizFinished.value = true
  else {
    quizIndex.value += 1
    selectedOptionId.value = null
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="page-stack learning-page">
    <header class="learning-hero">
      <span class="eyebrow">Другой способ учиться</span>
      <h1>Обучение</h1>
      <p v-if="!currentCard && !quizActive">Выберите вопрос, прочитайте разбор с двумя простыми примерами и ответьте на мини-тест в конце урока. Обычные карточки и их расписание остаются без изменений.</p>
    </header>

    <p v-if="loading" class="learning-state">Открываем учебник…</p>

    <template v-else-if="quizActive">
      <button class="learning-back" @click="quizActive = false"><ArrowLeft :size="17" />К урокам</button>
      <section v-if="!quizFinished && currentQuizQuestion" class="learning-quiz">
        <span class="eyebrow">Проверка по прочитанным урокам · {{ quizIndex + 1 }} / {{ quizQuestions.length }}</span>
        <h2>{{ currentQuizQuestion.prompt }}</h2>
        <p>Сначала попробуйте ответить сами, затем выберите подходящий вариант.</p>
        <div class="learning-options">
          <button v-for="option in currentQuizQuestion.options" :key="option.id" :disabled="Boolean(selectedOptionId)" :class="{ 'learning-option--correct': selectedOptionId && option.id === currentQuizQuestion.correctOptionId, 'learning-option--wrong': selectedOptionId === option.id && !answerCorrect }" @click="selectOption(option.id)">{{ option.text }}</button>
        </div>
        <div v-if="selectedOptionId" class="learning-feedback">
          <strong>{{ answerCorrect ? 'Верно!' : 'Пока не совпало — вот объяснение' }}</strong>
          <MarkdownContent :source="currentQuizQuestion.answer" />
          <button class="primary-button" @click="nextQuestion">{{ quizIndex === quizQuestions.length - 1 ? 'Увидеть результат' : 'Следующий вопрос' }}<ArrowRight :size="17" /></button>
        </div>
      </section>
      <section v-else class="learning-quiz learning-quiz--result">
        <CircleCheck :size="34" />
        <span class="eyebrow">Проверка завершена</span>
        <h2>{{ correctCount }} из {{ quizQuestions.length }} верно</h2>
        <p>Это спокойная самопроверка без оценок: результат не меняет расписание карточек.</p>
        <button class="primary-button" @click="startQuiz"><RotateCcw :size="17" />Пройти ещё раз</button>
        <button class="secondary-button" @click="quizActive = false">Вернуться к урокам</button>
      </section>
    </template>

    <template v-else>
      <label v-if="!currentCard" class="topic-picker">Тема
        <select :value="topicId" @change="chooseTopic(($event.target as HTMLSelectElement).value)">
          <option v-for="item in topics" :key="item.id" :value="item.id">{{ item.title }}</option>
        </select>
      </label>

      <template v-if="currentCard">
        <button class="learning-back" @click="closeCard"><ArrowLeft :size="17" />Все вопросы темы</button>
        <article class="learning-question">
          <div class="learning-question__meta"><Layers3 :size="16" /><span>{{ topic?.sections.find((section) => section.id === currentCard?.sectionId)?.title ?? topic?.title }}</span></div>
          <h2>{{ currentCard.question }}</h2>
          <p>Разберитесь в примерах, затем выберите ответ в мини-тесте в конце урока.</p>
        </article>
        <LessonPanel :key="currentCard.id" :card="currentCard" :quiz-pool="topicCards" @completed="markRead" />
        <details class="original-answer">
          <summary>Исходный ответ карточки</summary>
          <div><MarkdownContent :source="currentCard.answer" /></div>
        </details>
        <div class="learning-navigation">
          <button v-if="nextCard" class="secondary-button" @click="openCard(nextCard)">Следующий вопрос<ArrowRight :size="17" /></button>
          <button v-if="readCards.length >= 2" class="primary-button" @click="startQuiz">Тест по изученным урокам · {{ Math.min(5, readCards.length) }} вопросов</button>
        </div>
      </template>

      <template v-else>
        <section class="learning-list-heading"><div><span class="eyebrow">{{ topic?.title }}</span><h2>Вопросы для изучения</h2><p>ИИ-урок создаётся только по нажатию: первый раз расходует один запрос, затем сохраняется на этом устройстве. Для нового урока нужен интернет и вход через Telegram.</p></div><span>{{ topicCards.length }}</span></section>
        <div class="learning-filters">
          <label>Раздел<select v-model="sectionId"><option value="">Все разделы</option><option v-for="section in topic?.sections" :key="section.id" :value="section.id">{{ section.title }}</option></select></label>
          <label>Поиск<div class="learning-search"><Search :size="17" /><input v-model="search" type="search" placeholder="Найти вопрос" /></div></label>
        </div>
        <div class="learning-list">
          <button v-for="card in filteredCards" :key="card.id" @click="openCard(card)"><BookOpenCheck :size="18" /><span>{{ card.question }}</span><ArrowRight :size="17" /></button>
          <p v-if="!filteredCards.length">Вопросы не найдены. Попробуйте изменить фильтры.</p>
        </div>
        <button v-if="readCards.length >= 2" class="primary-button learning-list__quiz" @click="startQuiz">Тест по изученным урокам · {{ Math.min(5, readCards.length) }} вопросов</button>
      </template>
    </template>
  </div>
</template>

<style scoped>
.learning-page { padding-bottom:18px; }
.learning-hero { padding:4px 0 12px; }.learning-hero h1 { margin:7px 0 10px; font-size:clamp(2rem,7vw,2.8rem); }.learning-hero p { max-width:630px; margin:0; color:var(--text-muted); font-size:.9rem; line-height:1.6; }
.learning-state { color:var(--text-muted); }
.topic-picker,.learning-filters label { display:grid; gap:7px; color:var(--text-muted); font-size:.78rem; font-weight:750; }
.topic-picker select,.learning-filters select,.learning-search { box-sizing:border-box; width:100%; min-height:46px; padding:10px 12px; border:1px solid var(--border-subtle); border-radius:13px; background:var(--surface); color:var(--text); font:inherit; font-size:.9rem; }
.learning-back { display:inline-flex; align-items:center; gap:7px; width:fit-content; margin:18px 0 0; padding:0; border:0; background:transparent; color:var(--text-muted); font:inherit; font-size:.78rem; font-weight:800; cursor:pointer; }
.learning-question { margin-top:10px; padding:22px; border:1px solid var(--border-subtle); border-radius:24px; background:var(--surface); }
.learning-question__meta { display:flex; align-items:center; gap:7px; color:var(--primary); font-size:.73rem; font-weight:800; }
.learning-question h2 { margin:16px 0 9px; color:var(--text); font-size:clamp(1.35rem,5vw,1.9rem); line-height:1.3; }
.learning-question p { margin:0; color:var(--text-muted); font-size:.82rem; line-height:1.5; }
.original-answer { min-width:0; margin-top:12px; border:1px solid var(--border-subtle); border-radius:16px; background:var(--surface); }
.original-answer summary { padding:14px 16px; color:var(--primary); font-size:.78rem; font-weight:800; cursor:pointer; }
.original-answer > div { min-width:0; padding:0 16px 16px; overflow-wrap:anywhere; }
.learning-navigation { display:grid; gap:9px; margin-top:16px; }.learning-navigation .primary-button,.learning-navigation .secondary-button { width:100%; }
.learning-list-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-top:25px; }.learning-list-heading h2 { margin:4px 0 6px; font-size:1.25rem; }.learning-list-heading p { margin:0; color:var(--text-muted); font-size:.78rem; line-height:1.5; }.learning-list-heading > span { padding:8px 10px; border-radius:11px; background:var(--primary-soft); color:var(--primary); font-size:.75rem; font-weight:800; }
.learning-filters { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:18px 0; }.learning-search { display:flex; align-items:center; gap:8px; padding:0 12px; }.learning-search svg { flex:none; color:var(--text-muted); }.learning-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:var(--text); font:inherit; font-size:.85rem; }
.learning-list { display:grid; gap:9px; }.learning-list > button { display:grid; grid-template-columns:20px 1fr 17px; align-items:center; gap:12px; min-width:0; padding:15px; border:1px solid var(--border-subtle); border-radius:17px; background:var(--surface); color:var(--text); text-align:left; font:inherit; font-size:.83rem; line-height:1.4; cursor:pointer; }.learning-list > button svg { color:var(--primary); }.learning-list > button span { min-width:0; overflow-wrap:anywhere; }.learning-list > p { color:var(--text-muted); }.learning-list__quiz { width:100%; margin-top:15px; }
.learning-quiz { padding:22px; border:1px solid var(--border-subtle); border-radius:24px; background:var(--surface); }.learning-quiz h2 { margin:14px 0 8px; font-size:clamp(1.3rem,5vw,1.8rem); line-height:1.35; }.learning-quiz > p { margin:0 0 18px; color:var(--text-muted); font-size:.82rem; }.learning-options { display:grid; gap:8px; }.learning-options button { width:100%; min-width:0; padding:13px; border:1px solid var(--border-subtle); border-radius:13px; background:var(--surface-muted); color:var(--text); text-align:left; font:inherit; font-size:.8rem; line-height:1.45; overflow-wrap:anywhere; cursor:pointer; }.learning-options button:disabled { opacity:1; cursor:default; }.learning-options .learning-option--correct { border-color:#91caa3; background:#edf9f0; }.learning-options .learning-option--wrong { border-color:#e8bb84; background:#fff6e9; }.learning-feedback { min-width:0; margin-top:16px; padding:15px; border-radius:16px; background:var(--surface-muted); overflow-wrap:anywhere; }.learning-feedback strong { color:var(--primary); }.learning-feedback :deep(.markdown-content) { font-size:.84rem; }.learning-feedback .primary-button { width:100%; margin-top:12px; }.learning-quiz--result { display:grid; justify-items:center; gap:10px; text-align:center; }.learning-quiz--result > svg { color:var(--primary); }.learning-quiz--result h2 { margin:0; }.learning-quiz--result .primary-button,.learning-quiz--result .secondary-button { width:100%; }
.learning-page :is(button,select,input,summary):focus-visible { outline:2px solid var(--primary); outline-offset:3px; }
@media (max-width:480px) { .learning-filters { grid-template-columns:1fr; }.learning-question,.learning-quiz { padding:17px; } }
@media (prefers-color-scheme:dark) { .learning-options .learning-option--correct,.learning-options .learning-option--wrong { background:var(--surface-muted); } }
</style>
