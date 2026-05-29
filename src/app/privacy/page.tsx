import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | InsureRank',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-700">
      <h1 className="mb-4 text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mb-8 text-sm text-slate-500">Last updated: January 2025</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">What We Collect</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm">
          <li>
            <strong>Account information</strong> — name, work email, organization name,
            bcrypt-hashed password.
          </li>
          <li>
            <strong>Contact &amp; lead data</strong> — names, phone numbers, email addresses,
            insurance policy details entered by your team.
          </li>
          <li>
            <strong>Usage analytics</strong> — pages visited, features used, error logs (via
            Sentry).
          </li>
          <li>
            <strong>Device tokens</strong> — FCM (Android/web) and APNs (iOS) tokens for push
            notifications. Tokens are deleted when you log out.
          </li>
          <li>
            <strong>Call metadata</strong> — duration, direction, and optional recording URL when
            call recording is enabled by your organization (recordings are stored by Twilio).
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">How We Use It</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm">
          <li>Deliver and improve the InsureRank service.</li>
          <li>Send push notifications for lead assignments, inbound calls, and task reminders.</li>
          <li>Maintain audit logs for your organization&apos;s compliance needs.</li>
          <li>We do not sell or share personal data with third parties for advertising.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Third-Party Services</h2>
        <p className="mb-2 text-sm">
          InsureRank uses the following sub-processors, each with their own privacy policies:
        </p>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          <li>
            <strong>Twilio</strong> — voice calls and SMS
          </li>
          <li>
            <strong>Google Firebase</strong> — push notifications
          </li>
          <li>
            <strong>Google Cloud</strong> — infrastructure and storage
          </li>
          <li>
            <strong>Sentry</strong> — error monitoring
          </li>
          <li>
            <strong>Resend</strong> — transactional email
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Data Retention</h2>
        <p className="text-sm">
          Your data is retained while your organization&apos;s account is active. Upon cancellation,
          all data is purged within 90 days unless a longer retention period is required by law.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Your Rights</h2>
        <p className="text-sm">
          You have the right to access, correct, or delete your personal data. Contact us at{' '}
          <a href="mailto:privacy@insurerank.com" className="text-indigo-600 underline">
            privacy@insurerank.com
          </a>{' '}
          to exercise these rights.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Contact</h2>
        <p className="text-sm">
          InsureRank &mdash;{' '}
          <a href="mailto:privacy@insurerank.com" className="text-indigo-600 underline">
            privacy@insurerank.com
          </a>
        </p>
      </section>
    </main>
  )
}
