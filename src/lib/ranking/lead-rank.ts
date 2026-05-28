import { db } from '@/lib/db'

export interface LeadRankComponents {
  recency: number
  temperature: number
  stageProbability: number
  revenue: number
  activityVelocity: number
}

const TEMP_SCORES = { HOT: 100, WARM: 60, COLD: 20 }

function recencyScore(lastActivityAt: Date | null): number {
  if (!lastActivityAt) return 10
  const daysSince = (Date.now() - lastActivityAt.getTime()) / 86_400_000
  return Math.max(0, 100 - daysSince * 3)
}

function revenueScore(expectedRevenue: number | null): number {
  if (!expectedRevenue || expectedRevenue <= 0) return 0
  // log-scale: $500 → ~25, $5k → ~50, $50k → ~75, $500k → ~100
  return Math.min(100, (Math.log10(expectedRevenue) / Math.log10(500_000)) * 100)
}

function velocityScore(activitiesLast30: number): number {
  return Math.min(100, activitiesLast30 * 10)
}

export async function computeLeadRank(
  leadId: string
): Promise<{ score: number; components: LeadRankComponents }> {
  const cutoff30d = new Date(Date.now() - 30 * 86_400_000)

  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      pipelineStage: { select: { probability: true } },
      _count: { select: { activities: { where: { createdAt: { gte: cutoff30d } } } } },
    },
  })

  const components: LeadRankComponents = {
    recency: recencyScore(lead.lastActivityAt),
    temperature: TEMP_SCORES[lead.temperature],
    stageProbability: lead.pipelineStage.probability * 100,
    revenue: revenueScore(lead.expectedRevenue),
    activityVelocity: velocityScore(lead._count.activities),
  }

  const score =
    components.recency * 0.2 +
    components.temperature * 0.25 +
    components.stageProbability * 0.2 +
    components.revenue * 0.2 +
    components.activityVelocity * 0.15

  return { score: Math.round(score * 10) / 10, components }
}
