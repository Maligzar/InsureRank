import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

// Build a guaranteed-correct URL using the OS username as fallback
function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  console.log('[db] DATABASE_URL from env:', envUrl)
  if (envUrl) return envUrl
  const user = execSync('whoami').toString().trim()
  const fallback = `postgresql://${user}@127.0.0.1:5432/insurerank`
  console.log('[db] Using fallback URL:', fallback)
  return fallback
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: getDatabaseUrl() } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
