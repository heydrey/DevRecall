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
  min-width: 0;
  max-width: 100%;
  color: var(--text);
  font-size: 1rem;
  line-height: 1.72;
  overflow-wrap: anywhere;
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
.markdown-content table {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  -webkit-overflow-scrolling: touch;
}
.markdown-content th,
.markdown-content td {
  min-width: 132px;
  padding: 9px 11px;
  border: 1px solid var(--border-subtle);
  text-align: left;
  vertical-align: top;
}
.markdown-content th {
  background: var(--surface-muted);
  font-size: 0.88em;
}
.markdown-content img {
  max-width: 100%;
  height: auto;
}
.markdown-content a {
  overflow-wrap: anywhere;
}
</style>
