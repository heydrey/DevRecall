export interface LessonPart {
  id: string
  title: string
  content: string
  pause?: { question: string; explanation: string }
}

export interface LessonQuestion {
  prompt: string
  options: Array<{ id: string; text: string }>
  correctOptionId: string
  explanation: string
}

export interface StructuredLesson {
  parts: LessonPart[]
  question: LessonQuestion | null
  fullText: string
}

const PARTS = [
  { id: 'idea', title: 'Суть простыми словами', matches: /^(?:суть|совсем простыми словами)/i },
  { id: 'example-1', title: 'Первый пример', matches: /^пример\s*1\b/i },
  { id: 'example-2', title: 'Второй пример', matches: /^пример\s*2\b/i },
  { id: 'mistake', title: 'Где легко ошибиться', matches: /^(?:где легко ошибиться|типичная ошибка)/i },
  { id: 'summary', title: 'Что запомнить', matches: /^(?:что запомнить|главное)/i },
] as const

function headingKind(line: string): string | null {
  if (!/^\s*(?:#{1,6}\s+|\d+[.)]\s*|\*\*)/.test(line)) return null
  const title = line.trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/[:：]\s*$/, '')
    .trim()
  if (/^(?:мини[ -]?тест|проверь себя)/i.test(title)) return 'quiz'
  return PARTS.find((part) => part.matches.test(title))?.id ?? null
}

function parseQuestion(source: string): LessonQuestion | null {
  const lines = source.split(/\r?\n/).map((line) => line.trim().replace(/\*\*/g, '').replace(/^[-*]\s+/, ''))
  const prompt = lines.find((line) => /^Вопрос\s*[:：]/i.test(line))?.replace(/^Вопрос\s*[:：]\s*/i, '').trim()
  const options = lines.flatMap((line) => {
    const match = /^([A-D])[).:-]\s*(.+)$/i.exec(line)
    return match ? [{ id: (match[1] ?? '').toUpperCase(), text: (match[2] ?? '').trim() }] : []
  })
  const correctOptionId = lines.find((line) => /^(?:Правильный вариант|Правильный ответ|Ответ)\s*[:：]/i.test(line))
    ?.match(/^(?:Правильный вариант|Правильный ответ|Ответ)\s*[:：]\s*([A-D])\b/i)?.[1]?.toUpperCase()
  const explanation = lines.find((line) => /^(?:Объяснение|Почему)\s*[:：]/i.test(line))
    ?.replace(/^(?:Объяснение|Почему)\s*[:：]\s*/i, '').trim() ?? ''
  if (!prompt || !correctOptionId || options.length < 3 || options.length > 4
    || !options.some((option) => option.id === correctOptionId)
    || new Set(options.map((option) => option.id)).size !== options.length
    || new Set(options.map((option) => option.text.toLocaleLowerCase('ru'))).size !== options.length) return null
  return { prompt, options, correctOptionId, explanation }
}

function extractPause(source: string): { content: string; pause?: LessonPart['pause'] } {
  const lines = source.split(/\r?\n/)
  const questionIndex = lines.findIndex((line) => /^\s*(?:\*\*)?Пауза\s*[:：]/i.test(line))
  const explanationIndex = lines.findIndex((line) => /^\s*(?:\*\*)?Разбор паузы\s*[:：]/i.test(line))
  if (questionIndex < 0 || explanationIndex <= questionIndex) return { content: source.trim() }
  const question = (lines[questionIndex] ?? '').replace(/\*\*/g, '').replace(/^\s*Пауза\s*[:：]\s*/i, '').trim()
  const explanation = (lines[explanationIndex] ?? '').replace(/\*\*/g, '').replace(/^\s*Разбор паузы\s*[:：]\s*/i, '').trim()
  if (!question || !explanation) return { content: source.trim() }
  return {
    content: lines.filter((_, index) => index !== questionIndex && index !== explanationIndex).join('\n').trim(),
    pause: { question, explanation },
  }
}

export function structureLesson(text: string): StructuredLesson {
  const collected: Array<{ id: string; lines: string[] }> = []
  const preamble: string[] = []
  let current: { id: string; lines: string[] } | null = null
  let inCodeBlock = false

  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) inCodeBlock = !inCodeBlock
    const kind = inCodeBlock ? null : headingKind(line)
    if (kind) {
      current = { id: kind, lines: [] }
      collected.push(current)
    } else if (current) current.lines.push(line)
    else preamble.push(line)
  }

  const quizSource = collected.find((part) => part.id === 'quiz')?.lines.join('\n') ?? ''
  const parts: LessonPart[] = collected.flatMap((part) => {
    if (part.id === 'quiz') return []
    const { content, pause } = extractPause(part.lines.join('\n').trim())
    const definition = PARTS.find((candidate) => candidate.id === part.id)
    return content && definition ? [{ id: part.id, title: definition.title, content, ...(pause ? { pause } : {}) }] : []
  })

  if (parts.length === 0) {
    parts.push({ id: 'idea', title: 'Разбор вопроса', content: text.trim() })
  } else if (preamble.join('\n').trim()) {
    parts[0] = { ...parts[0]!, content: `${preamble.join('\n').trim()}\n\n${parts[0]!.content}` }
  }

  return {
    parts,
    question: parseQuestion(quizSource),
    fullText: parts.map((part) => `## ${part.title}\n\n${part.content}${part.pause ? `\n\n**Пауза:** ${part.pause.question}\n\n**Разбор:** ${part.pause.explanation}` : ''}`).join('\n\n'),
  }
}
