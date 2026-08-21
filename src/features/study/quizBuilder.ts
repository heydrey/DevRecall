import type { Card } from '../content/types'

export interface QuizOption {
  id: string
  text: string
}

export interface QuizQuestion {
  cardId: string
  prompt: string
  answer: string
  correctOptionId: string
  options: QuizOption[]
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    const current = result[index] as T
    result[index] = result[target] as T
    result[target] = current
  }
  return result
}

function answerPreview(source: string): string {
  const plain = source
    .replace(/~~~[\w-]*\n?/g, '')
    .replace(/```[\w-]*\n?/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s*[#>*+-]+\s*/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (plain.length <= 230) return plain
  const shortened = plain.slice(0, 230)
  const lastBoundary = Math.max(shortened.lastIndexOf('. '), shortened.lastIndexOf('; '), shortened.lastIndexOf(', '))
  return `${shortened.slice(0, lastBoundary > 130 ? lastBoundary + 1 : 227).trim()}…`
}

export function buildSessionQuiz(cards: Card[], limit = 5, random: () => number = Math.random): QuizQuestion[] {
  const uniqueCards = [...new Map(cards.map((card) => [card.id, card])).values()]
  if (uniqueCards.length < 2) return []

  return shuffle(uniqueCards, random).slice(0, Math.min(limit, uniqueCards.length)).map((card) => {
    const distractors = shuffle(uniqueCards.filter((candidate) => candidate.id !== card.id), random)
      .slice(0, Math.min(3, uniqueCards.length - 1))
    const optionCards = shuffle([card, ...distractors], random)
    return {
      cardId: card.id,
      prompt: card.question,
      answer: card.answer,
      correctOptionId: card.id,
      options: optionCards.map((option) => ({ id: option.id, text: answerPreview(option.answer) })),
    }
  })
}
