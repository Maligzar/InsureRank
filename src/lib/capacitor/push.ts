'use client'

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

/**
 * Call once after the user is authenticated.
 * On iOS/Android: requests permission + registers with APNs/FCM.
 * On web: no-op (the browser FCM path handles this separately).
 */
export async function registerNativePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return

  await PushNotifications.register()

  PushNotifications.addListener('registration', async (token) => {
    try {
      await fetch('/api/v1/agents/me/fcm-token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value }),
      })
    } catch {
      // Non-fatal
    }
  })

  PushNotifications.addListener('pushNotificationReceived', (_notification) => {
    // App is in the foreground; the in-app notification banner is handled by
    // the UI layer — no action needed here.
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data as Record<string, string> | undefined
    if (!data) return

    // Navigate to the relevant entity when the user taps the notification
    if (data.leadId) {
      window.location.href = `/leads/${data.leadId}`
    } else if (data.contactId) {
      window.location.href = `/contacts/${data.contactId}`
    }
  })
}
