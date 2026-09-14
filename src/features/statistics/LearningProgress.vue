<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../content/types'
import { useProgressStore } from '../progress/progressStore'
import { learningInsights } from './learningInsights'
const props = defineProps<{ cards: Card[] }>()
const store = useProgressStore()
const insights = computed(() => learningInsights(store.reviewEvents))
const improvedCards = computed(() => props.cards.filter(card => insights.value.improved.includes(card.id)).slice(0, 3))
</script>

<template>
  <section class="learning-progress">
    <span class="eyebrow">Не только прочитано</span>
    <h2>Что удалось вспомнить позже</h2>
    <div class="learning-progress__numbers">
      <div><strong>{{ insights.retained.length }}</strong><span>карточек вспомнили после паузы от 24 часов</span></div>
      <div><strong>{{ insights.improved.length }}</strong><span>из них раньше приходилось разбирать заново</span></div>
    </div>
    <p>По вашим оценкам за последние 7 дней. Учитывается последняя попытка по карточке. Ответ сразу после чтения сюда не попадает.</p>
    <ul v-if="improvedCards.length"><li v-for="card in improvedCards" :key="card.id">{{ card.question }}<small>Раньше разбирали заново → теперь вспомнили после паузы.</small></li></ul>
    <p v-else>Пока здесь нет примеров роста — это нормально. Разберите материал сегодня и возвращайтесь по плану.</p>
    <small class="history-note">Старые оценки не позволяют точно определить, использовались ли подсказки.</small>
    <details>
      <summary>На чём основан этот подход?</summary>
      <ul>
        <li>Сначала вспоминаем, затем сверяем: <a href="https://doi.org/10.1126/science.1152408" target="_blank" rel="noopener noreferrer">исследование практики воспроизведения</a>.</li>
        <li>Возвращаемся к материалу через время: <a href="https://pubmed.ncbi.nlm.nih.gov/16719566/" target="_blank" rel="noopener noreferrer">метаанализ интервальной практики</a>.</li>
        <li>Объясняем причины сами: <a href="https://link.springer.com/article/10.1007/s10648-018-9434-x" target="_blank" rel="noopener noreferrer">метаанализ самообъяснения</a>.</li>
        <li>Новое начинаем с разобранного примера: <a href="https://doi.org/10.1007/s10648-019-09465-5" target="_blank" rel="noopener noreferrer">обзор исследований обучения по примерам</a>.</li>
      </ul>
      <p>Исследования поддерживают методики, а не гарантируют результат конкретного интерфейса. 24 часа — порог этого показателя, не универсальный интервал обучения. Расписание подбирает FSRS по вашим оценкам. ИИ помогает с объяснением, но не является безошибочным экзаменатором.</p>
    </details>
  </section>
</template>

<style scoped>
.learning-progress { min-width:0; padding:22px; border:1px solid var(--border-subtle); border-radius:24px; background:var(--surface); }
h2 { margin:6px 0 18px; font-size:1.2rem; }
.learning-progress__numbers { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.learning-progress__numbers > div { display:flex; flex-direction:column; gap:7px; border-radius:16px; padding:15px; background:var(--primary-soft); }
strong { font-size:1.6rem; color:var(--primary); }
span:not(.eyebrow),p,li { font-size:.8rem; line-height:1.5; }
p { color:var(--text-muted); margin:14px 0 0; }
ul { padding-left:18px; margin-bottom:0; } li+li { margin-top:12px; }
small { display:block; margin-top:4px; color:var(--primary); line-height:1.5; }
.history-note { margin-top:12px; color:var(--text-muted); font-size:.72rem; }
details { margin-top:16px; } summary { cursor:pointer; font-size:.82rem; font-weight:750; } a { color:var(--primary); }
@media(max-width:400px) { .learning-progress__numbers { grid-template-columns:1fr; } }
</style>
