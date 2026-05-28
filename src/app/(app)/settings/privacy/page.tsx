export const metadata = {
  title: 'Privacy Policy',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 prose prose-slate">
      <h1>Privacy Policy</h1>
      <p className="lead">Last updated: {new Date().getFullYear()}</p>

      <p>
        InsureRank (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides insurance sales CRM software
        (&ldquo;the Service&rdquo;). This policy explains what data we collect, why, and your
        rights.
      </p>

      <h2>Data We Collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — name, email, organization name, hashed password.
        </li>
        <li>
          <strong>Contact & lead data</strong> — names, phone numbers, email addresses, and
          insurance-related information entered by your organization.
        </li>
        <li>
          <strong>Usage data</strong> — pages visited, features used, timestamps.
        </li>
        <li>
          <strong>Device identifiers</strong> — FCM/APNs token for push notifications; removed when
          you sign out.
        </li>
        <li>
          <strong>Call recordings</strong> — when enabled by your organization, Twilio records calls
          and stores the URL; recordings are hosted by Twilio.
        </li>
      </ul>

      <h2>How We Use Your Data</h2>
      <ul>
        <li>Operate and improve the Service.</li>
        <li>Send push notifications for assigned leads, inbound calls, and tasks.</li>
        <li>Audit logs for compliance within your organization.</li>
        <li>We do not sell data to third parties.</li>
      </ul>

      <h2>Third-Party Services</h2>
      <p>
        We use <strong>Twilio</strong> (calls, SMS), <strong>Firebase / Google</strong> (push
        notifications), <strong>Sentry</strong> (error monitoring), and <strong>Resend</strong>{' '}
        (email). Each has its own privacy policy.
      </p>

      <h2>Data Retention</h2>
      <p>
        Data is retained while your organization has an active account. On cancellation, data is
        purged within 90 days unless a longer retention period is required by law.
      </p>

      <h2>Your Rights</h2>
      <p>
        You may request access, correction, or deletion of your personal data by contacting{' '}
        <a href="mailto:privacy@insurerank.com">privacy@insurerank.com</a>.
      </p>

      <h2>Contact</h2>
      <p>
        InsureRank — <a href="mailto:privacy@insurerank.com">privacy@insurerank.com</a>
      </p>
    </div>
  )
}
