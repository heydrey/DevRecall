<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, BookOpen } from '@lucide/vue'
import { StaticCardRepository } from './StaticCardRepository'
import type { Card, Topic } from './types'

const topics = ref<Topic[]>([])
const cards = ref<Card[]>([])

onMounted(async () => {
  const repository = new StaticCardRepository()
  ;[topics.value, cards.value] = await Promise.all([repository.getTopics(), repository.getCards()])
})

const cardCount = (topicId: string) => cards.value.filter((card) => card.topicId === topicId).length
</script>

<template>
  <div class="page-stack">
    <header class="page-header">
      <span class="eyebrow">База знаний</span>
      <h1>Темы обучения</h1>
      <p>Выберите направление и проходите карточки в удобном темпе.</p>
    </header>
    <div class="topic-list">
      <RouterLink v-for="topic in topics" :key="topic.id" class="topic-card" :to="`/topics/${topic.id}`">
        <div class="topic-card__icon" :style="{ background: topic.accent + '22', color: topic.accent }"><BookOpen :size="24" /></div>
        <div class="topic-card__content">
          <span class="eyebrow">{{ cardCount(topic.id) }} карточек</span>
          <h2>{{ topic.title }}</h2>
          <p>{{ topic.description }}</p>
          <div class="topic-card__sections">
            <span v-for="section in topic.sections" :key="section.id">{{ section.title }}</span>
          </div>
        </div>
        <ArrowRight class="topic-card__arrow" :size="21" />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.topic-list { display:grid; gap:14px; }
.topic-card { position:relative; display:flex; align-items:flex-start; gap:16px; padding:20px; border:1px solid var(--border-subtle); border-radius:28px; background:var(--surface); color:inherit; text-decoration:none; box-shadow:var(--shadow-sm); }
.topic-card__icon { display:grid; width:52px; height:52px; flex:none; place-items:center; border-radius:18px; background:#fff2a7; color:#6b5300; }
.topic-card__content { min-width:0; flex:1; }
.topic-card h2 { margin:6px 0; font-size:1.4rem; }
.topic-card p { margin:0; color:var(--text-muted); line-height:1.55; }
.topic-card__sections { display:flex; flex-wrap:wrap; gap:7px; margin-top:16px; }
.topic-card__sections span { padding:7px 10px; border-radius:999px; background:var(--surface-muted); color:var(--text-muted); font-size:.72rem; }
.topic-card__arrow { flex:none; margin-top:14px; color:var(--text-muted); }
</style>
