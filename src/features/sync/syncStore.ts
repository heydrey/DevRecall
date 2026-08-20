import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useProfileStore } from '../profile/profileStore'
import { useProgressStore } from '../progress/progressStore'
import { DisabledSyncClient } from './DisabledSyncClient'
import { HttpSyncClient } from './HttpSyncClient'
import { LocalOutboxRepository } from './LocalOutboxRepository'
import type { SyncClient } from './SyncClient'
import type { SyncStatus } from './types'

const DEVICE_ID_KEY = 'devrecall:device-id:v1'
const SYNC_CURSOR_KEY = 'devrecall:sync-cursor:v1'
const LAST_SYNC_KEY = 'devrecall:last-sync:v1'

function stableDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function createClient(): SyncClient {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (baseUrl) return new HttpSyncClient(baseUrl)
  if (typeof window !== 'undefined' && window.Telegram?.WebApp.initData) return new HttpSyncClient(window.location.origin)
  return new DisabledSyncClient()
}

const outboxRepository = new LocalOutboxRepository()
const syncClient = createClient()

export const useSyncStore = defineStore('sync', () => {
  const profileStore = useProfileStore()
  const progressStore = useProgressStore()
  const status = ref<SyncStatus>(import.meta.env.VITE_API_BASE_URL ? 'offline' : 'local')
  const lastSyncedAt = ref<string | null>(localStorage.getItem(LAST_SYNC_KEY))
  const lastError = ref<string | null>(null)
  const deviceId = ref(stableDeviceId())
  const cursor = ref<string | undefined>(localStorage.getItem(SYNC_CURSOR_KEY) ?? undefined)
  const pendingCount = computed(() => progressStore.pendingSyncCount)

  async function retry(): Promise<void> {
    const initData = profileStore.getTelegramInitData()
    if (!initData) {
      status.value = 'local'
      lastError.value = null
      return
    }
    if (!navigator.onLine) {
      status.value = 'offline'
      lastError.value = 'Нет подключения к интернету.'
      return
    }

    status.value = 'syncing'
    lastError.value = null
    try {
      if (profileStore.user?.mode === 'telegram') progressStore.prepareTelegramSync(profileStore.user.id)
      const mutations = outboxRepository.list().slice(0, 200)
      const response = await syncClient.sync({
        deviceId: deviceId.value,
        platform: window.Telegram?.WebApp.platform ?? 'web',
        cursor: cursor.value,
        mutations,
      }, initData)
      outboxRepository.acknowledge(response.acknowledgedMutationIds)
      progressStore.refreshPendingSyncCount()
      progressStore.applyRemoteSync(response.changedProgress, response.settings, response.reviewEvents)
      profileStore.setUser(response.user)
      cursor.value = response.cursor
      lastSyncedAt.value = response.serverTime
      localStorage.setItem(SYNC_CURSOR_KEY, response.cursor)
      localStorage.setItem(LAST_SYNC_KEY, response.serverTime)
      status.value = 'synced'
      if (outboxRepository.list().length) window.setTimeout(() => void retry(), 250)
    } catch (error) {
      status.value = navigator.onLine ? 'error' : 'offline'
      lastError.value = error instanceof Error ? error.message : 'Не удалось синхронизировать прогресс.'
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => {
      if (status.value !== 'local') status.value = 'offline'
    })
    window.addEventListener('online', () => {
      if (status.value === 'offline') void retry()
    })

    let retryTimer: number | undefined
    watch(pendingCount, (count) => {
      if (!count || !profileStore.getTelegramInitData()) return
      window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(() => void retry(), 800)
    })
  }

  return { status, lastSyncedAt, lastError, deviceId, cursor, pendingCount, retry }
})
