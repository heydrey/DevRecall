import topicsJson from './content/topics.json'
import closuresJson from './content/javascript/closures.json'
import eventLoopJson from './content/javascript/event-loop.json'
import fundamentalsJson from './content/javascript/fundamentals.json'
import promisesJson from './content/javascript/promises.json'
import javascriptInterviewJson from './content/javascript/collections-functions.json'
import javascriptTheoryPracticeJson from './content/javascript/theory-practice.json'
import vueInterviewJson from './content/vue/interview.json'
import vueArchitectureJson from './content/vue/architecture.json'
import htmlCssInterviewJson from './content/html-css/interview.json'
import browserWebInterviewJson from './content/browser-web/interview.json'
import browserRenderingStorageJson from './content/browser-web/rendering-storage.json'
import httpInterviewJson from './content/http/interview.json'
import httpAdvancedJson from './content/http/advanced.json'
import architectureInterviewJson from './content/architecture/interview.json'
import testingInterviewJson from './content/testing/interview.json'
import typescriptInterviewJson from './content/typescript/interview.json'
import phpInterviewJson from './content/php/interview.json'
import laravelInterviewJson from './content/laravel/interview.json'
import sqlInterviewJson from './content/sql/interview.json'
import postgresqlInterviewJson from './content/postgresql/interview.json'
import postgresqlRlsInterviewJson from './content/postgresql-rls/interview.json'
import gitInterviewJson from './content/git/interview.json'
import dockerInterviewJson from './content/docker/interview.json'
import cicdInterviewJson from './content/cicd/interview.json'
import kubernetesInterviewJson from './content/kubernetes/interview.json'
import rabbitmqInterviewJson from './content/rabbitmq/interview.json'
import securityInterviewJson from './content/security/interview.json'
import ragInterviewJson from './content/rag/interview.json'
import systemDesignInterviewJson from './content/system-design/interview.json'
import type { CardRepository } from './CardRepository'
import { cardSchema, topicSchema } from './schema'
import type { Card, Topic } from './types'

const topics = topicSchema.array().parse(topicsJson) satisfies Topic[]
const cards = cardSchema.array().parse([
  ...fundamentalsJson,
  ...eventLoopJson,
  ...promisesJson,
  ...closuresJson,
  ...javascriptInterviewJson,
  ...javascriptTheoryPracticeJson,
  ...vueInterviewJson,
  ...vueArchitectureJson,
  ...htmlCssInterviewJson,
  ...browserWebInterviewJson,
  ...browserRenderingStorageJson,
  ...httpInterviewJson,
  ...httpAdvancedJson,
  ...architectureInterviewJson,
  ...testingInterviewJson,
  ...typescriptInterviewJson,
  ...phpInterviewJson,
  ...laravelInterviewJson,
  ...sqlInterviewJson,
  ...postgresqlInterviewJson,
  ...postgresqlRlsInterviewJson,
  ...gitInterviewJson,
  ...dockerInterviewJson,
  ...cicdInterviewJson,
  ...kubernetesInterviewJson,
  ...rabbitmqInterviewJson,
  ...securityInterviewJson,
  ...ragInterviewJson,
  ...systemDesignInterviewJson,
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
