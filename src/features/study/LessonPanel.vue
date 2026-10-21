<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ArrowLeft, ArrowRight, BookOpenCheck, RotateCcw } from '@lucide/vue'
import type { Card } from '../content/types'
import MarkdownContent from '../../shared/markdown/MarkdownContent.vue'
import { explainCard, hasCachedLesson, regenerateLesson } from './aiExplanation'
import { buildCardQuiz } from './quizBuilder'
import { structureLesson, type LessonQuestion } from './lessonStructure'

const props = defineProps<{ card: Card; quizPool: Card[] }>()
const emit = defineEmits<{ completed: [cardId: string] }>()
const panel = ref<HTMLElement | null>(null)
const loading = ref(false)
const error = ref('')
const lesson = ref('')
const cached = ref(false)
const stepIndex = ref(0)
const pauseRevealed = ref(false)
const selectedOptionId = ref<string | null>(null)
const fallbackQuiz = ref<LessonQuestion | null>(null)
const structure = computed(() => structureLesson(lesson.value))
const quiz = computed(() => structure.value.question ?? fallbackQuiz.value)
const onQuiz = computed(() => stepIndex.value >= structure.value.parts.length)
const activePart = computed(() => structure.value.parts[stepIndex.value] ?? null)
const totalSteps = computed(() => structure.value.parts.length + 1)
const answerCorrect = computed(() => selectedOptionId.value === quiz.value?.correctOptionId)
const progressKey = computed(() => `devrecall:lesson-step:v1:${props.card.id}`)

function lessonSignature(source: string): string {
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619)
  }
  return (hash >>> 0).toString(36)
}

function restoreStep(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey.value) ?? 'null') as { signature?: string; step?: number } | null
    stepIndex.value = saved?.signature === lessonSignature(lesson.value) && Number.isInteger(saved.step)
      ? Math.min(Math.max(saved.step ?? 0, 0), structure.value.parts.length)
      : 0
  } catch {
    stepIndex.value = 0
  }
}

function saveStep(): void {
  try {
    localStorage.setItem(progressKey.value, JSON.stringify({ signature: lessonSignature(lesson.value), step: stepIndex.value }))
  } catch {
    // Продолжить текущий урок можно и без сохранения шага.
  }
}

async function loadLesson(force = false): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const result = force ? await regenerateLesson(props.card) : await explainCard(props.card, 'lesson')
    lesson.value = result.text
    cached.value = result.cached
    const oldQuiz = buildCardQuiz(props.card, props.quizPool)
    fallbackQuiz.value = oldQuiz ? {
      prompt: oldQuiz.prompt,
      options: oldQuiz.options,
      correctOptionId: oldQuiz.correctOptionId,
      explanation: props.card.answer,
    } : null
    selectedOptionId.value = null
    pauseRevealed.value = false
    if (force) {
      stepIndex.value = 0
      saveStep()
    } else restoreStep()
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : 'Не удалось открыть урок.'
  } finally {
    loading.value = false
  }
}

