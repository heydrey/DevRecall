<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Star } from '@lucide/vue'
import { StaticCardRepository } from '../content/StaticCardRepository'
import type { Card } from '../content/types'
import { useProgressStore } from '../progress/progressStore'

const progressStore = useProgressStore()
const cards = ref<Card[]>([])
onMounted(async () => { cards.value = await new StaticCardRepository().getCards() })
const favorites = computed(() => cards.value.filter((card) => progressStore.isFavorite(card.id)))
</script>

<template>
  <div class="page-stack">
    <header class="page-header"><span class="eyebrow">Личная подборка</span><h1>Избранное</h1><p>Сохраняйте вопросы, к которым хотите возвращаться чаще.</p></header>
    <div v-if="favorites.length" class="page-stack">
      <RouterLink class="primary-button" to="/study?mode=favorites">Учить избранное <ArrowRight :size="19" /></RouterLink>
      <div class="favorite-list">
        <article v-for="card in favorites" :key="card.id">
          <Star :size="18" fill="currentColor" />
          <div><span>{{ card.sectionId }}</span><strong>{{ card.question }}</strong></div>
          <button aria-label="Удалить из избранного" @click="progressStore.toggleFavorite(card.id)">×</button>
        </article>
      </div>
    </div>
    <section v-else class="empty-state"><div><Star :size="27" /></div><h2>Пока пусто</h2><p>Нажмите звёздочку на карточке во время обучения.</p><RouterLink to="/study?mode=today">Начать обучение</RouterLink></section>
  </div>
</template>

<style scoped>
.favorite-list { display:grid; gap:10px; }
.favorite-list article { display:flex; align-items:flex-start; gap:13px; padding:16px; border:1px solid var(--border-subtle); border-radius:20px; background:var(--surface); }
.favorite-list svg { flex:none; color:#e4a72f; }
.favorite-list div { display:flex; flex:1; flex-direction:column; gap:5px; }
.favorite-list span { color:var(--primary); font-size:.7rem; text-transform:uppercase; }
.favorite-list strong { font-size:.92rem; line-height:1.45; }
.favorite-list button { border:0; background:transparent; color:var(--text-muted); font-size:1.4rem; cursor:pointer; }
</style>
