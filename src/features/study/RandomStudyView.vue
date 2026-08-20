<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowLeft, Brain, Clock, Shuffle, Sparkles, Star } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { StaticCardRepository } from '../content/StaticCardRepository'
import type { Topic } from '../content/types'
import { useProgressStore } from '../progress/progressStore'
import type { RandomPool, SessionMinutes } from './sessionBuilder'

const router = useRouter()
const progressStore = useProgressStore()
const repository = new StaticCardRepository()
const topics = ref<Topic[]>([])
const topicId = ref<string>('all')
const pool = ref<RandomPool>('all')
const minutes = ref<SessionMinutes>(progressStore.settings.sessionMinutes)

const durations: Array<{ value: SessionMinutes; label: string }> = [
  { value: 5, label: '5 мин' },
  { value: 10, label: '10 мин' },
  { value: 20, label: '20 мин' },
  { value: 0, label: 'Без лимита' },
]

const pools: Array<{ value: RandomPool; title: string; text: string; icon: typeof Shuffle }> = [
  { value: 'all', title: 'Все карточки', text: 'Полностью случайная подборка', icon: Shuffle },
  { value: 'difficult', title: 'Сложные', text: 'То, где чаще возникают ошибки', icon: Brain },
  { value: 'favorites', title: 'Избранные', text: 'Только сохранённые вопросы', icon: Star },
  { value: 'unseen', title: 'Ещё не изученные', text: 'Карточки без предыдущих ответов', icon: Sparkles },
]

onMounted(async () => {
  topics.value = await repository.getTopics()
})

function start(): void {
  router.push({
    path: '/study',
    query: { mode: 'random', topicId: topicId.value, pool: pool.value, minutes: String(minutes.value) },
  })
}
</script>

<template>
  <div class="random-page page-stack">
    <RouterLink class="back-link" to="/"><ArrowLeft :size="18" />На главную</RouterLink>
    <header class="page-header">
      <span class="eyebrow">Свободная практика</span>
      <h1>Случайная тренировка</h1>
      <p>Выберите удобную длительность и набор вопросов. Карточки каждый раз перемешиваются заново.</p>
    </header>

    <section class="setup-card">
      <div class="setup-heading"><Clock :size="20" /><div><strong>Сколько времени есть?</strong><span>Количество карточек подстроится автоматически</span></div></div>
      <div class="duration-grid">
        <button v-for="item in durations" :key="item.value" :class="{ active: minutes === item.value }" @click="minutes = item.value">{{ item.label }}</button>
      </div>
    </section>

    <section class="setup-card">
      <label class="topic-select"><span>Тема</span><select v-model="topicId"><option value="all">Все темы</option><option v-for="topic in topics" :key="topic.id" :value="topic.id">{{ topic.title }}</option></select></label>
    </section>

    <section>
      <div class="section-heading"><div><span class="eyebrow">Набор</span><h2>Какие карточки взять?</h2></div></div>
      <div class="pool-grid">
        <button v-for="item in pools" :key="item.value" :class="['pool-card', { active: pool === item.value }]" @click="pool = item.value">
          <component :is="item.icon" :size="21" />
          <strong>{{ item.title }}</strong>
          <span>{{ item.text }}</span>
        </button>
      </div>
    </section>

    <button class="primary-button start-button" @click="start"><Shuffle :size="19" />Начать тренировку</button>
  </div>
</template>

<style scoped>
.random-page { padding-bottom:18px; }
.setup-card { padding:20px; border:1px solid var(--border-subtle); border-radius:24px; background:var(--surface); box-shadow:var(--shadow-sm); }
.setup-heading { display:flex; align-items:center; gap:12px; margin-bottom:16px; color:var(--primary); }
.setup-heading > div { display:flex; flex-direction:column; gap:3px; color:var(--text); }
.setup-heading span { color:var(--text-muted); font-size:.78rem; }
.duration-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.duration-grid button { min-height:45px; border:1px solid var(--border-subtle); border-radius:14px; background:var(--surface-muted); color:var(--text); font-weight:750; cursor:pointer; }
.duration-grid button.active { border-color:var(--primary); background:var(--primary-soft); color:var(--primary); }
.topic-select { display:flex; align-items:center; justify-content:space-between; gap:16px; font-weight:800; }
.topic-select select { width:min(62%,320px); min-height:44px; padding:0 12px; border:1px solid var(--border-subtle); border-radius:13px; background:var(--surface-muted); color:var(--text); }
.pool-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
.pool-card { display:flex; min-height:138px; flex-direction:column; align-items:flex-start; gap:8px; padding:18px; border:1px solid var(--border-subtle); border-radius:21px; background:var(--surface); color:var(--text); text-align:left; cursor:pointer; box-shadow:var(--shadow-sm); }
.pool-card svg { color:var(--primary); }.pool-card span { color:var(--text-muted); font-size:.78rem; line-height:1.4; }
.pool-card.active { border-color:var(--primary); background:var(--primary-soft); }
.start-button { width:100%; }
@media (max-width:520px) { .duration-grid { grid-template-columns:1fr 1fr; }.pool-grid { grid-template-columns:1fr; }.pool-card { min-height:112px; } }
</style>
