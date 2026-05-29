import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { z } from 'zod'

const schema = z.object({ token: z.string().min(1) })

export async function PUT(req: Request) {
  try {
    const session = await requireSession()
    if (!session.user.agentId) {
      return NextResponse.json({ error: 'Not an agent' }, { status: 403 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    await db.agent.update({
      where: { id: session.user.agentId },
      data: { fcmToken: parsed.data.token },
    })

    return new NextResponse(null, { status: 204 })
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
