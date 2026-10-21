<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, BookOpenText, Check, CircleCheck, ExternalLink, Link2, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { useProfileStore } from '../profile/profileStore'
import { useNotesStore } from './notesStore'
import type { LearningNote } from './types'

const route = useRoute()
const router = useRouter()
const profile = useProfileStore()
const store = useNotesStore()
const query = ref('')
const editing = ref(false)
const editingId = ref<string | null>(null)
const title = ref('')
const shortAnswer = ref('')
const body = ref('')
const linksText = ref('')
const formError = ref('')

const selected = computed(() => store.visibleNotes.find((note) => note.id === route.query.id) ?? null)
const activeNotes = computed(() => store.visibleNotes.filter((note) => !note.isDone))
const doneNotes = computed(() => store.visibleNotes.filter((note) => note.isDone))
const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  return store.visibleNotes.filter((note) => !needle || `${note.title} ${note.shortAnswer} ${note.body} ${note.links.join(' ')}`.toLocaleLowerCase('ru').includes(needle))
})
const formTitle = computed(() => editingId.value ? 'Редактировать запись' : 'Новая запись')
const syncLabel = computed(() => ({
  local: 'Сохранено только на устройстве',
  syncing: 'Синхронизируем…',
  synced: 'Синхронизировано с Telegram',
  offline: 'Без сети — сохраним и отправим позже',
  error: 'Не удалось синхронизировать',
})[store.status])

onMounted(async () => {
  await profile.load()
  store.ensureLoaded()
  await store.sync()
})

watch(() => profile.user?.id, () => {
  store.ensureLoaded()
  void store.sync()
})

function open(note: LearningNote): void {
  editing.value = false
  void router.push({ path: '/notes', query: { id: note.id } })
}

function close(): void {
  editing.value = false
  void router.push('/notes')
}

function newNote(): void {
  void router.push('/notes')
  editingId.value = null
  title.value = ''
  shortAnswer.value = ''
  body.value = ''
  linksText.value = ''
  formError.value = ''
  editing.value = true
}

function editNote(): void {
  if (!selected.value) return
  editingId.value = selected.value.id
  title.value = selected.value.title
  shortAnswer.value = selected.value.shortAnswer
  body.value = selected.value.body
  linksText.value = selected.value.links.join('\n')
  formError.value = ''
  editing.value = true
}

