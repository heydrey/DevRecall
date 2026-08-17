import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../features/home/HomeView.vue'
import TopicsView from '../features/content/TopicsView.vue'
import TopicView from '../features/content/TopicView.vue'
import StudyView from '../features/study/StudyView.vue'
import FavoritesView from '../features/favorites/FavoritesView.vue'
import StatisticsView from '../features/statistics/StatisticsView.vue'
import SettingsView from '../features/settings/SettingsView.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/topics', name: 'topics', component: TopicsView },
  { path: '/topics/:topicId', name: 'topic', component: TopicView },
  { path: '/study', name: 'study', component: StudyView, meta: { hideNavigation: true } },
  { path: '/favorites', name: 'favorites', component: FavoritesView },
  { path: '/statistics', name: 'statistics', component: StatisticsView },
  { path: '/settings', name: 'settings', component: SettingsView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
