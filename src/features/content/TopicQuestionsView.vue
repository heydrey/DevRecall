<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { StaticCardRepository } from './StaticCardRepository'
import type { Card, Topic } from './types'
import { getVueVersion, vueVersionLabel, type VueVersion } from './vueVersion'

const route = useRoute()
const repository = new StaticCardRepository()
const topic = ref<Topic | null>(null)
const cards = ref<Card[]>([])
const search = ref('')
const section = ref('')
const version = ref<'all' | VueVersion>('all')
const filtered = computed(() => cards.value.filter(card =>
  (!section.value || card.sectionId === section.value)
  && (version.value === 'all' || getVueVersion(card) === version.value)
  && card.question.toLocaleLowerCase('ru').includes(search.value.trim().toLocaleLowerCase('ru'))))
watch(() => route.params.topicId, () => { section.value = ''; version.value = 'all'; search.value = '' })
watch(() => route.params.topicId, async id => {
  topic.value = (await repository.getTopics()).find(item => item.id === id) ?? null
  cards.value = await repository.getCardsByTopic(String(id))
}, { immediate: true })
</script>

<template>
  <div class="page-stack">
    <RouterLink class="back-link" :to="`/topics/${route.params.topicId}`"><ArrowLeft :size="18" />К теме</RouterLink>
    <header><span class="eyebrow">{{ topic?.title }}</span><h1>Все вопросы</h1><p>Выберите вопрос для разбора. Чтение не меняет прогресс тренировки.</p></header>
    <div class="question-filters">
      <label>Поиск вопроса<input v-model="search" type="search" placeholder="Например, типы данных" /></label>
      <label>Раздел<select v-model="section"><option value="">Все разделы</option><option v-for="item in topic?.sections" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
      <label v-if="topic?.id === 'vue'">Версия Vue<select v-model="version"><option value="all">Все версии</option><option value="vue2">Особенности Vue 2</option><option value="vue3">Особенности Vue 3</option><option value="both">Общее для Vue 2 и 3</option></select></label>
    </div>
    <p v-if="topic?.id === 'vue'" class="version-help">Для подготовки по Vue 2 смотрите «Особенности Vue 2» и «Общее для Vue 2 и 3». В общих карточках пример может быть записан синтаксисом Vue 3; различия указаны в ответе. Composition API встроен во Vue 2.7, а в более старом Vue 2 требует плагина.</p>
    <p>Вопросов: {{ filtered.length }} из {{ cards.length }}</p>
    <div class="question-list">
      <RouterLink v-for="card in filtered" :key="card.id" :to="{ path: '/study', query: { mode: 'browse', topicId: card.topicId, cardId: card.id } }">
        <span class="question-list__content"><span>{{ card.question }}</span><small v-if="getVueVersion(card)" class="version-badge" :data-version="getVueVersion(card)">{{ vueVersionLabel(getVueVersion(card)!) }}</small></span><ArrowRight :size="18" />
      </RouterLink>
      <p v-if="!filtered.length">Вопросы не найдены. Измените поиск или раздел.</p>
    </div>
  </div>
</template>

<style scoped>
header p { color:var(--text-muted); line-height:1.5; }
.question-filters { display:flex; flex-wrap:wrap; gap:12px; }
label { display:grid; gap:8px; flex:1 1 220px; min-width:0; font-size:.85rem; }
input, select { width:100%; box-sizing:border-box; min-width:0; padding:12px; border:1px solid var(--border-subtle); border-radius:14px; background:var(--surface); color:var(--text); font:inherit; }
.question-list { display:grid; gap:10px; }
.question-list a { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:18px; border:1px solid var(--border-subtle); border-radius:18px; background:var(--surface); color:inherit; text-decoration:none; line-height:1.5; }
.question-list__content { display:grid; gap:6px; }
.version-help { color:var(--text-muted); font-size:.8rem; line-height:1.5; }
.version-badge { width:max-content; padding:3px 8px; border-radius:8px; background:var(--primary-soft); color:var(--primary); font-size:.72rem; font-weight:700; }
.version-badge[data-version="vue2"] { background:#fff0d8; color:#8a5300; }
.question-list span { min-width:0; overflow-wrap:anywhere; }
.question-list svg { flex-shrink:0; color:var(--primary); }
</style>
