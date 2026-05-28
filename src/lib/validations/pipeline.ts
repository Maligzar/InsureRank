import { z } from 'zod'

export const pipelineStageSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.number().int().nonnegative(),
  probability: z.number().min(0).max(1).default(0),
  lineOfBusiness: z.enum(['LIFE', 'PNC', 'HEALTH', 'OTHER']).optional(),
  isDefault: z.boolean().default(false),
  isClosed: z.boolean().default(false),
  isWon: z.boolean().default(false),
})

export const pipelineStageUpdateSchema = pipelineStageSchema.partial()

export const pipelineReorderSchema = z.object({
  stages: z.array(
    z.object({
      id: z.string().cuid(),
      position: z.number().int().nonnegative(),
    })
  ),
})
