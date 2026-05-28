# InsureRank — System Architecture

## Overview

InsureRank is an insurance sales CRM platform built for agencies, brokers, and independent agents. It provides lead management, policy tracking, automated ranking/scoring of prospects, agent performance analytics, and a full sales pipeline — all tailored to the insurance vertical.

---

## Core Domain Concepts

| Concept | Description |
|---|---|
| **Lead** | A prospective customer who has not yet purchased a policy |
| **Contact** | A person record (may be a Lead, an existing Client, or a Referral source) |
| **Policy** | An active or lapsed insurance contract linked to a Client |
| **Quote** | A pricing proposal generated for a Lead or existing Client |
| **Pipeline Stage** | A configurable step in the sales funnel (e.g. New → Quoted → Pending → Bound) |
| **Agent** | A licensed insurance producer who owns leads and policies |
| **Carrier** | An insurance company whose products are sold through the platform |
| **Line of Business (LOB)** | The insurance category: `LIFE`, `PNC` (Property & Casualty), `HEALTH`, or `OTHER` |
| **Lead Source** | How a contact was acquired: channel (Referral, Web Form, etc.) plus full UTM attribution |
| **Rank Score** | A composite algorithmic score (0–100) reflecting a lead's or agent's standing |

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Layer                              │
│  Mobile PWA (primary) — installable, offline-capable, push-enabled │
│  Desktop browser (secondary)                                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS / WebRTC (Twilio)
              ┌─────────────▼──────────────────────────────┐
              │          Google Cloud Run                   │
              │  ┌─────────────────┐  ┌──────────────────┐ │
              │  │  Next.js App    │  │  BullMQ Workers  │ │
              │  │  (SSR + API)    │  │  (rank, notify)  │ │
              │  └────────┬────────┘  └────────┬─────────┘ │
              └───────────┼────────────────────┼────────────┘
                          │ VPC (private)       │
        ┌─────────────────┼─────────────────────┼──────────────────┐
        │         Google Cloud — Data Layer      │                  │
        │  Cloud SQL       │         Memorystore │  Cloud Storage   │
        │  (PostgreSQL 15) │         (Redis)     │  (GCS bucket)    │
        └──────────────────┴─────────────────────┴──────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) | SSR, file-based routing, edge-ready |
| Language | TypeScript (strict) | Type safety across full stack |
| Styling | Tailwind CSS + shadcn/ui | Mobile-first, accessible component library |
| PWA | Serwist (next-pwa successor) | Service worker, offline caching, installability |
| State management | Zustand + React Query | Local UI state + server state caching with offline support |
| ORM | Prisma | Type-safe DB access, migration tooling |
| Database | Cloud SQL — PostgreSQL 15 | Managed, private-IP PostgreSQL on GCP |
| Cache / sessions | Cloud Memorystore (Redis) | Managed Redis in the same GCP VPC |
| Auth | NextAuth.js v5 | Email + password (M1); OAuth added in M2 |
| Background jobs | BullMQ (Memorystore-backed) | Reliable async processing, retries |
| File storage | Google Cloud Storage (GCS) | Policy documents, ID uploads |
| Email | Resend | Transactional email (quotes, notifications) |
| Push notifications | Firebase Cloud Messaging (FCM) | Native-quality push to PWA on Android + iOS |
| Voice + SMS | Twilio | Browser-based calling (WebRTC), outbound SMS, activity auto-logging |
| Deployment | Google Cloud Run | Containerised Next.js app + workers; auto-scales to zero |
| Container registry | Google Artifact Registry | Docker image storage |
| Secrets | Google Secret Manager | Centralised secret storage; injected into Cloud Run at runtime |
| CI/CD | GitHub Actions | Lint, test, type-check → build Docker image → deploy to Cloud Run |
| Monitoring | Google Cloud Monitoring + Sentry | Infrastructure metrics + application error tracking |
| Testing | Vitest + Playwright (mobile viewport) | Unit/integration + E2E with mobile-first test runs |

---

## Data Models

### Core Entities (ERD summary)

```
Organization ──< Agent >── TeamMembership ──> Team
     │
     └──< Contact
              │
              ├──< Lead ──> PipelineStage
              │       │
              │       └──< Quote ──> Carrier
              │                └──> Product
              └──< Policy ──> Carrier
                       │   └──> Product
                       └──< Document
```

### Key Table Definitions

