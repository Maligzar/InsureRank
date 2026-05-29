import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiAuthError, scopeToOrg } from '../api-auth'

// Mock the auth module so requireSession/requireRole don't need a real DB
vi.mock('../auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '../auth'
import { requireSession, requireRole } from '../api-auth'

const mockAuth = auth as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

// ─── ApiAuthError ─────────────────────────────────────────────────────────────

describe('ApiAuthError', () => {
  it('stores status and message', () => {
    const err = new ApiAuthError(403, 'Forbidden')
    expect(err.status).toBe(403)
    expect(err.message).toBe('Forbidden')
    expect(err).toBeInstanceOf(Error)
  })

  it('is instanceof Error', () => {
    expect(new ApiAuthError(401, 'x')).toBeInstanceOf(Error)
  })
})

// ─── scopeToOrg ───────────────────────────────────────────────────────────────

describe('scopeToOrg', () => {
  it('throws when orgIds do not match', () => {
    expect(() => scopeToOrg('org-a', 'org-b')).toThrow(ApiAuthError)
    expect(() => scopeToOrg('org-a', 'org-b')).toThrow('Forbidden')
  })

  it('does not throw when orgIds match', () => {
    expect(() => scopeToOrg('org-a', 'org-a')).not.toThrow()
  })
})

// ─── requireSession ───────────────────────────────────────────────────────────

describe('requireSession', () => {
  it('throws 401 when no session', async () => {
    mockAuth.mockResolvedValueOnce(null)
    await expect(requireSession()).rejects.toThrow(ApiAuthError)
    await expect(requireSession()).rejects.toMatchObject({ status: 401 })
  })

  it('returns session when authenticated', async () => {
    const session = { user: { id: 'u1', orgId: 'o1', role: 'AGENT', agentId: 'a1' } }
    mockAuth.mockResolvedValueOnce(session)
    const result = await requireSession()
    expect(result).toEqual(session)
  })
})

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole', () => {
  it('allows a role at or above the minimum', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', orgId: 'o1', role: 'ORG_ADMIN', agentId: null },
    })
    await expect(requireRole('MANAGER')).resolves.toBeDefined()
  })

  it('throws 403 when role is below minimum', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', orgId: 'o1', role: 'VIEWER', agentId: null } })
    await expect(requireRole('MANAGER')).rejects.toMatchObject({ status: 403 })
  })

  it('allows exact role match', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', orgId: 'o1', role: 'AGENT', agentId: 'a1' } })
    await expect(requireRole('AGENT')).resolves.toBeDefined()
  })

  it('SUPER_ADMIN passes any role check', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', orgId: 'o1', role: 'SUPER_ADMIN', agentId: null },
    })
    await expect(requireRole('ORG_ADMIN')).resolves.toBeDefined()
  })
})
