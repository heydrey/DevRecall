<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
}>()
</script>

<template>
  <section class="placeholder-view">
    <span class="placeholder-view__eyebrow">{{ eyebrow }}</span>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <div class="placeholder-view__panel" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  </section>
</template>

<style scoped>
.placeholder-view {
  display: grid;
  gap: 12px;
}

.placeholder-view__eyebrow {
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 8vw, 3.4rem);
  letter-spacing: -0.045em;
}

p {
  max-width: 560px;
  margin: 0;
  color: var(--text-muted);
  font-size: 1.04rem;
  line-height: 1.65;
}

.placeholder-view__panel {
  display: grid;
  gap: 12px;
  margin-top: 18px;
  padding: 20px;
  border: 1px solid var(--border-subtle);
  border-radius: 26px;
  background: var(--surface);
  box-shadow: var(--shadow-md);
}

.placeholder-view__panel span {
  display: block;
  height: 72px;
  border-radius: 18px;
  background: linear-gradient(110deg, var(--surface-muted), var(--primary-soft));
}
</style>
