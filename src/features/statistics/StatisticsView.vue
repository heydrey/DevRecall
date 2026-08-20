<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Brain, CalendarClock, Flame, TrendingUp } from '@lucide/vue'
import { StaticCardRepository } from '../content/StaticCardRepository'
import type { Card, Topic } from '../content/types'
import { useProgressStore } from '../progress/progressStore'

const store = useProgressStore()
const repository = new StaticCardRepository()
const cards = ref<Card[]>([])
const topics = ref<Topic[]>([])
const todayKey = new Date().toLocaleDateString('sv-SE')

onMounted(async () => {
  ;[cards.value, topics.value] = await Promise.all([repository.getCards(), repository.getTopics()])
})

const todayEvents = computed(() => store.reviewEvents.filter((event) => new Date(event.reviewedAt).toLocaleDateString('sv-SE') === todayKey))
const learned = computed(() => Object.values(store.progress).filter((item) => item.repetitions > 0).length)
const learning = computed(() => Object.values(store.progress).filter((item) => item.repetitions > 0 && (item.fsrs?.stability ?? 0) < 21).length)
const mature = computed(() => Object.values(store.progress).filter((item) => (item.fsrs?.stability ?? 0) >= 21).length)
const dueToday = computed(() => cards.value.filter((card) => store.isDue(card.id)).length)
const dueTomorrow = computed(() => store.dueTomorrowCount(cards.value))

function successRate(days: number): number {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const events = store.reviewEvents.filter((event) => new Date(event.reviewedAt) >= since)
  if (!events.length) return 0
  const correct = events.filter((event) => event.rating === 'good' || event.rating === 'easy').length
  return Math.round((correct / events.length) * 100)
}

const weekly = computed(() => Array.from({ length: 7 }, (_, index) => {
  const date = new Date(); date.setDate(date.getDate() - (6 - index))
  const key = date.toLocaleDateString('sv-SE')
  return { label: date.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2), count: store.reviewEvents.filter((event) => new Date(event.reviewedAt).toLocaleDateString('sv-SE') === key).length }
}))
const maxWeek = computed(() => Math.max(1, ...weekly.value.map((day) => day.count)))

const forecast = computed(() => Array.from({ length: 7 }, (_, index) => {
  const date = new Date(); date.setDate(date.getDate() + index)
  const key = date.toLocaleDateString('sv-SE')
  const count = Object.values(store.progress).filter((item) => {
    const due = item.fsrs?.due ?? item.nextReviewAt
    return due && new Date(due).toLocaleDateString('sv-SE') === key
  }).length
  return { label: index === 0 ? 'сег' : date.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2), count }
}))
const maxForecast = computed(() => Math.max(1, ...forecast.value.map((day) => day.count)))

