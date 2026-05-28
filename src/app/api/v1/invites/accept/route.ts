import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hash } from 'bcrypt'
import { z } from 'zod'

const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
})

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    }

    const { token, name, password } = parsed.data

    const invite = await db.invite.findUnique({ where: { token } })
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 })
    }

    const existing = await db.user.findUnique({
      where: { orgId_email: { orgId: invite.orgId, email: invite.email } },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'User already exists in this organization' },
        { status: 409 }
      )
    }

    const passwordHash = await hash(password, 12)

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { orgId: invite.orgId, email: invite.email, passwordHash, name },
      })

      const agent = await tx.agent.create({
        data: { orgId: invite.orgId, userId: user.id, role: invite.role },
      })

      await tx.invite.update({
        where: { token },
        data: { acceptedAt: new Date() },
      })

      return { user, agent }
    })

    return NextResponse.json({ userId: result.user.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
