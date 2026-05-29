/* eslint-disable no-console */
import 'dotenv/config'
import { Worker } from 'bullmq'
import { PrismaClient, Prisma } from '@prisma/client'
import { computeLeadRank } from '../src/lib/ranking/lead-rank'
import { computeAgentRank } from '../src/lib/ranking/agent-rank'

const db = new PrismaClient()

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  }
}

const connection = redisConnection()

const leadWorker = new Worker<{ leadId: string }>(
  'lead-rank',
  async (job) => {
    const { leadId } = job.data
    const { score, components } = await computeLeadRank(leadId)

    await db.$transaction([
      db.lead.update({ where: { id: leadId }, data: { rankScore: score } }),
      db.rankSnapshot.create({
        data: { leadId, score, components: components as unknown as Prisma.InputJsonValue },
      }),
    ])

    console.log(`[lead-rank] leadId=${leadId} score=${score}`)
  },
  { connection, concurrency: 5 }
)

const agentWorker = new Worker<{ agentId: string }>(
  'agent-rank',
  async (job) => {
    const { agentId } = job.data
    const { score, components } = await computeAgentRank(agentId)

    await db.$transaction([
      db.agent.update({ where: { id: agentId }, data: { rankScore: score } }),
      db.rankSnapshot.create({
        data: { agentId, score, components: components as unknown as Prisma.InputJsonValue },
      }),
    ])

    console.log(`[agent-rank] agentId=${agentId} score=${score}`)
  },
  { connection, concurrency: 5 }
)

async function shutdown() {
  console.log('Shutting down rank workers...')
  await Promise.all([leadWorker.close(), agentWorker.close()])
  await db.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

leadWorker.on('failed', (job, err) => {
  console.error(`[lead-rank] failed jobId=${job?.id}`, err)
})

agentWorker.on('failed', (job, err) => {
  console.error(`[agent-rank] failed jobId=${job?.id}`, err)
})

console.log('Rank workers started.')
