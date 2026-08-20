import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './app/App.vue'
import { router } from './app/router'
import { bootstrapTelegramWebApp } from './features/telegram/telegramWebApp'
import { useProfileStore } from './features/profile/profileStore'
import { useSyncStore } from './features/sync/syncStore'
import './shared/styles/tokens.css'
import './shared/styles/base.css'

bootstrapTelegramWebApp()

const pinia = createPinia()
createApp(App).use(pinia).use(router).mount('#app')

const profileStore = useProfileStore(pinia)
const syncStore = useSyncStore(pinia)
void profileStore.load().then(() => syncStore.retry())