```sql
-- Multi-tenant root
Organization { id, name, slug, plan, settings, timezone }

-- Users / agents
Agent { id, orgId, userId, role, licenseNumber, licenseState, licenseExpiry, twilioNumber, rank, status }

-- Contact (unified person record)
Contact {
  id, orgId, firstName, lastName, email, phone, dob, address (JSON),
  -- Lead source attribution
  sourceChannel (REFERRAL | WEB_FORM | COLD_CALL | IMPORT | SOCIAL | OTHER),
  utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
  assignedAgentId, createdAt
}

-- Lead (extends Contact with sales state)
Lead {
  id, contactId, pipelineStageId,
  lineOfBusiness (LIFE | PNC | HEALTH | OTHER),   -- required
  rankScore, temperature (HOT | WARM | COLD),
  expectedRevenue, closeDate, lostReason, lastActivityAt
}

-- Policy
Policy { id, contactId, carrierId, productId, agentId, lineOfBusiness, policyNumber, premium, effectiveDate, expiryDate, status }

-- Quote
Quote { id, leadId, carrierId, productId, lineOfBusiness, premium, deductible, coverage, expiryDate, status, sentAt }

-- Pipeline (stages can be scoped to a lineOfBusiness or apply to all)
PipelineStage { id, orgId, name, position, probability, lineOfBusiness (nullable), isDefault, isClosed, isWon }

-- Activity log (CALL and SMS types backed by Twilio)
Activity {
  id, orgId, entityType, entityId, agentId,
  type (CALL | SMS | EMAIL | MEETING | NOTE | TASK),
  notes, scheduledAt, completedAt,
  -- Twilio metadata (populated for CALL / SMS types)
  twilioCallSid, twilioSmsSid, callDurationSeconds, callDirection, callRecordingUrl
}

-- Rank snapshot (time-series for analytics)
RankSnapshot { id, entityType, entityId, score, components (JSON), createdAt }
```

---

## Authentication & Authorization

### Auth Flow

1. User authenticates via NextAuth `CredentialsProvider` (email + bcrypt password) — M1 only
2. JWT session contains `{ userId, orgId, role, agentId }`
3. Every API route validates session and enforces row-level org isolation
4. Middleware applies role checks before route handlers execute

OAuth providers (Google, Microsoft) are planned for M2.

### Roles

| Role | Description |
|---|---|
| `super_admin` | Platform operator — cross-org access |
| `org_admin` | Agency owner — full org access |
| `manager` | Team lead — sees team's data |
| `agent` | Producer — sees own book of business |
| `viewer` | Read-only (assistants, compliance) |

---

## Ranking Engine

The InsureRank score is the platform's differentiating feature. It runs as a background job triggered on key events (new activity logged, quote sent, time elapsed).

### Lead Rank Score (0–100)

| Component | Weight | Signal |
|---|---|---|
| Engagement recency | 25% | Days since last meaningful touchpoint |
| Response rate | 20% | % of outreach attempts that got a reply |
| Policy fit | 20% | Product-contact demographic alignment |
| Pipeline velocity | 20% | Speed of stage progression vs. cohort |
| Revenue potential | 15% | Expected premium vs. agency average |

### Agent Rank Score (0–100)

| Component | Weight | Signal |
|---|---|---|
| Close rate | 30% | Won deals / total leads in period |
| Retention rate | 25% | Policies renewed vs. lapsed |
| Activity volume | 20% | Qualified touchpoints per week |
| Revenue growth | 15% | YoY premium written |
| Response time | 10% | Average hours to first contact |

Scores are stored as immutable `RankSnapshot` records to power trend charts.

---

## API Design

All internal APIs use Next.js Route Handlers under `/app/api/`. REST conventions with JSON responses.

### Versioning

`/api/v1/...` — current stable  
`/api/v2/...` — next version (introduced before deprecating v1)

### Core Endpoints

