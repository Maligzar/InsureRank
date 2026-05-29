import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { contactSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { sendPushToAgent } from '@/lib/fcm'
import { Prisma } from '@prisma/client'

type Ctx = { params: Promise<{ id: string }> }

async function getContact(orgId: string, id: string) {
  const contact = await db.contact.findFirst({
    where: { id, orgId, deletedAt: null },
  })
  return contact
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params
    const contact = await db.contact.findFirst({
      where: { id, orgId: session.user.orgId, deletedAt: null },
      include: {
        assignedAgent: { include: { user: { select: { name: true, avatar: true } } } },
        leads: {
          where: { deletedAt: null },
          include: { pipelineStage: true },
          orderBy: { createdAt: 'desc' },
        },
        policies: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(contact)
  } catch (err: unknown) {
    return handleError(err)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params
    const existing = await getContact(session.user.orgId, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parsed = contactSchema.partial().safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { convertToLead: _c, dob, address, ...rest } = parsed.data

    const prevAgentId = existing.assignedAgentId
    const contact = await db.contact.update({
      where: { id },
      data: {
        ...rest,
        dob: dob ? new Date(dob) : undefined,
        address: address as Prisma.InputJsonValue | undefined,
      },
    })

    const newAgentId = contact.assignedAgentId
    const isReassignment = rest.assignedAgentId !== undefined && newAgentId !== prevAgentId
    createAuditLog(
      session.user.orgId,
      session.user.id,
      isReassignment ? 'CONTACT_ASSIGNED' : 'CONTACT_UPDATED',
      'contact',
      id,
      isReassignment ? { from: prevAgentId, to: newAgentId } : undefined
    ).catch(() => {})

    if (isReassignment && newAgentId) {
      sendPushToAgent(newAgentId, {
        title: 'New Contact Assigned',
        body: `${contact.firstName} ${contact.lastName} has been assigned to you.`,
        data: { type: 'CONTACT_ASSIGNED', contactId: id },
      }).catch(() => {})
    }

    return NextResponse.json(contact)
  } catch (err: unknown) {
    return handleError(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await requireSession()
    const { id } = await params
    const existing = await getContact(session.user.orgId, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.contact.update({ where: { id }, data: { deletedAt: new Date() } })
    createAuditLog(session.user.orgId, session.user.id, 'CONTACT_DELETED', 'contact', id).catch(
      () => {}
    )
    return new NextResponse(null, { status: 204 })
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
