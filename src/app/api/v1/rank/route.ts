import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/api-auth'
import { leadRankQueue, agentRankQueue } from '@/lib/queue'

// POST /api/v1/rank — enqueue a full re-rank for the calling org (MANAGER+)
export async function POST(_req: Request) {
  try {
    const session = await requireRole('MANAGER')
    const orgId = session.user.orgId

    const [leads, agents] = await Promise.all([
      db.lead.findMany({
        where: { deletedAt: null, contact: { orgId, deletedAt: null } },
        select: { id: true },
      }),
      db.agent.findMany({
        where: { orgId, status: 'ACTIVE' },
        select: { id: true },
      }),
    ])

    await Promise.all([
      leadRankQueue.addBulk(
        leads.map((l) => ({
          name: 'score' as const,
          data: { leadId: l.id },
          opts: { jobId: `lead-rank:${l.id}`, removeOnComplete: 100 },
        }))
      ),
      agentRankQueue.addBulk(
        agents.map((a) => ({
          name: 'score' as const,
          data: { agentId: a.id },
          opts: { jobId: `agent-rank:${a.id}`, removeOnComplete: 100 },
        }))
      ),
    ])

    return NextResponse.json({ queued: { leads: leads.length, agents: agents.length } })
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
