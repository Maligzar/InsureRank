import { z } from 'zod'

export const leadSchema = z.object({
  contactId: z.string().cuid(),
  pipelineStageId: z.string().cuid(),
  lineOfBusiness: z.enum(['LIFE', 'PNC', 'HEALTH', 'OTHER']),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).default('WARM'),
  expectedRevenue: z.number().min(0).optional(),
  closeDate: z.string().datetime().optional(),
  lostReason: z.string().max(500).optional(),
})

export const leadUpdateSchema = leadSchema.partial().omit({ contactId: true })

export const leadStageSchema = z.object({
  pipelineStageId: z.string().cuid(),
})

export const leadImportRowSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  lineOfBusiness: z.enum(['LIFE', 'PNC', 'HEALTH', 'OTHER']).default('OTHER'),
  sourceChannel: z
    .enum(['REFERRAL', 'WEB_FORM', 'COLD_CALL', 'IMPORT', 'SOCIAL', 'OTHER'])
    .default('IMPORT'),
  expectedRevenue: z.coerce.number().optional(),
})

export type LeadInput = z.infer<typeof leadSchema>
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>
