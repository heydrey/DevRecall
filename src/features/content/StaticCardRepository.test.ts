import { describe, expect, it } from 'vitest'
import { StaticCardRepository } from './StaticCardRepository'

describe('StaticCardRepository', () => {
  it('возвращает 30 включённых JavaScript-карточек со стабильными уникальными ID', async () => {
    const repository = new StaticCardRepository()

    const cards = await repository.getCardsByTopic('javascript')

    expect(cards).toHaveLength(30)
    expect(new Set(cards.map((card) => card.id)).size).toBe(30)
    expect(cards.every((card) => card.id.startsWith('js-'))).toBe(true)
    expect(cards.every((card) => card.question.trim() && card.answer.trim())).toBe(true)
  })

  it('находит карточку по ID и возвращает null для неизвестного ID', async () => {
    const repository = new StaticCardRepository()

    await expect(repository.getCardById('js-event-loop-001')).resolves.toMatchObject({
      topicId: 'javascript',
      sectionId: 'event-loop',
    })
    await expect(repository.getCardById('missing-card')).resolves.toBeNull()
  })

  it('возвращает тему JavaScript с четырьмя разделами', async () => {
    const repository = new StaticCardRepository()

    const topics = await repository.getTopics()

    expect(topics).toHaveLength(1)
    expect(topics[0]).toMatchObject({ id: 'javascript', title: 'JavaScript' })
    expect(topics[0]?.sections).toHaveLength(4)
  })
})
