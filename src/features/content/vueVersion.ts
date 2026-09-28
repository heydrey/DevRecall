import type { Card } from './types'

export type VueVersion = 'vue2' | 'vue3' | 'both'

// Cards not listed here describe concepts that apply to both major versions.
const vue2Only = new Set([
  'vue-reactivity-006',
  'vue-legacy-001', 'vue-legacy-002', 'vue-legacy-003', 'vue-legacy-004', 'vue-legacy-005',
])

const vue3Only = new Set([
  'vue-reactivity-008', 'vue-reactivity-009',
  'vue-ecosystem-003', 'vue-ecosystem-009',
  'vue-practice-001', 'vue-practice-003', 'vue-practice-004',
  'vue-extended-001', 'vue-extended-002', 'vue-extended-003',
  'vue-extended-005', 'vue-extended-006', 'vue-extended-007',
  'vue-extended-008', 'vue-extended-009', 'vue-extended-010',
  'vue-extended-013',
  'vue-2026-004',
])

export function getVueVersion(card: Card): VueVersion | null {
  if (card.topicId !== 'vue') return null
  if (vue2Only.has(card.id)) return 'vue2'
  if (vue3Only.has(card.id)) return 'vue3'
  return 'both'
}

export function vueVersionLabel(version: VueVersion): string {
  if (version === 'vue2') return 'Vue 2'
  if (version === 'vue3') return 'Vue 3'
  return 'Vue 2 и 3'
}
