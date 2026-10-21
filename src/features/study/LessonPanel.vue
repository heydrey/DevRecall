<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpenCheck } from '@lucide/vue'
import type { Card } from '../content/types'
import MarkdownContent from '../../shared/markdown/MarkdownContent.vue'
import { explainCard } from './aiExplanation'
import { buildCardQuiz } from './quizBuilder'

const props = defineProps<{ card: Card; quizPool: Card[] }>()
const emit = defineEmits<{ completed: [cardId: string] }>()
const loading = ref(false)
const error = ref('')
const lesson = ref('')
const cached = ref(false)
const quiz = ref<ReturnType<typeof buildCardQuiz>>(null)
const selectedOptionId = ref<string | null>(null)
const answerCorrect = computed(() => selectedOptionId.value === quiz.value?.correctOptionId)

async function loadLesson(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await explainCard(props.card, 'lesson')
    lesson.value = result.text
    cached.value = result.cached
    quiz.value = buildCardQuiz(props.card, props.quizPool)
    selectedOptionId.value = null
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : 'Не удалось открыть урок.'
  } finally {
    loading.value = false
  }
}

function selectOption(id: string): void {
  if (selectedOptionId.value || !quiz.value) return
  selectedOptionId.value = id
  emit('completed', props.card.id)
}
</script>

<template>
  <details class="lesson-panel" open>
    <summary>
      <BookOpenCheck :size="20" aria-hidden="true" />
      <span><strong>Мини-урок по этому вопросу</strong><small>Два простых примера и мини-тест с вариантами</small></span>
    </summary>
    <div class="lesson-panel__body">
      <p v-if="!lesson">Откройте разбор, когда захотите вникнуть глубже. Обычная карточка и её оценки не изменятся.</p>
      <button v-if="!lesson" class="lesson-panel__button" :disabled="loading" @click="loadLesson">
        <span v-if="loading" class="lesson-panel__spinner" aria-hidden="true" />
        <BookOpenCheck v-else :size="17" aria-hidden="true" />
        {{ loading ? 'Готовим урок…' : 'Открыть мини-урок' }}
      </button>
      <p v-if="error" class="lesson-panel__error" role="alert">{{ error }} <button @click="loadLesson">Повторить</button></p>
      <template v-if="lesson">
        <div class="lesson-panel__content"><MarkdownContent :source="lesson" /></div>
        <p class="lesson-panel__footnote">{{ cached ? 'Урок сохранён на этом устройстве и доступен без интернета.' : 'Урок сохранится на этом устройстве для повторного чтения.' }} ИИ может ошибаться: при расхождении ориентируйтесь на исходную карточку.</p>
        <section v-if="quiz" class="lesson-check" aria-label="Мини-тест по уроку">
          <span class="lesson-check__eyebrow">Мини-тест · 1 вопрос</span>
          <h3>{{ quiz.prompt }}</h3>
          <p>Попробуйте ответить сами, затем выберите подходящий вариант.</p>
          <div class="lesson-check__options">
            <button v-for="option in quiz.options" :key="option.id" :disabled="Boolean(selectedOptionId)" :class="{ 'lesson-check__option--correct': selectedOptionId && option.id === quiz.correctOptionId, 'lesson-check__option--wrong': selectedOptionId === option.id && !answerCorrect }" @click="selectOption(option.id)">{{ option.text }}</button>
          </div>
          <div v-if="selectedOptionId" class="lesson-check__answer" role="status">
            <strong>{{ answerCorrect ? 'Верно!' : 'Не совсем — вот правильный ответ' }}</strong>
            <MarkdownContent :source="card.answer" />
            <p>Эта проверка не меняет интервалы повторения карточки.</p>
          </div>
        </section>
        <p v-else>Для этого вопроса пока не хватает вариантов ответа. Можно свериться с исходной карточкой ниже.</p>
      </template>
    </div>
  </details>
</template>

