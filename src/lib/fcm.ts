import * as admin from 'firebase-admin'

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

export async function sendPushNotification(fcmToken: string, payload: PushPayload): Promise<void> {
  const app = getApp()
  await admin.messaging(app).send({
    token: fcmToken,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  })
}

export async function sendPushToAgent(agentId: string, payload: PushPayload): Promise<void> {
  const { db } = await import('./db')
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { fcmToken: true },
  })
  if (!agent?.fcmToken) return
  await sendPushNotification(agent.fcmToken, payload).catch(() => {
    // Non-fatal: device may have rotated token
  })
}