const weakTopics = computed(() => {
  const since = new Date(); since.setDate(since.getDate() - 30)
  const cardTopics = new Map(cards.value.map((card) => [card.id, card.topicId]))
  const titles = new Map(topics.value.map((topic) => [topic.id, topic.title]))
  const scores = new Map<string, number>()
  store.reviewEvents.filter((event) => new Date(event.reviewedAt) >= since).forEach((event) => {
    const topicId = cardTopics.get(event.cardId)
    if (!topicId || (event.rating !== 'again' && event.rating !== 'hard')) return
    scores.set(topicId, (scores.get(topicId) ?? 0) + (event.rating === 'again' ? 2 : 1))
  })
  return [...scores.entries()]
    .map(([id, score]) => ({ id, title: titles.get(id) ?? id, score }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
})
</script>

<template>
  <div class="page-stack">
    <header class="page-header"><span class="eyebrow">Результаты</span><h1>Статистика</h1><p>Показывает, что повторить сейчас и какие темы требуют больше внимания.</p></header>
    <div class="summary-grid">
      <article><CalendarClock :size="20" /><strong>{{ dueToday }}</strong><span>нужно сегодня</span></article>
      <article><TrendingUp :size="20" /><strong>{{ dueTomorrow }}</strong><span>запланировано завтра</span></article>
      <article><Brain :size="20" /><strong>{{ learning }}</strong><span>в изучении</span></article>
      <article><Flame :size="20" /><strong>{{ mature }}</strong><span>хорошо закреплено</span></article>
    </div>

    <section class="chart-card rate-card">
      <div><span>Успешные ответы за 7 дней</span><strong>{{ successRate(7) }}%</strong></div>
      <div><span>Успешные ответы за 30 дней</span><strong>{{ successRate(30) }}%</strong></div>
      <p>Всего начато карточек: {{ learned }}</p>
    </section>

    <section class="chart-card">
      <div class="section-heading"><div><span class="eyebrow">Последние 7 дней</span><h2>Активность</h2></div></div>
      <div class="weekly-chart">
        <div v-for="day in weekly" :key="day.label" class="weekly-chart__day">
          <span>{{ day.count }}</span><i :style="{ height: `${Math.max(8, (day.count / maxWeek) * 100)}%` }" /><b>{{ day.label }}</b>
        </div>
      </div>
    </section>

    <section class="chart-card">
      <div class="section-heading"><div><span class="eyebrow">Следующие 7 дней</span><h2>План повторений</h2></div></div>
      <div class="weekly-chart weekly-chart--forecast">
        <div v-for="day in forecast" :key="day.label" class="weekly-chart__day">
          <span>{{ day.count }}</span><i :style="{ height: `${Math.max(8, (day.count / maxForecast) * 100)}%` }" /><b>{{ day.label }}</b>
        </div>
      </div>
    </section>

    <section class="chart-card">
      <div class="section-heading"><div><span class="eyebrow">За 30 дней</span><h2>Темы для внимания</h2></div></div>
      <div v-if="weakTopics.length" class="weak-list">
        <RouterLink v-for="topic in weakTopics" :key="topic.id" :to="`/topics/${topic.id}`"><span>{{ topic.title }}</span><strong>{{ topic.score }}</strong></RouterLink>
      </div>
      <p v-else class="quiet-state">Пока нет сложных тем. Продолжайте отвечать на карточки — статистика появится автоматически.</p>
    </section>

    <section class="chart-card">
      <div class="section-heading"><div><span class="eyebrow">Сегодня</span><h2>Самооценка</h2></div></div>
      <div class="rating-summary">
        <div v-for="rating in ['again','hard','good','easy']" :key="rating">
          <span>{{ { again:'Не знаю', hard:'Сложно', good:'Нормально', easy:'Легко' }[rating] }}</span>
          <strong>{{ todayEvents.filter((event) => event.rating === rating).length }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.summary-grid article { display:flex; min-height:116px; flex-direction:column; justify-content:flex-end; gap:3px; padding:16px; border:1px solid var(--border-subtle); border-radius:22px; background:var(--surface); }
.summary-grid svg { color:var(--primary); }.summary-grid strong { font-size:1.6rem; }.summary-grid span { color:var(--text-muted); font-size:.72rem; }
.chart-card { padding:20px; border:1px solid var(--border-subtle); border-radius:26px; background:var(--surface); box-shadow:var(--shadow-sm); }
.rate-card { display:grid; grid-template-columns:1fr 1fr; gap:10px; }.rate-card > div { display:flex; flex-direction:column; gap:6px; padding:15px; border-radius:17px; background:var(--surface-muted); }.rate-card span,.rate-card p { color:var(--text-muted); font-size:.78rem; }.rate-card strong { font-size:1.55rem; }.rate-card p { grid-column:1/-1; margin:0; }
.weekly-chart { display:flex; height:180px; align-items:flex-end; justify-content:space-between; gap:9px; padding-top:16px; }
.weekly-chart__day { display:grid; height:100%; flex:1; grid-template-rows:20px 1fr 20px; gap:6px; align-items:end; text-align:center; }
.weekly-chart__day span,.weekly-chart__day b { color:var(--text-muted); font-size:.68rem; font-weight:700; }
.weekly-chart__day i { display:block; min-height:8px; border-radius:8px 8px 4px 4px; background:linear-gradient(180deg,var(--primary),#a693ff); }
.weekly-chart--forecast i { background:linear-gradient(180deg,#35a873,#9be0bb); }
.rating-summary,.weak-list { display:grid; gap:8px; }.rating-summary div,.weak-list a { display:flex; justify-content:space-between; padding:12px 14px; border-radius:15px; background:var(--surface-muted); color:inherit; text-decoration:none; }.weak-list strong { color:var(--primary); }
.quiet-state { margin:14px 0 0; color:var(--text-muted); line-height:1.55; }
@media(max-width:620px){.summary-grid{grid-template-columns:1fr 1fr}.rate-card{grid-template-columns:1fr}.rate-card p{grid-column:auto}}
</style>
