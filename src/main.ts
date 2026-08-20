import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './app/App.vue'
import { router } from './app/router'
import { bootstrapTelegramWebApp } from './features/telegram/telegramWebApp'
import { TelegramIdentityProvider } from './features/profile/TelegramIdentityProvider'
import { useProfileStore } from './features/profile/profileStore'
import { useSyncStore } from './features/sync/syncStore'
import './shared/styles/tokens.css'
import './shared/styles/base.css'

function showTelegramOnly(message: string): void {
  const root = document.querySelector<HTMLElement>('#app')
  if (!root) return
  root.replaceChildren()
  const section = document.createElement('main')
  section.className = 'access-gate'
  const badge = document.createElement('div')
  badge.className = 'access-gate__badge'
  badge.textContent = '🔐'
  const title = document.createElement('h1')
  title.textContent = 'Доступ закрыт'
  const text = document.createElement('p')
  text.textContent = message
  section.append(badge, title, text)
  root.append(section)
}

async function start(): Promise<void> {
  bootstrapTelegramWebApp()
  const pinia = createPinia()

  if (import.meta.env.PROD) {
    const telegramIdentity = new TelegramIdentityProvider()
    if (!telegramIdentity.isAvailable()) {
      showTelegramOnly('Запустите DevRecall через кнопку в Telegram.')
      return
    }
    try {
      const user = await telegramIdentity.getUser()
      createApp(App).use(pinia).use(router).mount('#app')
      const profileStore = useProfileStore(pinia)
      profileStore.setUser(user)
      await useSyncStore(pinia).retry()
    } catch (error) {
      showTelegramOnly(error instanceof Error ? error.message : 'Не удалось подтвердить доступ.')
    }
    return
  }

  createApp(App).use(pinia).use(router).mount('#app')
  const profileStore = useProfileStore(pinia)
  const syncStore = useSyncStore(pinia)
  await profileStore.load()
  await syncStore.retry()
}

void start()
