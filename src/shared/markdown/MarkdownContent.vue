<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from './renderMarkdown'

const props = defineProps<{ source: string }>()
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <div class="markdown-content" v-html="html" />
</template>

<style>
.markdown-content {
  color: var(--text);
  font-size: 1rem;
  line-height: 1.72;
}

.markdown-content > :first-child { margin-top: 0; }
.markdown-content > :last-child { margin-bottom: 0; }
.markdown-content code {
  padding: 0.18em 0.4em;
  border-radius: 7px;
  background: var(--surface-muted);
  color: var(--primary);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.88em;
}
.markdown-content pre {
  max-width: 100%;
  overflow-x: auto;
  padding: 16px;
  border-radius: 16px;
  background: #171421;
  color: #f7f4ff;
}
.markdown-content pre code {
  padding: 0;
  background: transparent;
  color: inherit;
}
</style>
