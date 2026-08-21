<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { ChartNoAxesColumnIncreasing, House, Layers3, Star } from '@lucide/vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { startPresenceTracking } from '../features/telegram/presence'

const route = useRoute()
const hideNavigation = computed(() => Boolean(route.meta.hideNavigation))
let stopPresence: () => void = () => undefined

onMounted(() => { stopPresence = startPresenceTracking() })
onBeforeUnmount(() => stopPresence())

const navigationItems = [
  { to: '/', label: 'Главная', icon: House },
  { to: '/topics', label: 'Темы', icon: Layers3 },
  { to: '/favorites', label: 'Избранное', icon: Star },
  { to: '/statistics', label: 'Статистика', icon: ChartNoAxesColumnIncreasing },
]
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--focused': hideNavigation }">
    <main class="app-content" :class="{ 'app-content--focused': hideNavigation }">
      <RouterView />
    </main>

    <nav v-if="!hideNavigation" class="bottom-nav" aria-label="Основная навигация">
      <RouterLink
        v-for="item in navigationItems"
        :key="item.to"
        :to="item.to"
        class="bottom-nav__item"
      >
        <component :is="item.icon" :size="21" :stroke-width="2" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
}

.app-content {
  width: min(100%, 760px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 24px 18px calc(104px + env(safe-area-inset-bottom));
}

.app-content--focused {
  width: 100%;
  max-width: none;
  padding: 0;
}

.bottom-nav {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 9px 10px calc(9px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  box-shadow: 0 -12px 36px rgb(33 24 72 / 8%);
  backdrop-filter: blur(20px);
}

.bottom-nav__item {
  display: flex;
  min-width: 0;
  min-height: 52px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  border-radius: 16px;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
  text-decoration: none;
  transition: color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.bottom-nav__item:active {
  transform: scale(0.96);
}

.bottom-nav__item.router-link-active {
  color: var(--primary);
  background: var(--primary-soft);
}

@media (min-width: 820px) {
  .app-content {
    padding-top: 42px;
  }

  .bottom-nav {
    bottom: 18px;
    border: 1px solid var(--border-subtle);
    border-radius: 24px;
    padding-bottom: 9px;
    box-shadow: var(--shadow-lg);
  }
}
</style>
