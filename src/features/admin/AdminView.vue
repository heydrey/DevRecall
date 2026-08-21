<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Activity, ArrowLeft, Bot, BrainCircuit, RefreshCw, ShieldCheck, Users } from '@lucide/vue'
import { fetchAdminOverview, type AdminOverview } from './adminClient'

const overview = ref<AdminOverview | null>(null)
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pageSize = ref(10)

const tokenPercent = computed(() => {
  if (!overview.value?.ai.dailyTokenLimit) return 0
  return Math.min(100, Math.round((overview.value.ai.tokensToday / overview.value.ai.dailyTokenLimit) * 100))
})

const requestPercent = computed(() => {
  if (!overview.value?.ai.dailyRequestLimit) return 0
  return Math.min(100, Math.round((overview.value.ai.requestsToday / overview.value.ai.dailyRequestLimit) * 100))
})

const providerRequestsRemaining = computed(() => String(overview.value?.ai.latestRateLimits['x-ratelimit-remaining-requests'] ?? '—'))
const providerTokensRemaining = computed(() => String(overview.value?.ai.latestRateLimits['x-ratelimit-remaining-tokens'] ?? '—'))

function number(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function date(value: string): string {
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    overview.value = await fetchAdminOverview(page.value, pageSize.value)
    page.value = overview.value.pagination.page
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить данные.'
  } finally {
    loading.value = false
  }
}

async function goToPage(nextPage: number): Promise<void> {
  if (!overview.value || nextPage < 1 || nextPage > overview.value.pagination.totalPages || loading.value) return
  page.value = nextPage
  await load()
}

async function changePageSize(): Promise<void> {
  page.value = 1
  await load()
}

onMounted(load)
</script>