```
POST   /api/v1/auth/[...nextauth]

GET    /api/v1/leads                    # paginated, filterable
POST   /api/v1/leads
GET    /api/v1/leads/:id
PATCH  /api/v1/leads/:id
DELETE /api/v1/leads/:id

GET    /api/v1/leads/:id/activities
POST   /api/v1/leads/:id/activities

POST   /api/v1/leads/:id/call            # Initiate Twilio outbound call
POST   /api/v1/leads/:id/sms             # Send Twilio SMS

GET    /api/v1/webhooks/twilio/voice     # Twilio TwiML callback
POST   /api/v1/webhooks/twilio/status    # Call status + recording webhook
POST   /api/v1/webhooks/twilio/sms       # Inbound SMS webhook

GET    /api/v1/leads/:id/quotes
POST   /api/v1/leads/:id/quotes

GET    /api/v1/policies
POST   /api/v1/policies
GET    /api/v1/policies/:id
PATCH  /api/v1/policies/:id

GET    /api/v1/pipeline/stages
GET    /api/v1/pipeline/board            # Kanban view data

GET    /api/v1/contacts
POST   /api/v1/contacts

GET    /api/v1/agents
GET    /api/v1/agents/:id/rank
GET    /api/v1/agents/:id/stats

GET    /api/v1/analytics/overview
GET    /api/v1/analytics/leaderboard
GET    /api/v1/analytics/pipeline-velocity

GET    /api/v1/carriers
GET    /api/v1/products
```

---

## Mobile-First Design Principles

Because agents primarily use InsureRank on their phones, every UI decision prioritises the mobile experience:

| Principle | Implementation |
|---|---|
| Bottom tab navigation | 5 tabs on mobile (Dashboard, Leads, Pipeline, Contacts, Settings) replace a sidebar |
| Thumb-zone layout | Primary actions (Call, SMS, Add Lead) anchored to the bottom of the screen |
| Tap target size | Minimum 44 × 44 px for all interactive elements |
| Offline capability | Leads list, pipeline board, and active lead detail cached by service worker |
| Swipe gestures | Swipe a lead card left/right on mobile pipeline to move stages |
| Push notifications | FCM push for: new lead assigned, task due, inbound SMS/call received |
| One-tap calling | Single button press initiates Twilio browser call — no dialer needed |
| Fast load | React Query stale-while-revalidate + service worker precaching keeps first paint < 1 s on LTE |
| Installable | `manifest.json` enables "Add to Home Screen" on Android and iOS |

Desktop retains a sidebar layout; the responsive breakpoint between mobile and desktop is 768 px.

---

## Frontend Structure

```
app/
  (auth)/
    login/
    signup/
  (dashboard)/
    layout.tsx              # Adaptive shell: sidebar on ≥768px, bottom nav on mobile
    page.tsx                # Dashboard overview
    leads/
      page.tsx              # Lead list (card view on mobile, table on desktop)
      [id]/
        page.tsx            # Lead detail (full-screen on mobile)
    pipeline/
      page.tsx              # Kanban board (horizontal scroll on mobile)
    policies/
      page.tsx
      [id]/page.tsx
    contacts/
      page.tsx
    analytics/
      page.tsx              # Charts & leaderboard
    settings/
      page.tsx
      team/page.tsx
      pipeline/page.tsx
      carriers/page.tsx
  api/
    v1/
      ...route handlers

components/
  ui/                       # shadcn base components
  mobile/
    BottomNav.tsx           # Mobile tab bar
    SwipeableCard.tsx       # Swipeable lead card for mobile pipeline
    CallPanel.tsx           # Active call overlay (full-screen on mobile)
  leads/
  pipeline/
  policies/
  analytics/
  shared/

lib/
  db.ts                     # Prisma client singleton
  auth.ts                   # NextAuth config
  gcs.ts                    # Google Cloud Storage client
  fcm.ts                    # Firebase Cloud Messaging (server-side)
  rank/
    lead-scorer.ts
    agent-scorer.ts
  validations/              # Zod schemas
  utils.ts

public/
  manifest.json             # PWA manifest (icons, theme colour, display: standalone)
  sw.js                     # Service worker (generated by Serwist)
  icons/                    # PWA icons (192px, 512px, maskable)

prisma/
  schema.prisma
  migrations/

workers/
  rank-worker.ts
  notification-worker.ts    # Sends FCM push notifications

Dockerfile                  # Multi-stage build: deps → builder → runner
.dockerignore
```

---

## Infrastructure & Deployment

### Google Cloud Services

| Service | Purpose |
|---|---|
| Cloud Run | Hosts the Next.js app container and BullMQ worker container |
| Cloud SQL (PostgreSQL 15) | Primary relational database; private IP, no public exposure |
| Cloud Memorystore (Redis) | Session cache, BullMQ job queue, rate-limit counters |
| Cloud Storage (GCS) | Policy documents, agent ID uploads, org logos |
| Artifact Registry | Docker image storage (`us-central1-docker.pkg.dev/insurerank/...`) |
| Secret Manager | All secrets injected into Cloud Run at deploy time — no `.env` in containers |
| VPC + Serverless VPC Connector | Cloud Run → Cloud SQL + Memorystore on private network |
| Firebase Cloud Messaging | Push notifications to PWA clients |
| Cloud Monitoring + Logging | Infrastructure metrics, structured log aggregation |
| Cloud Armor (M2) | WAF / DDoS protection layer |

