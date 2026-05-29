import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { z } from 'zod'

const registerSchema = z.object({
  orgName: z.string().min(2).max(100),
  orgSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { orgName, orgSlug, name, email, password } = parsed.data

    const slugTaken = await db.organization.findUnique({ where: { slug: orgSlug } })
    if (slugTaken) {
      return NextResponse.json({ error: 'Organization slug is already taken' }, { status: 409 })
    }

    const passwordHash = await hash(password, 12)

    const result = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, slug: orgSlug },
      })

      const user = await tx.user.create({
        data: { orgId: org.id, email, passwordHash, name },
      })

      const agent = await tx.agent.create({
        data: { orgId: org.id, userId: user.id, role: 'ORG_ADMIN' },
      })

      await tx.pipelineStage.createMany({
        data: [
          { orgId: org.id, name: 'New Lead', position: 0, probability: 0.1, isDefault: true },
          { orgId: org.id, name: 'Contacted', position: 1, probability: 0.25 },
          { orgId: org.id, name: 'Quoted', position: 2, probability: 0.6 },
          { orgId: org.id, name: 'Pending Approval', position: 3, probability: 0.8 },
          {
            orgId: org.id,
            name: 'Bound',
            position: 4,
            probability: 1.0,
            isClosed: true,
            isWon: true,
          },
          { orgId: org.id, name: 'Lost', position: 5, probability: 0, isClosed: true },
        ],
      })

      return { org, user, agent }
    })

    return NextResponse.json({ orgId: result.org.id, userId: result.user.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
