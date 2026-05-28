# InsureRank — Project Plan: Milestone 1

## Milestone 1 Goal

Deliver a working, deployable insurance sales CRM core hosted on Google Cloud, optimised for agents working primarily on their phones. The app is a Progressive Web App (PWA) — installable on Android and iOS, offline-capable, and push-notification-enabled. Features include email/password authentication, multi-tenant organisation setup, contact/lead management (with line-of-business segmentation and full UTM attribution), a mobile-friendly kanban pipeline, lead rank scoring, and Twilio-powered call + SMS from within the app. At the end of M1 an agency can sign up, install the app to their home screen, import leads, call or text prospects with one tap, move leads through a segmented sales funnel, and see each lead's rank score.

---

## Success Criteria

- [ ] An organization admin can sign up, configure their agency, and invite team members
- [ ] Agents can log in with email + password
- [ ] Agents can install the app to their phone home screen (PWA); the app works offline for cached screens
- [ ] Agents receive push notifications (FCM) for new lead assignments and task reminders
- [ ] Agents can create, update, and delete leads and contacts with line-of-business (Life, P&C, Health) and full UTM source attribution
- [ ] Agents can call or SMS a lead with one tap from the lead detail page; calls and texts are auto-logged as Activities
- [ ] Leads can be moved through a configurable pipeline via a mobile-friendly kanban board (swipe on mobile)
- [ ] Pipeline stages can optionally be filtered by line of business
- [ ] Each lead displays a rank score (0–100) computed from engagement and pipeline signals
- [ ] All data is isolated per organization (no cross-tenant leakage)
- [ ] The application is deployed to Google Cloud Run and passes all automated tests
- [ ] Core pages load in < 2 s on LTE; PWA shell loads in < 1 s on repeat visits

---

## Timeline

| Phase | Focus | Duration |
|---|---|---|
| Phase 1 | Project foundation & infrastructure | Week 1 |
| Phase 2 | Database schema & ORM layer | Week 2 |
| Phase 3 | Authentication & authorization | Week 2–3 |
| Phase 4 | Contact & lead management (API) | Week 3–4 |
| Phase 5 | Pipeline kanban (API + UI) | Week 4–5 |
| Phase 6 | Rank scoring engine | Week 5–6 |
| Phase 7 | Core UI: dashboard, leads, contacts | Week 6–7 |
| Phase 8 | Twilio call + SMS integration | Week 7–8 |
| Phase 9 | Testing, QA, and production deployment | Week 8–9.5 |

Total estimated duration: **9–10 weeks** (1.5 weeks added for Twilio integration)

---

## Phase 1 — Project Foundation & Infrastructure

**Goal:** A running skeleton that every subsequent phase builds on.

### Tasks

#### 1.1 Repository & Tooling Setup
- [ ] Initialize Next.js 14 project with TypeScript strict mode (`npx create-next-app@latest --ts --app --tailwind`)
- [ ] Configure ESLint (eslint-config-next + custom rules), Prettier, and Husky pre-commit hooks
- [ ] Set up `tsconfig.json` path aliases (`@/` for `src/`, `@/db` for prisma client, etc.)
- [ ] Add `.editorconfig` and `.nvmrc` / `.tool-versions` pinning Node version
- [ ] Configure Vitest for unit/integration tests
- [ ] Configure Playwright for E2E tests (with dev/ci environments)

#### 1.2 CI/CD Pipeline
- [ ] Create GitHub Actions workflow: `ci.yml`
  - Runs on every PR: lint, typecheck (`tsc --noEmit`), unit tests
  - Runs E2E tests on PRs targeting `main` (Playwright with mobile viewport 390×844)
- [ ] Create GitHub Actions workflow: `deploy.yml`
  - On merge to `main`: build Docker image → push to Artifact Registry → `gcloud run deploy`
  - Use Workload Identity Federation (no long-lived service account keys in CI)
- [ ] Configure branch protection on `main` (require CI green + 1 review)

