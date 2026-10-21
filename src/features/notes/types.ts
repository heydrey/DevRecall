export interface LearningNote {
  id: string
  title: string
  shortAnswer: string
  body: string
  links: string[]
  isDone: boolean
  updatedAt: string
  deletedAt: string | null
}

export interface NoteDraft {
  title: string
  shortAnswer: string
  body: string
  links: string[]
  isDone: boolean
}
