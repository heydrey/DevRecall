import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import SectionPlaceholder from './SectionPlaceholder.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: SectionPlaceholder,
    props: {
      eyebrow: 'DevRecall',
      title: 'Добрый вечер 👋',
      description: 'Здесь появится ваш план обучения на сегодня и быстрый переход к повторению.',
    },
  },
  {
    path: '/topics',
    component: SectionPlaceholder,
    props: {
      eyebrow: 'База знаний',
      title: 'Темы',
      description: 'JavaScript станет первой полноценной темой, остальные добавим после проверки учебного цикла.',
    },
  },
  {
    path: '/favorites',
    component: SectionPlaceholder,
    props: {
      eyebrow: 'Личная подборка',
      title: 'Избранное',
      description: 'Сохраняйте важные и сложные вопросы, чтобы возвращаться к ним отдельной сессией.',
    },
  },
  {
    path: '/statistics',
    component: SectionPlaceholder,
    props: {
      eyebrow: 'Результаты',
      title: 'Статистика',
      description: 'Здесь будут серия дней, активность за неделю и прогресс по темам.',
    },
  },
  {
    path: '/settings',
    component: SectionPlaceholder,
    props: {
      eyebrow: 'Персонализация',
      title: 'Настройки',
      description: 'Дневные лимиты, цветовая тема и параметры обучения.',
    },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
