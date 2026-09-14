<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Card } from '../content/types'
import type { ReviewRating } from '../progress/types'
import MarkdownContent from '../../shared/markdown/MarkdownContent.vue'
import { buildLearningGuide } from './learningGuide'
import { buildAnswerLead, buildKeywordHint } from './cardHints'

const props = defineProps<{ card: Card; answerVisible: boolean; hintStage: number; learningMode: boolean; practice: boolean }>()
const emit = defineEmits<{
  reveal: []; hint: []; learn: []; rate: [rating: ReviewRating]; retry: []
}>()
const guide = computed(() => buildLearningGuide(props.card))
const draft = ref('')
const answeredSilently = ref(false)
const attempted = computed(() => Boolean(draft.value.trim()) || answeredSilently.value)
const helped = computed(() => props.learningMode || props.hintStage > 0)
const phase = ref<'first' | 'retry' | 'retry-check'>('first')
const retryDraft = ref('')
const retrySpoken = ref(false)
const checked = ref<number[]>([])
const reflection = ref('')
const exerciseDraft = ref('')
const exerciseSpoken = ref(false)
const solutionVisible = ref(false)
const retryInput = ref<HTMLTextAreaElement | null>(null)
const anchor = ref<HTMLElement | null>(null)
const originalRating = ref<ReviewRating | null>(null)
const canCheckRetry = computed(() => Boolean(retryDraft.value.trim()) || retrySpoken.value)
const canCheckExercise = computed(() => Boolean(exerciseDraft.value.trim()) || exerciseSpoken.value)
const options: { value: ReviewRating; title: string; hint: string }[] = [
  { value: 'again', title: 'Только часть / пока не вспомнил', hint: 'снова разберём и повторим раньше' },
  { value: 'hard', title: 'Сам, но с трудом', hint: 'смысл верный, вспоминал долго' },
  { value: 'good', title: 'Сам, по смыслу', hint: 'основные мысли верны' },
  { value: 'easy', title: 'Сам, легко', hint: 'уверенно объяснил без помощи' },
]

function reveal(): void {
  // Просмотр до собственной попытки — обучение, а не успешное извлечение.
  if (!attempted.value) emit('learn')
  else emit('reveal')
}
async function startRetry(): Promise<void> {
  phase.value = 'retry'
  await nextTick()
  anchor.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  retryInput.value?.focus({ preventScroll: true })
}
function checkRetry(): void {
  if (!canCheckRetry.value) return
  checked.value = []
  phase.value = 'retry-check'
  emit('retry')
}
function chooseRating(rating: ReviewRating): void {
  if (rating === 'again' && phase.value === 'first') {
    originalRating.value = 'again'
    void startRetry()
  } else emit('rate', originalRating.value ?? rating)
}
</script>

