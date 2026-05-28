import { describe, it, expect } from 'vitest'
import {
  paginationSchema,
  sortSchema,
  idParamSchema,
  contactSchema,
  leadSchema,
  leadUpdateSchema,
  leadStageSchema,
  activitySchema,
  pipelineStageSchema,
  pipelineReorderSchema,
} from '../validations'

// ─── Shared ───────────────────────────────────────────────────────────────────

describe('paginationSchema', () => {
  it('uses defaults when omitted', () => {
    const r = paginationSchema.parse({})
    expect(r.page).toBe(1)
    expect(r.limit).toBe(25)
  })

  it('rejects limit > 100', () => {
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it('rejects page < 1', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('accepts cursor', () => {
    const r = paginationSchema.parse({ cursor: 'abc' })
    expect(r.cursor).toBe('abc')
  })
})

describe('sortSchema', () => {
  it('accepts asc/desc', () => {
    expect(sortSchema.safeParse({ sortOrder: 'asc' }).success).toBe(true)
    expect(sortSchema.safeParse({ sortOrder: 'desc' }).success).toBe(true)
  })

  it('rejects invalid sortOrder', () => {
    expect(sortSchema.safeParse({ sortOrder: 'random' }).success).toBe(false)
  })
})

describe('idParamSchema', () => {
  it('accepts a valid cuid', () => {
    expect(idParamSchema.safeParse({ id: 'clxxxxxxxxxxxxxxxxxxxxxx' }).success).toBe(true)
  })

  it('rejects empty string', () => {
    expect(idParamSchema.safeParse({ id: '' }).success).toBe(false)
  })
})

// ─── Contact ──────────────────────────────────────────────────────────────────

describe('contactSchema', () => {
  const valid = {
    firstName: 'Jane',
    lastName: 'Doe',
  }

  it('accepts minimal contact', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty firstName', () => {
    expect(contactSchema.safeParse({ ...valid, firstName: '' }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('accepts valid email', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'jane@test.com' }).success).toBe(true)
  })

  it('accepts all source channels', () => {
    const channels = ['REFERRAL', 'WEB_FORM', 'COLD_CALL', 'IMPORT', 'SOCIAL', 'OTHER']
    for (const ch of channels) {
      expect(contactSchema.safeParse({ ...valid, sourceChannel: ch }).success).toBe(true)
    }
  })

  it('rejects invalid sourceChannel', () => {
    expect(contactSchema.safeParse({ ...valid, sourceChannel: 'UNKNOWN' }).success).toBe(false)
  })

  it('accepts UTM fields', () => {
    const r = contactSchema.safeParse({ ...valid, utmSource: 'google', utmMedium: 'cpc' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.utmSource).toBe('google')
    }
  })
})

// ─── Lead ─────────────────────────────────────────────────────────────────────

describe('leadSchema', () => {
  const valid = {
    contactId: 'clxxxxxxxxxxxxxxxxxxxxxx',
    pipelineStageId: 'clxxxxxxxxxxxxxxxxxxxxxx',
    lineOfBusiness: 'LIFE',
  }

  it('accepts minimal lead', () => {
    expect(leadSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing lineOfBusiness', () => {
    expect(
      leadSchema.safeParse({ contactId: valid.contactId, pipelineStageId: valid.pipelineStageId })
        .success
    ).toBe(false)
  })

  it('rejects invalid lineOfBusiness', () => {
    expect(leadSchema.safeParse({ ...valid, lineOfBusiness: 'AUTO' }).success).toBe(false)
  })

  it('accepts all LOBs', () => {
    for (const lob of ['LIFE', 'PNC', 'HEALTH', 'OTHER']) {
      expect(leadSchema.safeParse({ ...valid, lineOfBusiness: lob }).success).toBe(true)
    }
  })

  it('rejects negative expectedRevenue', () => {
    expect(leadSchema.safeParse({ ...valid, expectedRevenue: -100 }).success).toBe(false)
  })

  it('accepts positive expectedRevenue', () => {
    expect(leadSchema.safeParse({ ...valid, expectedRevenue: 5000 }).success).toBe(true)
  })
})

describe('leadUpdateSchema', () => {
  it('accepts partial update', () => {
    expect(leadUpdateSchema.safeParse({ temperature: 'HOT' }).success).toBe(true)
  })

  it('accepts empty object', () => {
    expect(leadUpdateSchema.safeParse({}).success).toBe(true)
  })
})

describe('leadStageSchema', () => {
  it('requires pipelineStageId', () => {
    expect(leadStageSchema.safeParse({}).success).toBe(false)
    expect(leadStageSchema.safeParse({ pipelineStageId: 'clxxxxxxxxxxxxxxxxxxxxxx' }).success).toBe(
      true
    )
  })
})

// ─── Activity ─────────────────────────────────────────────────────────────────

describe('activitySchema', () => {
  it('accepts EMAIL type', () => {
    expect(activitySchema.safeParse({ type: 'EMAIL', notes: 'Follow up sent' }).success).toBe(true)
  })

  it('accepts NOTE type with no notes', () => {
    expect(activitySchema.safeParse({ type: 'NOTE' }).success).toBe(true)
  })

  it('rejects CALL type (only EMAIL/MEETING/NOTE/TASK allowed for manual creation)', () => {
    expect(activitySchema.safeParse({ type: 'CALL' }).success).toBe(false)
  })

  it('rejects invalid type', () => {
    expect(activitySchema.safeParse({ type: 'POKE' }).success).toBe(false)
  })
})

// ─── Pipeline stage ───────────────────────────────────────────────────────────

describe('pipelineStageSchema', () => {
  const valid = { name: 'New Lead', position: 0 }

  it('accepts valid stage', () => {
    expect(pipelineStageSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects probability > 1', () => {
    expect(pipelineStageSchema.safeParse({ ...valid, probability: 1.5 }).success).toBe(false)
  })

  it('rejects probability < 0', () => {
    expect(pipelineStageSchema.safeParse({ ...valid, probability: -0.1 }).success).toBe(false)
  })

  it('rejects negative position', () => {
    expect(pipelineStageSchema.safeParse({ ...valid, position: -1 }).success).toBe(false)
  })

  it('accepts optional lineOfBusiness', () => {
    expect(pipelineStageSchema.safeParse({ ...valid, lineOfBusiness: 'HEALTH' }).success).toBe(true)
  })
})

describe('pipelineReorderSchema', () => {
  it('accepts valid reorder list', () => {
    const r = pipelineReorderSchema.safeParse({
      stages: [
        { id: 'clxxxxxxxxxxxxxxxxxxxxxx', position: 0 },
        { id: 'clyyyyyyyyyyyyyyyyyyyyyy', position: 1 },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('rejects non-integer position', () => {
    expect(
      pipelineReorderSchema.safeParse({
        stages: [{ id: 'clxxxxxxxxxxxxxxxxxxxxxx', position: 0.5 }],
      }).success
    ).toBe(false)
  })
})
