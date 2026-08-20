import topicsJson from './content/topics.json'
import closuresJson from './content/javascript/closures.json'
import eventLoopJson from './content/javascript/event-loop.json'
import fundamentalsJson from './content/javascript/fundamentals.json'
import promisesJson from './content/javascript/promises.json'
import javascriptInterviewJson from './content/javascript/collections-functions.json'
import javascriptTheoryPracticeJson from './content/javascript/theory-practice.json'
import javascript2026Json from './content/javascript/interview-2026.json'
import vueInterviewJson from './content/vue/interview.json'
import vueArchitectureJson from './content/vue/architecture.json'
import vue2026Json from './content/vue/interview-2026.json'
import vueExtended2026Json from './content/vue/extended-2026.json'
import htmlCssInterviewJson from './content/html-css/interview.json'
import browserWebInterviewJson from './content/browser-web/interview.json'
import browserRenderingStorageJson from './content/browser-web/rendering-storage.json'
import browser2026Json from './content/browser-web/interview-2026.json'
import httpInterviewJson from './content/http/interview.json'
import httpAdvancedJson from './content/http/advanced.json'
import http2026Json from './content/http/interview-2026.json'
import architectureInterviewJson from './content/architecture/interview.json'
import architecture2026Json from './content/architecture/interview-2026.json'
import testingInterviewJson from './content/testing/interview.json'
import testing2026Json from './content/testing/interview-2026.json'
import typescriptInterviewJson from './content/typescript/interview.json'
import typescript2026Json from './content/typescript/interview-2026.json'
import phpInterviewJson from './content/php/interview.json'
import php2026Json from './content/php/interview-2026.json'
import phpExtended2026Json from './content/php/extended-2026.json'
import laravelInterviewJson from './content/laravel/interview.json'
import laravel2026Json from './content/laravel/interview-2026.json'
import laravelExtended2026Json from './content/laravel/extended-2026.json'
import sqlInterviewJson from './content/sql/interview.json'
import sql2026Json from './content/sql/interview-2026.json'
import postgresqlInterviewJson from './content/postgresql/interview.json'
import postgresql2026Json from './content/postgresql/interview-2026.json'
import postgresqlRlsInterviewJson from './content/postgresql-rls/interview.json'
import gitInterviewJson from './content/git/interview.json'
import dockerInterviewJson from './content/docker/interview.json'
import cicdInterviewJson from './content/cicd/interview.json'
import cicd2026Json from './content/cicd/interview-2026.json'
import kubernetesInterviewJson from './content/kubernetes/interview.json'
import kubernetes2026Json from './content/kubernetes/interview-2026.json'
import rabbitmqInterviewJson from './content/rabbitmq/interview.json'
import securityInterviewJson from './content/security/interview.json'
import security2026Json from './content/security/interview-2026.json'
import ragInterviewJson from './content/rag/interview.json'
import rag2026Json from './content/rag/interview-2026.json'
import systemDesignInterviewJson from './content/system-design/interview.json'
import systemDesign2026Json from './content/system-design/interview-2026.json'
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
  ...javascript2026Json,
  ...vueInterviewJson,
  ...vueArchitectureJson,
  ...vue2026Json,
  ...vueExtended2026Json,
  ...htmlCssInterviewJson,
  ...browserWebInterviewJson,
  ...browserRenderingStorageJson,
  ...browser2026Json,
  ...httpInterviewJson,
  ...httpAdvancedJson,
  ...http2026Json,
  ...architectureInterviewJson,
  ...architecture2026Json,
  ...testingInterviewJson,
  ...testing2026Json,
  ...typescriptInterviewJson,
  ...typescript2026Json,
  ...phpInterviewJson,
  ...php2026Json,
  ...phpExtended2026Json,
  ...laravelInterviewJson,
  ...laravel2026Json,
  ...laravelExtended2026Json,
  ...sqlInterviewJson,
  ...sql2026Json,
  ...postgresqlInterviewJson,
  ...postgresql2026Json,
  ...postgresqlRlsInterviewJson,
  ...gitInterviewJson,
  ...dockerInterviewJson,
  ...cicdInterviewJson,
  ...cicd2026Json,
  ...kubernetesInterviewJson,
  ...kubernetes2026Json,
  ...rabbitmqInterviewJson,
  ...securityInterviewJson,
  ...security2026Json,
  ...ragInterviewJson,
  ...rag2026Json,
  ...systemDesignInterviewJson,
  ...systemDesign2026Json,
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
