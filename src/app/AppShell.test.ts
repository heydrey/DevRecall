import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import AppShell from './AppShell.vue'

describe('AppShell', () => {
  it('показывает основные разделы русской навигации', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div>Главная страница</div>' } }],
    })

    await router.push('/')
    await router.isReady()

    const wrapper = mount(AppShell, {
      global: { plugins: [router] },
    })

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Основная навигация')
    expect(wrapper.text()).toContain('Главная')
    expect(wrapper.text()).toContain('Темы')
    expect(wrapper.text()).toContain('Избранное')
    expect(wrapper.text()).toContain('Статистика')
  })
})
