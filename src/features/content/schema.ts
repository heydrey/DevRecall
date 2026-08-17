import { z } from 'zod'

export const cardLevelSchema = z.enum(['basic', 'middle', 'advanced'])

export const sectionSchema = z.object({
  id: z.string().trim().min(1),
  topicId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
})

export const topicSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  accent: z.string().trim().regex(/^#[0-9a-f]{6}$/i),
  sections: z.array(sectionSchema).min(1),
})

export const cardSchema = z.object({
  id: z.string().trim().min(1),
  topicId: z.string().trim().min(1),
  sectionId: z.string().trim().min(1),
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  level: cardLevelSchema,
  tags: z.array(z.string().trim().min(1)),
  enabled: z.boolean(),
})
