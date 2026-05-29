import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)

    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 25)))
    const skip = (page - 1) * limit
    const stageId = searchParams.get('stageId')
    const agentId = searchParams.get('agentId')
    const lob = searchParams.get('lob')
    const temperature = searchParams.get('temperature')
    const sortBy = searchParams.get('sortBy') ?? 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      contact: { orgId: session.user.orgId, deletedAt: null },
    }

    if (stageId) where.pipelineStageId = stageId
    if (agentId) where.contact = { ...(where.contact as object), assignedAgentId: agentId }
    if (lob) where.lineOfBusiness = lob as Prisma.EnumLineOfBusinessFilter['equals']
    if (temperature) where.temperature = temperature as Prisma.EnumTemperatureFilter['equals']

    const orderBy: Prisma.LeadOrderByWithRelationInput =
      sortBy === 'rankScore'
        ? { rankScore: sortOrder }
        : sortBy === 'expectedRevenue'
          ? { expectedRevenue: sortOrder }
          : sortBy === 'lastActivityAt'
            ? { lastActivityAt: sortOrder }
            : { createdAt: sortOrder }

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              assignedAgentId: true,
            },
          },
          pipelineStage: true,
          _count: { select: { activities: true, quotes: true } },
        },
      }),
      db.lead.count({ where }),
    ])

    return NextResponse.json({
      data: leads,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err: unknown) {
    return handleError(err)
  }
}

function handleError(err: unknown): NextResponse {
  if (err instanceof Error && 'status' in err) {
    return NextResponse.json({ error: err.message }, { status: (err as { status: number }).status })
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
