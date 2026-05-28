import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { contactSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)

    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 25)))
    const skip = (page - 1) * limit
    const search = searchParams.get('search')
    const agentId = searchParams.get('agentId')
    const source = searchParams.get('source')

    const where: Prisma.ContactWhereInput = {
      orgId: session.user.orgId,
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    if (agentId) where.assignedAgentId = agentId
    if (source) where.sourceChannel = source as Prisma.EnumSourceChannelFilter['equals']

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedAgent: { include: { user: { select: { name: true, avatar: true } } } },
          _count: { select: { leads: true, policies: true } },
        },
      }),
      db.contact.count({ where }),
    ])

    return NextResponse.json({
      data: contacts,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err: unknown) {
    return handleError(err)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    const parsed = contactSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { convertToLead: _, ...data } = parsed.data

    const contact = await db.contact.create({
      data: {
        orgId: session.user.orgId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dob: data.dob ? new Date(data.dob) : undefined,
        address: data.address as Prisma.InputJsonValue,
        sourceChannel: data.sourceChannel,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        utmContent: data.utmContent,
        utmTerm: data.utmTerm,
        assignedAgentId: data.assignedAgentId,
      },
    })

    return NextResponse.json(contact, { status: 201 })
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
