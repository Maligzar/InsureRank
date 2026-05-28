import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/api-auth'
import { parseCsvContacts } from '@/lib/csv-import'
import { createAuditLog } from '@/lib/audit'

const MAX_ROWS = 1000
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: Request) {
  try {
    const session = await requireRole('AGENT')

    const contentType = req.headers.get('content-type') ?? ''
    let csvText: string

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
      }
      csvText = await file.text()
    } else {
      const raw = await req.text()
      if (Buffer.byteLength(raw) > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'Body too large (max 5 MB)' }, { status: 413 })
      }
      csvText = raw
    }

    const { rows, errors } = parseCsvContacts(csvText)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found', parseErrors: errors },
        { status: 422 }
      )
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows (max ${MAX_ROWS} per import)` },
        { status: 422 }
      )
    }

    const orgId = session.user.orgId
    const createdIds: string[] = []

    // Insert in chunks to avoid hitting Prisma's prepared statement limits
    const CHUNK = 100
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const contacts = await db.$transaction(
        chunk.map((row) =>
          db.contact.create({
            data: {
              orgId,
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email || null,
              phone: row.phone || null,
              sourceChannel: row.sourceChannel,
            },
            select: { id: true },
          })
        )
      )
      createdIds.push(...contacts.map((c) => c.id))
    }

    createAuditLog(session.user.orgId, session.user.id, 'CONTACT_CREATED', 'contact', 'bulk', {
      count: createdIds.length,
    }).catch(() => {})

    return NextResponse.json(
      { imported: createdIds.length, skipped: errors.length, parseErrors: errors },
      { status: 201 }
    )
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
