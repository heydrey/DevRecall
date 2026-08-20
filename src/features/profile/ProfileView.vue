<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, Cloud, Download, RefreshCw, Settings, Upload, UserRound } from '@lucide/vue'
import { createBackup, downloadBackup, mergeOutbox, parseBackupFile } from '../backup/backupService'
import { useProgressStore } from '../progress/progressStore'
import { LocalOutboxRepository } from '../sync/LocalOutboxRepository'
import { useSyncStore } from '../sync/syncStore'
import { useProfileStore } from './profileStore'

const profileStore = useProfileStore()
const progressStore = useProgressStore()
const syncStore = useSyncStore()
const outboxRepository = new LocalOutboxRepository()
const fileInput = ref<HTMLInputElement | null>(null)
const message = ref<string | null>(null)
const messageError = ref(false)

onMounted(() => profileStore.load())

const learned = computed(() => Object.values(progressStore.progress).filter((item) => item.repetitions > 0).length)
const favorites = computed(() => Object.values(progressStore.progress).filter((item) => item.favorite).length)
const initials = computed(() => profileStore.user?.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? 'DR')
const streak = computed(() => {
  const days = new Set(progressStore.reviewEvents.map((event) => new Date(event.reviewedAt).toLocaleDateString('sv-SE')))
  let count = 0
  const cursor = new Date()
  while (days.has(cursor.toLocaleDateString('sv-SE'))) { count += 1; cursor.setDate(cursor.getDate() - 1) }
  return count
})

const statusLabel = computed(() => ({
  local: 'Только на устройстве',
  syncing: 'Синхронизация',
  synced: 'Синхронизировано',
  offline: 'Нет сети',
  error: 'Ошибка синхронизации',
})[syncStore.status])

function currentBackup() {
  return createBackup(progressStore.exportProgressBackup(), outboxRepository.list(), profileStore.user)
}

function exportData(): void {
  downloadBackup(currentBackup())
  messageError.value = false
  message.value = 'Резервная копия скачана.'
}

