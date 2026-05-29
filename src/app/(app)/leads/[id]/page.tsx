import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import type { Temperature, ActivityType } from '@prisma/client'

const tempVariant: Record<Temperature, 'hot' | 'warm' | 'cold'> = {
  HOT: 'hot',
  WARM: 'warm',
  COLD: 'cold',
}

const activityIcon: Record<ActivityType, string> = {
  CALL: '📞',
  SMS: '💬',
  EMAIL: '✉️',
  MEETING: '📅',
  NOTE: '📝',
  TASK: '✅',
}

type Params = { params: Promise<{ id: string }> }

export default async function LeadDetailPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null, contact: { orgId: session.user.orgId } },
    include: {
      contact: true,
      pipelineStage: true,
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { agent: { include: { user: { select: { name: true } } } } },
      },
      quotes: {
        orderBy: { createdAt: 'desc' },
        include: { carrier: { select: { name: true } } },
      },
    },
  })

  if (!lead) notFound()

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/leads" className="text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-white truncate">
            {lead.contact.firstName} {lead.contact.lastName}
          </h1>
          <p className="text-xs text-slate-400">{lead.pipelineStage.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={tempVariant[lead.temperature]}>{lead.temperature}</Badge>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Key details */}
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Line of Business</p>
              <p className="text-sm font-medium text-white mt-0.5">{lead.lineOfBusiness}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Rank Score</p>
              <p className="text-sm font-bold text-indigo-400 mt-0.5">
                {Math.round(lead.rankScore)}
              </p>
            </div>
            {lead.expectedRevenue && (
              <div>
                <p className="text-xs text-slate-500">Expected Revenue</p>
                <p className="text-sm font-medium text-white mt-0.5">
                  {formatCurrency(lead.expectedRevenue)}
                </p>
              </div>
            )}
            {lead.closeDate && (
              <div>
                <p className="text-xs text-slate-500">Close Date</p>
                <p className="text-sm font-medium text-white mt-0.5">
                  {lead.closeDate.toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Contact</h2>
          <div className="space-y-2">
            {lead.contact.email && (
              <a
                href={`mailto:${lead.contact.email}`}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <span className="text-slate-500">✉️</span>
                {lead.contact.email}
              </a>
            )}
            {lead.contact.phone && (
              <a
                href={`tel:${lead.contact.phoneE164 ?? lead.contact.phone}`}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <span className="text-slate-500">📞</span>
                {lead.contact.phone}
              </a>
            )}
          </div>
        </div>

        {/* Quotes */}
        {lead.quotes.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Quotes</h2>
            <div className="space-y-2">
              {lead.quotes.map((q) => (
                <div key={q.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{q.carrier.name}</p>
                    <p className="text-xs text-slate-500">{q.status}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">{formatCurrency(q.premium)}/mo</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity feed */}
        <div className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Activity</h2>
          {lead.activities.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {lead.activities.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <span className="text-base shrink-0 mt-0.5">{activityIcon[a.type]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{a.type}</p>
                      <p className="text-xs text-slate-500 shrink-0">
                        {formatRelativeTime(a.createdAt)}
                      </p>
                    </div>
                    {a.notes && <p className="text-sm text-slate-400 mt-0.5">{a.notes}</p>}
                    <p className="text-xs text-slate-600 mt-0.5">{a.agent.user.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-4 py-3 flex gap-2 z-20">
        <a
          href={`tel:${lead.contact.phoneE164 ?? lead.contact.phone ?? ''}`}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          📞 Call
        </a>
        <a
          href={`sms:${lead.contact.phoneE164 ?? lead.contact.phone ?? ''}`}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          💬 Text
        </a>
        <a
          href={`mailto:${lead.contact.email ?? ''}`}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          ✉️ Email
        </a>
      </div>
    </div>
  )
}
