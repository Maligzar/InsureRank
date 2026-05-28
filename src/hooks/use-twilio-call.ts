'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'error' | 'incoming'

interface UseTwilioCallReturn {
  callState: CallState
  call: (to: string) => Promise<void>
  hangup: () => void
  mute: (muted: boolean) => Promise<void>
  error: string | null
  isNative: boolean
}

export function useTwilioCall(): UseTwilioCallReturn {
  const [callState, setCallState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  // Holds Twilio Device/Call instances (web) or native plugin listeners
  const deviceRef = useRef<unknown>(null)
  const activeCallRef = useRef<unknown>(null)
  const listenersRef = useRef<Array<{ remove: () => void }>>([])

  const isNative = Capacitor.isNativePlatform()

  // ─── Native path (iOS via CallKit + Twilio Voice SDK) ────────────────────

  useEffect(() => {
    if (!isNative) return

    let mounted = true
    void (async () => {
      const { TwilioVoice } = await import('@/lib/capacitor/twilio-voice-plugin')

      const h1 = await TwilioVoice.addListener('callConnected', () => {
        if (mounted) setCallState('in-call')
      })
      const h2 = await TwilioVoice.addListener('callDisconnected', () => {
        if (mounted) {
          setCallState('idle')
          activeCallRef.current = null
        }
      })
      const h3 = await TwilioVoice.addListener('callFailed', ({ error: msg }) => {
        if (mounted) {
          setError(msg)
          setCallState('error')
        }
      })
      const h4 = await TwilioVoice.addListener('incomingCall', () => {
        if (mounted) setCallState('incoming')
      })

      listenersRef.current = [h1, h2, h3, h4]
    })()

    return () => {
      mounted = false
      listenersRef.current.forEach((h) => h.remove())
    }
  }, [isNative])

  const nativeCall = useCallback(async (to: string) => {
    try {
      setError(null)
      setCallState('connecting')

      const { token } = await fetch('/api/v1/twilio/token').then((r) => r.json())
      const { TwilioVoice } = await import('@/lib/capacitor/twilio-voice-plugin')
      await TwilioVoice.makeCall({ to, accessToken: token })

      setCallState('ringing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Call failed')
      setCallState('error')
    }
  }, [])

  const nativeHangup = useCallback(() => {
    void import('@/lib/capacitor/twilio-voice-plugin').then(({ TwilioVoice }) =>
      TwilioVoice.hangUp()
    )
  }, [])

  const nativeMute = useCallback(async (muted: boolean) => {
    const { TwilioVoice } = await import('@/lib/capacitor/twilio-voice-plugin')
    await TwilioVoice.mute({ muted })
  }, [])

  // ─── Web path (WebRTC via Twilio Device JS SDK) ───────────────────────────

  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) return deviceRef.current

    const { token } = await fetch('/api/v1/twilio/token').then((r) => r.json())
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

  const webCall = useCallback(
    async (to: string) => {
      try {
        setError(null)
        setCallState('connecting')
        const device = await ensureDevice()
        const conn = await (
          device as { connect: (opts: { params: { To: string } }) => Promise<unknown> }
        ).connect({ params: { To: to } })

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

  const webHangup = useCallback(() => {
    if (activeCallRef.current) {
      ;(activeCallRef.current as { disconnect: () => void }).disconnect()
    }
  }, [])

  if (isNative) {
    return { callState, call: nativeCall, hangup: nativeHangup, mute: nativeMute, error, isNative }
  }

  return {
    callState,
    call: webCall,
    hangup: webHangup,
    mute: async () => {},
    error,
    isNative,
  }
}
