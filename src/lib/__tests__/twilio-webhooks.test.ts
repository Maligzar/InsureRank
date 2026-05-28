import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../twilio', () => ({
  validateTwilioSignature: vi.fn().mockReturnValue(true),
  twimlResponse: (xml: string) =>
    new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
      headers: { 'Content-Type': 'text/xml' },
    }),
}))

vi.mock('../db', () => ({
  db: {
    contact: { findFirst: vi.fn() },
    activity: { create: vi.fn() },
    lead: { update: vi.fn() },
  },
}))

vi.mock('../queue', () => ({
  enqueueLeadRank: vi.fn(),
}))

import { db } from '../db'
import { POST as outboundPOST } from '../../app/api/v1/twilio/voice/outbound/route'
import { POST as statusPOST } from '../../app/api/v1/twilio/voice/status/route'

const mockDb = db as unknown as {
  contact: { findFirst: ReturnType<typeof vi.fn> }
  activity: { create: ReturnType<typeof vi.fn> }
  lead: { update: ReturnType<typeof vi.fn> }
}

function makeFormRequest(params: Record<string, string>, url = 'http://localhost/') {
  const form = new URLSearchParams(params)
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
}

beforeEach(() => vi.clearAllMocks())

// ─── Outbound TwiML ───────────────────────────────────────────────────────────

describe('voice/outbound', () => {
  it('generates Dial TwiML for valid E.164 number', async () => {
    process.env.TWILIO_PHONE_NUMBER = '+15550000000'
    process.env.TWILIO_WEBHOOK_BASE_URL = 'https://example.com'

    const req = makeFormRequest({ To: '+15551234567' })
    const res = await outboundPOST(req)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/xml')
    expect(text).toContain('<Dial')
    expect(text).toContain('+15551234567')
  })

  it('generates Client dial for client: identity', async () => {
    const req = makeFormRequest({ To: 'client:agent-123' })
    const res = await outboundPOST(req)
    const text = await res.text()

    expect(text).toContain('<Client>agent-123</Client>')
  })

  it('returns error TwiML for invalid destination', async () => {
    const req = makeFormRequest({ To: 'not-a-number' })
    const res = await outboundPOST(req)
    const text = await res.text()

    expect(text).toContain('<Say>Invalid destination.</Say>')
  })

  it('rejects missing To param', async () => {
    const req = makeFormRequest({ From: '+15550000000' })
    const res = await outboundPOST(req)
    const text = await res.text()

    expect(text).toContain('<Say>Invalid destination.</Say>')
  })
})

// ─── Call status webhook ──────────────────────────────────────────────────────

describe('voice/status', () => {
  it('returns OK immediately for non-completed status', async () => {
    const req = makeFormRequest({ CallStatus: 'ringing', CallSid: 'CA123' })
    const res = await statusPOST(req)

    expect(res.status).toBe(200)
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('creates CALL Activity when status is completed', async () => {
    mockDb.contact.findFirst.mockResolvedValueOnce({
      orgId: 'org-1',
      assignedAgent: { id: 'agent-1' },
      leads: [{ id: 'lead-1' }],
    })
    mockDb.activity.create.mockResolvedValueOnce({})
    mockDb.lead.update.mockResolvedValueOnce({})

    const req = makeFormRequest({
      CallStatus: 'completed',
      CallSid: 'CA999',
      CallDuration: '120',
      Direction: 'outbound-api',
      To: '+15551234567',
      From: '+15550000000',
    })

    const res = await statusPOST(req)
    expect(res.status).toBe(200)
    expect(mockDb.activity.create).toHaveBeenCalledOnce()

    const callArgs = mockDb.activity.create.mock.calls[0][0]
    expect(callArgs.data.type).toBe('CALL')
    expect(callArgs.data.twilioCallSid).toBe('CA999')
    expect(callArgs.data.callDurationSeconds).toBe(120)
    expect(callArgs.data.callDirection).toBe('OUTBOUND')
  })

  it('returns OK without creating activity when contact not found', async () => {
    mockDb.contact.findFirst.mockResolvedValueOnce(null)

    const req = makeFormRequest({
      CallStatus: 'completed',
      CallSid: 'CA000',
      To: '+19990000000',
      From: '+15550000000',
    })

    const res = await statusPOST(req)
    expect(res.status).toBe(200)
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('handles inbound call direction — searches by From number', async () => {
    mockDb.contact.findFirst.mockResolvedValueOnce({
      orgId: 'org-1',
      assignedAgent: { id: 'agent-1' },
      leads: [],
    })
    mockDb.activity.create.mockResolvedValueOnce({})

    const req = makeFormRequest({
      CallStatus: 'completed',
      CallSid: 'CA456',
      Direction: 'inbound',
      From: '+15559876543',
      To: '+15550000000',
    })

    await statusPOST(req)

    const whereArg = mockDb.contact.findFirst.mock.calls[0][0].where
    expect(whereArg.phoneE164).toBe('+15559876543')

    const activityData = mockDb.activity.create.mock.calls[0][0].data
    expect(activityData.callDirection).toBe('INBOUND')
  })
})
