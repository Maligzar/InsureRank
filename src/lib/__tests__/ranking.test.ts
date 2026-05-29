import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    lead: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    activity: {
      count: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { computeLeadRank } from '../ranking/lead-rank'
import { computeAgentRank } from '../ranking/agent-rank'

const mockDb = db as unknown as {
  lead: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
  activity: { count: ReturnType<typeof vi.fn> }
}

beforeEach(() => vi.clearAllMocks())

// ─── Lead rank ────────────────────────────────────────────────────────────────

describe('computeLeadRank', () => {
  function makeLead(
    temp: 'HOT' | 'COLD',
    daysAgo: number,
    probability: number,
    revenue: number,
    activities = 5
  ) {
    return {
      temperature: temp,
      lastActivityAt: daysAgo === 0 ? new Date() : new Date(Date.now() - daysAgo * 86_400_000),
      pipelineStage: { probability },
      expectedRevenue: revenue,
      _count: { activities },
    }
  }

  it('scores a hot, recently-active lead higher than a cold stale lead', async () => {
    mockDb.lead.findUniqueOrThrow
      .mockResolvedValueOnce(makeLead('HOT', 1, 0.8, 5000))
      .mockResolvedValueOnce(makeLead('COLD', 30, 0.1, 100, 0))

    const hot = await computeLeadRank('lead-hot')
    const cold = await computeLeadRank('lead-cold')

    expect(hot.score).toBeGreaterThan(cold.score)
    expect(hot.components.temperature).toBe(100)
    expect(cold.components.temperature).toBe(20)
  })

  it('caps component scores at 100', async () => {
    mockDb.lead.findUniqueOrThrow.mockResolvedValueOnce(makeLead('HOT', 0, 1.0, 500_000, 30))
    const { score, components } = await computeLeadRank('lead-1')
    expect(score).toBeLessThanOrEqual(100)
    expect(components.stageProbability).toBe(100)
    expect(components.activityVelocity).toBe(100)
  })

  it('handles null lastActivityAt and null revenue', async () => {
    mockDb.lead.findUniqueOrThrow.mockResolvedValueOnce({
      temperature: 'WARM',
      lastActivityAt: null,
      pipelineStage: { probability: 0.25 },
      expectedRevenue: null,
      _count: { activities: 0 },
    })
    const { score, components } = await computeLeadRank('lead-2')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(components.revenue).toBe(0)
    expect(components.recency).toBe(10)
  })

  it('returns a score between 0 and 100', async () => {
    mockDb.lead.findUniqueOrThrow.mockResolvedValueOnce(makeLead('HOT', 7, 0.4, 2000, 2))
    const { score } = await computeLeadRank('lead-3')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ─── Agent rank ───────────────────────────────────────────────────────────────

describe('computeAgentRank', () => {
  it('rewards 100% conversion rate', async () => {
    mockDb.lead.findMany.mockResolvedValueOnce([
      { expectedRevenue: 5000, pipelineStage: { isWon: true } },
      { expectedRevenue: 3000, pipelineStage: { isWon: true } },
    ])
    mockDb.activity.count.mockResolvedValueOnce(20)
    mockDb.lead.count.mockResolvedValueOnce(5)

    const { components } = await computeAgentRank('agent-1')
    expect(components.conversionRate).toBe(100)
  })

  it('returns 50 conversion score when no closed leads yet', async () => {
    mockDb.lead.findMany.mockResolvedValueOnce([])
    mockDb.activity.count.mockResolvedValueOnce(0)
    mockDb.lead.count.mockResolvedValueOnce(0)

    const { components } = await computeAgentRank('agent-1')
    expect(components.conversionRate).toBe(50)
  })

  it('score is between 0 and 100', async () => {
    mockDb.lead.findMany.mockResolvedValueOnce([
      { expectedRevenue: 2000, pipelineStage: { isWon: false } },
    ])
    mockDb.activity.count.mockResolvedValueOnce(10)
    mockDb.lead.count.mockResolvedValueOnce(3)

    const { score } = await computeAgentRank('agent-1')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
