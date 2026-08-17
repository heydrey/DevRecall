import topicsJson from './content/topics.json'
import closuresJson from './content/javascript/closures.json'
import eventLoopJson from './content/javascript/event-loop.json'
import fundamentalsJson from './content/javascript/fundamentals.json'
import promisesJson from './content/javascript/promises.json'
import type { CardRepository } from './CardRepository'
import { cardSchema, topicSchema } from './schema'
import type { Card, Topic } from './types'

const topics = topicSchema.array().parse(topicsJson) satisfies Topic[]
const cards = cardSchema.array().parse([
  ...fundamentalsJson,
  ...eventLoopJson,
  ...promisesJson,
  ...closuresJson,
]) satisfies Card[]

export class StaticCardRepository implements CardRepository {
  async getTopics(): Promise<Topic[]> {
    return topics
  }

  async getCards(): Promise<Card[]> {
    return cards.filter((card) => card.enabled)
  }

  async getCardsByTopic(topicId: string): Promise<Card[]> {
    return cards.filter((card) => card.enabled && card.topicId === topicId)
  }

  async getCardById(cardId: string): Promise<Card | null> {
    return cards.find((card) => card.enabled && card.id === cardId) ?? null
  }
}
