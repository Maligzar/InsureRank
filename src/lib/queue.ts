import { Queue } from 'bullmq'

// BullMQ bundles its own ioredis; use connection options directly to avoid version conflicts
function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  }
}

export const leadRankQueue = new Queue<{ leadId: string }>('lead-rank', {
  connection: redisConnection(),
})
export const agentRankQueue = new Queue<{ agentId: string }>('agent-rank', {
  connection: redisConnection(),
})

export async function enqueueLeadRank(leadId: string) {
  await leadRankQueue.add(
    'score',
    { leadId },
    {
      jobId: `lead-rank:${leadId}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  )
}

export async function enqueueAgentRank(agentId: string) {
  await agentRankQueue.add(
    'score',
    { agentId },
    {
      jobId: `agent-rank:${agentId}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  )
}
