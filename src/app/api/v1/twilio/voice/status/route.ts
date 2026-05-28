import { db } from '@/lib/db'
import { validateTwilioSignature } from '@/lib/twilio'

// Twilio calls this when a call's status changes (initiated, ringing, in-progress, completed, etc.)
export async function POST(req: Request) {
  const url = `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/v1/twilio/voice/status`
  const signature = req.headers.get('X-Twilio-Signature') ?? ''

  const body = await req.formData()
  const params: Record<string, string> = {}
  body.forEach((v, k) => {
    params[k] = String(v)
  })

  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(url, params, signature)) {
    return new Response('Forbidden', { status: 403 })
  }

  const status = params['CallStatus']
  if (status !== 'completed') return new Response('OK')

  const callSid = params['CallSid'] ?? ''
  const durationSeconds = Number(params['CallDuration'] ?? 0)
  const direction = params['Direction'] === 'inbound' ? 'INBOUND' : 'OUTBOUND'
  const recordingUrl = params['RecordingUrl'] ?? null
  const to = params['To'] ?? ''
  const from = params['From'] ?? ''

  // Find the lead's contact by phone number (try both To and From depending on direction)
  const phoneToSearch = direction === 'OUTBOUND' ? to : from
  const contact = await db.contact.findFirst({
    where: { phoneE164: phoneToSearch, deletedAt: null },
    include: {
      leads: {
        where: { deletedAt: null },
        orderBy: { lastActivityAt: 'desc' },
        take: 1,
        select: { id: true },
      },
      assignedAgent: { select: { id: true } },
    },
  })

  if (!contact || !contact.assignedAgent) {
    return new Response('OK')
  }

  const leadId = contact.leads[0]?.id ?? null
  const agentId = contact.assignedAgent.id

  await db.activity.create({
    data: {
      orgId: contact.orgId,
      leadId,
      agentId,
      type: 'CALL',
      twilioCallSid: callSid,
      callDurationSeconds: durationSeconds,
      callDirection: direction,
      callRecordingUrl: recordingUrl,
      completedAt: new Date(),
    },
  })

  if (leadId) {
    await db.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } })
  }

  return new Response('OK')
}
