import { auth } from '@/lib/auth'
import { Role } from '@prisma/client'
import { NextResponse } from 'next/server'

const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 5,
  ORG_ADMIN: 4,
  MANAGER: 3,
  AGENT: 2,
  VIEWER: 1,
}

export async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    throw new ApiAuthError(401, 'Unauthorized')
  }
  return session
}

export async function requireRole(minimumRole: Role) {
  const session = await requireSession()
  const userLevel = ROLE_HIERARCHY[session.user.role]
  const requiredLevel = ROLE_HIERARCHY[minimumRole]
  if (userLevel < requiredLevel) {
    throw new ApiAuthError(403, 'Forbidden')
  }
  return session
}

export function scopeToOrg(orgId: string, sessionOrgId: string) {
  if (orgId !== sessionOrgId) {
    throw new ApiAuthError(403, 'Forbidden')
  }
}

export class ApiAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export function withAuth<T>(
  handler: (req: Request, ctx: T) => Promise<NextResponse>
): (req: Request, ctx: T) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      if (err instanceof ApiAuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      console.error(err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
