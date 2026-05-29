import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { getTwilioClient } from '@/lib/twilio'
import { enqueueLeadRank } from '@/lib/queue'
import { z } from 'zod'

const schema = z.object({
  to: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
  body: z.string().min(1).max(1600),
  leadId: z.string().cuid().optional(),
})

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { to, body, leadId } = parsed.data

    const agent = await db.agent.findFirst({ where: { userId: session.user.id } })
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const message = await getTwilioClient().messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body,
    })

    await db.activity.create({
      data: {
        orgId: session.user.orgId,
        leadId: leadId ?? null,
        agentId: agent.id,
        type: 'SMS',
        notes: body,
        twilioSmsSid: message.sid,
        completedAt: new Date(),
      },
    })

    if (leadId) {
      await db.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } })
      enqueueLeadRank(leadId).catch(console.error)
    }

    return NextResponse.json({ sid: message.sid })
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
