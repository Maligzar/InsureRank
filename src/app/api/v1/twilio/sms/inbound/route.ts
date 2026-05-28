import { db } from '@/lib/db'
import { validateTwilioSignature } from '@/lib/twilio'
import { enqueueLeadRank } from '@/lib/queue'

// Twilio calls this webhook when an SMS is received on our Twilio number.
export async function POST(req: Request) {
  const url = `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/v1/twilio/sms/inbound`
  const signature = req.headers.get('X-Twilio-Signature') ?? ''

  const body = await req.formData()
  const params: Record<string, string> = {}
  body.forEach((v, k) => {
    params[k] = String(v)
  })

  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(url, params, signature)) {
    return new Response('Forbidden', { status: 403 })
  }

  const from = params['From'] ?? ''
  const messageBody = params['Body'] ?? ''
  const smsSid = params['SmsSid'] ?? ''

  const contact = await db.contact.findFirst({
    where: { phoneE164: from, deletedAt: null },
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

  if (contact?.assignedAgent) {
    const leadId = contact.leads[0]?.id ?? null

    await db.activity.create({
      data: {
        orgId: contact.orgId,
        leadId,
        agentId: contact.assignedAgent.id,
        type: 'SMS',
        notes: messageBody,
        twilioSmsSid: smsSid,
        callDirection: 'INBOUND',
        completedAt: new Date(),
      },
    })

    if (leadId) {
      await db.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } })
      enqueueLeadRank(leadId).catch(console.error)
    }
  }

  // Return empty TwiML — no auto-reply
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
