<script setup lang="ts">
import { computed } from 'vue'
import { Flame, TrendingUp } from '@lucide/vue'
import { useProgressStore } from '../progress/progressStore'

const store = useProgressStore()
const todayKey = new Date().toLocaleDateString('sv-SE')
const todayEvents = computed(() => store.reviewEvents.filter((event) => new Date(event.reviewedAt).toLocaleDateString('sv-SE') === todayKey))
const learned = computed(() => Object.values(store.progress).filter((item) => item.repetitions > 0).length)
const mastered = computed(() => Object.values(store.progress).filter((item) => item.status === 'mastered').length)
const weekly = computed(() => Array.from({ length: 7 }, (_, index) => {
  const date = new Date(); date.setDate(date.getDate() - (6 - index))
  const key = date.toLocaleDateString('sv-SE')
  return { label: date.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2), count: store.reviewEvents.filter((event) => new Date(event.reviewedAt).toLocaleDateString('sv-SE') === key).length }
}))
const maxWeek = computed(() => Math.max(1, ...weekly.value.map((day) => day.count)))
</script>

<template>
  <div class="page-stack">
    <header class="page-header"><span class="eyebrow">Результаты</span><h1>Статистика</h1><p>Не отчёт ради отчёта, а ориентир для следующей учебной сессии.</p></header>
    <div class="summary-grid">
      <article><TrendingUp :size="20" /><strong>{{ todayEvents.length }}</strong><span>сегодня</span></article>
      <article><Flame :size="20" /><strong>{{ learned }}</strong><span>начато</span></article>
      <article><strong>{{ mastered }}</strong><span>закреплено</span></article>
    </div>
    <section class="chart-card">
      <div class="section-heading"><div><span class="eyebrow">Последние 7 дней</span><h2>Активность</h2></div></div>
      <div class="weekly-chart">
        <div v-for="day in weekly" :key="day.label" class="weekly-chart__day">
          <span>{{ day.count }}</span><i :style="{ height: `${Math.max(8, (day.count / maxWeek) * 100)}%` }" /><b>{{ day.label }}</b>
        </div>
      </div>
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
.summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.summary-grid article { display:flex; min-height:110px; flex-direction:column; justify-content:flex-end; gap:3px; padding:16px; border:1px solid var(--border-subtle); border-radius:22px; background:var(--surface); }
.summary-grid svg { color:var(--primary); }.summary-grid strong { font-size:1.6rem; }.summary-grid span { color:var(--text-muted); font-size:.72rem; }
.chart-card { padding:20px; border:1px solid var(--border-subtle); border-radius:26px; background:var(--surface); box-shadow:var(--shadow-sm); }
.weekly-chart { display:flex; height:180px; align-items:flex-end; justify-content:space-between; gap:9px; padding-top:16px; }
.weekly-chart__day { display:grid; height:100%; flex:1; grid-template-rows:20px 1fr 20px; gap:6px; align-items:end; text-align:center; }
.weekly-chart__day span,.weekly-chart__day b { color:var(--text-muted); font-size:.68rem; font-weight:700; }
.weekly-chart__day i { display:block; min-height:8px; border-radius:8px 8px 4px 4px; background:linear-gradient(180deg,var(--primary),#a693ff); }
.rating-summary { display:grid; gap:8px; }
.rating-summary div { display:flex; justify-content:space-between; padding:12px 14px; border-radius:15px; background:var(--surface-muted); }
@media(max-width:420px){.summary-grid{grid-template-columns:1fr 1fr}.summary-grid article:last-child{grid-column:span 2}}
</style>