<template>
  <section ref="anchor" class="learning-workbench" aria-label="Учимся вспоминать">
    <div v-if="!answerVisible" class="attempt-panel">
      <span class="step-label">1 · Вспомнить</span>
      <label for="own-answer"><strong>Как бы вы объяснили это своими словами?</strong></label>
      <p>Можно коротко и неидеально. Важен смысл, а не совпадение с учебником.</p>
      <textarea id="own-answer" v-model="draft" rows="3" maxlength="4000" placeholder="Главная мысль… Например…" />
      <button class="quiet-button" :aria-pressed="answeredSilently" @click="answeredSilently = !answeredSilently">{{ answeredSilently ? '✓ Ответил вслух / про себя' : 'Я ответил вслух / про себя' }}</button>
      <small>Черновик только в этой карточке: не отправляется ИИ и не сохраняется после перехода.</small>
      <div v-if="hintStage" class="learning-notice"><strong>Подсказка</strong><p>{{ hintStage === 1 ? buildKeywordHint(card) : buildAnswerLead(card) }}</p><small>{{ practice ? 'Попытка с помощью — повторим в этом занятии.' : 'Это попытка с помощью — повторим раньше.' }}</small></div>
      <button v-if="hintStage < 2" class="quiet-button" @click="emit('hint')">{{ hintStage ? 'Ещё подсказка' : 'Нужна подсказка' }}</button>
      <button class="primary-button" @click="reveal">{{ attempted ? 'Сверить мой ответ' : 'Посмотреть и разобраться' }}</button>
      <button class="secondary-button" @click="emit('learn')">Впервые вижу — разобрать по шагам</button>
    </div>

    <div v-else-if="phase === 'retry'" class="attempt-panel">
      <span class="step-label">3 · Вспомнить без текста</span>
      <h2>Объяснение скрыто. Попробуйте ещё раз</h2>
      <p>Одной-двух фраз достаточно. Эта попытка помогает закрепить, но не заменяет повторение в другой день.</p>
      <label for="retry-answer">Главная мысль и пример</label>
      <textarea id="retry-answer" ref="retryInput" v-model="retryDraft" rows="4" maxlength="4000" placeholder="Теперь я объяснил бы так…" />
      <button class="quiet-button" :aria-pressed="retrySpoken" @click="retrySpoken = !retrySpoken">{{ retrySpoken ? '✓ Повторил вслух / про себя' : 'Повторил вслух / про себя' }}</button>
      <button class="primary-button" :disabled="!canCheckRetry" @click="checkRetry">Сверить повторную попытку</button>
      <button class="quiet-button" @click="phase = 'retry-check'">Пока не получается — вернуться к объяснению</button>
      <button class="secondary-button" @click="emit('rate', originalRating ?? 'again')">{{ practice ? 'Продолжить тренировку' : 'Сохранить и повторить позже' }}</button>
    </div>

    <div v-else class="review-panel">
      <span class="step-label">{{ phase === 'retry-check' ? '4 · Проверить себя' : '2 · Разобраться и сверить' }}</span>
      <div v-if="helped" class="learning-notice"><strong>Сейчас вы учитесь, а не сдаёте экзамен</strong><p>{{ practice ? 'Была помощь или просмотр до ответа. Повторим в этом занятии; основной график не меняется.' : 'Была помощь или просмотр до ответа. Сохраним раннее повторение, даже если сейчас всё стало понятно.' }}</p></div>
      <details v-if="draft.trim()" class="draft-details"><summary>Мой первый ответ</summary><p class="draft-text">{{ draft }}</p></details>
      <div v-if="phase === 'retry-check' && retryDraft.trim()" class="learning-notice"><strong>Моя повторная попытка</strong><p class="draft-text">{{ retryDraft }}</p></div>

      <section class="self-check">
        <h2>Сверьте ключевые мысли</h2>
        <p>Отметьте то, что было в вашем ответе по смыслу. Это опоры из карточки, не строгий экзаменационный список.</p>
        <label v-for="(point, index) in guide.keyPoints" :key="index" class="check-point">
          <input v-model="checked" type="checkbox" :value="index" />
          <MarkdownContent :source="point" />
        </label>
        <small>{{ checked.length }} из {{ guide.keyPoints.length }} опор отмечено. Итоговую оценку выбираете вы.</small>
      </section>

      <section v-if="learningMode" class="learning-notice">
        <strong>Как разобрать пример ниже</strong>
        <ol><li>Прочитайте главную идею; незнакомые слова уточните в «Объяснить проще».</li><li>Проследите пример: что дано на входе, что делает каждый шаг, что получается?</li><li>Закройте объяснение и воспроизведите идею на своём примере.</li></ol>
      </section>
      <details class="full-answer" :open="learningMode || phase === 'retry-check'">
        <summary>Полное объяснение, пример и ИИ-разбор</summary>
        <slot name="answer" />
      </details>

      <details class="practice-details">
        <summary>Почему это работает? · объяснить самому</summary>
        <p>{{ guide.reflection }}</p>
        <label for="reflection-answer">Моё объяснение причин</label>
        <textarea id="reflection-answer" v-model="reflection" rows="3" maxlength="4000" placeholder="Это работает потому, что… Если изменить…, то…" />
        <p class="muted-note">Сверьте свои причины с разбором выше. Автоматической оценки здесь нет.</p>
      </details>

      <details v-if="guide.exercise" class="practice-details">
        <summary>Применить на новом примере</summary>
        <MarkdownContent :source="guide.exercise.prompt" />
        <label for="application-answer">Моё решение</label>
        <textarea id="application-answer" v-model="exerciseDraft" rows="3" maxlength="4000" placeholder="Я бы сделал так, потому что…" />
        <button class="quiet-button" :aria-pressed="exerciseSpoken" @click="exerciseSpoken = !exerciseSpoken">{{ exerciseSpoken ? '✓ Решил про себя' : 'Решил про себя' }}</button>
        <button v-if="!solutionVisible" class="secondary-button" @click="solutionVisible = true">{{ canCheckExercise ? 'Сверить решение' : 'Сначала изучить решение' }}</button>
        <div v-if="solutionVisible" class="learning-notice"><strong>Разбор решения</strong><MarkdownContent :source="guide.exercise.solution" /><p>Прочитали? Спрячьте разбор и объясните ход решения сами.</p><button class="quiet-button" @click="solutionVisible = false">Скрыть разбор</button></div>
        <small>Это дополнительная практика. Она не увеличивает интервал карточки.</small>
      </details>
      <details v-else class="practice-details">
        <summary>Применить на своём примере</summary>
        <p>Возьмите пример из карточки. Измените одно условие и объясните, что изменится в результате. Если примера нет — придумайте ситуацию из своего проекта.</p>
        <label for="application-answer">Условие → результат → почему</label>
        <textarea id="application-answer" v-model="exerciseDraft" rows="3" maxlength="4000" placeholder="В моём проекте… Если…, то…, потому что…" />
        <small>Открытое упражнение без готового решения. Проверяйте вывод по объяснению и документации.</small>
      </details>

      <div v-if="phase === 'first'" class="retry-actions">
        <button class="secondary-button" @click="originalRating = helped ? 'again' : null; startRetry()">Скрыть ответ и сформулировать заново</button>
        <small v-if="!helped">Если хотите сначала потренироваться ещё раз, оценка ниже всё равно относится к первой попытке.</small>
      </div>
      <div class="assessment">
        <p v-if="practice" class="muted-note">Свободное закрепление: основной график повторений не изменится.</p>
        <template v-if="helped || originalRating === 'again'">
          <button class="primary-button" @click="emit('rate', 'again')">{{ practice ? 'Дальше · ещё раз в этом занятии' : 'Сохранить · повторить раньше' }}</button>
          <small>Разобраться — полезный результат. Самостоятельное воспроизведение проверим позже.</small>
        </template>
        <template v-else>
          <strong>Как прошла первая попытка, до просмотра?</strong>
          <p>Слова могут отличаться от карточки. «Сам» — без подсказок, основные мысли верны.</p>
          <div class="assessment-grid"><button v-for="option in options" :key="option.value" @click="chooseRating(option.value)"><strong>{{ option.title }}</strong><small>{{ option.hint }}</small></button></div>
          <button v-if="phase === 'first'" class="quiet-button" @click="emit('rate', 'again')">Не вспомнил — повторить позже без второй попытки</button>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.learning-workbench { min-width:0; scroll-margin-top:90px; }
