import { Prisma } from '@prisma/client'
import { db } from './db'

export type AuditAction =
  | 'CONTACT_CREATED'
  | 'CONTACT_UPDATED'
  | 'CONTACT_DELETED'
  | 'CONTACT_ASSIGNED'
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'LEAD_STAGE_CHANGED'
  | 'LEAD_DELETED'
  | 'INVITE_SENT'
  | 'INVITE_ACCEPTED'
  | 'PIPELINE_STAGE_CREATED'
  | 'PIPELINE_REORDERED'

export type AuditEntityType = 'contact' | 'lead' | 'invite' | 'pipeline_stage'

export async function createAuditLog(
  orgId: string,
  actorId: string | null,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  diff?: Record<string, unknown> | null
): Promise<void> {
  await db.auditLog
    .create({
      data: {
        orgId,
        actorId,
        action,
        entityType,
        entityId,
        diff: diff ? (diff as unknown as Prisma.InputJsonValue) : undefined,
      },
    })
    .catch(() => {
      // Non-fatal: audit failures must not break the primary operation
    })
}