function save(): void {
  formError.value = ''
  if (!title.value.trim()) {
    formError.value = 'Напишите, в чём хотите разобраться.'
    return
  }
  if (title.value.length > 160 || shortAnswer.value.length > 1000 || body.value.length > 20_000) {
    formError.value = 'Название или описание слишком длинное.'
    return
  }
  const links = [...new Set(linksText.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]
  if (links.length > 20 || links.some((link) => {
    try { return !['http:', 'https:'].includes(new URL(link).protocol) || link.length > 2048 } catch { return true }
  })) {
    formError.value = 'Добавьте до 20 ссылок с адресом https:// или http://, по одной в строке.'
    return
  }
  const old = store.visibleNotes.find((item) => item.id === editingId.value)
  const note = store.save({ title: title.value, shortAnswer: shortAnswer.value, body: body.value, links, isDone: old?.isDone ?? false }, editingId.value ?? undefined)
  editing.value = false
  void router.push({ path: '/notes', query: { id: note.id } })
}

function remove(): void {
  if (!selected.value || !window.confirm('Удалить эту запись?')) return
  store.remove(selected.value.id)
  close()
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="notes-page page-stack">
    <template v-if="editing">
      <button class="back-link notes-back" @click="editing = false"><ArrowLeft :size="18" />Назад</button>
      <header class="page-header"><span class="eyebrow">Не забыть после собеседования</span><h1>{{ formTitle }}</h1><p>Запишите мысль сейчас — разобраться можно потом, в своём темпе.</p></header>
      <form class="note-form" @submit.prevent="save">
        <label for="note-title">В чём разобраться? <span>*</span></label>
        <input id="note-title" v-model="title" maxlength="160" placeholder="Например: как работает Event Loop" autofocus />
        <label for="note-short-answer">Коротко для повторения</label>
        <textarea id="note-short-answer" v-model="shortAnswer" rows="3" maxlength="1000" placeholder="Сформулируйте суть в одном-двух предложениях своими словами" />
        <label for="note-body">Мои заметки</label>
        <textarea id="note-body" v-model="body" rows="8" maxlength="20000" placeholder="Что спросили на собеседовании? Что уже понял? Что стоит проверить?" />
        <label for="note-links">Ссылки на материалы</label>
        <textarea id="note-links" v-model="linksText" rows="4" placeholder="https://developer.mozilla.org/...&#10;https://youtube.com/..." />
        <small>По одной ссылке в строке. Откроются в браузере Telegram.</small>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <button class="primary-button" type="submit"><Check :size="18" />Сохранить</button>
      </form>
    </template>

    <template v-else-if="selected">
      <button class="back-link notes-back" @click="close"><ArrowLeft :size="18" />Все записи</button>
      <article class="note-detail">
        <span :class="['note-status', { 'note-status--done': selected.isDone }]">{{ selected.isDone ? 'Разобрано' : 'Хочу разобраться' }}</span>
        <h1>{{ selected.title }}</h1>
        <small>Обновлено {{ formatDate(selected.updatedAt) }}</small>
        <div class="note-actions">
          <button class="secondary-button" @click="editNote"><Pencil :size="17" />Изменить</button>
          <button class="secondary-button" @click="store.setDone(selected.id, !selected.isDone)"><CircleCheck :size="17" />{{ selected.isDone ? 'Вернуть в планы' : 'Отметить разобранным' }}</button>
        </div>
      </article>
      <section v-if="selected.shortAnswer" class="note-section note-short-answer"><span class="eyebrow">Коротко для повторения</span><p class="note-body">{{ selected.shortAnswer }}</p></section>
      <section v-if="selected.body" class="note-section"><span class="eyebrow">Мои мысли</span><p class="note-body">{{ selected.body }}</p></section>
      <section v-if="selected.links.length" class="note-section"><span class="eyebrow">Материалы</span><div class="note-links"><a v-for="link in selected.links" :key="link" :href="link" target="_blank" rel="noopener noreferrer"><Link2 :size="17" /><span>{{ link }}</span><ExternalLink :size="16" /></a></div></section>
      <p v-if="!selected.shortAnswer && !selected.body && !selected.links.length" class="note-empty">Здесь пока только тема. Добавьте короткий ответ, свои мысли или полезные ссылки, когда появятся.</p>
      <button class="delete-button" @click="remove"><Trash2 :size="17" />Удалить запись</button>
    </template>

    <template v-else>
      <header class="page-header notes-header"><span class="eyebrow">Личный список</span><h1>Разобраться</h1><p>Поймали пробел после собеседования? Запишите тему, мысли и ссылки — вернётесь к ним позже.</p></header>
      <button class="primary-button add-button" @click="newNote"><Plus :size="20" />Добавить запись</button>
      <div class="notes-sync" :class="{ 'notes-sync--error': store.status === 'error' }"><span>{{ syncLabel }}<template v-if="store.pendingCount"> · {{ store.pendingCount }} в очереди</template></span><button v-if="store.status === 'error' || store.status === 'offline'" @click="store.sync">Повторить</button></div>
      <p v-if="store.error" class="sync-error" role="status">{{ store.error }}</p>
      <template v-if="store.visibleNotes.length">
        <label class="search-box"><Search :size="18" /><input v-model="query" type="search" placeholder="Найти тему или ссылку" aria-label="Найти запись" /></label>
        <div class="notes-counts"><span>{{ activeNotes.length }} в планах</span><span>{{ doneNotes.length }} разобрано</span></div>
        <div v-if="filtered.length" class="notes-list">
          <button v-for="note in filtered" :key="note.id" class="note-row" @click="open(note)">
            <span class="note-row__icon"><CircleCheck v-if="note.isDone" :size="21" /><BookOpenText v-else :size="21" /></span>
            <span class="note-row__content"><strong>{{ note.title }}</strong><small>{{ note.shortAnswer || note.body || (note.links.length ? `${note.links.length} ссылок` : 'Добавьте мысли и материалы') }}</small><em>{{ note.isDone ? 'Разобрано' : 'В планах' }} · {{ formatDate(note.updatedAt) }}</em></span>
            <ArrowRight :size="18" class="note-row__arrow" />
          </button>
        </div>
        <p v-else class="note-empty">По запросу ничего не найдено.</p>
      </template>
      <div v-else class="empty-state"><div><BookOpenText :size="29" /></div><h2>Пока список пуст</h2><p>После собеседования добавьте первую тему, которую хочется разобрать. Записи всегда можно изменить или дополнить ссылками.</p><button class="secondary-button" @click="newNote"><Plus :size="18" />Добавить тему</button></div>
    </template>
  </div>
</template>

<style scoped>
.notes-page { gap:20px; }
.notes-header h1 { margin:5px 0 0; }
.notes-back { border:0; padding:0; background:none; cursor:pointer; }
.add-button { width:100%; }
.notes-sync { display:flex; justify-content:space-between; gap:10px; padding:11px 14px; border-radius:15px; background:var(--primary-soft); color:var(--text-muted); font-size:.76rem; }
.notes-sync--error { background:#fff1ee; color:#ad3d36; }
.notes-sync button { border:0; background:none; color:var(--primary); font-weight:800; cursor:pointer; }
.sync-error,.form-error { margin:0; color:#b53630; font-size:.82rem; overflow-wrap:anywhere; }
.search-box { display:flex; align-items:center; gap:9px; min-height:48px; padding:0 14px; border:1px solid var(--border-subtle); border-radius:16px; background:var(--surface); color:var(--text-muted); }
.search-box input { width:100%; border:0; outline:0; background:none; color:var(--text); }
.notes-counts { display:flex; gap:8px; }
.notes-counts span { padding:8px 12px; border-radius:999px; background:var(--surface-muted); color:var(--text-muted); font-size:.75rem; font-weight:750; }
.notes-list { display:grid; gap:10px; }
.note-row { display:flex; width:100%; min-width:0; align-items:center; gap:13px; padding:16px; border:1px solid var(--border-subtle); border-radius:20px; background:var(--surface); color:var(--text); text-align:left; cursor:pointer; }
.note-row__icon { display:grid; width:42px; height:42px; flex:none; place-items:center; border-radius:14px; background:var(--primary-soft); color:var(--primary); }
.note-row__content { display:grid; min-width:0; flex:1; gap:4px; }
.note-row__content strong { overflow-wrap:anywhere; }
.note-row__content small { overflow:hidden; color:var(--text-muted); text-overflow:ellipsis; white-space:nowrap; }
.note-row__content em { color:var(--text-muted); font-size:.7rem; font-style:normal; }
.note-row__arrow { flex:none; color:var(--text-muted); }
.note-form,.note-section,.note-detail { display:grid; gap:12px; padding:20px; border:1px solid var(--border-subtle); border-radius:24px; background:var(--surface); }
.note-form label { font-weight:800; }
.note-form label span { color:#d75e4d; }
.note-form input,.note-form textarea { width:100%; padding:13px 14px; border:1px solid var(--border-subtle); border-radius:14px; background:var(--surface-muted); color:var(--text); outline-color:var(--primary); resize:vertical; }
.note-form small { margin-top:-7px; color:var(--text-muted); font-size:.75rem; }
.note-detail h1 { margin:0; font-size:clamp(1.7rem,7vw,2.5rem); overflow-wrap:anywhere; }
.note-detail small { color:var(--text-muted); }
.note-status { width:fit-content; padding:7px 10px; border-radius:999px; background:var(--primary-soft); color:var(--primary); font-size:.72rem; font-weight:800; }
.note-status--done { background:#e6f6ec; color:#277847; }
.note-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.note-actions button { min-height:44px; }
.note-body { margin:0; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; }
.note-short-answer { background:var(--primary-soft); }
.note-links { display:grid; gap:8px; }
.note-links a { display:flex; align-items:center; gap:9px; min-width:0; padding:12px; border-radius:13px; background:var(--surface-muted); color:var(--primary); text-decoration:none; }
.note-links a span { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.note-links a svg { flex:none; }
.note-empty { margin:0; padding:18px; border-radius:18px; background:var(--surface-muted); color:var(--text-muted); line-height:1.5; }
.delete-button { display:flex; width:fit-content; align-items:center; gap:7px; border:0; background:none; color:#b13e38; cursor:pointer; }
@media(max-width:440px){ .note-actions { display:grid; }.note-actions button { justify-content:flex-start; } }
</style>