<style scoped>
.lesson-panel { min-width:0; margin-top:14px; border:1px solid var(--border-subtle); border-radius:20px; background:var(--surface); overflow:hidden; }
.lesson-panel > summary { display:flex; min-height:66px; align-items:center; gap:11px; padding:14px 17px; color:var(--primary); cursor:pointer; list-style:none; }
.lesson-panel > summary::-webkit-details-marker { display:none; }
.lesson-panel > summary > span { display:grid; min-width:0; flex:1; gap:2px; }
.lesson-panel > summary strong { color:var(--text); font-size:.86rem; }
.lesson-panel > summary small { color:var(--text-muted); font-size:.7rem; line-height:1.4; }
.lesson-panel > summary::after { content:'+'; font-size:1.2rem; font-weight:700; }
.lesson-panel[open] > summary::after { content:'−'; }
.lesson-panel__body { min-width:0; padding:0 17px 17px; }
.lesson-panel__body > p { margin:0 0 14px; color:var(--text-muted); font-size:.8rem; line-height:1.5; }
.lesson-panel__button { display:inline-flex; min-height:43px; align-items:center; justify-content:center; gap:8px; padding:10px 14px; border:0; border-radius:12px; background:var(--primary); color:white; font:inherit; font-size:.79rem; font-weight:800; cursor:pointer; }
.lesson-panel__button:disabled { opacity:.6; cursor:wait; }
.lesson-panel__spinner { width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin .7s linear infinite; }
.lesson-panel__error { padding:10px 12px; border-radius:12px; background:var(--surface-muted); color:var(--text); }
.lesson-panel__error button { border:0; background:transparent; color:var(--primary); font:inherit; font-weight:800; cursor:pointer; }
.lesson-panel__content { min-width:0; margin-bottom:16px; padding:16px; border-radius:16px; background:var(--surface-muted); overflow-wrap:anywhere; }
.lesson-panel__content :deep(.markdown-content) { font-size:.88rem; line-height:1.65; }
.lesson-panel__body > .lesson-panel__footnote { margin:0 0 16px; font-size:.69rem; }
.lesson-check { padding:15px; border-radius:16px; background:var(--surface-muted); }
.lesson-check__eyebrow { color:var(--primary); font-size:.68rem; font-weight:800; text-transform:uppercase; }
.lesson-check h3 { margin:8px 0 12px; color:var(--text); font-size:1.1rem; line-height:1.35; }
.lesson-check > p { color:var(--text-muted); font-size:.8rem; line-height:1.5; }
.lesson-check__options { display:grid; gap:8px; }
.lesson-check__options button { width:100%; min-width:0; padding:12px; border:1px solid var(--border-subtle); border-radius:12px; background:var(--surface); color:var(--text); text-align:left; font:inherit; font-size:.8rem; line-height:1.45; overflow-wrap:anywhere; cursor:pointer; }
.lesson-check__options button:disabled { opacity:1; cursor:default; }
.lesson-check__options .lesson-check__option--correct { border-color:#91caa3; background:#edf9f0; }
.lesson-check__options .lesson-check__option--wrong { border-color:#e8bb84; background:#fff6e9; }
.lesson-check__answer { min-width:0; margin:14px 0 0; padding:14px; border-radius:13px; background:var(--surface); overflow-wrap:anywhere; }
.lesson-check__answer > strong { color:var(--primary); }
.lesson-check__answer :deep(.markdown-content) { font-size:.85rem; }
.lesson-check__answer > p { color:var(--text-muted); font-size:.72rem; }
.lesson-panel :is(button,summary):focus-visible { outline:2px solid var(--primary); outline-offset:3px; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width:480px) { .lesson-panel__body { padding:0 12px 12px; }.lesson-panel__content { padding:12px; }.lesson-check { padding:12px; } }
@media (prefers-color-scheme:dark) { .lesson-check__options .lesson-check__option--correct,.lesson-check__options .lesson-check__option--wrong { background:var(--surface-muted); } }
</style>
