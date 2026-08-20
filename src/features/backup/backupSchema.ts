import { z } from 'zod'
import type { AppUser } from '../profile/types'
import type { ProgressBackupPayload } from '../progress/ProgressRepository'
import type { SyncMutation } from '../sync/types'

export interface DevRecallBackup {
  format: 'devrecall-backup'
  version: 1
  exportedAt: string
  progress: ProgressBackupPayload
  outbox: SyncMutation[]
  profile?: Pick<AppUser, 'id' | 'displayName' | 'mode'>
}

const reviewMutationSchema = z.object({
  id: z.string().min(1),
  type: z.literal('review.recorded'),
  createdAt: z.string().datetime(),
  cardId: z.string().min(1),
  rating: z.enum(['again', 'hard', 'good', 'easy']),
  reviewedAt: z.string().datetime(),
})

const favoriteMutationSchema = z.object({
  id: z.string().min(1),
  type: z.literal('favorite.changed'),
  createdAt: z.string().datetime(),
  cardId: z.string().min(1),
  favorite: z.boolean(),
})

const settingsMutationSchema = z.object({
  id: z.string().min(1),
  type: z.literal('settings.updated'),
  createdAt: z.string().datetime(),
  patch: z.object({
    dailyNewCards: z.number().int().positive().optional(),
    dailyReviewLimit: z.number().int().positive().optional(),
    theme: z.enum(['system', 'light', 'dark']).optional(),
    preferredLevel: z.enum(['all', 'basic', 'middle', 'advanced']).optional(),
    sessionMinutes: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(20)]).optional(),
  }).strict(),
})

export const syncMutationSchema = z.discriminatedUnion('type', [
  reviewMutationSchema,
  favoriteMutationSchema,
  settingsMutationSchema,
])

export const devRecallBackupSchema = z.object({
  format: z.literal('devrecall-backup'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  progress: z.object({
    snapshot: z.object({
      version: z.number(),
      progress: z.record(z.string(), z.unknown()),
      reviewEvents: z.array(z.unknown()),
      settings: z.object({
        dailyNewCards: z.number(),
        dailyReviewLimit: z.number(),
        theme: z.enum(['system', 'light', 'dark']),
        preferredLevel: z.enum(['all', 'basic', 'middle', 'advanced']),
        sessionMinutes: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(20)]).optional(),
      }).passthrough(),
    }).passthrough(),
    rawLegacyBackup: z.string().optional(),
  }),
  outbox: z.array(syncMutationSchema),
  profile: z.object({
    id: z.string(),
    displayName: z.string(),
    mode: z.enum(['local', 'telegram']),
  }).optional(),
})
