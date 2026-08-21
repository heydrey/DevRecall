<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, BookOpenCheck, BrainCircuit, Check, Lightbulb, RotateCcw, Sparkles, Star, X } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownContent from '../../shared/markdown/MarkdownContent.vue'
import { StaticCardRepository } from '../content/StaticCardRepository'
import { useProgressStore } from '../progress/progressStore'
import type { ReviewRating } from '../progress/types'
import { useStudyStore, type StudyMode } from './studyStore'
import type { RandomPool, SessionMinutes } from './sessionBuilder'
import { buildAnswerLead, buildKeywordHint } from './cardHints'
import { explainCard, hasCachedExplanation, isAiExplanationAvailable, type ExplanationMode } from './aiExplanation'

const route = useRoute()
const router = useRouter()
const studyStore = useStudyStore()
const progressStore = useProgressStore()
const repository = new StaticCardRepository()
const loading = ref(true)
const aiLoading = ref(false)
const aiError = ref('')
const aiText = ref('')
const aiMode = ref<ExplanationMode | null>(null)
const aiCached = ref(false)
const aiAvailable = ref(false)

onMounted(async () => {
  const mode = (route.query.mode as StudyMode | undefined) ?? 'today'
  if (mode === 'random') {
    const topics = await repository.getTopics()
    const requestedTopic = String(route.query.topicId ?? 'all')
    const topicId = requestedTopic === 'all' || topics.some((topic) => topic.id === requestedTopic) ? requestedTopic : 'all'
    const requestedPool = String(route.query.pool ?? 'all')
    const pool: RandomPool = requestedPool === 'difficult' || requestedPool === 'favorites' || requestedPool === 'unseen' ? requestedPool : 'all'
    const requestedMinutes = Number(route.query.minutes ?? progressStore.settings.sessionMinutes)
    const minutes: SessionMinutes = requestedMinutes === 0 || requestedMinutes === 5 || requestedMinutes === 10 || requestedMinutes === 20
      ? requestedMinutes
      : progressStore.settings.sessionMinutes
    await studyStore.startRandom({ topicId, pool, minutes })
  } else {
    await studyStore.start(mode, String(route.query.topicId ?? 'javascript'), route.query.sectionId ? String(route.query.sectionId) : undefined)
  }
  loading.value = false
  void isAiExplanationAvailable().then((available) => { aiAvailable.value = available })
})

const currentNumber = computed(() => Math.min(studyStore.currentIndex + 1, studyStore.cards.length))
const favorite = computed(() => studyStore.currentCard ? progressStore.isFavorite(studyStore.currentCard.id) : false)
const isNewCard = computed(() => studyStore.currentCard
  ? !(progressStore.progress[studyStore.currentCard.id]?.repetitions ?? 0)
  : false)
const keywordHint = computed(() => studyStore.currentCard ? buildKeywordHint(studyStore.currentCard) : '')
const answerLead = computed(() => studyStore.currentCard ? buildAnswerLead(studyStore.currentCard) : '')
const showAiTools = computed(() => aiAvailable.value || Boolean(studyStore.currentCard && hasCachedExplanation(studyStore.currentCard.id)))
const durationMinutes = computed(() => {
  if (!studyStore.startedAt) return 0
  return Math.max(1, Math.round((Date.now() - new Date(studyStore.startedAt).getTime()) / 60000))
})

const ratingOptions: Array<{ value: ReviewRating; label: string; hint: string; className: string }> = [
  { value: 'again', label: 'Изучаю', hint: 'повторим в этой сессии', className: 'rating--again' },
  { value: 'hard', label: 'Вспомнил с трудом', hint: 'вернётся раньше', className: 'rating--hard' },
  { value: 'good', label: 'Ответил верно', hint: 'обычный интервал', className: 'rating--good' },
  { value: 'easy', label: 'Знал уверенно', hint: 'длинный интервал', className: 'rating--easy' },
]

const resultTitle = computed(() => studyStore.rememberedCount
  ? 'Знания стали крепче!'
  : 'Первое знакомство готово!')
const resultText = computed(() => studyStore.mistakeCardIds.length
  ? `${studyStore.mistakeCardIds.length} сложных карточек уже найдены и поставлены на повторение.`
  : 'Все ответы удалось вспомнить — отличный результат для одной сессии.')

