import type { Card, Topic } from './types'

export interface CardRepository {
  getTopics(): Promise<Topic[]>
  getCards(): Promise<Card[]>
  getCardsByTopic(topicId: string): Promise<Card[]>
  getCardById(cardId: string): Promise<Card | null>
}
