import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { Temperature } from '@prisma/client'

const tempVariant: Record<Temperature, 'hot' | 'warm' | 'cold'> = {
  HOT: 'hot',
  WARM: 'warm',
  COLD: 'cold',
}

export default async function PipelinePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.orgId

  const stages = await db.pipelineStage.findMany({
    where: { orgId, isClosed: false },
    orderBy: { position: 'asc' },
    include: {
      leads: {
        where: { deletedAt: null },
        orderBy: { rankScore: 'desc' },
        take: 50,
        include: {
          contact: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="text-xl font-bold text-white mb-5">Pipeline</h1>

      {/* Mobile: vertical stack; Desktop: horizontal scroll */}
      <div className="md:flex md:gap-4 md:overflow-x-auto md:pb-4 space-y-4 md:space-y-0">
        {stages.map((stage) => {
          const stageRevenue = stage.leads.reduce((sum, l) => sum + (l.expectedRevenue ?? 0), 0)

          return (
            <div key={stage.id} className="md:w-72 md:shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-semibold text-slate-300">{stage.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{stage.leads.length}</span>
                  {stageRevenue > 0 && (
                    <span className="text-xs text-slate-500">{formatCurrency(stageRevenue)}</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-2 space-y-2 min-h-16">
                {stage.leads.length === 0 && (
                  <div className="text-center py-4 text-slate-600 text-xs">Empty</div>
                )}
                {stage.leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block bg-slate-800 hover:bg-slate-700 rounded-lg p-3 transition-colors"
                  >
                    <p className="text-sm font-medium text-white">
                      {lead.contact.firstName} {lead.contact.lastName}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={tempVariant[lead.temperature]} className="text-xs">
                        {lead.temperature}
                      </Badge>
                      {lead.expectedRevenue && (
                        <span className="text-xs text-slate-400">
                          {formatCurrency(lead.expectedRevenue)}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 ml-auto">
                        {Math.round(lead.rankScore)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
