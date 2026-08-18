<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, ArrowRight, CircleAlert, Layers3 } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { useProgressStore } from '../progress/progressStore'
import { StaticCardRepository } from './StaticCardRepository'
import type { Card, Topic } from './types'

const route = useRoute()
const progressStore = useProgressStore()
const topic = ref<Topic | null>(null)
const cards = ref<Card[]>([])

onMounted(async () => {
  const repository = new StaticCardRepository()
  topic.value = (await repository.getTopics()).find((item) => item.id === route.params.topicId) ?? null
  cards.value = await repository.getCardsByTopic(String(route.params.topicId))
})

const learned = computed(() => cards.value.filter((card) => progressStore.progress[card.id]?.repetitions).length)
const due = computed(() => cards.value.filter((card) => progressStore.isDue(card.id)).length)
const difficult = computed(() => progressStore.difficultCards(cards.value).length)
const percent = computed(() => cards.value.length ? Math.round((learned.value / cards.value.length) * 100) : 0)
const topicBadge = computed(() => {
  const words = topic.value?.title.split(/\s+/) ?? []
  return words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join('').toUpperCase()
    : words[0]?.slice(0, 3).toUpperCase() ?? ''
})
</script>

<template>
  <div v-if="topic" class="page-stack">
    <RouterLink class="back-link" to="/topics"><ArrowLeft :size="18" />Все темы</RouterLink>
    <header class="topic-hero">
      <div
        class="topic-hero__badge"
        :style="{ background: topic.accent + '22', color: topic.accent }"
      >{{ topicBadge }}</div>
      <span class="eyebrow">Тема</span>
      <h1>{{ topic.title }}</h1>
      <p>{{ topic.description }}</p>
      <div class="topic-hero__progress"><span :style="{ width: `${percent}%` }" /></div>
      <div class="topic-hero__meta"><span>{{ learned }} из {{ cards.length }} начато</span><strong>{{ percent }}%</strong></div>
      <RouterLink class="primary-button" :to="`/study?mode=topic&topicId=${topic.id}`">
        Учить тему <ArrowRight :size="19" />
      </RouterLink>
    </header>
    <div class="mini-stats">
      <article><Layers3 :size="19" /><strong>{{ due }}</strong><span>к повторению</span></article>
      <article><CircleAlert :size="19" /><strong>{{ difficult }}</strong><span>сложных</span></article>
    </div>
    <section>
      <div class="section-heading"><div><span class="eyebrow">Содержание</span><h2>Разделы</h2></div></div>
      <div class="section-list">
        <article v-for="section in topic.sections" :key="section.id">
          <div><strong>{{ section.title }}</strong><span>{{ section.description }}</span></div>
          <b>{{ cards.filter((card) => card.sectionId === section.id).length }}</b>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.topic-hero { padding:24px; border:1px solid var(--border-subtle); border-radius:30px; background:var(--surface); box-shadow:var(--shadow-md); }
.topic-hero__badge { display:grid; width:60px; height:60px; place-items:center; margin-bottom:22px; border-radius:20px; background:#fff1a6; color:#5e4a00; font-size:1.15rem; font-weight:900; }
.topic-hero h1 { margin:6px 0; font-size:2.2rem; }
.topic-hero p { margin:0; color:var(--text-muted); line-height:1.6; }
.topic-hero__progress { height:9px; margin:24px 0 8px; overflow:hidden; border-radius:999px; background:var(--surface-muted); }
.topic-hero__progress span { display:block; height:100%; border-radius:inherit; background:var(--primary); }
.topic-hero__meta { display:flex; justify-content:space-between; margin-bottom:20px; color:var(--text-muted); font-size:.8rem; }
.topic-hero__meta strong { color:var(--primary); }
.mini-stats { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.mini-stats article { display:grid; grid-template-columns:auto 1fr; gap:2px 10px; align-items:center; padding:16px; border:1px solid var(--border-subtle); border-radius:22px; background:var(--surface); }
.mini-stats svg { grid-row:span 2; color:var(--primary); }
.mini-stats strong { font-size:1.3rem; }
.mini-stats span { color:var(--text-muted); font-size:.75rem; }
.section-list { display:grid; gap:10px; }
.section-list article { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:17px; border:1px solid var(--border-subtle); border-radius:20px; background:var(--surface); }
.section-list div { display:flex; min-width:0; flex-direction:column; gap:4px; }
.section-list span { color:var(--text-muted); font-size:.8rem; line-height:1.35; }
.section-list b { display:grid; width:34px; height:34px; place-items:center; border-radius:12px; background:var(--primary-soft); color:var(--primary); }
</style>
