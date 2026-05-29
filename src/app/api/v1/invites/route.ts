import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/api-auth'
import { createAuditLog } from '@/lib/audit'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const resend = new Resend(process.env.RESEND_API_KEY)

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['MANAGER', 'AGENT', 'VIEWER']).default('AGENT'),
})

export async function POST(req: Request) {
  try {
    const session = await requireRole('MANAGER')
    const parsed = inviteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { email, role } = parsed.data
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invite = await db.invite.create({
      data: {
        orgId: session.user.orgId,
        email,
        role,
        token,
        expiresAt,
        invitedById: session.user.id,
      },
    })

    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/signup?invite=${token}`
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: "You've been invited to InsureRank",
      html: `<p>You've been invited to join InsureRank. <a href="${acceptUrl}">Accept your invitation</a> (expires in 7 days).</p>`,
    })

    createAuditLog(session.user.orgId, session.user.id, 'INVITE_SENT', 'invite', invite.id, {
      email,
      role,
    }).catch(() => {})

    return NextResponse.json({ id: invite.id }, { status: 201 })
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
