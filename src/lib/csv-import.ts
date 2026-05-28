import Papa from 'papaparse'
import { z } from 'zod'

const contactRowSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  sourceChannel: z
    .enum(['REFERRAL', 'WEB_FORM', 'COLD_CALL', 'IMPORT', 'SOCIAL', 'OTHER'])
    .default('IMPORT'),
  lineOfBusiness: z.enum(['LIFE', 'PNC', 'HEALTH', 'OTHER']).optional(),
  expectedRevenue: z.coerce.number().nonnegative().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type CsvContactRow = z.infer<typeof contactRowSchema>

export interface ParseResult {
  rows: CsvContactRow[]
  errors: Array<{ row: number; message: string }>
}

const FIELD_ALIASES: Record<string, string> = {
  first_name: 'firstName',
  last_name: 'lastName',
  first: 'firstName',
  last: 'lastName',
  e_mail: 'email',
  mobile: 'phone',
  cell: 'phone',
  source: 'sourceChannel',
  source_channel: 'sourceChannel',
  lob: 'lineOfBusiness',
  line_of_business: 'lineOfBusiness',
  expected_revenue: 'expectedRevenue',
  revenue: 'expectedRevenue',
}

function normalizeHeader(h: string): string {
  const trimmed = h.trim()
  const key = trimmed.toLowerCase().replace(/\s+/g, '_')
  // If there's a known alias, use it; otherwise preserve original casing (handles camelCase headers)
  return FIELD_ALIASES[key] ?? trimmed
}

export function parseCsvContacts(csvText: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  })

  const rows: CsvContactRow[] = []
  const errors: Array<{ row: number; message: string }> = []

  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i]
    const parsed = contactRowSchema.safeParse({
      ...raw,
      email: raw.email || undefined,
      phone: raw.phone || undefined,
      expectedRevenue: raw.expectedRevenue || undefined,
      lineOfBusiness: raw.lineOfBusiness || undefined,
    })

    if (parsed.success) {
      rows.push(parsed.data)
    } else {
      errors.push({
        row: i + 2,
        message: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
      })
    }
  }

  return { rows, errors }
}
