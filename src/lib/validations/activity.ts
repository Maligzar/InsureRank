import { z } from 'zod'

export const activitySchema = z.object({
  type: z.enum(['EMAIL', 'MEETING', 'NOTE', 'TASK']),
  notes: z.string().max(5000).optional(),
  scheduledAt: z.string().datetime().optional(),
})

export const activityUpdateSchema = z.object({
  notes: z.string().max(5000).optional(),
  completedAt: z.string().datetime().nullable().optional(),
})

export type ActivityInput = z.infer<typeof activitySchema>
