import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))
  const search = params.search
  const limit = 25
  const skip = (page - 1) * limit

  const where = {
    orgId: session.user.orgId,
    deletedAt: null as null,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true } } },
    }),
    db.contact.count({ where }),
  ])

  const pages = Math.ceil(total / limit)

  return (
    <div className="px-4 py-6 md:px-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Contacts</h1>
        <span className="text-sm text-slate-400">{total} total</span>
      </div>

      <div className="space-y-2">
        {contacts.length === 0 && (
          <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-500">
            No contacts found
          </div>
        )}
        {contacts.map((contact) => (
          <Link
            key={contact.id}
            href={`/contacts/${contact.id}`}
            className="block bg-slate-800 hover:bg-slate-750 rounded-xl p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">
                  {contact.firstName} {contact.lastName}
                </p>
                {contact.email && (
                  <p className="text-sm text-slate-400 mt-0.5 truncate">{contact.email}</p>
                )}
                {contact.phone && <p className="text-sm text-slate-500 mt-0.5">{contact.phone}</p>}
              </div>
              <div className="shrink-0 text-right">
                <Badge variant="outline">{contact.sourceChannel.replace('_', ' ')}</Badge>
                {contact._count.leads > 0 && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    {contact._count.leads} lead{contact._count.leads !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/contacts?page=${page - 1}`}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-slate-400 text-sm">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link
              href={`/contacts?page=${page + 1}`}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