async function changeStep(next: number): Promise<void> {
  stepIndex.value = Math.min(Math.max(next, 0), structure.value.parts.length)
  pauseRevealed.value = false
  saveStep()
  await nextTick()
  panel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function selectOption(id: string): void {
  if (selectedOptionId.value || !quiz.value) return
  selectedOptionId.value = id
  emit('completed', props.card.id)
}

onMounted(() => {
  if (hasCachedLesson(props.card)) void loadLesson()
})
</script>

<template>
  <section ref="panel" class="lesson-panel" aria-label="Мини-урок по вопросу">
    <header class="lesson-panel__header">
      <BookOpenCheck :size="20" aria-hidden="true" />
      <span><strong>Мини-урок по этому вопросу</strong><small>Понимание по шагам, без таймера</small></span>
    </header>
    <div class="lesson-panel__body">
      <p v-if="!lesson">Один подробный разбор, показанный небольшими частями. На каждом шаге можно остановиться и вернуться позже.</p>
      <button v-if="!lesson" class="lesson-panel__button" :disabled="loading" @click="loadLesson()">
        <span v-if="loading" class="lesson-panel__spinner" aria-hidden="true" />
        <BookOpenCheck v-else :size="17" aria-hidden="true" />
        {{ loading ? 'Готовим урок…' : 'Открыть мини-урок' }}
      </button>
      <p v-if="error" class="lesson-panel__error" role="alert">{{ error }} <button @click="loadLesson()">Повторить</button></p>
      <template v-if="lesson">
        <div class="lesson-panel__progress">
          <span>Шаг {{ stepIndex + 1 }} из {{ totalSteps }}</span>
          <span>{{ onQuiz ? 'Проверка понимания' : activePart?.title }}</span>
          <div role="progressbar" :aria-valuenow="stepIndex + 1" :aria-valuemin="1" :aria-valuemax="totalSteps" aria-label="Прогресс урока"><span :style="{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }" /></div>
        </div>

        <article v-if="!onQuiz && activePart" class="lesson-panel__content">
          <span class="lesson-panel__eyebrow">{{ activePart.title }}</span>
          <MarkdownContent :source="activePart.content" />
          <div v-if="activePart.pause" class="lesson-panel__pause">
            <strong>Пауза для понимания</strong>
            <p>{{ activePart.pause.question }}</p>
            <button v-if="!pauseRevealed" @click="pauseRevealed = true">Подумал — показать разбор</button>
            <p v-else class="lesson-panel__pause-answer">{{ activePart.pause.explanation }}</p>
          </div>
        </article>

        <section v-else-if="quiz" class="lesson-check" aria-label="Мини-тест по уроку">
          <span class="lesson-panel__eyebrow">{{ structure.question ? 'Мини-тест по примеру' : 'Проверка по карточке' }}</span>
          <h3>{{ quiz.prompt }}</h3>
          <p>Выберите вариант. Если ошибётесь, покажем объяснение — без штрафа.</p>
          <div class="lesson-check__options">
            <button v-for="option in quiz.options" :key="option.id" :disabled="Boolean(selectedOptionId)" :class="{ 'lesson-check__option--correct': selectedOptionId && option.id === quiz.correctOptionId, 'lesson-check__option--wrong': selectedOptionId === option.id && !answerCorrect }" @click="selectOption(option.id)">{{ option.text }}</button>
          </div>
          <div v-if="selectedOptionId" class="lesson-check__answer" role="status">
            <strong>{{ answerCorrect ? 'Да, именно так!' : 'Теперь понятно, где была ловушка' }}</strong>
            <MarkdownContent :source="quiz.explanation || card.answer" />
            <p>Урок изучен. Эта проверка не меняет интервалы повторения карточки.</p>
            <button class="lesson-panel__retry" @click="selectedOptionId = null"><RotateCcw :size="15" />Пройти ещё раз</button>
          </div>
          <p v-if="!structure.question" class="lesson-check__legacy">Этот урок был создан раньше: варианты взяты из карточек темы. Чтобы получить проверку именно по примеру, можно обновить урок одним запросом к ИИ.</p>
        </section>
        <p v-else>Для этой темы не удалось составить варианты. Сверьтесь с исходной карточкой ниже.</p>

        <div class="lesson-panel__navigation">
          <button v-if="stepIndex > 0" class="lesson-panel__previous" @click="changeStep(stepIndex - 1)"><ArrowLeft :size="16" />Назад</button>
          <button v-if="!onQuiz" class="lesson-panel__button" @click="changeStep(stepIndex + 1)">{{ stepIndex === structure.parts.length - 1 ? 'К мини-тесту' : 'Следующий шаг' }}<ArrowRight :size="17" /></button>
        </div>

        <details class="lesson-panel__full">
          <summary>Показать весь подробный разбор</summary>
          <div><MarkdownContent :source="structure.fullText" /></div>
        </details>
        <button v-if="!structure.question" class="lesson-panel__refresh" :disabled="loading" @click="loadLesson(true)">{{ loading ? 'Обновляем урок…' : 'Обновить урок и тест по примеру · 1 запрос ИИ' }}</button>
        <p class="lesson-panel__footnote">{{ cached ? 'Разбор сохранён на этом устройстве и доступен без интернета.' : 'Разбор сохранится на этом устройстве.' }} Шаг тоже сохраняется здесь. ИИ может ошибаться: при расхождении ориентируйтесь на исходную карточку.</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.lesson-panel { min-width:0; margin-top:14px; scroll-margin-top:18px; border:1px solid var(--border-subtle); border-radius:20px; background:var(--surface); overflow:hidden; }
.lesson-panel__header { display:flex; align-items:center; gap:11px; min-height:66px; padding:14px 17px; color:var(--primary); }
.lesson-panel__header > span { display:grid; min-width:0; gap:2px; }
.lesson-panel__header strong { color:var(--text); font-size:.86rem; }
.lesson-panel__header small { color:var(--text-muted); font-size:.7rem; line-height:1.4; }
.lesson-panel__body { min-width:0; padding:0 17px 17px; }
.lesson-panel__body > p { margin:0 0 14px; color:var(--text-muted); font-size:.8rem; line-height:1.5; }
.lesson-panel__button { display:inline-flex; min-height:44px; align-items:center; justify-content:center; gap:8px; padding:10px 15px; border:0; border-radius:12px; background:var(--primary); color:white; font:inherit; font-size:.8rem; font-weight:800; cursor:pointer; }
.lesson-panel__button:disabled { opacity:.6; cursor:wait; }
.lesson-panel__spinner { width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin .7s linear infinite; }
.lesson-panel__error { padding:10px 12px; border-radius:12px; background:var(--surface-muted); color:var(--text); }
.lesson-panel__error button { border:0; background:transparent; color:var(--primary); font:inherit; font-weight:800; cursor:pointer; }
.lesson-panel__progress { display:grid; grid-template-columns:auto 1fr; gap:8px 12px; margin:4px 0 15px; color:var(--text-muted); font-size:.72rem; font-weight:750; }
.lesson-panel__progress > span:nth-child(2) { text-align:right; }
.lesson-panel__progress > div { grid-column:1/-1; height:6px; border-radius:99px; background:var(--surface-muted); overflow:hidden; }
.lesson-panel__progress > div > span { display:block; height:100%; border-radius:inherit; background:var(--primary); transition:width .2s ease; }
.lesson-panel__eyebrow { color:var(--primary); font-size:.7rem; font-weight:850; text-transform:uppercase; }
.lesson-panel__content,.lesson-check { min-width:0; padding:18px; border-radius:16px; background:var(--surface-muted); overflow-wrap:anywhere; }
.lesson-panel__content :deep(.markdown-content) { margin-top:11px; font-size:.91rem; line-height:1.7; }
.lesson-panel__pause { margin-top:18px; padding:14px; border:1px solid var(--border-subtle); border-radius:14px; background:var(--surface); }
.lesson-panel__pause > strong { color:var(--primary); font-size:.76rem; }
.lesson-panel__pause > p { margin:8px 0; color:var(--text); font-size:.84rem; line-height:1.55; }
.lesson-panel__pause button,.lesson-panel__retry { min-height:42px; padding:8px 0; border:0; background:transparent; color:var(--primary); font:inherit; font-size:.78rem; font-weight:800; cursor:pointer; }
.lesson-panel__pause .lesson-panel__pause-answer { padding-top:10px; border-top:1px solid var(--border-subtle); color:var(--text-muted); }
.lesson-panel__navigation { display:flex; justify-content:flex-end; gap:10px; margin-top:15px; }
.lesson-panel__previous { display:inline-flex; min-height:44px; align-items:center; gap:6px; padding:10px; border:0; background:transparent; color:var(--primary); font:inherit; font-size:.78rem; font-weight:800; cursor:pointer; }
.lesson-check h3 { margin:9px 0 10px; color:var(--text); font-size:1.08rem; line-height:1.4; }
.lesson-check > p { margin:0 0 14px; color:var(--text-muted); font-size:.8rem; line-height:1.5; }
.lesson-check__options { display:grid; gap:8px; }
.lesson-check__options button { width:100%; min-width:0; min-height:44px; padding:12px; border:1px solid var(--border-subtle); border-radius:12px; background:var(--surface); color:var(--text); text-align:left; font:inherit; font-size:.8rem; line-height:1.45; overflow-wrap:anywhere; cursor:pointer; }
.lesson-check__options button:disabled { opacity:1; cursor:default; }
.lesson-check__options .lesson-check__option--correct { border-color:#91caa3; background:#edf9f0; }
.lesson-check__options .lesson-check__option--wrong { border-color:#e8bb84; background:#fff6e9; }
.lesson-check__answer { min-width:0; margin-top:14px; padding:14px; border-radius:13px; background:var(--surface); overflow-wrap:anywhere; }
.lesson-check__answer > strong { color:var(--primary); }
.lesson-check__answer :deep(.markdown-content) { margin-top:9px; font-size:.85rem; }
.lesson-check__answer > p { color:var(--text-muted); font-size:.72rem; }
.lesson-check__answer .lesson-panel__retry { display:inline-flex; align-items:center; gap:6px; }
.lesson-check > .lesson-check__legacy { margin:14px 0 0; font-size:.72rem; }
.lesson-panel__full { min-width:0; margin-top:17px; border-top:1px solid var(--border-subtle); }
.lesson-panel__full summary { min-height:44px; padding:12px 0; color:var(--primary); font-size:.78rem; font-weight:800; cursor:pointer; }
.lesson-panel__full > div { min-width:0; padding:12px; border-radius:13px; background:var(--surface-muted); }
.lesson-panel__full :deep(.markdown-content) { font-size:.83rem; }
.lesson-panel__refresh { min-height:44px; margin-top:8px; padding:8px 0; border:0; background:transparent; color:var(--primary); font:inherit; font-size:.76rem; font-weight:800; text-align:left; cursor:pointer; }
.lesson-panel__refresh:disabled { opacity:.6; cursor:wait; }
.lesson-panel__body > .lesson-panel__footnote { margin:10px 0 0; font-size:.69rem; }
.lesson-panel :is(button,summary):focus-visible { outline:2px solid var(--primary); outline-offset:3px; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width:480px) { .lesson-panel__body { padding:0 12px 12px; }.lesson-panel__content,.lesson-check { padding:14px; }.lesson-panel__navigation .lesson-panel__button { flex:1; } }
@media (prefers-color-scheme:dark) { .lesson-check__options .lesson-check__option--correct,.lesson-check__options .lesson-check__option--wrong { background:var(--surface-muted); } }
</style>
