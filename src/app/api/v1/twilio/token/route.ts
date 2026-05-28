import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { generateVoiceToken } from '@/lib/twilio'

export async function GET(_req: Request) {
  try {
    const session = await requireSession()

    // Use agentId as the Twilio identity so we can map inbound calls back to an agent
    const identity = session.user.agentId ?? session.user.id
    const token = generateVoiceToken(identity)

    return NextResponse.json({ token, identity })
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
