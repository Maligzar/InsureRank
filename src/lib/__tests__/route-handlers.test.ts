import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Auth mock ────────────────────────────────────────────────────────────────

vi.mock('../auth', () => ({ auth: vi.fn() }))
vi.mock('../queue', () => ({ enqueueLeadRank: vi.fn(), enqueueAgentRank: vi.fn() }))
vi.mock('../audit', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../fcm', () => ({ sendPushToAgent: vi.fn().mockResolvedValue(undefined) }))

vi.mock('../db', () => ({
  db: {
    contact: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    lead: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    pipelineStage: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { auth } from '../auth'
import { db } from '../db'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

function makeSession(orgId = 'org-1', role = 'AGENT', agentId: string | null = 'agent-1') {
  return { user: { id: 'user-1', orgId, role, agentId } }
}

function makeRequest(method: string, body?: unknown, url = 'http://localhost/api/test') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(makeSession())
})

// ─── Contacts list ────────────────────────────────────────────────────────────

describe('GET /api/v1/contacts', () => {
  it('scopes results to session org', async () => {
    mockDb.contact.findMany.mockResolvedValue([])
    mockDb.contact.count.mockResolvedValue(0)

    const { GET } = await import('../../app/api/v1/contacts/route')
    const res = await GET(makeRequest('GET'))

    expect(res.status).toBe(200)
    const whereArg = mockDb.contact.findMany.mock.calls[0][0].where
    expect(whereArg.orgId).toBe('org-1')
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const { GET } = await import('../../app/api/v1/contacts/route')
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })
})

// ─── Contact create ───────────────────────────────────────────────────────────

describe('POST /api/v1/contacts', () => {
  it('creates contact in session org', async () => {
    const created = { id: 'c-1', orgId: 'org-1', firstName: 'Jane', lastName: 'Doe' }
    mockDb.contact.create.mockResolvedValue(created)

    const { POST } = await import('../../app/api/v1/contacts/route')
    const res = await POST(makeRequest('POST', { firstName: 'Jane', lastName: 'Doe' }))

    expect(res.status).toBe(201)
    const createArg = mockDb.contact.create.mock.calls[0][0].data
    expect(createArg.orgId).toBe('org-1')
  })

  it('returns 400 on validation failure', async () => {
    const { POST } = await import('../../app/api/v1/contacts/route')
    const res = await POST(makeRequest('POST', { firstName: '' }))
    expect(res.status).toBe(400)
  })
})

// ─── Contact detail ───────────────────────────────────────────────────────────

describe('GET /api/v1/contacts/[id]', () => {
  it('returns 404 when contact not in org', async () => {
    mockDb.contact.findFirst.mockResolvedValue(null)

    const { GET } = await import('../../app/api/v1/contacts/[id]/route')
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'c-999' }) })
    expect(res.status).toBe(404)
  })

  it('returns contact when found in org', async () => {
    const contact = { id: 'c-1', orgId: 'org-1', firstName: 'Jane', lastName: 'Doe' }
    mockDb.contact.findFirst.mockResolvedValue(contact)

    const { GET } = await import('../../app/api/v1/contacts/[id]/route')
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'c-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('c-1')
  })
})

// ─── Contact PATCH ────────────────────────────────────────────────────────────

describe('PATCH /api/v1/contacts/[id]', () => {
  it('returns 404 when contact not found', async () => {
    mockDb.contact.findFirst.mockResolvedValue(null)

    const { PATCH } = await import('../../app/api/v1/contacts/[id]/route')
    const res = await PATCH(makeRequest('PATCH', { firstName: 'Jane' }), {
      params: Promise.resolve({ id: 'c-999' }),
    })
    expect(res.status).toBe(404)
  })

  it('updates contact and returns it', async () => {
    const existing = { id: 'c-1', orgId: 'org-1', assignedAgentId: null }
    const updated = { id: 'c-1', orgId: 'org-1', firstName: 'Jane', assignedAgentId: null }
    mockDb.contact.findFirst.mockResolvedValue(existing)
    mockDb.contact.update.mockResolvedValue(updated)

    const { PATCH } = await import('../../app/api/v1/contacts/[id]/route')
    const res = await PATCH(makeRequest('PATCH', { firstName: 'Jane' }), {
      params: Promise.resolve({ id: 'c-1' }),
    })
    expect(res.status).toBe(200)
  })
})

// ─── Contact DELETE ───────────────────────────────────────────────────────────

