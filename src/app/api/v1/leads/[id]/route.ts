import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { leadUpdateSchema } from '@/lib/validations'
import { enqueueLeadRank } from '@/lib/queue'

type Ctx = { params: Promise<{ id: string }> }

async function getLead(orgId: string, id: string) {
  return db.lead.findFirst({
    where: { id, deletedAt: null, contact: { orgId, deletedAt: null } },
  })
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params

    const lead = await db.lead.findFirst({
      where: { id, deletedAt: null, contact: { orgId: session.user.orgId, deletedAt: null } },
      include: {
        contact: true,
        pipelineStage: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        quotes: { orderBy: { createdAt: 'desc' }, include: { carrier: true } },
        rankSnapshots: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })

    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(lead)
  } catch (err: unknown) {
    return handleError(err)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params
    const existing = await getLead(session.user.orgId, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parsed = leadUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { closeDate, ...rest } = parsed.data
    const lead = await db.lead.update({
      where: { id },
      data: {
        ...rest,
        closeDate: closeDate ? new Date(closeDate) : undefined,
      },
      include: { pipelineStage: true },
    })

    enqueueLeadRank(id).catch(console.error)
    return NextResponse.json(lead)
  } catch (err: unknown) {
    return handleError(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params
    const existing = await getLead(session.user.orgId, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.lead.update({ where: { id }, data: { deletedAt: new Date() } })
    return new NextResponse(null, { status: 204 })
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
