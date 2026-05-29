import { db } from '@/lib/db'

export interface AgentRankComponents {
  conversionRate: number
  activityVolume: number
  revenueClosed: number
  responseTime: number
  activeLeads: number
}

function conversionScore(won: number, closed: number): number {
  if (closed === 0) return 50
  return Math.min(100, (won / closed) * 100)
}

function revenueClosedScore(revenue: number): number {
  if (revenue <= 0) return 0
  // log-scale: $1k → ~25, $10k → ~50, $100k → ~75, $1M → ~100
  return Math.min(100, (Math.log10(revenue + 1) / Math.log10(1_000_001)) * 100)
}

function responseTimeScore(avgHours: number | null): number {
  if (avgHours === null) return 50
  // 0h → 100, 4h → ~92, 24h → ~50, 48h → 0
  return Math.max(0, 100 - avgHours * (100 / 48))
}

function activeLeadsScore(count: number): number {
  return Math.min(100, count * 5)
}

export async function computeAgentRank(
  agentId: string
): Promise<{ score: number; components: AgentRankComponents }> {
  const cutoff30d = new Date(Date.now() - 30 * 86_400_000)
  const cutoff90d = new Date(Date.now() - 90 * 86_400_000)

  const [closedLeads, activitiesLast30, activeLeads] = await Promise.all([
    db.lead.findMany({
      where: {
        contact: { assignedAgentId: agentId },
        deletedAt: null,
        pipelineStage: { isClosed: true },
        updatedAt: { gte: cutoff90d },
      },
      include: { pipelineStage: { select: { isWon: true } } },
    }),
    db.activity.count({
      where: { agentId, createdAt: { gte: cutoff30d } },
    }),
    db.lead.count({
      where: {
        contact: { assignedAgentId: agentId },
        deletedAt: null,
        temperature: { in: ['HOT', 'WARM'] },
        pipelineStage: { isClosed: false },
      },
    }),
  ])

  const wonLeads = closedLeads.filter((l) => l.pipelineStage.isWon)
  const revenueClosed = wonLeads.reduce((s, l) => s + (l.expectedRevenue ?? 0), 0)

  const components: AgentRankComponents = {
    conversionRate: conversionScore(wonLeads.length, closedLeads.length),
    activityVolume: Math.min(100, activitiesLast30 * 2),
    revenueClosed: revenueClosedScore(revenueClosed),
    responseTime: responseTimeScore(null),
    activeLeads: activeLeadsScore(activeLeads),
  }

  const score =
    components.conversionRate * 0.3 +
    components.activityVolume * 0.2 +
    components.revenueClosed * 0.25 +
    components.responseTime * 0.15 +
    components.activeLeads * 0.1

  return { score: Math.round(score * 10) / 10, components }
}
