<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { ArrowLeft, RotateCcw } from '@lucide/vue'
import { useProgressStore } from '../progress/progressStore'

const store = useProgressStore()
function applyTheme(theme = store.settings.theme): void {
  document.documentElement.dataset.theme = theme === 'system' ? '' : theme
}
function requestReset(): void {
  if (window.confirm('Удалить весь локальный прогресс?')) store.resetProgress()
}
onMounted(() => applyTheme())
watch(() => store.settings.theme, (theme) => applyTheme(theme))
</script>

<template>
  <div class="page-stack">
    <RouterLink class="back-link" to="/"><ArrowLeft :size="18" />На главную</RouterLink>
    <header class="page-header"><span class="eyebrow">Персонализация</span><h1>Настройки</h1><p>Подберите комфортный объём ежедневного обучения.</p></header>
    <section class="settings-card">
      <label><span><strong>Новых карточек в день</strong><small>После обязательных повторений</small></span>
        <select :value="store.settings.dailyNewCards" @change="store.updateSettings({ dailyNewCards: Number(($event.target as HTMLSelectElement).value) })"><option :value="10">10</option><option :value="20">20</option><option :value="30">30</option><option :value="50">50</option></select>
      </label>
      <label><span><strong>Максимум повторений</strong><small>Ограничение одной сессии</small></span>
        <select :value="store.settings.dailyReviewLimit" @change="store.updateSettings({ dailyReviewLimit: Number(($event.target as HTMLSelectElement).value) })"><option :value="50">50</option><option :value="100">100</option><option :value="500">Без ограничения</option></select>
      </label>
      <label><span><strong>Цветовая тема</strong><small>Внешний вид приложения</small></span>
        <select :value="store.settings.theme" @change="store.updateSettings({ theme: ($event.target as HTMLSelectElement).value as 'system'|'light'|'dark' })"><option value="system">Системная</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select>
      </label>
    </section>
    <button class="danger-button" @click="requestReset"><RotateCcw :size="18" />Сбросить прогресс</button>
  </div>
</template>

<style scoped>
.settings-card { overflow:hidden; border:1px solid var(--border-subtle); border-radius:25px; background:var(--surface); box-shadow:var(--shadow-sm); }
.settings-card label { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:17px; border-bottom:1px solid var(--border-subtle); }
.settings-card label:last-child { border-bottom:0; }.settings-card label > span { display:flex; flex-direction:column; gap:4px; }
.settings-card small { color:var(--text-muted); }.settings-card select { min-height:40px; padding:0 9px; border:1px solid var(--border-subtle); border-radius:12px; background:var(--surface-muted); color:var(--text); }
.danger-button { display:flex; align-items:center; justify-content:center; gap:8px; min-height:48px; border:1px solid #e9b4b0; border-radius:16px; background:transparent; color:#b83c35; cursor:pointer; }
</style>
