import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { leadStageSchema } from '@/lib/validations'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params

    const lead = await db.lead.findFirst({
      where: { id, deletedAt: null, contact: { orgId: session.user.orgId, deletedAt: null } },
    })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parsed = leadStageSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const stage = await db.pipelineStage.findFirst({
      where: { id: parsed.data.pipelineStageId, orgId: session.user.orgId },
    })
    if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

    const updated = await db.lead.update({
      where: { id },
      data: { pipelineStageId: parsed.data.pipelineStageId },
      include: { pipelineStage: true },
    })

    return NextResponse.json(updated)
  } catch (err: unknown) {
    if (err instanceof Error && 'status' in err) {
      return NextResponse.json(
        { error: err.message },
        { status: (err as { status: number }).status }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
