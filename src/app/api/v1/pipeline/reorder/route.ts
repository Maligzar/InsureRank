import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/api-auth'
import { pipelineReorderSchema } from '@/lib/validations'

export async function PATCH(req: Request) {
  try {
    const session = await requireRole('MANAGER')
    const parsed = pipelineReorderSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { stages } = parsed.data

    // Verify all stages belong to this org before updating
    const existing = await db.pipelineStage.findMany({
      where: { orgId: session.user.orgId, id: { in: stages.map((s) => s.id) } },
      select: { id: true },
    })
    if (existing.length !== stages.length) {
      return NextResponse.json({ error: 'One or more stages not found' }, { status: 404 })
    }

    await db.$transaction(
      stages.map((s) =>
        db.pipelineStage.update({ where: { id: s.id }, data: { position: s.position } })
      )
    )

    const updated = await db.pipelineStage.findMany({
      where: { orgId: session.user.orgId },
      orderBy: { position: 'asc' },
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
