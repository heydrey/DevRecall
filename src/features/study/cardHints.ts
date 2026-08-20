import type { Card } from '../content/types'

const SHORT_TAGS = new Set(['js', 'ts', 'php', 'vue', 'sql', 'http', 'api', 'dom', 'css', 'html'])

function humanizeTag(tag: string): string {
  const value = tag.replace(/[-_]+/g, ' ').trim()
  return SHORT_TAGS.has(value.toLowerCase()) ? value.toUpperCase() : value
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_#>\[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildKeywordHint(card: Card): string {
  const terms = [...new Set(card.tags.map(humanizeTag).filter(Boolean))].slice(0, 4)
  return terms.length ? terms.join(' · ') : humanizeTag(card.sectionId)
}

export function buildAnswerLead(card: Card): string {
  const words = plainText(card.answer).split(' ').filter(Boolean)
  const lead = words.slice(0, 7).join(' ')
  return lead ? `${lead}${words.length > 7 ? '…' : ''}` : 'Сформулируйте главную идею одним предложением.'
}
