export type CardLevel = 'basic' | 'middle' | 'advanced'

export interface Section {
  id: string
  topicId: string
  title: string
  description: string
}

export interface Topic {
  id: string
  title: string
  description: string
  accent: string
  sections: Section[]
}

export interface Card {
  id: string
  topicId: string
  sectionId: string
  question: string
  answer: string
  level: CardLevel
  tags: string[]
  enabled: boolean
}