describe('DELETE /api/v1/contacts/[id]', () => {
  it('soft deletes contact', async () => {
    const existing = { id: 'c-1', orgId: 'org-1' }
    mockDb.contact.findFirst.mockResolvedValue(existing)
    mockDb.contact.update.mockResolvedValue({ ...existing, deletedAt: new Date() })

    const { DELETE } = await import('../../app/api/v1/contacts/[id]/route')
    const res = await DELETE(makeRequest('DELETE'), { params: Promise.resolve({ id: 'c-1' }) })
    expect(res.status).toBe(204)

    const updateArg = mockDb.contact.update.mock.calls[0][0].data
    expect(updateArg.deletedAt).toBeDefined()
  })
})

// ─── Pipeline stages list ─────────────────────────────────────────────────────

describe('GET /api/v1/pipeline', () => {
  it('returns stages for session org', async () => {
    mockDb.pipelineStage.findMany.mockResolvedValue([])

    const { GET } = await import('../../app/api/v1/pipeline/route')
    const res = await GET(makeRequest('GET'))

    expect(res.status).toBe(200)
    const whereArg = mockDb.pipelineStage.findMany.mock.calls[0][0].where
    expect(whereArg.orgId).toBe('org-1')
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const { GET } = await import('../../app/api/v1/pipeline/route')
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })
})

// ─── Pipeline stage create ────────────────────────────────────────────────────

describe('POST /api/v1/pipeline', () => {
  it('requires MANAGER role', async () => {
    mockAuth.mockResolvedValueOnce(makeSession('org-1', 'VIEWER'))
    const { POST } = await import('../../app/api/v1/pipeline/route')
    const res = await POST(makeRequest('POST', { name: 'Test', position: 0 }))
    expect(res.status).toBe(403)
  })

  it('creates stage for MANAGER+', async () => {
    mockAuth.mockResolvedValueOnce(makeSession('org-1', 'MANAGER'))
    const stage = { id: 's-1', orgId: 'org-1', name: 'New Stage', position: 0 }
    mockDb.pipelineStage.create.mockResolvedValue(stage)

    const { POST } = await import('../../app/api/v1/pipeline/route')
    const res = await POST(makeRequest('POST', { name: 'New Stage', position: 0 }))
    expect(res.status).toBe(201)

    const createArg = mockDb.pipelineStage.create.mock.calls[0][0].data
    expect(createArg.orgId).toBe('org-1')
  })
})

// ─── Contact PATCH — reassignment branch ─────────────────────────────────────

describe('PATCH /api/v1/contacts/[id] — reassignment', () => {
  it('sends FCM push when assignedAgentId changes', async () => {
    const newAgentId = 'clnewagentxxxxxxxxxxxxxxxxx'
    const existing = { id: 'c-1', orgId: 'org-1', assignedAgentId: 'cloldagentxxxxxxxxxxxxxxxxx' }
    const updated = {
      id: 'c-1',
      orgId: 'org-1',
      firstName: 'Jane',
      lastName: 'Smith',
      assignedAgentId: newAgentId,
    }
    mockDb.contact.findFirst.mockResolvedValue(existing)
    mockDb.contact.update.mockResolvedValue(updated)

    const { PATCH } = await import('../../app/api/v1/contacts/[id]/route')
    const res = await PATCH(
      makeRequest('PATCH', { firstName: 'Jane', assignedAgentId: newAgentId }),
      { params: Promise.resolve({ id: 'c-1' }) }
    )

    expect(res.status).toBe(200)
    const { sendPushToAgent } = await import('../fcm')
    expect(sendPushToAgent as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      newAgentId,
      expect.objectContaining({ title: 'New Contact Assigned' })
    )
  })
})

// ─── Leads list ───────────────────────────────────────────────────────────────

describe('GET /api/v1/leads', () => {
  it('filters leads by session org', async () => {
    mockDb.lead.findMany.mockResolvedValue([])
    mockDb.lead.count.mockResolvedValue(0)

    const { GET } = await import('../../app/api/v1/leads/route')
    const res = await GET(makeRequest('GET'))

    expect(res.status).toBe(200)
    const whereArg = mockDb.lead.findMany.mock.calls[0][0].where
    expect(whereArg.contact.orgId).toBe('org-1')
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const { GET } = await import('../../app/api/v1/leads/route')
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })
})

// ─── Pipeline POST validation failure ────────────────────────────────────────

describe('POST /api/v1/pipeline — validation', () => {
  it('returns 400 for missing name', async () => {
    mockAuth.mockResolvedValueOnce(makeSession('org-1', 'MANAGER'))
    const { POST } = await import('../../app/api/v1/pipeline/route')
    const res = await POST(makeRequest('POST', { position: 0 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative position', async () => {
    mockAuth.mockResolvedValueOnce(makeSession('org-1', 'MANAGER'))
    const { POST } = await import('../../app/api/v1/pipeline/route')
    const res = await POST(makeRequest('POST', { name: 'Test', position: -1 }))
    expect(res.status).toBe(400)
  })
})
