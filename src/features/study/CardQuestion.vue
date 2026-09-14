<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { MessageCircle, Send } from '@lucide/vue'
import type { Card } from '../content/types'
import MarkdownContent from '../../shared/markdown/MarkdownContent.vue'
import { askCardQuestion } from './aiExplanation'

const props = defineProps<{ card: Card }>()
const question = ref('')
const loading = ref(false)
const error = ref('')
const answer = ref('')
const answeredQuestion = ref('')
const canSend = computed(() => Boolean(question.value.trim()) && question.value.length <= 1_000 && !loading.value)
let controller: AbortController | undefined
onBeforeUnmount(() => controller?.abort())

async function submit(): Promise<void> {
  if (!canSend.value) return
  const submittedQuestion = question.value.trim()
  const request = new AbortController()
  controller = request
  loading.value = true
  error.value = ''
  try {
    const result = await askCardQuestion(props.card, submittedQuestion, request.signal)
    if (request.signal.aborted) return
    answer.value = result.text
    answeredQuestion.value = submittedQuestion
  } catch (failure) {
    if (!request.signal.aborted) error.value = failure instanceof Error ? failure.message : 'Не удалось получить ответ. Попробуйте ещё раз.'
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}
</script>

<template>
  <details class="card-question">
    <summary><MessageCircle :size="17" aria-hidden="true" />Спросить по карточке</summary>
    <form @submit.prevent="submit">
      <label for="card-ai-question">Что именно непонятно?</label>
      <textarea id="card-ai-question" v-model="question" :disabled="loading" maxlength="1000" rows="2" placeholder="Например: почему в этом примере нужен await?" aria-describedby="card-question-note" />
      <div class="card-question__actions">
        <small>{{ question.length }} / 1000</small>
        <button type="submit" :disabled="!canSend"><Send :size="15" aria-hidden="true" />{{ loading ? 'Отвечает…' : 'Спросить ИИ' }}</button>
      </div>
      <small id="card-question-note">ИИ получит карточку и этот вопрос, без истории переписки. Каждая отправка расходует лимит. Не отправляйте секреты.</small>
    </form>
    <p v-if="loading" class="card-question__state" role="status">Разбираем ваш вопрос…</p>
    <p v-if="error" class="card-question__error" role="alert">{{ error }} Вопрос оставлен в поле — можно отправить снова.</p>
    <section v-if="answer" class="card-question__answer" aria-live="polite">
      <strong>Ваш вопрос</strong>
      <p class="card-question__asked">{{ answeredQuestion }}</p>
      <MarkdownContent :source="answer" />
      <small>ИИ может ошибаться. Ответ останется здесь до перехода к другой карточке.</small>
    </section>
  </details>
</template>

<style scoped>
.card-question { min-width:0; max-width:100%; margin-top:12px; border:1px solid var(--border-subtle); border-radius:16px; background:var(--surface); }
summary { display:flex; min-height:44px; align-items:center; gap:8px; padding:10px 13px; color:var(--primary); font-size:.8rem; font-weight:750; cursor:pointer; list-style:none; }
summary::-webkit-details-marker { display:none; } summary::after { content:'+'; margin-left:auto; } details[open] > summary::after { content:'−'; }
form { display:grid; min-width:0; gap:9px; padding:0 13px 13px; }
label { font-size:.8rem; font-weight:700; }
textarea { box-sizing:border-box; width:100%; min-width:0; min-height:76px; max-height:240px; resize:vertical; padding:10px 12px; border:1px solid var(--border-subtle); border-radius:12px; background:var(--surface-muted); color:var(--text); font:inherit; font-size:16px; line-height:1.5; }
summary:focus-visible,textarea:focus-visible,button:focus-visible { outline:2px solid var(--primary); outline-offset:3px; }
.card-question__actions { display:flex; align-items:center; justify-content:space-between; gap:10px; }
button { display:flex; align-items:center; gap:7px; min-height:42px; padding:9px 13px; border:0; border-radius:12px; background:var(--primary); color:white; font:inherit; font-size:.78rem; font-weight:750; cursor:pointer; }
button:disabled { opacity:.5; cursor:default; }
small { display:block; color:var(--text-muted); font-size:.68rem; line-height:1.45; }
.card-question__state,.card-question__error { margin:0 13px 13px; font-size:.8rem; line-height:1.5; }.card-question__state { color:var(--text-muted); }.card-question__error { color:var(--text); border-left:3px solid #e39130; padding-left:10px; }
.card-question__answer { min-width:0; margin:0 13px 13px; padding:14px; border-radius:14px; background:var(--primary-soft); overflow-wrap:anywhere; }
.card-question__answer > strong { font-size:.74rem; color:var(--primary); }.card-question__asked { margin:6px 0 14px; font-size:.85rem; white-space:pre-wrap; }
.card-question__answer > small { margin-top:12px; }.card-question__answer :deep(.markdown-content) { font-size:.9rem; }
</style>
