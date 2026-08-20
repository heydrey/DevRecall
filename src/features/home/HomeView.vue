<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Flame, Shuffle, Sparkles, UserRound } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { StaticCardRepository } from '../content/StaticCardRepository'
import type { Card, Topic } from '../content/types'
import { useProgressStore } from '../progress/progressStore'

const repository = new StaticCardRepository()
const progressStore = useProgressStore()
const cards = ref<Card[]>([])
const topics = ref<Topic[]>([])

onMounted(async () => {
  ;[cards.value, topics.value] = await Promise.all([repository.getCards(), repository.getTopics()])
})

const dueCount = computed(() => cards.value.filter((card) => progressStore.isDue(card.id)).length)
const newCount = computed(() => cards.value.filter((card) => !(progressStore.progress[card.id]?.repetitions ?? 0)).length)
const plannedCount = computed(() => Math.min(dueCount.value, progressStore.settings.dailyReviewLimit) + Math.min(newCount.value, progressStore.settings.dailyNewCards))
const learnedCount = computed(() => Object.values(progressStore.progress).filter((item) => item.repetitions > 0).length)
const todayCount = computed(() => {
  const today = new Date().toLocaleDateString('sv-SE')
  return progressStore.reviewEvents.filter(
    (event) => new Date(event.reviewedAt).toLocaleDateString('sv-SE') === today,
  ).length
})
const streak = computed(() => {
  const days = new Set(
    progressStore.reviewEvents.map((event) => new Date(event.reviewedAt).toLocaleDateString('sv-SE')),
  )
  let count = 0
  const cursor = new Date()
  while (days.has(cursor.toLocaleDateString('sv-SE'))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
})
const progressPercent = computed(() =>
  cards.value.length ? Math.round((learnedCount.value / cards.value.length) * 100) : 0,
)
const topicCardCount = (topicId: string) => cards.value.filter((card) => card.topicId === topicId).length
const topicProgress = (topicId: string) => {
  const topicCards = cards.value.filter((card) => card.topicId === topicId)
  if (!topicCards.length) return 0
  const started = topicCards.filter((card) => progressStore.progress[card.id]?.repetitions).length
  return Math.round((started / topicCards.length) * 100)
}
const topicBadge = (title: string) => {
  const words = title.split(/\s+/)
  return words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join('').toUpperCase()
    : words[0]?.slice(0, 3).toUpperCase() ?? ''
}
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
})
const cardWord = (count: number) => {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return 'карточек'
  if (mod10 === 1) return 'карточка'
  if (mod10 >= 2 && mod10 <= 4) return 'карточки'
  return 'карточек'
}
</script>

<template>
  <div class="home-page page-stack">
    <header class="topbar">
      <div>
        <span class="eyebrow">DevRecall</span>
        <h1>{{ greeting }} 👋</h1>
      </div>
      <RouterLink class="icon-button" to="/profile" aria-label="Личный кабинет">
        <UserRound :size="21" />
      </RouterLink>
    </header>

    <section class="study-hero">
      <div class="study-hero__glow" />
      <div class="study-hero__icon"><Sparkles :size="22" /></div>
      <span class="study-hero__label">План на сегодня</span>
      <h2>{{ plannedCount ? (dueCount ? `${dueCount} ${cardWord(dueCount)} к повторению` : 'Можно изучить новые карточки') : 'На сегодня всё готово' }}</h2>
      <p>{{ plannedCount ? `В плане ${plannedCount} ${cardWord(plannedCount)}. Выберите удобный режим и сохраните темп.` : 'Можно закрепить знания в свободной случайной тренировке.' }}</p>
      <div class="study-hero__actions">
        <RouterLink class="primary-button primary-button--light" to="/study?mode=today">
          Повторить по плану <ArrowRight :size="19" />
        </RouterLink>
        <RouterLink class="primary-button hero-random-button" to="/study/random">
          <Shuffle :size="18" />Случайная тренировка
        </RouterLink>
      </div>
    </section>

    <section>
      <div class="section-heading">
        <div><span class="eyebrow">Кратко</span><h2>Ваш прогресс</h2></div>
      </div>
      <div class="stats-grid">
        <article class="stat-tile stat-tile--warm">
          <Flame :size="21" />
          <strong>{{ streak }}</strong>
          <span>дней подряд</span>
        </article>
        <article class="stat-tile">
          <strong>{{ todayCount }}</strong>
          <span>пройдено сегодня</span>
        </article>
        <article class="stat-tile">
          <strong>{{ learnedCount }}</strong>
          <span>карточек начато</span>
        </article>
      </div>
    </section>

    <section class="progress-card">
      <div class="progress-card__top">
        <div><span class="eyebrow">Общий результат</span><h2>Подготовка к собеседованию</h2></div>
        <strong>{{ progressPercent }}%</strong>
      </div>
      <div class="progress-track"><span :style="{ width: `${progressPercent}%` }" /></div>
      <p>{{ learnedCount }} из {{ cards.length }} карточек уже встречались в обучении.</p>
    </section>

    <section>
      <div class="section-heading">
        <div><span class="eyebrow">База знаний</span><h2>Темы</h2></div>
        <RouterLink to="/topics">Все темы</RouterLink>
      </div>
      <RouterLink
        v-for="topic in topics"
        :key="topic.id"
        class="topic-preview"
        :to="`/topics/${topic.id}`"
      >
        <div class="topic-preview__badge" :style="{ background: topic.accent + '22', color: topic.accent }">
          {{ topicBadge(topic.title) }}
        </div>
        <div class="topic-preview__body">
          <strong>{{ topic.title }}</strong>
          <span>{{ topicCardCount(topic.id) }} карточек · {{ topic.sections.length }} разделов</span>
        </div>
        <span class="topic-preview__percent">{{ topicProgress(topic.id) }}%</span>
      </RouterLink>
    </section>
  </div>