#### 1.3 Google Cloud Infrastructure Provisioning
- [ ] Create GCP project `insurerank-prod` (and `insurerank-staging` for preview deploys)
- [ ] Enable APIs: Cloud Run, Cloud SQL, Memorystore, Cloud Storage, Artifact Registry, Secret Manager, Firebase, Cloud Build
- [ ] Provision **Cloud SQL** — PostgreSQL 15, `db-g1-small`, private IP, `us-central1`
  - Enable Cloud SQL Auth Proxy for local dev connections
- [ ] Provision **Memorystore** — Redis 7, BASIC tier, 1 GB, `us-central1`, private IP
- [ ] Create **Serverless VPC Connector** so Cloud Run can reach Cloud SQL and Memorystore on the private network
- [ ] Create **GCS bucket** `insurerank-documents` — private, `us-central1`, lifecycle rule: delete after 7 years
- [ ] Create **Artifact Registry** repository `insurerank` in `us-central1`
- [ ] Create a **dedicated service account** for the Cloud Run app with least-privilege IAM roles:
  - `roles/cloudsql.client`, `roles/storage.objectAdmin`, `roles/secretmanager.secretAccessor`
- [ ] Set up Sentry project and store DSN in Secret Manager
- [ ] Enable **Firebase** project linked to GCP project (for FCM)

