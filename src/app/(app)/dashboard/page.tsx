import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Temperature } from '@prisma/client'

const tempVariant: Record<Temperature, 'hot' | 'warm' | 'cold'> = {
  HOT: 'hot',
  WARM: 'warm',
  COLD: 'cold',
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.orgId

  const [leadCount, contactCount, recentLeads, stageBreakdown] = await Promise.all([
    db.lead.count({ where: { deletedAt: null, contact: { orgId } } }),
    db.contact.count({ where: { orgId, deletedAt: null } }),
    db.lead.findMany({
      where: { deletedAt: null, contact: { orgId }, lastActivityAt: { not: null } },
      orderBy: { lastActivityAt: 'desc' },
      take: 8,
      include: {
        contact: { select: { firstName: true, lastName: true } },
        pipelineStage: { select: { name: true } },
      },
    }),
    db.pipelineStage.findMany({
      where: { orgId },
      orderBy: { position: 'asc' },
      include: { _count: { select: { leads: { where: { deletedAt: null } } } } },
    }),
  ])

  const totalRevenue = await db.lead.aggregate({
    where: { deletedAt: null, contact: { orgId } },
    _sum: { expectedRevenue: true },
  })

  return (
    <div className="px-4 py-6 md:px-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Active Leads</p>
          <p className="text-2xl font-bold text-white">{leadCount}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Contacts</p>
          <p className="text-2xl font-bold text-white">{contactCount}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-slate-400 text-xs mb-1">Pipeline Value</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(totalRevenue._sum.expectedRevenue ?? 0)}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pipeline stage summary */}
        <div className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Pipeline Stages</h2>
          <div className="space-y-2">
            {stageBreakdown
              .filter((s) => !s.isClosed)
              .map((stage) => (
                <div key={stage.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 truncate">{stage.name}</span>
                  <span className="text-sm font-semibold text-white ml-2 shrink-0">
                    {stage._count.leads}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Leads</h2>
          <div className="space-y-3">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {lead.contact.firstName} {lead.contact.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{lead.pipelineStage.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={tempVariant[lead.temperature]}>{lead.temperature}</Badge>
                  <span className="text-xs text-slate-500">
                    {formatRelativeTime(lead.lastActivityAt!)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