function rate(value: ReviewRating): void { studyStore.rate(value) }

watch(() => studyStore.currentCard?.id, () => {
  aiLoading.value = false
  aiError.value = ''
  aiText.value = ''
  aiMode.value = null
  aiCached.value = false
})

async function requestAiExplanation(mode: ExplanationMode): Promise<void> {
  const card = studyStore.currentCard
  if (!card || aiLoading.value) return
  aiLoading.value = true
  aiError.value = ''
  aiText.value = ''
  aiMode.value = mode
  try {
    const result = await explainCard(card, mode)
    aiText.value = result.text
    aiCached.value = result.cached
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : 'Не удалось получить объяснение.'
  } finally {
    aiLoading.value = false
  }
}
</script>

<template>
  <div class="study-page">
    <header class="study-header">
      <button class="icon-button" aria-label="Закрыть обучение" @click="router.push('/')"><X :size="21" /></button>
      <div class="study-header__progress">
        <span>{{ currentNumber }} / {{ studyStore.cards.length }} <template v-if="studyStore.currentStreak >= 2">· 🔥 {{ studyStore.currentStreak }}</template></span>
        <div><i :style="{ width: `${studyStore.progressPercent}%` }" /></div>
      </div>
      <button class="icon-button" :class="{ 'icon-button--favorite': favorite }" aria-label="Избранное" @click="studyStore.toggleFavorite"><Star :size="21" :fill="favorite ? 'currentColor' : 'none'" /></button>
    </header>

    <main v-if="loading" class="study-center"><span class="loader" /><p>Готовим карточки…</p></main>

    <main v-else-if="studyStore.finished" class="study-center">
      <section v-if="studyStore.cards.length" class="result-card">
        <div class="result-card__icon"><Check :size="30" /></div>
        <span class="eyebrow">Сессия завершена</span>
        <h1>{{ resultTitle }}</h1>
        <p>Вы разобрали {{ studyStore.completedUniqueCount }} карточек за {{ durationMinutes }} мин.</p>
        <p class="result-insight">{{ resultText }}</p>
        <div class="result-grid">
          <div><strong>{{ studyStore.newCardsLearnedCount }}</strong><span>новых разобрано</span></div>
          <div><strong>{{ studyStore.mistakeCardIds.length }}</strong><span>сложных разобрано</span></div>
          <div><strong>{{ studyStore.rememberedCount }}</strong><span>ответов вспомнили</span></div>
          <div><strong>{{ studyStore.bestStreak }}</strong><span>лучшая серия</span></div>
        </div>
        <button v-if="studyStore.mistakeCardIds.length" class="primary-button" @click="studyStore.repeatMistakes"><RotateCcw :size="18" />Закрепить сложные</button>
        <button class="secondary-button" @click="studyStore.restartSession"><RotateCcw :size="18" />{{ studyStore.mode === 'random' ? 'Ещё одна случайная тренировка' : 'Пройти ещё раз' }}</button>
        <RouterLink class="back-link back-link--center" to="/">На главную</RouterLink>
      </section>
      <section v-else class="result-card">
        <div class="result-card__icon"><Star :size="28" /></div>
        <h1>Здесь пока нет карточек</h1>
        <p>{{ studyStore.mode === 'random' ? 'По выбранным условиям ничего не найдено. Измените тему или набор.' : 'Добавьте вопросы в избранное или выберите другой режим.' }}</p>
        <RouterLink class="primary-button" :to="studyStore.mode === 'random' ? '/study/random' : '/study?mode=today'">{{ studyStore.mode === 'random' ? 'Изменить условия' : 'Учиться сегодня' }}</RouterLink>
        <RouterLink class="back-link back-link--center" to="/"><ArrowLeft :size="18" />На главную</RouterLink>
      </section>
    </main>

    <main v-else-if="studyStore.currentCard" class="study-content">
      <div v-if="progressStore.persistenceWarning" class="persistence-warning">{{ progressStore.persistenceWarning }}<button @click="progressStore.clearPersistenceWarning">×</button></div>
      <section class="question-card">
        <div v-if="isNewCard" class="new-card-note">
          <Sparkles :size="18" />
          <div><strong>Новая карточка</strong><span>Её не нужно знать заранее — сейчас разберём.</span></div>
        </div>
        <div class="question-card__meta">
          <span>{{ studyStore.currentCard.sectionId.replace('-', ' ') }}</span>
          <b>{{ studyStore.currentCard.level }}</b>
        </div>
        <h1>{{ studyStore.currentCard.question }}</h1>
        <div v-if="!studyStore.answerVisible && studyStore.hintStage" class="hint-block">
          <Lightbulb :size="20" />
          <div>
            <strong>{{ studyStore.hintStage === 1 ? 'Опорные понятия' : 'Начало объяснения' }}</strong>
            <span>{{ studyStore.hintStage === 1 ? keywordHint : answerLead }}</span>
          </div>
        </div>
        <div v-if="studyStore.answerVisible" class="answer-block">
          <span class="answer-block__label">Ответ</span>
          <MarkdownContent :source="studyStore.currentCard.answer" />
          <div v-if="showAiTools" class="ai-tools">
            <div class="ai-tools__heading"><BrainCircuit :size="19" /><div><strong>Выберите глубину разбора</strong><span>Оба режима объясняют именно эту карточку.</span></div></div>
            <div class="ai-tools__buttons">
              <button :disabled="aiLoading" @click="requestAiExplanation('simple')"><Sparkles :size="17" /><span><strong>Объяснить проще</strong><small>Без жаргона, с аналогией и словарём</small></span></button>
              <button :disabled="aiLoading" @click="requestAiExplanation('deep')"><BookOpenCheck :size="17" /><span><strong>Копнуть глубже</strong><small>Для собеседования: механизм и нюансы</small></span></button>
            </div>
          </div>
          <div v-if="aiLoading" class="ai-state" aria-live="polite"><span class="loader loader--small" /><span>{{ aiMode === 'deep' ? 'Готовим подробный разбор…' : 'Переводим на простой язык…' }}</span></div>
          <div v-else-if="aiError" class="ai-error" aria-live="polite">{{ aiError }}<button @click="aiMode && requestAiExplanation(aiMode)">Повторить</button></div>
          <section v-else-if="aiText" class="ai-answer">
            <header><div><BrainCircuit :size="18" /><strong>{{ aiMode === 'deep' ? 'Подробный разбор' : 'Простое объяснение' }}</strong></div><span v-if="aiCached">сохранено</span></header>
            <MarkdownContent :source="aiText" />
            <small>Ответ создан ИИ и может содержать неточность. Текст карточки остаётся основным.</small>
          </section>
        </div>
      </section>

      <div v-if="!studyStore.answerVisible" class="study-actions">
        <p>{{ isNewCard ? 'Можно попробовать догадаться или сразу изучить объяснение — оба варианта полезны.' : 'Сформулируйте ответ вслух или про себя, затем сверьте себя.' }}</p>
        <button v-if="studyStore.hintStage < 2" class="hint-button" @click="studyStore.revealHint"><Lightbulb :size="17" />{{ studyStore.hintStage ? 'Ещё подсказка' : 'Нужна подсказка' }}</button>
        <button class="primary-button" @click="studyStore.revealAnswer">Сверить ответ</button>
        <button class="secondary-button" @click="studyStore.startLearning"><BookOpenCheck :size="18" />Не знаю — объясни</button>
      </div>
      <div v-else-if="studyStore.learningMode" class="rating-panel learning-panel">
        <div class="learning-panel__message"><BookOpenCheck :size="21" /><div><strong>Теперь этот вопрос уже знаком</strong><span>Не знать до объяснения нормально. Следующая встреча закрепит ответ.</span></div></div>
        <button class="primary-button" @click="rate('again')">Понятно, повторим позже</button>
      </div>
      <div v-else class="rating-panel">
        <p>Что вы помнили до просмотра ответа?</p>
        <div class="rating-grid">
          <button v-for="option in ratingOptions" :key="option.value" :class="['rating-button', option.className]" @click="rate(option.value)">
            <strong>{{ option.label }}</strong><span>{{ option.hint }}</span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.study-page { min-height:100dvh; background:var(--page); }
