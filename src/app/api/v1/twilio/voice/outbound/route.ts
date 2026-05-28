import { twimlResponse, validateTwilioSignature } from '@/lib/twilio'

// Twilio calls this webhook when an outbound call is placed via Twilio.Device.
// Body (form-encoded): To, From, CallSid, Direction, ...
export async function POST(req: Request) {
  const url = `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/v1/twilio/voice/outbound`
  const signature = req.headers.get('X-Twilio-Signature') ?? ''

  const body = await req.formData()
  const params: Record<string, string> = {}
  body.forEach((v, k) => {
    params[k] = String(v)
  })

  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(url, params, signature)) {
    return new Response('Forbidden', { status: 403 })
  }

  const to = params['To'] ?? ''
  const callerId = process.env.TWILIO_PHONE_NUMBER ?? ''

  // Sanitize: only allow E.164 numbers or Twilio client IDs
  const isE164 = /^\+[1-9]\d{7,14}$/.test(to)
  const isClient = to.startsWith('client:')

  if (!isE164 && !isClient) {
    return twimlResponse('<Response><Say>Invalid destination.</Say></Response>')
  }

  const statusCallbackUrl = `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/v1/twilio/voice/status`

  const xml = isClient
    ? `<Response><Dial callerId="${callerId}" record="record-from-answer" recordingStatusCallback="${statusCallbackUrl}"><Client>${to.replace('client:', '')}</Client></Dial></Response>`
    : `<Response><Dial callerId="${callerId}" record="record-from-answer" recordingStatusCallback="${statusCallbackUrl}">${to}</Dial></Response>`

  return twimlResponse(xml)
}
