/* eslint-disable @typescript-eslint/no-require-imports */
import twilio from 'twilio'

export function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

export function generateVoiceToken(identity: string): string {
  // Use require to sidestep Next.js bundler issues with twilio's CJS/ESM split
  const { AccessToken } = require('twilio').jwt
  const { VoiceGrant } = AccessToken

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY!,
    process.env.TWILIO_API_SECRET!,
    { identity, ttl: 3600 }
  )

  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_APP_SID,
      incomingAllow: true,
    })
  )

  return token.toJwt() as string
}

export function twimlResponse(xml: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN!, signature, url, params)
}
