import { z } from 'zod'

export const contactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(7).max(20).optional().or(z.literal('')),
  dob: z.string().datetime().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().default('US'),
    })
    .optional(),
  sourceChannel: z
    .enum(['REFERRAL', 'WEB_FORM', 'COLD_CALL', 'IMPORT', 'SOCIAL', 'OTHER'])
    .default('OTHER'),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  assignedAgentId: z.string().cuid().optional(),
  convertToLead: z.boolean().default(false),
})

export type ContactInput = z.infer<typeof contactSchema>