.study-header { position:sticky; z-index:10; top:0; display:grid; grid-template-columns:44px 1fr 44px; align-items:center; gap:14px; width:min(100%,760px); margin:0 auto; padding:14px 16px; background:color-mix(in srgb,var(--page) 88%,transparent); backdrop-filter:blur(18px); }
.study-header__progress { display:flex; flex-direction:column; gap:7px; text-align:center; }
.study-header__progress > span { color:var(--text-muted); font-size:.72rem; font-weight:750; }
.study-header__progress > div { height:6px; overflow:hidden; border-radius:99px; background:var(--surface-muted); }
.study-header__progress i { display:block; height:100%; border-radius:inherit; background:var(--primary); transition:width 220ms ease; }
.icon-button--favorite { color:#e3a52a; }
.study-content { display:flex; width:min(100%,720px); min-width:0; min-height:calc(100dvh - 80px); margin:0 auto; padding:16px 16px 28px; flex-direction:column; }
.persistence-warning { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; padding:11px 14px; border:1px solid #e9c475; border-radius:14px; background:#fff8e7; color:#77510d; font-size:.78rem; }
.persistence-warning button { border:0; background:transparent; color:inherit; font-size:1.2rem; cursor:pointer; }
.question-card { min-width:0; max-width:100%; flex:1; padding:24px; border:1px solid var(--border-subtle); border-radius:30px; background:var(--surface); box-shadow:var(--shadow-md); }
.new-card-note { display:flex; align-items:center; gap:10px; margin-bottom:22px; padding:12px 14px; border-radius:17px; background:var(--primary-soft); color:var(--primary); }
.new-card-note > div { display:flex; flex-direction:column; gap:2px; }.new-card-note strong { font-size:.78rem; }.new-card-note span { color:var(--text-muted); font-size:.7rem; }
.question-card__meta { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.question-card__meta span,.question-card__meta b { padding:7px 10px; border-radius:999px; background:var(--surface-muted); color:var(--text-muted); font-size:.68rem; font-weight:800; text-transform:uppercase; }
.question-card h1 { margin:34px 0; font-size:clamp(1.55rem,6vw,2.35rem); line-height:1.25; letter-spacing:-.035em; }
.answer-block { min-width:0; max-width:100%; padding-top:22px; border-top:1px solid var(--border-subtle); animation:answer-in 180ms ease; }
.hint-block { display:flex; align-items:flex-start; gap:11px; margin:0 0 22px; padding:14px; border:1px solid color-mix(in srgb,#e5ad32 42%,var(--border-subtle)); border-radius:18px; background:color-mix(in srgb,#fff4cf 70%,var(--surface)); color:#9b6912; animation:answer-in 180ms ease; }
.hint-block > div { display:flex; flex-direction:column; gap:4px; }.hint-block strong { font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; }.hint-block span { color:var(--text); font-size:.88rem; line-height:1.45; }
.answer-block__label { display:block; margin-bottom:12px; color:var(--primary); font-size:.72rem; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
.ai-tools { margin-top:24px; padding-top:18px; border-top:1px solid var(--border-subtle); }
.ai-tools__heading { display:flex; align-items:center; gap:10px; color:var(--primary); }.ai-tools__heading > div { display:flex; flex-direction:column; gap:2px; }.ai-tools__heading strong { color:var(--text); font-size:.84rem; }.ai-tools__heading span { color:var(--text-muted); font-size:.7rem; }
.ai-tools__buttons { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }.ai-tools__buttons button { display:flex; min-width:0; min-height:58px; align-items:center; justify-content:flex-start; gap:9px; padding:9px 11px; border:1px solid var(--border-subtle); border-radius:14px; background:var(--surface-muted); color:var(--text); text-align:left; cursor:pointer; }.ai-tools__buttons button > span { display:flex; min-width:0; flex-direction:column; gap:2px; }.ai-tools__buttons button strong { font-size:.75rem; }.ai-tools__buttons button small { color:var(--text-muted); font-size:.63rem; font-weight:650; line-height:1.3; }.ai-tools__buttons button:disabled { opacity:.55; cursor:wait; }
.ai-state { display:flex; align-items:center; justify-content:center; gap:10px; margin-top:12px; padding:16px; border-radius:16px; background:var(--surface-muted); color:var(--text-muted); font-size:.78rem; }.loader--small { width:22px; height:22px; border-width:3px; }
.ai-error { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; padding:13px 14px; border-radius:16px; background:#fff0ef; color:#a8322b; font-size:.76rem; }.ai-error button { border:0; background:transparent; color:inherit; font-weight:800; cursor:pointer; }
.ai-answer { min-width:0; max-width:100%; overflow:hidden; margin-top:12px; padding:18px; border:1px solid color-mix(in srgb,var(--primary) 28%,var(--border-subtle)); border-radius:20px; background:color-mix(in srgb,var(--primary-soft) 38%,var(--surface)); }
.ai-answer header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; color:var(--primary); }.ai-answer header > div { display:flex; align-items:center; gap:8px; }.ai-answer header strong { font-size:.82rem; }.ai-answer header > span { padding:4px 7px; border-radius:999px; background:var(--surface); color:var(--text-muted); font-size:.62rem; font-weight:800; text-transform:uppercase; }.ai-answer small { display:block; margin-top:14px; color:var(--text-muted); font-size:.66rem; line-height:1.45; }
.study-actions,.rating-panel { padding:20px 4px 0; }
.study-actions p,.rating-panel > p { margin:0 0 14px; color:var(--text-muted); font-size:.84rem; line-height:1.45; text-align:center; }
.study-actions .primary-button { width:100%; }
.study-actions { display:grid; gap:9px; }.study-actions p { margin-bottom:4px; }.study-actions .secondary-button { width:100%; }
.hint-button { display:inline-flex; width:fit-content; min-height:38px; align-items:center; justify-self:center; gap:7px; padding:0 12px; border:0; background:transparent; color:var(--primary); font-size:.78rem; font-weight:800; cursor:pointer; }
.learning-panel { display:grid; gap:12px; }.learning-panel .primary-button { width:100%; }
.learning-panel__message { display:flex; align-items:flex-start; gap:11px; padding:14px; border-radius:18px; background:var(--primary-soft); color:var(--primary); }
.learning-panel__message > div { display:flex; flex-direction:column; gap:4px; }.learning-panel__message strong { font-size:.86rem; }.learning-panel__message span { color:var(--text-muted); font-size:.75rem; line-height:1.4; }
.rating-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
.rating-button { display:flex; min-height:68px; flex-direction:column; align-items:flex-start; justify-content:center; gap:3px; padding:12px 15px; border:1px solid var(--border-subtle); border-radius:18px; background:var(--surface); color:var(--text); cursor:pointer; }
.rating-button span { color:var(--text-muted); font-size:.68rem; }
.rating--again { border-color:#f2b8b3; background:#fff0ef; color:#a8322b; }
.rating--hard { border-color:#f2d18e; background:#fff8e9; color:#946116; }
.rating--good { border-color:#a9d8ba; background:#effaf3; color:#237143; }
.rating--easy { border-color:#bdb3f4; background:#f2efff; color:#5941c7; }
.study-center { display:grid; min-height:calc(100dvh - 80px); place-items:center; padding:20px; }
.result-card { width:min(100%,520px); padding:28px; border:1px solid var(--border-subtle); border-radius:30px; background:var(--surface); text-align:center; box-shadow:var(--shadow-lg); }
.result-card__icon { display:grid; width:64px; height:64px; place-items:center; margin:0 auto 20px; border-radius:22px; background:var(--primary-soft); color:var(--primary); }
.result-card h1 { margin:7px 0; font-size:2rem; }
.result-card > p { margin:0 0 22px; color:var(--text-muted); }
.result-card > .result-insight { margin:-10px 0 20px; padding:12px 14px; border-radius:16px; background:var(--primary-soft); color:var(--text); font-size:.82rem; line-height:1.45; }
.result-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px; }
.result-grid div { display:flex; flex-direction:column; gap:3px; padding:14px; border-radius:17px; background:var(--surface-muted); }
.result-grid strong { font-size:1.35rem; }.result-grid span { color:var(--text-muted); font-size:.72rem; }
.result-card .primary-button,.result-card .secondary-button { width:100%; margin-top:9px; }
.back-link--center { justify-content:center; margin-top:20px; }
@keyframes answer-in { from { opacity:0; transform:translateY(8px); } }
@media (prefers-color-scheme:dark) { .rating--again,.rating--hard,.rating--good,.rating--easy { background:var(--surface-muted); } }
@media (prefers-color-scheme:dark) { .ai-error { background:var(--surface-muted); color:#ff9f98; } }
@media (max-width:440px) { .ai-tools__buttons { grid-template-columns:1fr; } }
</style>
