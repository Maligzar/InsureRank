import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

// Build a guaranteed-correct URL — skip placeholder URLs from .env.example
function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  if (envUrl && !envUrl.includes('postgres:password')) return envUrl
  const user = execSync('whoami').toString().trim()
  const url = `postgresql://${user}@127.0.0.1:5432/insurerank`
  console.log('[db] Using local URL for user:', user)
  return url
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: getDatabaseUrl() } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
