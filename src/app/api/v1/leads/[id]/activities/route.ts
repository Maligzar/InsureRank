import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { activitySchema } from '@/lib/validations'
import { enqueueLeadRank } from '@/lib/queue'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))

    const lead = await db.lead.findFirst({
      where: { id, deletedAt: null, contact: { orgId: session.user.orgId, deletedAt: null } },
    })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const activities = await db.activity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { agent: { include: { user: { select: { name: true, avatar: true } } } } },
    })

    return NextResponse.json(activities)
  } catch (err: unknown) {
    return handleError(err)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params

    const lead = await db.lead.findFirst({
      where: { id, deletedAt: null, contact: { orgId: session.user.orgId, deletedAt: null } },
    })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const agent = await db.agent.findFirst({
      where: { userId: session.user.id },
    })
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const parsed = activitySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const activity = await db.activity.create({
      data: {
        orgId: session.user.orgId,
        leadId: id,
        agentId: agent.id,
        type: parsed.data.type,
        notes: parsed.data.notes,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      },
      include: { agent: { include: { user: { select: { name: true, avatar: true } } } } },
    })

    await db.lead.update({ where: { id }, data: { lastActivityAt: new Date() } })
    enqueueLeadRank(id).catch(console.error)

    return NextResponse.json(activity, { status: 201 })
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
