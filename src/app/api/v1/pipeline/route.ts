import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireRole } from '@/lib/api-auth'
import { pipelineStageSchema } from '@/lib/validations'

export async function GET(_req: Request) {
  try {
    const session = await requireSession()
    const stages = await db.pipelineStage.findMany({
      where: { orgId: session.user.orgId },
      orderBy: { position: 'asc' },
      include: { _count: { select: { leads: true } } },
    })
    return NextResponse.json(stages)
  } catch (err: unknown) {
    return handleError(err)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole('MANAGER')
    const parsed = pipelineStageSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const stage = await db.pipelineStage.create({
      data: { orgId: session.user.orgId, ...parsed.data },
    })
    return NextResponse.json(stage, { status: 201 })
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
