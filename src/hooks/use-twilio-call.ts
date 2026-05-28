'use client'

import { useState, useCallback, useRef } from 'react'

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'error'

interface UseTwilioCallReturn {
  callState: CallState
  call: (to: string) => Promise<void>
  hangup: () => void
  error: string | null
}

export function useTwilioCall(): UseTwilioCallReturn {
  const [callState, setCallState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  // device and activeCall hold Twilio Device/Call instances at runtime
  // typed as unknown to avoid importing the Twilio SDK at module level
  const deviceRef = useRef<unknown>(null)
  const activeCallRef = useRef<unknown>(null)

  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) return deviceRef.current

    const { token } = await fetch('/api/v1/twilio/token').then((r) => r.json())

    // Dynamically import the Twilio Voice SDK so it only loads in the browser
    const { Device } = await import('@twilio/voice-sdk')
    const device = new Device(token, { logLevel: 1 })

    device.on('error', (err: Error) => {
      setError(err.message)
      setCallState('error')
    })

    await device.register()
    deviceRef.current = device
    return device
  }, [])

  const call = useCallback(
    async (to: string) => {
      try {
        setError(null)
        setCallState('connecting')
        const device = await ensureDevice()
        const conn = await (
          device as { connect: (opts: { params: { To: string } }) => Promise<unknown> }
        ).connect({
          params: { To: to },
        })

        activeCallRef.current = conn
        setCallState('ringing')
        ;(conn as { on: (event: string, cb: () => void) => void }).on('accept', () =>
          setCallState('in-call')
        )
        ;(conn as { on: (event: string, cb: () => void) => void }).on('disconnect', () => {
          setCallState('idle')
          activeCallRef.current = null
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Call failed')
        setCallState('error')
      }
    },
    [ensureDevice]
  )

  const hangup = useCallback(() => {
    if (activeCallRef.current) {
      ;(activeCallRef.current as { disconnect: () => void }).disconnect()
    }
  }, [])

  return { callState, call, hangup, error }
}