async function importData(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const imported = await parseBackupFile(file)
    downloadBackup(currentBackup())
    progressStore.importProgressBackup(imported.progress)
    outboxRepository.replace(mergeOutbox(outboxRepository.list(), imported.outbox))
    progressStore.refreshPendingSyncCount()
    messageError.value = false
    message.value = 'Данные восстановлены. Предыдущая версия также скачана как резервная копия.'
  } catch (error) {
    messageError.value = true
    message.value = error instanceof Error ? error.message : 'Не удалось восстановить данные.'
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="profile-page page-stack">
    <RouterLink class="back-link" to="/"><ArrowLeft :size="18" />На главную</RouterLink>

    <section class="profile-hero">
      <div class="profile-avatar"><img v-if="profileStore.user?.photoUrl" :src="profileStore.user.photoUrl" alt="" /><span v-else>{{ initials }}</span></div>
      <div class="profile-copy"><span class="eyebrow">Личный кабинет</span><h1>{{ profileStore.user?.displayName ?? 'Загрузка…' }}</h1><p>{{ profileStore.user?.mode === 'telegram' ? 'Telegram-профиль' : 'Локальный режим' }}</p></div>
      <RouterLink class="icon-button" to="/settings" aria-label="Настройки"><Settings :size="21" /></RouterLink>
    </section>

    <section class="sync-card">
      <div class="sync-card__icon"><Cloud :size="22" /></div>
      <div class="sync-card__copy"><span>Статус прогресса</span><strong>{{ statusLabel }}</strong><small v-if="syncStore.lastError" class="sync-error">{{ syncStore.lastError }}</small><small v-else-if="syncStore.lastSyncedAt">Последняя синхронизация: {{ new Date(syncStore.lastSyncedAt).toLocaleString('ru-RU') }}</small><small v-else>После подключения Telegram здесь появится время последней синхронизации.</small></div>
      <b>{{ syncStore.pendingCount }} в очереди</b>
      <button v-if="syncStore.status === 'offline' || syncStore.status === 'error'" class="secondary-button" @click="syncStore.retry"><RefreshCw :size="17" />Повторить</button>
    </section>

    <p class="telegram-note" v-if="profileStore.user?.mode === 'telegram'">Вы вошли через Telegram. Прогресс синхронизируется между Telegram Desktop и телефоном при подключении к интернету.</p>
    <p class="telegram-note" v-else>Откройте приложение внутри Telegram, чтобы войти в общий аккаунт и синхронизировать прогресс между компьютером и телефоном.</p>

    <section>
      <div class="section-heading"><div><span class="eyebrow">Ваши данные</span><h2>Краткая статистика</h2></div></div>
      <div class="profile-stats">
        <article><strong>{{ learned }}</strong><span>карточек начато</span></article>
        <article><strong>{{ progressStore.reviewEvents.length }}</strong><span>ответов сохранено</span></article>
        <article><strong>{{ favorites }}</strong><span>в избранном</span></article>
        <article><strong>{{ streak }}</strong><span>дней подряд</span></article>
      </div>
    </section>

    <section class="data-card">
      <div><span class="eyebrow">Безопасность данных</span><h2>Резервная копия</h2><p>Скачайте прогресс в JSON или восстановите его из ранее сохранённого файла.</p></div>
      <button class="primary-button" @click="exportData"><Download :size="18" />Скачать резервную копию</button>
      <button class="secondary-button" @click="fileInput?.click()"><Upload :size="18" />Восстановить из файла</button>
      <input ref="fileInput" class="hidden-input" type="file" accept="application/json,.json" @change="importData" />
      <p v-if="message" :class="['profile-message', { error: messageError }]">{{ message }}</p>
    </section>

    <RouterLink class="settings-link" to="/settings"><UserRound :size="19" /><span><strong>Настройки обучения</strong><small>Лимиты, длительность, тема и сброс прогресса</small></span></RouterLink>
  </div>
</template>

<style scoped>
.profile-hero { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:16px; padding:22px; border:1px solid var(--border-subtle); border-radius:28px; background:var(--surface); box-shadow:var(--shadow-sm); }
.profile-avatar { display:grid; width:68px; height:68px; place-items:center; overflow:hidden; border-radius:23px; background:linear-gradient(145deg,var(--primary),#9b85ff); color:white; font-size:1.25rem; font-weight:900; }.profile-avatar img { width:100%; height:100%; object-fit:cover; }
.profile-copy h1 { margin:5px 0 3px; font-size:clamp(1.45rem,5vw,2rem); }.profile-copy p { margin:0; color:var(--text-muted); font-size:.82rem; }
.sync-card { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:14px; padding:19px; border:1px solid var(--border-subtle); border-radius:24px; background:var(--surface); }.sync-card__icon { display:grid; width:46px; height:46px; place-items:center; border-radius:16px; background:var(--primary-soft); color:var(--primary); }.sync-card__copy { display:flex; flex-direction:column; gap:3px; }.sync-card__copy span,.sync-card__copy small { color:var(--text-muted); font-size:.72rem; }.sync-card__copy .sync-error { color:#d86159; overflow-wrap:anywhere; }.sync-card > b { padding:7px 10px; border-radius:999px; background:var(--surface-muted); color:var(--text-muted); font-size:.68rem; }.sync-card .secondary-button { grid-column:1/-1; }
.telegram-note { margin:-10px 0 0; padding:14px 16px; border-radius:17px; background:var(--primary-soft); color:var(--text-muted); font-size:.8rem; line-height:1.55; }
.profile-stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }.profile-stats article { display:flex; min-height:104px; flex-direction:column; justify-content:flex-end; padding:16px; border:1px solid var(--border-subtle); border-radius:21px; background:var(--surface); }.profile-stats strong { font-size:1.55rem; }.profile-stats span { color:var(--text-muted); font-size:.72rem; }
.data-card { display:grid; gap:10px; padding:21px; border:1px solid var(--border-subtle); border-radius:26px; background:var(--surface); }.data-card h2 { margin:5px 0 6px; }.data-card p { margin:0 0 8px; color:var(--text-muted); line-height:1.5; }.hidden-input { display:none; }.profile-message { padding:11px 13px; border-radius:13px; background:#eaf8ef; color:#236a3d!important; font-size:.78rem; }.profile-message.error { background:#fff0ef; color:#a8322b!important; }
.settings-link { display:flex; align-items:center; gap:13px; padding:17px; border:1px solid var(--border-subtle); border-radius:20px; background:var(--surface); color:inherit; text-decoration:none; }.settings-link svg { color:var(--primary); }.settings-link span { display:flex; flex-direction:column; gap:3px; }.settings-link small { color:var(--text-muted); }
@media(max-width:520px){.profile-hero{grid-template-columns:auto 1fr}.profile-hero>.icon-button{grid-column:1/-1;width:100%}.sync-card{grid-template-columns:auto 1fr}.sync-card>b{grid-column:1/-1;width:fit-content}}
</style>