</template>

<style scoped>
.study-hero {
  position: relative;
  overflow: hidden;
  padding: 24px;
  border-radius: 30px;
  background: linear-gradient(145deg, #7655f7 0%, #5135d3 100%);
  box-shadow: 0 24px 60px rgb(82 53 211 / 28%);
  color: white;
}
.study-hero__glow { position:absolute; width:210px; height:210px; right:-70px; top:-90px; border-radius:50%; background:rgb(255 255 255 / 13%); }
.study-hero__icon { display:grid; width:42px; height:42px; place-items:center; margin-bottom:24px; border-radius:15px; background:rgb(255 255 255 / 16%); }
.study-hero__label { font-size:.78rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; opacity:.75; }
.study-hero h2 { max-width:460px; margin:8px 0; font-size:clamp(1.65rem,6vw,2.4rem); letter-spacing:-.035em; }
.study-hero p { max-width:500px; margin:0 0 22px; line-height:1.55; opacity:.78; }
.study-hero__actions { display:flex; flex-wrap:wrap; gap:10px; }
.hero-random-button { border:1px solid rgb(255 255 255 / 24%); background:rgb(255 255 255 / 12%); box-shadow:none; color:white; }
.stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.stat-tile { display:flex; min-height:120px; flex-direction:column; justify-content:flex-end; gap:3px; padding:16px; border:1px solid var(--border-subtle); border-radius:22px; background:var(--surface); box-shadow:var(--shadow-sm); }
.stat-tile strong { font-size:1.65rem; letter-spacing:-.04em; }
.stat-tile span { color:var(--text-muted); font-size:.75rem; line-height:1.25; }
.stat-tile--warm { color:#f26f3d; }
.progress-card { padding:22px; border:1px solid var(--border-subtle); border-radius:26px; background:var(--surface); box-shadow:var(--shadow-sm); }
.progress-card__top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.progress-card h2 { margin:5px 0 0; font-size:1.15rem; }
.progress-card__top > strong { color:var(--primary); font-size:1.45rem; }
.progress-card p { margin:12px 0 0; color:var(--text-muted); font-size:.85rem; }
.progress-track { height:9px; margin-top:20px; overflow:hidden; border-radius:999px; background:var(--surface-muted); }
.progress-track span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--primary),#a58fff); }
.topic-preview { display:flex; align-items:center; gap:14px; padding:16px; border:1px solid var(--border-subtle); border-radius:24px; background:var(--surface); color:inherit; text-decoration:none; box-shadow:var(--shadow-sm); }
.topic-preview + .topic-preview { margin-top:10px; }
.topic-preview__badge { display:grid; width:50px; height:50px; flex:none; place-items:center; border-radius:17px; background:#fff4b8; color:#6d5700; font-weight:900; }
.topic-preview__body { display:flex; min-width:0; flex:1; flex-direction:column; gap:4px; }
.topic-preview__body span { color:var(--text-muted); font-size:.82rem; }
.topic-preview__percent { color:var(--primary); font-weight:800; }
@media (max-width:440px) { .study-hero__actions { display:grid; }.stats-grid { grid-template-columns:1fr 1fr; } .stat-tile:first-child { grid-column:span 2; min-height:92px; } }
</style>