<template>
  <div class="admin-page page-stack">
    <div class="admin-topbar">
      <RouterLink class="back-link" to="/profile"><ArrowLeft :size="18" />В профиль</RouterLink>
      <button class="icon-button" aria-label="Обновить" :disabled="loading" @click="load"><RefreshCw :size="19" :class="{ spin: loading }" /></button>
    </div>

    <header class="admin-hero">
      <div class="admin-hero__icon"><ShieldCheck :size="27" /></div>
      <div><span class="eyebrow">Только для владельца</span><h1>Панель администратора</h1><p>Пользователи, активность, обучение и расход ИИ.</p></div>
    </header>

    <section v-if="loading && !overview" class="admin-state"><span class="loader" /><p>Собираем метрики…</p></section>
    <section v-else-if="error && !overview" class="admin-state admin-state--error"><ShieldCheck :size="32" /><h2>Доступ закрыт</h2><p>{{ error }}</p></section>

    <template v-else-if="overview">
      <section>
        <div class="section-heading"><div><span class="eyebrow">Приложение</span><h2>Что происходит сейчас</h2></div></div>
        <div class="metric-grid">
          <article><Users :size="20" /><strong>{{ number(overview.metrics.totalUsers) }}</strong><span>всего пользователей</span></article>
          <article class="metric-online"><Activity :size="20" /><strong>{{ number(overview.metrics.onlineNow) }}</strong><span>активны сейчас</span></article>
          <article><Activity :size="20" /><strong>{{ number(overview.metrics.active24h) }}</strong><span>заходили за 24 часа</span></article>
          <article><Bot :size="20" /><strong>{{ number(overview.metrics.reviews24h) }}</strong><span>ответов за 24 часа</span></article>
        </div>
        <p class="metric-note">«Активен сейчас» означает, что приложение прислало сигнал в последние 5 минут.</p>
      </section>

      <section class="ai-card">
        <div class="ai-card__heading"><div class="ai-card__icon"><BrainCircuit :size="22" /></div><div><span class="eyebrow">ИИ-наставник</span><h2>Расход бесплатного лимита</h2><p>{{ overview.ai.provider }} · {{ overview.ai.model }}</p></div></div>
        <p v-if="!overview.ai.trackingAvailable" class="tracking-warning">{{ overview.ai.trackingError }}</p>
        <div class="quota-row">
          <div><strong>{{ number(overview.ai.requestsToday) }} / {{ number(overview.ai.dailyRequestLimit) }}</strong><span>запросов за последние 24 часа</span></div><b>{{ requestPercent }}%</b>
        </div>
        <div class="quota-bar"><i :style="{ width: `${requestPercent}%` }" /></div>
        <div class="quota-row quota-row--tokens">
          <div><strong>{{ number(overview.ai.tokensToday) }} / {{ number(overview.ai.dailyTokenLimit) }}</strong><span>токенов за последние 24 часа</span></div><b>{{ tokenPercent }}%</b>
        </div>
        <div class="quota-bar"><i :style="{ width: `${tokenPercent}%` }" /></div>
        <div class="ai-details">
          <div><span>Использований ИИ за 24 часа</span><strong>{{ number(overview.ai.usesToday) }}</strong></div>
          <div><span>Расчётный остаток запросов</span><strong>{{ number(overview.ai.estimatedRequestsRemaining) }}</strong></div>
          <div><span>Расчётный остаток токенов</span><strong>{{ number(overview.ai.estimatedTokensRemaining) }}</strong></div>
          <div><span>Последний ответ Groq: запросов</span><strong>{{ providerRequestsRemaining }}</strong></div>
          <div><span>Последний ответ Groq: токенов/мин</span><strong>{{ providerTokensRemaining }}</strong></div>
        </div>
        <p class="metric-note">Учёт начался после подключения админ-панели: более ранние обращения восстановить нельзя. Кэшированное объяснение считается использованием, но не расходует запросы и токены. Groq может менять бесплатные лимиты.</p>
      </section>

      <section>
        <div class="section-heading"><div><span class="eyebrow">Аудитория</span><h2>Пользователи</h2></div><span>{{ overview.pagination.totalItems }}</span></div>
        <div class="user-table-wrap">
          <table class="user-table">
            <thead><tr><th>Пользователь</th><th>Активность</th><th>Карточки</th><th>Ответы</th><th>ИИ</th><th>Устройства</th><th>Первый вход</th></tr></thead>
            <tbody>
              <tr v-for="user in overview.users" :key="user.telegramId">
                <td class="user-name"><strong>{{ user.displayName }}</strong><small>ID {{ user.telegramId }}</small></td>
                <td><b class="status-pill" :class="{ online: user.onlineNow }">{{ user.onlineNow ? 'Сейчас' : date(user.lastSeenAt) }}</b></td>
                <td>{{ number(user.studiedCards) }}</td>
                <td>{{ number(user.reviewCount) }}</td>
                <td><strong>{{ number(user.aiUses) }}</strong><small>{{ number(user.aiApiRequests) }} с расходом</small></td>
                <td>{{ number(user.deviceCount) }}</td>
                <td>{{ date(user.joinedAt) }}</td>
              </tr>
              <tr v-if="!overview.users.length"><td colspan="7" class="empty-table">Пользователей пока нет.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <label>По <select v-model.number="pageSize" :disabled="loading" @change="changePageSize"><option :value="10">10</option><option :value="25">25</option><option :value="50">50</option></select></label>
          <span>Страница {{ overview.pagination.page }} из {{ overview.pagination.totalPages }}</span>
          <div><button :disabled="loading || overview.pagination.page <= 1" @click="goToPage(overview.pagination.page - 1)">Назад</button><button :disabled="loading || overview.pagination.page >= overview.pagination.totalPages" @click="goToPage(overview.pagination.page + 1)">Дальше</button></div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin-page { padding-bottom:32px; }.admin-topbar { display:flex; align-items:center; justify-content:space-between; }.admin-topbar .back-link { margin:0; }.admin-hero { display:flex; align-items:center; gap:15px; padding:22px; border:1px solid var(--border-subtle); border-radius:28px; background:linear-gradient(145deg,var(--surface),var(--primary-soft)); }.admin-hero__icon,.ai-card__icon { display:grid; width:50px; height:50px; flex:0 0 auto; place-items:center; border-radius:17px; background:var(--primary); color:white; }.admin-hero h1 { margin:5px 0 3px; font-size:clamp(1.55rem,6vw,2.2rem); }.admin-hero p,.ai-card p { margin:0; color:var(--text-muted); font-size:.78rem; }.admin-state { display:grid; min-height:280px; place-items:center; align-content:center; gap:12px; text-align:center; }.admin-state--error { padding:30px; border:1px solid var(--border-subtle); border-radius:26px; background:var(--surface); }.admin-state--error svg { color:var(--primary); }.admin-state--error h2,.admin-state--error p { margin:0; }.admin-state--error p { color:var(--text-muted); }.metric-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }.metric-grid article { display:flex; min-height:120px; flex-direction:column; justify-content:flex-end; gap:4px; padding:16px; border:1px solid var(--border-subtle); border-radius:21px; background:var(--surface); }.metric-grid svg { margin-bottom:auto; color:var(--primary); }.metric-grid strong { font-size:1.6rem; }.metric-grid span { color:var(--text-muted); font-size:.7rem; }.metric-online { border-color:#a9d8ba!important; background:#effaf3!important; }.metric-online svg,.metric-online strong { color:#237143; }.metric-note { margin:10px 2px 0; color:var(--text-muted); font-size:.68rem; line-height:1.5; }.ai-card { padding:21px; border:1px solid var(--border-subtle); border-radius:26px; background:var(--surface); }.ai-card__heading { display:flex; align-items:center; gap:13px; margin-bottom:20px; }.ai-card h2 { margin:4px 0 2px; }.tracking-warning { margin:0 0 14px!important; padding:11px 13px; border-radius:13px; background:#fff8e7; color:#77510d!important; }.quota-row { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-top:14px; }.quota-row > div { display:flex; flex-direction:column; gap:3px; }.quota-row strong { font-size:1.02rem; }.quota-row span { color:var(--text-muted); font-size:.68rem; }.quota-row > b { color:var(--primary); font-size:.78rem; }.quota-row--tokens { margin-top:19px; }.quota-bar { height:8px; margin-top:8px; overflow:hidden; border-radius:99px; background:var(--surface-muted); }.quota-bar i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--primary),#9b85ff); }.ai-details { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:18px; }.ai-details div { display:flex; min-width:0; flex-direction:column; gap:5px; padding:11px; border-radius:14px; background:var(--surface-muted); }.ai-details span { color:var(--text-muted); font-size:.63rem; line-height:1.35; }.ai-details strong { overflow-wrap:anywhere; font-size:.78rem; }.user-table-wrap { max-width:100%; overflow-x:auto; margin-top:14px; border:1px solid var(--border-subtle); border-radius:20px; background:var(--surface); -webkit-overflow-scrolling:touch; }.user-table { width:100%; min-width:820px; border-collapse:collapse; font-size:.73rem; }.user-table th,.user-table td { padding:13px 12px; border-bottom:1px solid var(--border-subtle); text-align:left; vertical-align:middle; white-space:nowrap; }.user-table th { background:var(--surface-muted); color:var(--text-muted); font-size:.63rem; letter-spacing:.04em; text-transform:uppercase; }.user-table tbody tr:last-child td { border-bottom:0; }.user-table td small,.user-name { display:flex; flex-direction:column; gap:3px; }.user-table td small { color:var(--text-muted); font-size:.61rem; }.status-pill { display:inline-flex; padding:6px 8px; border-radius:999px; background:var(--surface-muted); color:var(--text-muted); font-size:.61rem; }.status-pill.online { background:#e2f7ea; color:#237143; }.empty-table { padding:28px!important; color:var(--text-muted); text-align:center!important; }.pagination { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; color:var(--text-muted); font-size:.68rem; }.pagination label,.pagination > div { display:flex; align-items:center; gap:7px; }.pagination select,.pagination button { min-height:34px; padding:0 10px; border:1px solid var(--border-subtle); border-radius:11px; background:var(--surface); color:var(--text); font:inherit; font-weight:750; }.pagination button:not(:disabled) { cursor:pointer; }.pagination button:disabled { opacity:.45; }.spin { animation:spin .8s linear infinite; }@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:430px){.admin-hero{align-items:flex-start}.ai-details{grid-template-columns:1fr}.metric-grid article{min-height:108px}.pagination{align-items:flex-start;flex-wrap:wrap}.pagination>span{order:3;width:100%}}
@media(prefers-color-scheme:dark){.metric-online{background:var(--surface-muted)!important}.tracking-warning{background:var(--surface-muted);color:#f1c86a!important}.status-pill.online{background:var(--surface-muted);color:#8ee3ad}}
</style>