#### 1.4 Secrets & Environment Configuration
- [ ] Store all secrets in **Google Secret Manager** (not `.env` files in containers):
  - `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
  - `GCS_BUCKET_NAME`, `GOOGLE_APPLICATION_CREDENTIALS_JSON`
  - `FIREBASE_SERVER_KEY`, `RESEND_API_KEY`
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - `SENTRY_DSN`
- [ ] Create `.env.example` documenting all variables for local dev
- [ ] Add `.env.local` setup instructions (using Cloud SQL Auth Proxy for local DB) to `README.md`
- [ ] Add GitHub Actions secrets: `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`

#### 1.5 Dependency Installation
- [ ] Install and verify core dependencies:
  - `prisma`, `@prisma/client`
  - `next-auth@beta` (v5)
  - `zod`
  - `@tanstack/react-query`
  - `zustand`
  - `ioredis`
  - `bullmq`
  - `resend`
  - `@google-cloud/storage`         ← GCS (replaces @aws-sdk/client-s3)
  - `firebase-admin`                 ← FCM push notifications (server side)
  - `serwist` + `@serwist/next`      ← PWA / service worker
  - `twilio`
  - `@sentry/nextjs`
  - `tailwindcss`, `shadcn-ui`
- [ ] Write `Dockerfile` (multi-stage: `deps` → `builder` → `runner`) and `.dockerignore`
- [ ] Verify `docker build` + `docker run` works locally before wiring CI

**Deliverable:** `npm run dev` starts with no errors; `npm run lint` and `npm test` pass; Docker image builds cleanly.

---

## Phase 2 — Database Schema & ORM Layer

**Goal:** A stable, migrated database schema that serves as the single source of truth for all domain models.

### Tasks

#### 2.1 Core Schema Design
- [ ] Write `prisma/schema.prisma` with all M1 models:
  - `Organization` — multi-tenant root, settings (JSON), plan
  - `User` — email, hashed password, name, avatar, emailVerified
  - `Agent` — orgId, userId, role (enum), licenseNumber, licenseState, licenseExpiry, status
  - `Contact` — orgId, firstName, lastName, email, phone, dob, address (JSON), sourceChannel (enum), utmSource, utmMedium, utmCampaign, utmContent, utmTerm, assignedAgentId
  - `Lead` — contactId, pipelineStageId, lineOfBusiness (LIFE | PNC | HEALTH | OTHER), rankScore, temperature (HOT/WARM/COLD), expectedRevenue, closeDate, lostReason, lastActivityAt
  - `LineOfBusiness` enum: `LIFE`, `PNC`, `HEALTH`, `OTHER`
  - `SourceChannel` enum: `REFERRAL`, `WEB_FORM`, `COLD_CALL`, `IMPORT`, `SOCIAL`, `OTHER`
  - `PipelineStage` — orgId, name, position, probability, isDefault, isClosed, isWon
  - `Activity` — orgId, entityType, entityId, agentId, type (CALL | SMS | EMAIL | MEETING | NOTE | TASK), notes, scheduledAt, completedAt, twilioCallSid, twilioSmsSid, callDurationSeconds, callDirection, callRecordingUrl
  - `RankSnapshot` — entityType, entityId, score, components (JSON), createdAt
  - `AuditLog` — orgId, actorId, action, entityType, entityId, diff (JSON), createdAt

#### 2.2 Indexes & Constraints
- [ ] Add composite indexes: `(orgId, createdAt)`, `(orgId, assignedAgentId)`, `(orgId, pipelineStageId)`, `(contactId)` on Lead
- [ ] Add unique constraints: `(orgId, slug)` on Organization, `(orgId, email)` on Agent
- [ ] Add foreign key cascade rules (delete Lead when Contact is deleted, etc.)

#### 2.3 Seed Data
- [ ] Write `prisma/seed.ts` to populate:
  - 1 demo organization
  - 1 admin + 2 agent users
  - Default pipeline stages (New Lead → Contacted → Quoted → Pending Approval → Bound → Lost)
  - 20 sample contacts/leads distributed across stages, each with a lineOfBusiness and sourceChannel assigned

#### 2.4 Prisma Client Setup
- [ ] Create `src/lib/db.ts` with singleton Prisma client (handles connection pooling in serverless)
- [ ] Add `postinstall` script: `prisma generate`
- [ ] Run first migration: `prisma migrate dev --name init`

#### 2.5 Validation Schemas (Zod)
- [ ] Write Zod schemas matching every Prisma model for API input validation:
  - `contactSchema` (includes UTM fields), `leadSchema` (includes `lineOfBusiness`), `pipelineStageSchema`, `activitySchema`
  - Shared: `paginationSchema`, `sortSchema`

**Deliverable:** `prisma migrate deploy` succeeds; `prisma db seed` populates a working development database.

---

## Phase 3 — Authentication & Authorization

**Goal:** Secure, role-aware login that gates all protected routes.

### Tasks

#### 3.1 NextAuth v5 Configuration
- [ ] Create `src/lib/auth.ts` with NextAuth config:
  - `CredentialsProvider` (email + bcrypt password) — the only provider in M1
  - Custom session callback: embed `userId`, `orgId`, `role`, `agentId` into JWT
  - OAuth providers (Google, Microsoft) are deferred to M2

#### 3.2 Middleware
- [ ] Create `middleware.ts` at project root:
  - Redirect unauthenticated requests from `/dashboard/*` to `/login`
  - Redirect authenticated users away from `/login` and `/signup`
  - Attach `x-org-id` and `x-user-id` headers for downstream route handlers

#### 3.3 API Route Auth Utilities
- [ ] Create `src/lib/api-auth.ts`:
  - `requireSession(req)` — throws 401 if no valid session
  - `requireRole(req, role[])` — throws 403 if insufficient role
  - `scopeToOrg(prismaQuery, session)` — injects `where: { orgId: session.orgId }` guard

#### 3.4 Registration & Onboarding
- [ ] `POST /api/v1/auth/register` — create Organization + User + Agent (admin role) atomically
- [ ] Onboarding wizard UI (3 steps):
  1. Agency name and slug
  2. Admin account details
  3. Default pipeline stages (use defaults or customize)
- [ ] Email verification flow using Resend (send verification link, verify token)

#### 3.5 Invite Flow
- [ ] `POST /api/v1/invites` — generate signed invite token, send via Resend
- [ ] `POST /api/v1/invites/accept` — validate token, create User + Agent with specified role
- [ ] Invite list page under Settings → Team

#### 3.6 Password Reset
- [ ] `POST /api/v1/auth/forgot-password` — generate token, send email
- [ ] `POST /api/v1/auth/reset-password` — validate token, update bcrypt hash

#### 3.7 Login / Signup Pages
- [ ] `/login` page: email + password form only (no OAuth buttons in M1)
- [ ] `/signup` page: triggers registration flow
- [ ] Forgot / reset password pages

**Deliverable:** A user can register an organization, log in, invite teammates, and all protected API routes return 401/403 appropriately when unauthenticated/unauthorized.

---

## Phase 4 — Contact & Lead Management (API)

**Goal:** Full CRUD API for the two core M1 entities, with filtering, pagination, and activity logging.

### Tasks

#### 4.1 Contacts API
- [ ] `GET /api/v1/contacts` — paginated list; filter by `assignedAgentId`, `sourceChannel`, `search` (name/email/phone)
- [ ] `POST /api/v1/contacts` — create with `sourceChannel` + UTM fields; auto-create Lead if `convertToLead: true`
- [ ] `GET /api/v1/contacts/:id`
- [ ] `PATCH /api/v1/contacts/:id`
- [ ] `DELETE /api/v1/contacts/:id` — soft delete (set `deletedAt`)
- [ ] All endpoints validate input with Zod and scope queries to `orgId`

#### 4.2 Leads API
- [ ] `GET /api/v1/leads` — paginated list; filters: `stageId`, `assignedAgentId`, `temperature`, `lineOfBusiness`, `sourceChannel`, `search`, `dateRange`; sort by `rankScore`, `lastActivityAt`, `expectedRevenue`
- [ ] `POST /api/v1/leads`
- [ ] `GET /api/v1/leads/:id` — includes contact, stage, recent activities, rank score
- [ ] `PATCH /api/v1/leads/:id` — triggers rank score re-computation when relevant fields change
- [ ] `DELETE /api/v1/leads/:id` — soft delete
- [ ] `PATCH /api/v1/leads/:id/stage` — move to new pipeline stage; create Activity record; update `lastActivityAt`

#### 4.3 Activities API
- [ ] `GET /api/v1/leads/:id/activities` — chronological list with pagination
- [ ] `POST /api/v1/leads/:id/activities` — manually log email, meeting, note, or task (with `scheduledAt` for tasks); CALL and SMS are auto-created by Twilio webhooks
- [ ] `PATCH /api/v1/activities/:id` — mark task complete, edit notes
- [ ] `DELETE /api/v1/activities/:id`

#### 4.4 Bulk Operations
- [ ] `POST /api/v1/leads/bulk-assign` — reassign selected leads to a different agent
- [ ] `POST /api/v1/leads/bulk-stage` — move selected leads to a different stage
- [ ] `POST /api/v1/leads/import` — CSV import (parse, validate, upsert contacts + leads)

#### 4.5 Audit Logging Middleware
- [ ] Create `src/lib/audit.ts` — wraps mutation handlers to write `AuditLog` records on create/update/delete

**Deliverable:** All endpoints return correct data, pass auth checks, and are covered by unit tests (Vitest with Prisma mock).

---

## Phase 5 — Pipeline Kanban (API + UI)

**Goal:** A visual, drag-and-drop kanban board for moving leads through the sales funnel.

### Tasks

#### 5.1 Pipeline Configuration API
- [ ] `GET /api/v1/pipeline/stages` — ordered list for the org
- [ ] `POST /api/v1/pipeline/stages` — create stage
- [ ] `PATCH /api/v1/pipeline/stages/:id` — rename, reorder, change probability
- [ ] `DELETE /api/v1/pipeline/stages/:id` — requires migration target stage for existing leads
- [ ] `PATCH /api/v1/pipeline/stages/reorder` — accept ordered array of IDs, update positions atomically

#### 5.2 Pipeline Board API
- [ ] `GET /api/v1/pipeline/board` — returns all stages with their leads (summarized), counts, and total expected revenue per stage; supports `assignedAgentId` and `lineOfBusiness` filters

#### 5.3 Kanban Board UI
- [ ] **Desktop:** drag-and-drop kanban using `@dnd-kit/core` + `@dnd-kit/sortable`
- [ ] **Mobile:** horizontally scrollable columns; long-press a card → stage picker bottom sheet (swipe-to-dismiss); no drag required
- [ ] Column per pipeline stage showing:
  - Stage name, lead count, total expected revenue
  - Lead cards: contact name, rank score badge, temperature indicator, assigned agent avatar, expected close date
- [ ] Move a card to a new stage → optimistic UI update → `PATCH /api/v1/leads/:id/stage`
- [ ] Tap a card → navigate to full lead detail (mobile) or open slide-over panel (desktop)
- [ ] Column header "Add Lead" button → quick-create bottom sheet (mobile) or inline form (desktop)

#### 5.4 Pipeline Settings UI
- [ ] Settings → Pipeline page
- [ ] List stages in order with drag-to-reorder
- [ ] Inline edit stage name and win probability
- [ ] Add / archive stages

#### 5.5 Filters & Views
- [ ] Filter bar above board: filter by assigned agent, line of business, temperature, date range
- [ ] Toggle between Kanban and Table views (table reuses lead list from Phase 7)

**Deliverable:** Agents can drag leads between stages on the kanban board; changes persist and are reflected immediately.

---

## Phase 6 — Rank Scoring Engine

**Goal:** A computed, explainable rank score for every lead that updates asynchronously on relevant events.

### Tasks

#### 6.1 Scorer Implementation
- [ ] Create `src/lib/rank/lead-scorer.ts`:
  - Input: `leadId` + all relevant DB data (fetched internally)
  - Computes 5 component scores (see architecture.md), weights them
  - Returns `{ score: number, components: Record<string, number> }`
- [ ] Unit tests covering edge cases: no activity, new lead, lead with 100% win probability stage

#### 6.2 BullMQ Worker
- [ ] Create `workers/rank-worker.ts`:
  - Queue: `rank-scoring`
  - Job: `score-lead` — calls `lead-scorer.ts`, writes `RankSnapshot`, updates `Lead.rankScore`
  - Concurrency: 5 parallel jobs
  - Retry: 3 attempts with exponential backoff
- [ ] Worker entry point deployed as a separate **Cloud Run service** (`insurerank-workers`) with min-instances: 1

#### 6.3 Job Dispatch
- [ ] Create `src/lib/rank/enqueue.ts` — `enqueuLeadScoring(leadId)` helper
- [ ] Dispatch jobs on:
  - Lead created
  - Lead stage changed
  - Activity logged against a lead
  - Scheduled nightly re-score for all active leads (BullMQ repeatable job, 2 AM UTC)

#### 6.4 Score Display
- [ ] Rank score badge component (color: red < 30, amber 30–60, green > 60)
- [ ] Tooltip showing component breakdown ("Engagement: 18/25, Pipeline Velocity: 16/20, …")
- [ ] Score trend sparkline on lead detail page (last 10 `RankSnapshot` records)

#### 6.5 Leaderboard Preview (M1 Seed)
- [ ] `GET /api/v1/leads?sort=rankScore&order=desc` — top-ranked leads for the org
- [ ] Simple "Hot Leads" widget on dashboard showing top 5 by rank score

**Deliverable:** Every lead has a dynamically computed rank score; scores update within 30 seconds of a triggering event.

---

## Phase 7 — Core UI (Mobile-First PWA)

**Goal:** A polished, installable PWA with all M1 screens designed for phone-first use.

### Tasks

#### 7.0 PWA Foundation
- [ ] Configure Serwist in `next.config.ts` — generate service worker at build time
- [ ] Write `public/manifest.json`:
  - `display: "standalone"`, `orientation: "portrait"`
  - Short name: "InsureRank", theme colour matching brand
  - Icon set: 192 px, 512 px, maskable variant
- [ ] Service worker caching strategy:
  - `StaleWhileRevalidate` for API routes (leads list, pipeline board)
  - `CacheFirst` for static assets (JS, CSS, fonts, icons)
  - `NetworkFirst` for lead detail (must be fresh; fall back to cache when offline)
- [ ] Offline fallback page (`/offline`) shown when a non-cached route is requested without network
- [ ] "Add to Home Screen" prompt: show once after 3rd session; dismissible
- [ ] FCM push setup (client side): request notification permission on first login; save FCM token to `Agent.fcmToken` field
- [ ] Test install flow on Android Chrome and iOS Safari 16+

#### 7.1 Application Shell
- [ ] **Mobile (< 768 px):** fixed bottom tab bar with 5 tabs: Dashboard, Leads, Pipeline, Contacts, Settings
- [ ] **Desktop (≥ 768 px):** collapsible left sidebar with same 5 items + Analytics (disabled in M1)
- [ ] Top header: page title only on mobile (no search bar); search + notification bell on desktop
- [ ] User menu (avatar → profile, sign out) — placed in bottom tab bar on mobile
- [ ] Theme: light mode only for M1 (dark mode in M2)

#### 7.2 Dashboard Page (`/dashboard`)
- [ ] Stats row: total leads, leads this month, expected revenue in pipeline, close rate
- [ ] "Hot Leads" widget: top 5 leads by rank score
- [ ] Pipeline summary: mini funnel chart showing lead counts per stage
- [ ] Recent activity feed: last 10 activities across the org

#### 7.3 Leads List Page (`/dashboard/leads`)
- [ ] **Mobile:** scrollable card list (contact name, LOB badge, rank score, temperature chip, last activity); tap card → detail
- [ ] **Desktop:** data table with columns: Contact, LOB, Rank Score, Stage, Temperature, Assigned Agent, Expected Revenue, Last Activity, Close Date
- [ ] Sortable columns (desktop), server-side pagination with infinite scroll (mobile)
- [ ] Filter panel: stage, agent, line of business, source channel, temperature, date range
- [ ] Bulk action toolbar (select → assign / move stage) — desktop only in M1
- [ ] "New Lead" FAB (floating action button) on mobile; button in header on desktop → slide-over form
- [ ] CSV import — desktop only in M1

#### 7.4 Lead Detail Page (`/dashboard/leads/:id`)
- [ ] Full-screen on mobile (no slide-over); slide-over panel on desktop for kanban drill-through
- [ ] **Sticky action bar at bottom of screen on mobile:** Call button (green), SMS button (blue), Log Note button — always reachable with thumb
- [ ] Contact information card (editable inline) — includes source channel and UTM attribution (read-only display)
- [ ] Pipeline stage selector (horizontal scrollable stage rail)
- [ ] Rank score panel: badge + component breakdown + sparkline
- [ ] Activity timeline (chronological, newest first) — call entries show duration, direction, and recording playback link
- [ ] Log activity form: email, meeting, note, task (calls and SMS use Twilio buttons, not this form)
- [ ] Info sidebar: assigned agent, line of business badge, temperature selector, expected revenue, close date, tags (collapses to accordion on mobile)

#### 7.5 Contacts List Page (`/dashboard/contacts`)
- [ ] Table: name, email, phone, assigned agent, open leads count, created date
- [ ] Search by name/email/phone
- [ ] "New Contact" slide-over form with option to simultaneously create a lead

#### 7.6 Settings Pages
- [ ] Settings → Team: list agents, invite, change role, deactivate
- [ ] Settings → Pipeline: drag-to-reorder stages, add/edit/archive
- [ ] Settings → Organization: name, logo upload (GCS signed URL), timezone
- [ ] Settings → Account: change name, email, password

#### 7.7 Empty States & Error Handling
- [ ] Illustrated empty states for: no leads, no contacts, empty pipeline stage
- [ ] Global error boundary with friendly fallback UI
- [ ] Toast notifications for all mutations (success + error)
- [ ] Form validation errors displayed inline (react-hook-form + Zod resolver)

**Deliverable:** All core pages render correctly; the application is usable end-to-end for a new agency.

---

## Phase 8 — Twilio Call + SMS Integration

**Goal:** Agents can call and text leads from within the app; all communication is automatically logged as Activities.

### Tasks

#### 8.1 Twilio Account Setup
- [ ] Provision Twilio project; purchase a platform default outbound number
- [ ] Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to env
- [ ] Configure Twilio webhook URLs pointing to production (and ngrok for local dev)

#### 8.2 Outbound Call Flow
- [ ] `POST /api/v1/leads/:id/call` — creates a Twilio outbound call from the agent's browser to the lead's phone number using Twilio Client JS (browser-based softphone)
- [ ] Return TwiML connecting the browser call to the lead's number
- [ ] `POST /api/v1/webhooks/twilio/status` — Twilio posts call status updates; on `completed`, create an `Activity` record (type: CALL) with duration, direction, recording URL

#### 8.3 Outbound SMS Flow
- [ ] `POST /api/v1/leads/:id/sms` — send an SMS via Twilio REST API; create `Activity` record immediately
- [ ] `POST /api/v1/webhooks/twilio/sms` — handle inbound SMS replies; match to lead by phone number, create Activity (type: SMS, direction: INBOUND), update `lastActivityAt`, enqueue rank score job

#### 8.4 Security for Twilio Webhooks
- [ ] Validate `X-Twilio-Signature` header on all webhook endpoints using `twilio.validateRequest()` — reject unsigned requests with 403

#### 8.5 Call UI in Lead Detail
- [ ] "Call" button in sticky bottom action bar — initiates browser call via Twilio Client JS SDK (WebRTC)
- [ ] Active call panel (full-screen overlay on mobile): contact name, call timer, mute, speaker, hang-up
- [ ] "SMS" button — opens full-screen compose view on mobile; character count; send button
- [ ] iOS Safari requires a user gesture to start audio — the tap on "Call" serves as the gesture; no additional prompt needed
- [ ] Test on Android Chrome 120+ and iOS Safari 16.4+ before sign-off

#### 8.6 FCM Push for Inbound SMS/Call Missed
- [ ] When an inbound SMS arrives (Twilio webhook) and the agent's PWA is in the background, send an FCM push notification: "New message from [Contact Name]: [first 60 chars]"
- [ ] When a Twilio call status = `no-answer` or `busy`, push: "Missed call from [Contact Name]"

#### 8.7 Twilio Number per Agent (Optional M1 stretch)
- [ ] Allow agents to have a dedicated Twilio number (stored on Agent record) for outbound caller ID; fall back to platform default if not set

**Deliverable:** Agents can call and text a lead with one click; every call and SMS appears automatically in the lead's activity timeline with duration and direction.

---

## Phase 9 — Testing, QA & Production Deployment

**Goal:** Confidence that M1 is stable, performant, and secure before announcing to first users.

### Tasks

#### 9.1 Unit & Integration Tests
- [ ] Achieve ≥ 80% line coverage on:
  - All API route handlers (mocked Prisma)
  - `lead-scorer.ts` (all weight components)
  - Auth utilities (`requireSession`, `requireRole`, `scopeToOrg`)
  - Zod validation schemas (including LOB and UTM fields)
  - Twilio webhook handlers (mock `twilio.validateRequest`)
- [ ] Integration tests for critical flows using Prisma test client against a test database

#### 9.2 E2E Tests (Playwright)
- [ ] All E2E suites run in two configurations: **mobile viewport (390×844, touch)** and **desktop (1440×900)**
- [ ] Sign up new organization → onboarding wizard → land on dashboard
- [ ] Install PWA (mobile): verify manifest served, "Add to Home Screen" prompt appears after 3rd session
- [ ] Create contact with LOB + UTM attribution → convert to lead → move through pipeline stages (mobile: bottom sheet stage picker; desktop: drag-and-drop)
- [ ] Filter pipeline kanban by line of business
- [ ] Log activity → verify rank score updates
- [ ] Invite agent → agent accepts → agent logs in → sees only own leads
- [ ] CSV import → verify leads appear in pipeline with correct LOB and source channel
- [ ] Simulate Twilio call status webhook → verify CALL Activity auto-created on lead
- [ ] Simulate Twilio inbound SMS webhook → verify SMS Activity created and `lastActivityAt` updated
- [ ] Verify FCM token saved after notification permission granted on login

#### 9.3 Security Audit
- [ ] Verify all mutations require valid session (run tests with no session header)
- [ ] Verify org isolation: agent from Org A cannot access Org B data (cross-org request tests)
- [ ] Check for mass-assignment: API only accepts whitelisted fields per Zod schema
- [ ] Verify Twilio webhook signature validation rejects unsigned requests
- [ ] Review Content-Security-Policy headers in production

#### 9.4 Performance Baseline
- [ ] Run Lighthouse CI against `/dashboard`, `/dashboard/leads`, `/dashboard/pipeline`
- [ ] Targets — **mobile (throttled LTE):** LCP < 2.5 s, TBT < 300 ms, PWA score 100
- [ ] Targets — **desktop:** LCP < 1.5 s, TBT < 150 ms
- [ ] Verify service worker caches the app shell; repeat visit PWA load < 1 s
- [ ] Add missing DB indexes if query explain plans show sequential scans

#### 9.5 Production Deployment
- [ ] Run `prisma migrate deploy` against Cloud SQL production DB (via Cloud SQL Auth Proxy from CI)
- [ ] Run `prisma db seed` for demo org data (optional)
- [ ] Verify all secrets are set in Google Secret Manager and mounted in Cloud Run service revision
- [ ] Configure Twilio webhook URLs to point at the production Cloud Run URL
- [ ] Confirm Cloud Run VPC Connector reaches Memorystore and Cloud SQL on private IPs
- [ ] Smoke test production on a physical phone: install PWA, register, log in, create lead, place a test call
- [ ] Configure Google Cloud Monitoring alerts: error rate > 1%, p95 latency > 3 s, Cloud SQL CPU > 80%
- [ ] Verify FCM push notifications delivered on both Android and iOS

#### 9.6 Documentation
- [ ] Update `README.md` with: local dev setup (Cloud SQL Auth Proxy), ngrok Twilio tunnel setup, Docker build, seed instructions, deploy instructions
- [ ] Write `CLAUDE.md` with: project conventions, key file locations, test commands, GCP service map, architecture summary
- [ ] Postman/Bruno collection exported for all v1 API endpoints

**Deliverable:** All CI checks green; production URL live; no P0 bugs in smoke test; Sentry reporting 0 errors.

---

## Definition of Done (M1)

An item is done when:
1. Code is merged to `main` via reviewed PR
2. CI passes (lint, typecheck, unit tests, E2E tests)
3. Feature is deployed to production
4. Feature is smoke-tested in production by the implementer
5. Any new env vars are documented in `.env.example`

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| NextAuth v5 API instability (beta) | Medium | High | Pin exact version; watch changelog; have fallback to v4 |
| Rank scoring adds perceptible latency | Low | Medium | Scoring is always async via BullMQ — never in request path |
| DB schema changes after data exists in prod | Medium | High | All schema changes via Prisma migrations; never edit prod directly |
| Cloud Run cold starts (worker service) | Low | Medium | Set min-instances: 1 on the worker service; app service is also always-on |
| Cloud SQL VPC connectivity | Medium | High | Provision and test VPC Connector in staging before production; Cloud SQL Auth Proxy for local dev |
| Twilio WebRTC on iOS Safari | Medium | High | Requires iOS 14.5+; call must be triggered by a tap event; test on physical device before launch |
| Twilio webhook delivery failures | Low | Medium | Implement webhook retry queue in BullMQ; log all raw Twilio payloads for replay |
| Phone number matching for inbound SMS | Medium | Medium | Normalize all phone numbers to E.164 on save; query by normalized number in webhook handler |
| PWA install prompt blocked by iOS | Medium | Low | iOS Safari does not show native install prompt; provide custom in-app "Add to Home Screen" instructions |
| Service worker update UX | Low | Low | Show "App updated — reload to apply" banner when a new service worker is waiting |

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Cloud platform | **Google Cloud.** Cloud Run (app + workers), Cloud SQL (PostgreSQL), Memorystore (Redis), GCS (storage), Secret Manager, FCM. |
| Primary client | **Mobile phone (PWA).** App is installable, offline-capable, and push-enabled. Mobile viewport is the primary design target; desktop is secondary. |
| Lines of business | **In M1.** Support Life, P&C, Health, and Other. `lineOfBusiness` is a required enum on Lead and Policy. |
| Lead source / attribution | **Full UTM in M1.** Contact stores `sourceChannel` enum + `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`. |
| Authentication providers | **Email + password only for M1.** Google and Microsoft OAuth deferred to M2. |
| Phone / SMS integration | **Twilio Call + SMS in M1** — browser-based WebRTC calling and SMS with auto-logged Activities and FCM push for missed events. Timeline extended by 1.5 weeks. |
| Data residency / compliance | **No special requirements.** GCP `us-central1`; HTTPS + AES-256 encryption at rest is sufficient. |