### CI/CD Pipeline

```
GitHub ──push──► GitHub Actions
                    │
                    ├── lint + typecheck + unit tests
                    ├── E2E tests — Playwright (mobile viewport: 390×844)
                    └── on merge to main:
                            ├── docker build (multi-stage)
                            ├── docker push → Artifact Registry
                            ├── gcloud run deploy insurerank-app
                            └── gcloud run deploy insurerank-workers
                                      │
                            Cloud SQL   (PostgreSQL 15, us-central1)
                            Memorystore (Redis, us-central1)
                            GCS bucket  (us-central1)
```

### GCP Project Structure

```
insurerank-prod/
  Cloud Run services:
    insurerank-app      (min-instances: 1, max: 10, 512 MB RAM)
    insurerank-workers  (min-instances: 1, max: 3,  256 MB RAM)
  Cloud SQL:
    insurerank-pg       (db-g1-small → db-n1-standard-1 when needed)
  Memorystore:
    insurerank-redis    (BASIC tier, 1 GB)
  GCS:
    insurerank-documents (private, lifecycle: delete after 7 years)
```

### Secrets (stored in Secret Manager, mounted as env at runtime)

```
DATABASE_URL              # postgres://... Cloud SQL private IP
DIRECT_URL                # Prisma migration bypass (direct Cloud SQL connection)
REDIS_URL                 # redis://... Memorystore private IP
NEXTAUTH_SECRET
NEXTAUTH_URL
GCS_BUCKET_NAME
GOOGLE_APPLICATION_CREDENTIALS_JSON   # Service account JSON for GCS + FCM
FIREBASE_SERVER_KEY       # FCM push notifications
RESEND_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
SENTRY_DSN
```

---

## Security Considerations

- All DB queries scoped to `orgId` — no cross-tenant data leakage
- Prisma parameterized queries prevent SQL injection
- Cloud SQL uses private IP only — not reachable from the public internet
- Rate limiting on auth and mutation endpoints via Memorystore Redis sliding window
- File uploads validated server-side (type, size) before GCS signed URL issued; GCS bucket is private
- PII fields (DOB, SSN) encrypted at rest with application-level AES-256
- All secrets stored in Google Secret Manager — never in container images or source code
- HTTPS everywhere; HSTS headers set; Cloud Run enforces HTTPS by default
- CSP, X-Frame-Options, and CSRF protection via Next.js middleware
- Twilio webhook signature validated on every inbound request
- Service worker scope limited to `/` — no cross-origin script access
- Audit log for all data mutations (`AuditLog` table)
- License expiry alerts 30/60/90 days in advance

---

## Scalability Considerations

- Cloud Run auto-scales the app container (0–10 instances); min-instances: 1 avoids cold starts for the app
- Workers run as a separate Cloud Run service (always-on, 1 minimum instance) to drain the BullMQ queue
- Prisma connection pooling via `pgbouncer=true` in the connection string (Cloud SQL proxy handles the pool)
- Memorystore Redis caches expensive aggregation queries (leaderboard, analytics) with 5-minute TTL
- Rank scoring runs async via BullMQ — never blocks the request path
- Database indexes on `orgId`, `assignedAgentId`, `pipelineStageId`, `createdAt` for all high-traffic queries
- Pagination enforced (max 100 rows per request); cursor-based for time-ordered feeds
- File uploads go directly to GCS via signed upload URLs — never stream through the app server
- Service worker caches the static shell and API responses; repeat visits load instantly even on poor mobile connections

---

## Future Milestones (high-level)

| Milestone | Focus |
|---|---|
| M1 | Foundation: auth (email/password), data models with LOB + UTM attribution, lead CRUD, pipeline kanban, rank scoring, Twilio call + SMS, mobile-first PWA on Google Cloud |
| M2 | Policy & quote management, carrier integrations, document uploads, Google/Microsoft OAuth, FCM push notification campaigns |
| M3 | Analytics dashboard, leaderboard, agent performance views, email notifications |
| M4 | Automated workflows, AI-assisted follow-up suggestions, native Android/iOS wrappers (Capacitor) |
| M5 | Public API, webhooks, marketplace integrations (Salesforce, HubSpot sync) |
