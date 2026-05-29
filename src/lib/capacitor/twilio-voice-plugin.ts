/**
 * Twilio Voice Capacitor plugin bridge.
 *
 * On iOS this calls into the native Swift TwilioVoicePlugin (to be built in
 * Xcode). On Android / browser it is a no-op and the existing WebRTC
 * Twilio.Device path continues to work.
 *
 * The Swift plugin must be registered in AppDelegate.swift:
 *   bridge.autoRegisterPlugins()
 */

import type { PluginListenerHandle } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'

export type TwilioCallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'error' | 'incoming'

export interface TwilioVoicePlugin {
  makeCall(options: { to: string; accessToken: string }): Promise<void>
  hangUp(): Promise<void>
  mute(options: { muted: boolean }): Promise<void>
  addListener(
    event: 'callConnected',
    handler: (data: { callSid: string }) => void
  ): Promise<PluginListenerHandle>
  addListener(
    event: 'callDisconnected',
    handler: (data: { callSid: string }) => void
  ): Promise<PluginListenerHandle>
  addListener(
    event: 'callFailed',
    handler: (data: { error: string }) => void
  ): Promise<PluginListenerHandle>
  addListener(
    event: 'incomingCall',
    handler: (data: { callSid: string; from: string }) => void
  ): Promise<PluginListenerHandle>
}

// Registers the plugin name — the Swift class TwilioVoicePlugin provides the implementation.
export const TwilioVoice = registerPlugin<TwilioVoicePlugin>('TwilioVoice')