.attempt-panel,.review-panel { display:grid; min-width:0; gap:16px; }
.step-label { color:var(--primary); font-size:.72rem; font-weight:850; text-transform:uppercase; letter-spacing:.06em; }
h2 { margin:0; font-size:1.1rem; line-height:1.4; }
p { margin:0; line-height:1.6; }
small,.muted-note { color:var(--text-muted); font-size:.78rem; line-height:1.5; }
textarea { display:block; box-sizing:border-box; width:100%; min-width:0; resize:vertical; min-height:100px; max-height:360px; border:1px solid var(--border-subtle); border-radius:16px; padding:13px; background:var(--surface-muted); color:var(--text); font:inherit; font-size:16px; line-height:1.5; }
textarea:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible { outline:3px solid var(--primary); outline-offset:3px; }
button { cursor:pointer; white-space:normal; }
button:disabled { opacity:.5; cursor:not-allowed; }
.quiet-button { min-height:44px; border:0; padding:10px; background:transparent; color:var(--primary); font:inherit; font-size:.82rem; font-weight:750; }
.quiet-button[aria-pressed=true] { border-radius:12px; background:var(--primary-soft); }
.learning-notice,.self-check { display:grid; min-width:0; gap:10px; padding:16px; border-radius:18px; background:var(--primary-soft); font-size:.85rem; overflow-wrap:anywhere; }
.self-check { background:var(--surface-muted); }
.self-check > p { color:var(--text-muted); }
.check-point { display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-top:1px solid var(--border-subtle); cursor:pointer; }
.check-point input { flex:none; width:20px; height:20px; margin-top:4px; accent-color:var(--primary); }
.check-point :deep(.markdown-content) { min-width:0; font-size:.86rem; }
.check-point :deep(p) { margin:0; }
.draft-text { white-space:pre-wrap; overflow-wrap:anywhere; }
.draft-details,.practice-details,.full-answer { min-width:0; padding:14px; border:1px solid var(--border-subtle); border-radius:16px; }
summary { cursor:pointer; min-height:28px; font-weight:750; font-size:.87rem; line-height:1.5; }
details[open] > :not(summary) { margin-top:12px; }
.assessment { display:grid; gap:12px; border-top:1px solid var(--border-subtle); padding-top:18px; }
.assessment > p { color:var(--text-muted); font-size:.8rem; }
.assessment-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.assessment-grid button { display:flex; min-width:0; min-height:80px; flex-direction:column; gap:7px; padding:14px; text-align:left; border:1px solid var(--border-subtle); border-radius:16px; background:var(--surface-muted); color:var(--text); }
.assessment-grid strong { font-size:.85rem; }
.retry-actions { display:grid; gap:8px; }
ol { margin:0; padding-left:20px; } li+li { margin-top:8px; }
@media(max-width:420px) { .assessment-grid { grid-template-columns:1fr; }.learning-notice,.self-check { padding:13px; } }
</style>
