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
| **Rank Score** | A composite algorithmic score (0–100) reflecting a lead's or agent's standing |

---

## System Architecture

### High-Level Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                          Client Layer                              │
│   Browser (Next.js)   │   Mobile (React Native - future)          │
└──────────────┬─────────────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼─────────────────────────────────────────────────────┐
│                         API Gateway / BFF                          │
│             Next.js API Routes  (App Router Route Handlers)        │
└──────┬───────────────┬────────────────────────┬────────────────────┘
       │               │                        │
┌──────▼──────┐ ┌──────▼──────┐       ┌────────▼────────┐
│  Auth       │ │  Core API   │       │  Background     │
│  (NextAuth) │ │  Services   │       │  Jobs / Workers │
└──────┬──────┘ └──────┬──────┘       └────────┬────────┘
       │               │                        │
┌──────▼───────────────▼────────────────────────▼────────────────────┐
│                        Data Layer                                  │
│   PostgreSQL (primary)  │  Redis (cache + sessions)  │  S3 (docs) │
└────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) | SSR, file-based routing, edge-ready |
| Language | TypeScript (strict) | Type safety across full stack |
| Styling | Tailwind CSS + shadcn/ui | Rapid, accessible component library |
| State management | Zustand + React Query | Local UI state + server state caching |
| ORM | Prisma | Type-safe DB access, migration tooling |
| Database | PostgreSQL 15 | Relational integrity for financial/policy data |
| Cache / sessions | Redis (Upstash) | Fast session store, rate limiting, job queue |
| Auth | NextAuth.js v5 | Role-based, supports SSO (Google, Microsoft) |
| Background jobs | BullMQ (Redis-backed) | Reliable async processing, retries |
| File storage | AWS S3 | Policy documents, ID uploads |
| Email | Resend | Transactional email (quotes, notifications) |
| Deployment | Vercel (frontend) + Railway/Render (workers) | Zero-downtime deploys, preview environments |
| CI/CD | GitHub Actions | Lint, test, type-check, deploy |
| Monitoring | Sentry + Vercel Analytics | Error tracking + performance |
| Testing | Vitest + Playwright | Unit/integration + E2E |

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
Organization { id, name, slug, plan, settings }

-- Users / agents
Agent { id, orgId, userId, licenseNumber, licenseState, licenseExpiry, rank, status }

-- Contact (unified person record)
Contact { id, orgId, firstName, lastName, email, phone, dob, address, sourceType, sourceId, assignedAgentId, createdAt }

-- Lead (extends Contact with sales state)
Lead { id, contactId, pipelineStageId, rankScore, temperature, expectedRevenue, closeDate, lostReason, lastActivityAt }

-- Policy
Policy { id, contactId, carrierId, productId, agentId, policyNumber, premium, effectiveDate, expiryDate, status }

-- Quote
Quote { id, leadId, carrierId, productId, premium, deductible, coverage, expiryDate, status, sentAt }

-- Pipeline
PipelineStage { id, orgId, name, position, probability, isDefault, isClosed, isWon }

-- Activity log
Activity { id, orgId, entityType, entityId, agentId, type, notes, scheduledAt, completedAt }

-- Rank snapshot (time-series for analytics)
RankSnapshot { id, entityType, entityId, score, components, createdAt }
```

---

## Authentication & Authorization

### Auth Flow

1. User authenticates via NextAuth (credential or OAuth — Google/Microsoft)
2. JWT session contains `{ userId, orgId, role, permissions[] }`
3. Every API route validates session and enforces row-level org isolation
4. Middleware applies role checks before route handlers execute

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

## Frontend Structure

```
app/
  (auth)/
    login/
    signup/
  (dashboard)/
    layout.tsx              # Sidebar + header shell
    page.tsx                # Dashboard overview
    leads/
      page.tsx              # Lead list / table
      [id]/
        page.tsx            # Lead detail
    pipeline/
      page.tsx              # Kanban board
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
  leads/
  pipeline/
  policies/
  analytics/
  shared/

lib/
  db.ts                     # Prisma client singleton
  auth.ts                   # NextAuth config
  rank/
    lead-scorer.ts
    agent-scorer.ts
  validations/              # Zod schemas
  utils.ts

prisma/
  schema.prisma
  migrations/

workers/
  rank-worker.ts
  notification-worker.ts
```

---

## Infrastructure & Deployment

```
GitHub ──push──► GitHub Actions
                    │
                    ├── lint + typecheck + unit tests
                    ├── E2E tests (Playwright)
                    └── on merge to main:
                            ├── Deploy frontend → Vercel
                            └── Deploy workers  → Railway
                                      │
                            PostgreSQL (Railway managed)
                            Redis      (Upstash)
                            S3         (AWS)
```

### Environment Variables

```
DATABASE_URL
DIRECT_URL                  # Prisma migrations bypass pooler
REDIS_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID / SECRET
AWS_ACCESS_KEY_ID / SECRET
AWS_S3_BUCKET
RESEND_API_KEY
SENTRY_DSN
```

---

## Security Considerations

- All DB queries scoped to `orgId` — no cross-tenant data leakage
- Prisma parameterized queries prevent SQL injection
- Rate limiting on auth and mutation endpoints via Redis sliding window
- File uploads validated server-side (type, size) before S3 pre-signed URL issued
- PII fields (DOB, SSN) encrypted at rest with application-level AES-256
- HTTPS everywhere; HSTS headers set
- CSP, X-Frame-Options, and CSRF protection via Next.js middleware
- Audit log for all data mutations (`Activity` table)
- License expiry alerts 30/60/90 days in advance

---

## Scalability Considerations

- Prisma connection pooling via PgBouncer (Railway built-in)
- Redis caches expensive aggregation queries (leaderboard, analytics) with 5-minute TTL
- Rank scoring runs async via BullMQ — never blocks the request path
- Database indexes on `orgId`, `assignedAgentId`, `pipelineStageId`, `createdAt` for all high-traffic queries
- Pagination enforced (max 100 rows per request); cursor-based for time-ordered feeds
- File uploads go directly to S3 via pre-signed URLs — never stream through the app server

---

## Future Milestones (high-level)

| Milestone | Focus |
|---|---|
| M1 | Foundation: auth, data models, lead CRUD, pipeline kanban, basic rank score |
| M2 | Policy & quote management, carrier integrations, document uploads |
| M3 | Analytics dashboard, leaderboard, agent performance views, email notifications |
| M4 | Automated workflows, AI-assisted follow-up suggestions, mobile web polish |
| M5 | Public API, webhooks, marketplace integrations (Salesforce, HubSpot sync) |
