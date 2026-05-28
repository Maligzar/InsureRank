import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import type { Temperature } from '@prisma/client'

const tempVariant: Record<Temperature, 'hot' | 'warm' | 'cold'> = {
  HOT: 'hot',
  WARM: 'warm',
  COLD: 'cold',
}

type Params = { params: Promise<{ id: string }> }

export default async function ContactDetailPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const contact = await db.contact.findFirst({
    where: { id, orgId: session.user.orgId, deletedAt: null },
    include: {
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { pipelineStage: { select: { name: true } } },
      },
      policies: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { carrier: { select: { name: true } } },
      },
    },
  })

  if (!contact) notFound()

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/contacts" className="text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div>
          <h1 className="font-bold text-white">
            {contact.firstName} {contact.lastName}
          </h1>
          <p className="text-xs text-slate-400">{contact.sourceChannel.replace('_', ' ')}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Contact details */}
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-3">
              <span className="text-slate-500 text-base">✉️</span>
              <span className="text-sm text-slate-300">{contact.email}</span>
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phoneE164 ?? contact.phone}`}
              className="flex items-center gap-3"
            >
              <span className="text-slate-500 text-base">📞</span>
              <span className="text-sm text-slate-300">{contact.phone}</span>
            </a>
          )}
          {contact.dob && (
            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-base">🎂</span>
              <span className="text-sm text-slate-300">{contact.dob.toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Leads */}
        <div className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">
            Leads ({contact.leads.length})
          </h2>
          {contact.leads.length === 0 ? (
            <p className="text-sm text-slate-500">No leads yet</p>
          ) : (
            <div className="space-y-2">
              {contact.leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
                >
                  <div>
                    <p className="text-sm text-white">{lead.pipelineStage.name}</p>
                    <p className="text-xs text-slate-500">{lead.lineOfBusiness}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={tempVariant[lead.temperature]}>{lead.temperature}</Badge>
                    {lead.expectedRevenue && (
                      <span className="text-xs text-slate-400">
                        {formatCurrency(lead.expectedRevenue)}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(lead.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Policies */}
        {contact.policies.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">
              Policies ({contact.policies.length})
            </h2>
            <div className="space-y-2">
              {contact.policies.map((policy) => (
                <div
                  key={policy.id}
                  className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
                >
                  <div>
                    <p className="text-sm text-white">{policy.carrier.name}</p>
                    <p className="text-xs text-slate-500">
                      {policy.lineOfBusiness} · {policy.status}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {formatCurrency(policy.premium)}/mo
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
