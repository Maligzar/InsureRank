'use client'

import { Capacitor } from '@capacitor/core'

const KEYCHAIN_KEY = 'insurerank.biometric.sessionToken'
const LAST_ACTIVE_KEY = 'insurerank.lastActive'
const GRACE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Thin wrapper around the iOS Keychain + LocalAuthentication.
 * Uses the Capacitor Preferences API as a cross-platform fallback for web.
 *
 * On iOS the @capacitor-community/biometric-auth plugin should be installed
 * and registered. These functions degrade gracefully when running in a browser.
 */

type BiometricPlugin = { authenticate: (opts: { reason: string }) => Promise<void> }

let _biometricPlugin: BiometricPlugin | null | undefined

async function getPlugin(): Promise<BiometricPlugin | null> {
  if (!Capacitor.isNativePlatform()) return null
  if (_biometricPlugin !== undefined) return _biometricPlugin
  try {
    const mod = await import('@capacitor-community/biometric-auth' as string)
    _biometricPlugin = (mod as { BiometricAuth: BiometricPlugin }).BiometricAuth ?? null
  } catch {
    _biometricPlugin = null
  }
  return _biometricPlugin
}

export async function isBiometricAvailable(): Promise<boolean> {
  const plugin = await getPlugin()
  if (!plugin) return false
  try {
    await plugin.authenticate({ reason: 'Verify identity' })
    return true
  } catch {
    return false
  }
}

export async function saveSessionForBiometric(sessionToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { Preferences } = await import('@capacitor/preferences')
  await Preferences.set({ key: KEYCHAIN_KEY, value: sessionToken })
  await Preferences.set({ key: LAST_ACTIVE_KEY, value: Date.now().toString() })
}

export async function loadSessionViaBiometric(): Promise<string | null> {
  const plugin = await getPlugin()
  if (!plugin) return null

  const { Preferences } = await import('@capacitor/preferences')
  const { value: lastActiveStr } = await Preferences.get({ key: LAST_ACTIVE_KEY })
  if (lastActiveStr && Date.now() - Number(lastActiveStr) < GRACE_MS) {
    const { value } = await Preferences.get({ key: KEYCHAIN_KEY })
    return value
  }

  try {
    await plugin.authenticate({ reason: 'Sign in to InsureRank' })
    await Preferences.set({ key: LAST_ACTIVE_KEY, value: Date.now().toString() })
    const { value } = await Preferences.get({ key: KEYCHAIN_KEY })
    return value
  } catch {
    return null
  }
}

export async function clearBiometricSession(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { Preferences } = await import('@capacitor/preferences')
  await Preferences.remove({ key: KEYCHAIN_KEY })
  await Preferences.remove({ key: LAST_ACTIVE_KEY })
}
