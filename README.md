# InsureRank

Multi-tenant insurance sales CRM. Mobile-first PWA for Android/desktop; native iOS App Store build via Capacitor.

## Stack

| Layer          | Technology                                            |
| -------------- | ----------------------------------------------------- |
| Framework      | Next.js 14 (App Router, TypeScript strict)            |
| Database       | PostgreSQL 15 on Google Cloud SQL (Prisma 5 ORM)      |
| Cache / Queue  | Redis on Memorystore + BullMQ                         |
| Auth           | NextAuth.js v5 (email + password, JWT)                |
| Communication  | Twilio Voice WebRTC + SMS                             |
| Push           | Firebase FCM (Android/web) + APNs via Capacitor (iOS) |
| Error tracking | Sentry                                                |
| iOS native     | Capacitor 8, CallKit, Twilio Voice iOS SDK            |
| CI/CD          | GitHub Actions → Google Cloud Run                     |

---

## Local Development

### Prerequisites

- Node.js 22+ (`nvm use` will pick up `.nvmrc`)
- Docker (for a local Postgres container), **or** Google Cloud SQL Auth Proxy
- Redis 7 (local or via Memorystore tunnel)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local values. At minimum:

```
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/insurerank
DIRECT_URL=postgresql://postgres:password@127.0.0.1:5432/insurerank
REDIS_URL=redis://127.0.0.1:6379
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
DISABLE_SW=true
```

For Twilio calling, Sentry, FCM, and email — fill in the respective keys (see comments in `.env.example`).

### 3. Set up the database

```bash
# Apply migrations
npx prisma migrate dev

# Seed with demo data (Apex Insurance Agency, 3 agents, 20 leads)
npx prisma db seed
```

Demo login: check `prisma/seed.ts` for the seeded email/password.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Commands

```bash
npm run dev            # Next.js dev server
npm run build          # Production build
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Vitest unit tests (100 tests, 7 files)
npm run test:coverage  # Unit tests + coverage (thresholds: 80/75/80/80)
npm run test:e2e       # Playwright E2E (requires running app + E2E_ADMIN_EMAIL env var)
npm run format         # Prettier fix
```

---

## iOS Setup (Mac required)

Everything below runs on a Mac with **Xcode 15+** and an **Apple Developer Program** account. The repo contains all the code — you just need to wire up the native tooling.

### One-time setup

```bash
# Install CocoaPods and Fastlane
sudo gem install cocoapods fastlane

# Generate the Xcode project
npx cap add ios

# Install CocoaPods dependencies
cd ios/App && pod install && cd ../..

# Open in Xcode
npx cap open ios
```

### In Xcode

1. **Signing** — select your Apple Developer team (_Signing & Capabilities_)
2. **Bundle ID** — confirm `com.insurerank.app`
3. **Deployment target** — iOS 16.0
4. **Capabilities** — enable all three:
   - Push Notifications
   - Voice over IP
   - Background Modes → _Audio, AirPlay, and Picture in Picture_ + _Voice over IP_
5. **Twilio Voice SDK** — add via _File → Add Package Dependencies_:
   - URL: `https://github.com/twilio/twilio-voice-ios`
   - Add `TwilioVoice` to the App target
   - The Swift bridge is already written at `ios/App/App/TwilioVoicePlugin.swift`
6. **App icons** — replace assets in `ios/App/App/Assets.xcassets/AppIcon.appiconset`
7. **Test on a physical iPhone** — push notifications and CallKit don't run in the simulator

### APNs push key

1. Apple Developer portal → Keys → create an APNs Auth Key (.p8)
2. Upload the `.p8` to Firebase Console → Project Settings → Cloud Messaging → APNs Auth Key
3. Done — FCM proxies APNs pushes; no server code changes needed

### Face ID (production upgrade)

The biometric module (`src/lib/capacitor/biometric.ts`) currently uses `@capacitor/preferences` as storage. For production, swap to the iOS Keychain:

```bash
npm install @capacitor-community/biometric-auth @capacitor-community/secure-storage
npx cap sync ios
```

Then update `biometric.ts` to use `SecureStorage` instead of `Preferences` for the session token.

### Fastlane code signing (match)

```bash
# Create a private git repo for certificates, then:
fastlane match init     # prompts for the git URL
fastlane match appstore # generates + stores certs
```

Set these GitHub Actions secrets before the iOS CI workflow runs:

| Secret                           | Value                               |
| -------------------------------- | ----------------------------------- |
| `APPLE_ID`                       | your Apple ID email                 |
| `MATCH_GIT_URL`                  | SSH/HTTPS URL of your certs repo    |
| `MATCH_GIT_BASIC_AUTHORIZATION`  | base64(`user:token`)                |
| `MATCH_PASSWORD`                 | encryption passphrase for match     |
| `APP_STORE_CONNECT_API_KEY_JSON` | JSON from App Store Connect API key |

The workflow (`.github/workflows/ios.yml`) runs on `macos-14`, syncs Capacitor, installs pods, and uploads to TestFlight on every merge to `main`.

---

## Deployment (web)

Merging to `main` triggers `.github/workflows/deploy.yml`:

1. Builds Docker image → Artifact Registry
2. Runs Prisma migrations via a Cloud Run job
3. Deploys app + worker services to Cloud Run

Required GitHub secrets: `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`.

---

## Architecture

```
Browser / Android PWA ──► Next.js on Cloud Run
                               │
iOS App (Capacitor) ───────────┤  ← WKWebView loads production URL
                               │
                          PostgreSQL (Cloud SQL)
                          Redis (Memorystore)
                          BullMQ rank workers (Cloud Run)
                          Twilio (calls + SMS)
                          FCM / APNs (push)
                          Sentry (error tracking)
```

### Key directories

```
src/
  app/
    (auth)/         Login, signup, forgot/reset password
    (app)/          Authenticated shell
      dashboard/    KPI cards, recent leads
      leads/        Lead list + detail + activities
      contacts/     Contact list + detail
      pipeline/     Stage board
      imports/      CSV bulk import
      settings/     Account settings
    api/v1/         REST API routes
  lib/
    auth.ts         NextAuth configuration
    api-auth.ts     requireSession / requireRole / scopeToOrg
    db.ts           Prisma client singleton
    queue.ts        BullMQ queue definitions
    twilio.ts       Twilio client + token + TwiML helpers
    fcm.ts          Firebase Admin push helper
    audit.ts        Audit log helper
    csv-import.ts   papaparse CSV parser
    ranking/        Lead + agent scoring algorithms
    capacitor/      iOS plugin bridges
      push.ts         APNs/FCM registration
      biometric.ts    Face ID / Touch ID
      twilio-voice-plugin.ts  CallKit bridge TypeScript interface
  hooks/
    use-twilio-call.ts   Platform-aware call hook (web WebRTC / iOS CallKit)
workers/
  rank.ts           Standalone BullMQ worker process
ios/
  App/App/
    TwilioVoicePlugin.swift  Capacitor → Twilio Voice + CallKit (Swift)
fastlane/
  Fastfile          ios_beta + ios_release lanes
  Matchfile         Certificate sync config
```
