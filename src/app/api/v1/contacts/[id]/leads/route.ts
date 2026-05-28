import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { leadSchema } from '@/lib/validations'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params

    const contact = await db.contact.findFirst({
      where: { id, orgId: session.user.orgId, deletedAt: null },
    })
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const leads = await db.lead.findMany({
      where: { contactId: id, deletedAt: null },
      include: { pipelineStage: true, _count: { select: { activities: true, quotes: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(leads)
  } catch (err: unknown) {
    return handleError(err)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params

    const contact = await db.contact.findFirst({
      where: { id, orgId: session.user.orgId, deletedAt: null },
    })
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parsed = leadSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { contactId: _, ...data } = parsed.data

    const stage = await db.pipelineStage.findFirst({
      where: { id: data.pipelineStageId, orgId: session.user.orgId },
    })
    if (!stage) return NextResponse.json({ error: 'Pipeline stage not found' }, { status: 404 })

    const lead = await db.lead.create({
      data: {
        contactId: id,
        pipelineStageId: data.pipelineStageId,
        lineOfBusiness: data.lineOfBusiness,
        temperature: data.temperature ?? 'WARM',
        expectedRevenue: data.expectedRevenue,
        closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
      },
      include: { pipelineStage: true },
    })

    return NextResponse.json(lead, { status: 201 })
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
