import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import type { Temperature } from '@prisma/client'

const tempVariant: Record<Temperature, 'hot' | 'warm' | 'cold'> = {
  HOT: 'hot',
  WARM: 'warm',
  COLD: 'cold',
}

const lobLabel: Record<string, string> = {
  LIFE: 'Life',
  PNC: 'P&C',
  HEALTH: 'Health',
  OTHER: 'Other',
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))
  const stageId = params.stageId
  const lob = params.lob
  const temperature = params.temperature
  const limit = 25
  const skip = (page - 1) * limit

  const where = {
    deletedAt: null as null,
    contact: { orgId: session.user.orgId, deletedAt: null as null },
    ...(stageId ? { pipelineStageId: stageId } : {}),
    ...(lob ? { lineOfBusiness: lob as 'LIFE' | 'PNC' | 'HEALTH' | 'OTHER' } : {}),
    ...(temperature ? { temperature: temperature as 'HOT' | 'WARM' | 'COLD' } : {}),
  }

  const [leads, total, stages] = await Promise.all([
    db.lead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
        pipelineStage: { select: { name: true } },
      },
    }),
    db.lead.count({ where }),
    db.pipelineStage.findMany({
      where: { orgId: session.user.orgId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const pages = Math.ceil(total / limit)

  return (
    <div className="px-4 py-6 md:px-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Leads</h1>
        <span className="text-sm text-slate-400">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
        {stages.map((s) => (
          <Link
            key={s.id}
            href={`/leads?stageId=${s.id}`}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              stageId === s.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {s.name}
          </Link>
        ))}
        {stageId && (
          <Link
            href="/leads"
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300"
          >
            Clear
          </Link>
        )}
      </div>

      {/* Lead list */}
      <div className="space-y-2">
        {leads.length === 0 && (
          <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-500">
            No leads found
          </div>
        )}
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="block bg-slate-800 hover:bg-slate-750 rounded-xl p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">
                  {lead.contact.firstName} {lead.contact.lastName}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">{lead.pipelineStage.name}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant={tempVariant[lead.temperature]}>{lead.temperature}</Badge>
                  <Badge variant="outline">{lobLabel[lead.lineOfBusiness]}</Badge>
                  {lead.expectedRevenue && (
                    <span className="text-xs text-slate-400">
                      {formatCurrency(lead.expectedRevenue)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500">
                  {lead.lastActivityAt ? formatRelativeTime(lead.lastActivityAt) : '—'}
                </p>
                <p className="text-sm font-bold text-indigo-400 mt-1">
                  {Math.round(lead.rankScore)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/leads?page=${page - 1}${stageId ? `&stageId=${stageId}` : ''}`}
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
              href={`/leads?page=${page + 1}${stageId ? `&stageId=${stageId}` : ''}`}
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
