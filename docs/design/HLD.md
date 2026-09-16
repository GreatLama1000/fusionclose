# Fusion Close — High Level Design (HLD)

**Product:** Fusion Close — multi-entity financial consolidation and close platform
**Owner:** SUVI Corp
**Version:** 1.0
**Date:** 2026-08-30
**Status:** For review
**Audience:** Engineering, and client / auditor review

Companion document: [LLD.md](LLD.md).

---

## 1. Purpose and scope

Fusion Close consolidates the financial results of a group of legal entities into
a single set of reported statements, and manages the close cycle that produces
them: data ingestion, currency translation, intercompany elimination, GAAP
conversion, statement production, and the review and sign-off around all of it.

**In scope for this document**

- The Java backend and consolidation engine.
- The React/TypeScript browser UI.
- Their contract, security perimeter, data model boundaries, and deployment.

**Out of scope**

- The MCA filing platform (`packages/`, `apps/` — TypeScript, Prisma, RAG).
- Ampera Optimization (`Ampera_Optimization/`).

Both are separate workstreams in the same monorepo and share no runtime with
Fusion Close.

### 1.1 Design authority

The technology split is fixed by
[ADR 0001 — Technology stack](adr/0001-technology-stack.md): **Java for the
backend, APIs and the whole consolidation engine; TypeScript and React for the
browser UI.** This document elaborates that decision; it does not reopen it.

The UI is recreated from `design_handoff_fusion_close/`. Those files are design
references, not code to lift.

---

## 2. Drivers

| # | Driver | Consequence in the architecture |
| --- | --- | --- |
| D1 | Figures must be exact and explainable to an auditor | `BigDecimal`/`Money` everywhere; an ArchUnit rule fails the build on any `double` or `float` field; rounding deferred to publication |
| D2 | One client's figures must never appear in another's statements | Two independent isolation layers: `TenantContext` in application code, Postgres RLS in the database |
| D3 | A closed period must not silently change | Period lock is a first-class state with attributed, logged unlock |
| D4 | Elimination rules are the part of the product an auditor reads | Plain Java strategy classes, no rules DSL; property-based tests on the invariants |
| D5 | Design fidelity is not negotiable | Bespoke component layer in React; no third-party component set |
| D6 | Trial balances are large and interaction is dense | Streaming workbook I/O server-side; virtualised grids client-side |
| D7 | A consolidation run must survive a restart | Durable Postgres-backed jobs (JobRunr), runs modelled as immutable records |
| D8 | Exports leave the building | Generated server-side from authoritative figures, never assembled in the browser |

---

## 3. System context

```
        ┌──────────────┐         ┌────────────────────┐
        │  Preparer /  │         │  Client-side user  │
        │  Reviewer    │         │  (external)        │
        └──────┬───────┘         └─────────┬──────────┘
               │  HTTPS                    │  HTTPS
               └────────────┬──────────────┘
                            ▼
                 ┌─────────────────────┐
                 │   Fusion Close UI   │  React + TS + Vite
                 │   (static bundle)   │  served by reverse proxy
                 └──────────┬──────────┘
                     /api   │  same-origin, Bearer JWT
                            ▼
      ┌────────────────────────────────────────────┐
      │      Fusion Close backend (Spring Boot)    │
      │      modular monolith, single deployable   │
      └───┬──────────────┬───────────────┬─────────┘
          │              │               │
          ▼              ▼               ▼
   ┌────────────┐  ┌───────────┐  ┌──────────────┐
   │  Postgres  │  │ Keycloak  │  │ Object store │
   │  + RLS     │  │  (OIDC)   │  │  (uploads,   │
   │  + JobRunr │  │           │  │   exports)   │
   └────────────┘  └───────────┘  └──────────────┘
```

### 3.1 External actors and systems

| Actor / system | Interaction |
| --- | --- |
| Firm users (Super User, Reviewer, Editor/Preparer) | Full close workflow through the UI |
| Client-side users (Client, Viewer) | Restricted entity and section access; Favorites rail and cross-engagement navigation suppressed |
| Keycloak | OIDC authentication, TOTP MFA, password policy, brute-force lockout, tenant SSO federation |
| Postgres | System of record, RLS enforcement, JobRunr job store |
| Object store | Uploaded workbooks, generated exports and data books |
| Email / SMTP | Notifications, invitations, forced password rotation |

---

## 4. Container view

| Container | Technology | Responsibility | Scaling |
| --- | --- | --- | --- |
| UI bundle | React 18, TypeScript 5.7, Vite 6 | Rendering, interaction, client-side view state | CDN / static; stateless |
| Backend app | Java 21, Spring Boot 3.5, Gradle | API, domain logic, consolidation engine, exports | Horizontal; stateless request path |
| Job workers | JobRunr inside the same deployable | Consolidation runs, ingestion parsing, export generation | Worker count per instance (`JOBRUNR_WORKERS`) |
| Database | Postgres 16 | Persistence, RLS, audit chain, job queue | Vertical + read replica for reporting (future) |
| Identity | Keycloak | AuthN, MFA, session policy | Managed separately |
| Object store | S3-compatible | Large binary in/out | Managed |

The backend is **one deployable**. Module boundaries are enforced at build time
by Spring Modulith and ArchUnit so the option to split later is preserved
without paying distributed-systems cost now.

---

## 5. Backend module architecture

```
                          ┌──────────────────────────┐
                          │        backend:api        │  REST, DTOs, OpenAPI
                          └────────────┬─────────────┘   (no business logic)
                                       │
   ┌───────────────────────────────────┴────────────────────────────────────┐
   │                            backend:modules                             │
   │                                                                        │
   │  identity   tenancy   entitymaster   chartofaccounts   ingestion       │
   │  ledger     fx        intercompany   gaap              consolidation   │
   │  reporting  collaboration            pmo               audit           │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌───────────────┐          ┌────────────────────┐        ┌────────────────────────┐
│  common-core  │          │  common-security   │        │  common-persistence    │
│  Money        │          │  TenantContext     │        │  jOOQ + JPA config     │
│  FiscalPeriod │          │  Role              │        │  RLS arming (SET LOCAL)│
│  Scenario     │          │  SectionAccess     │        │  transactional outbox  │
│  typed ids    │          │                    │        │                        │
│  framework-   │          │                    │        │                        │
│  free (rule)  │          │                    │        │                        │
└───────────────┘          └────────────────────┘        └────────────────────────┘
```

### 5.1 Module responsibilities

| Module | Owns | Depth in LLD |
| --- | --- | --- |
| `identity` | Users, invitations, roles, per-user permission overrides | Summary |
| `tenancy` | Tenants, workspaces, engagements, accounting periods, locks | Summary |
| `entitymaster` | Legal entity master, ownership graph, consolidation structure | Summary |
| `chartofaccounts` | Group CoA, FSLI taxonomy, mapping sets | Summary |
| `ingestion` | Workbook upload, parsing, staging, validation, commit | **Deep** |
| `ledger` | Trial balance facts, top-side journals, balance queries | **Deep** |
| `fx` | Rate tables, translation, CTA / OCI computation | **Deep** |
| `intercompany` | Elimination classes E1–E9, matching, registers | **Deep** |
| `gaap` | Framework conversion adjustments, dual-GAAP presentation | **Deep** |
| `consolidation` | Run orchestration, sequencing, NCI, output facts | **Deep** |
| `reporting` | Statement assembly, notes, disclosures, exports, bridges | **Deep** |
| `collaboration` | Comments, presence, notifications | Summary |
| `pmo` | Assignments, task lists, close calendar | Summary |
| `audit` | Hash-chained append-only event log, chain verification | Summary |

### 5.2 The consolidation pipeline

The module list maps onto the UI's own stepper.

```
 Engagement    Financial      Currency       Intercompany    GAAP          Output &
 Setup     →   Data Layer  →  Translation →  Eliminations →  Conversion →  Reporting
 ──────────    ──────────     ───────────    ────────────    ──────────    ──────────
 tenancy       ingestion      fx             intercompany    gaap          reporting
 entitymaster  ledger                        (E9→E1,E2→      consolidation
 chartof-                                     E4; E6→E1)     (NCI, equity)
 accounts
```

Ordering inside the elimination stage is part of the specification, not an
implementation detail: E9 normalises in-transit and cut-off items before E1 and
E2 attempt to match; E2 hands capitalised charges to E4; E6 creates E1 pairs. The
orchestrator in `consolidation` owns that sequence — elimination classes never
call each other.

---

## 6. Frontend architecture

```
┌──────────────────────────────────────────────────────────────┐
│  app/                router, providers, error boundaries     │
├──────────────────────────────────────────────────────────────┤
│  features/           one folder per route group               │
│    engagement  financial-data-layer  fx  ice  consolidation  │
│    gaap  reporting  disclosure  pmo  teams  settings         │
├──────────────────────────────────────────────────────────────┤
│  shared/                                                     │
│    tokens/     tokens.css — the only place a colour, radius,  │
│                shadow or type size is defined                │
│    ui/         bespoke neumorphic primitives                  │
│    grid/       TanStack Table + Virtual wrappers              │
│    api/        generated OpenAPI client + query keys          │
│    auth/       oidc-client-ts session, role/permission gates  │
│    money/      decimal.js display formatting (display only)   │
└──────────────────────────────────────────────────────────────┘
```

### 6.1 Layering rules

1. `features/` may import from `shared/`. `shared/` never imports from
   `features/`.
2. Colour, radius, shadow and type size come from `tokens.css` only. A hex code
   in a component is a review failure.
3. **The browser never computes a figure that reaches a statement.** Money
   crosses the wire as a string and is handled with `decimal.js` purely for
   display and for client-side sanity checks.
4. Server state lives in TanStack Query. UI state (selection anchors, drag
   targets, fullscreen flags, column widths) lives in Zustand or local state, and
   never in Query.

### 6.2 Route map

Route keys below are the ones the design prototype already uses.

| Group | Routes |
| --- | --- |
| Top | `home`, `workspace` |
| Workspace | `command`, `engagement`, `consol`, `fx`, `ice` |
| Engagement Setup | `upload` (Financial Data Layer), `master` |
| Module Integration | `buscomb` (PPA Accounting), `proforma`, `gaap`, `carve` |
| Output & Reporting | `repanalytics`, `reporting`, `bridges`, `fs` |
| Reporting & Analytics | `sentinel` |
| Projects | `intake` |
| Delivery | `pmo`, `assistant` |
| Teams | `access`, `mytasks` |
| Disclosure insights | `disclib` |
| Bottom | `userguide`, `feedback`, `reachus`, `config` |

Stepper routes: `consol → gaap → reporting → fs → bridges`.

### 6.3 Contract with the backend

The frontend API client is **generated from the backend's OpenAPI document**
(`openapi-typescript`). The contract cannot drift silently; a breaking backend
change fails the frontend typecheck.

Dev and production behave identically: Vite proxies `/api` to the backend with
`changeOrigin: false`, so cookie and CORS behaviour matches the production
reverse-proxy setup rather than being papered over with permissive CORS.

---

## 7. Data architecture

### 7.1 Isolation model

Shared schema, `tenant_id` on every business table, Postgres RLS enforcing it.

```
 request ──► JWT claim ──► TenantContext.set(tenantId)
                                   │
                     transaction start
                                   ▼
                   SET LOCAL app.current_tenant = '<uuid>'
                                   │
                                   ▼
        every RLS policy: USING (tenant_id = app_current_tenant())
```

Three properties make this hold:

- `app_current_tenant()` returns NULL when unset, and NULL matches no row. A code
  path that forgets to bind a tenant sees an empty result, not another client's
  data.
- `FORCE ROW LEVEL SECURITY` applies policies to the table owner too.
- The runtime pool connects as `fusion_app` — not the table owner, not a
  superuser, both of which would bypass RLS. Flyway migrations connect as
  `fusion_migrator`.

The tenant is only ever read from a validated token claim. Never a header, query
parameter, or request body.

### 7.2 Grain and keys

- The trial balance is held at a **single monthly grain**. Quarterly and annual
  views are ranges over months, which makes the UI's granularity switch a pure
  query concern.
- `Scenario` (`ACTUAL`, `BUDGET`, `FORECAST`, `RESTATED`) is part of the primary
  key of every ledger fact, not a filter bolted on later — a restatement must
  coexist with originally reported actuals without overwriting them.
- Periods are keyed `YYYY-MM`.
- Cross-boundary identifiers are typed records (`TenantId`, `WorkspaceId`,
  `EngagementId`, `LegalEntityId`, `UserId`, `ConsolidationRunId`) so a method
  cannot be called with the arguments swapped.

### 7.3 SQL strategy

| Concern | Tool |
| --- | --- |
| Consolidation engine and reporting reads | jOOQ — typed, set-based, no N+1 or lazy-loading surprises |
| Master-data CRUD (entities, users, tasks) | JPA |
| Schema evolution | Flyway, plain reviewable SQL (RLS needs real DDL) |

---

## 8. Cross-cutting concerns

### 8.1 Authentication

Keycloak as OIDC provider; the backend is a JWT resource server. This supplies
TOTP MFA, password policy, brute-force lockout and tenant SSO federation without
building them. The design's per-user MFA flag and forced first-login password
rotation map onto Keycloak required actions.

### 8.2 Authorization

The effective decision is **the narrowest of three inputs**:

```
   Role (coarse default)
        ∩
   Per-user permission overrides
        ∩
   Per-group section ACL  (NONE | VIEW | absent → fall back to role)
        ▼
   Effective grant
```

Deny always wins. The ordering matters most for `CLIENT`: a client-side preparer
must never widen their own access by being added to a broader group.

Roles, in rank order: `SUPER_USER` (50), `REVIEWER` (40), `EDITOR_PREPARER` (30),
`CLIENT` (20), `VIEWER` (10). `CLIENT` and `VIEWER` are external.

The UI hides what a user cannot access, but **the UI is not the control**. A
section at `NONE` is not rendered, not returned by the API, and not exportable.

### 8.3 Period locks

A period is `OPEN`, `SOFT_CLOSED`, or `LOCKED`. A locked period's figures cannot
change without an explicit unlock that is attributed and logged — the database
enforces attribution with a check constraint, so a lock without an actor and a
timestamp cannot exist.

### 8.4 Audit

Append-only `audit_event`, hash-chained: each row commits to the previous row's
hash, so editing or deleting history breaks the chain verifiably. Enforced in the
database by a trigger that raises on UPDATE and DELETE, and by grants that give
the application role `SELECT, INSERT` only. Hibernate Envers was rejected — it
versions entities but gives no tamper-evident chain, which is what an auditor
asks for.

### 8.5 Money

- `Money` is exact, immutable, single-currency, and refuses arithmetic across
  currencies. Translation is an explicit rate-stamped operation owned by `fx`.
- Working scale is 8 decimal places; rounding to presentation scale happens once,
  at publication.
- `HALF_UP`, matching Ind AS / IFRS / US GAAP statement practice and spreadsheet
  behaviour. Banker's rounding is deliberately not the default: it surprises
  preparers reconciling to Excel.
- `Money.allocate(weights)` distributes the rounding remainder a minor unit at a
  time to the largest fractional parts, so group-share / NCI splits sum back
  exactly and a consolidated balance sheet still balances.

### 8.6 Background work

JobRunr, Postgres-backed. No extra broker to operate, and a consolidation run
survives a restart. A job payload carries its tenant; the worker binds it with
`TenantContext.callAs(...)` because there is no HTTP request to inherit from.

### 8.7 Workbook I/O

fastexcel for reading, POI/SXSSF for writing — streaming both ways. A large trial
balance must never become a DOM tree in memory. Upload ceiling is explicit
(`64MB` default, configurable).

### 8.8 Observability

Actuator exposes `health`, `info`, `prometheus` only. Metrics carry an
`application: fusion-close` tag. Server error responses include no message,
stacktrace, or binding errors. Every audit event carries a `request_id` for
correlation.

---

## 9. Non-functional requirements

| Attribute | Target | How the architecture supports it |
| --- | --- | --- |
| Correctness | Zero tolerance on figures | `Money`, deferred rounding, exact allocation, property-based tests, ArchUnit ban on floating point |
| Tenant isolation | No cross-tenant read, ever | Two enforcement layers, one of them outside application code |
| Auditability | Any published figure traceable to source rows and rules applied | Immutable runs, hash-chained audit, rule-level attribution on every posting |
| Interactive latency | Grid scroll, cell edit, multi-select feel local | Virtualised grids; client-side selection state; no server round-trip per keystroke |
| Consolidation run duration | Minutes, not hours, for a mid-size group | Set-based jOOQ, single monthly grain, staged commits |
| Durability | Run survives restart | Postgres-backed jobs, idempotent stages |
| Availability | Business-hours critical, close-window critical | Stateless request path, horizontal scaling |
| Security | Server-side perimeter only | Keycloak, RLS, unprivileged runtime role, server-side exports |
| Recoverability | Point-in-time restore | Managed Postgres PITR; object store versioning |

---

## 10. Deployment

```
        Internet
           │  TLS
           ▼
   ┌───────────────┐
   │ Reverse proxy │  serves the static UI bundle
   │  (nginx)      │  proxies /api same-origin
   └───┬───────┬───┘
       │       │
       ▼       ▼
 ┌──────────┐ ┌────────────────────────┐
 │ UI static│ │ fusion-close backend   │  N instances
 │  assets  │ │ (app + JobRunr workers)│
 └──────────┘ └────┬──────────┬────────┘
                   │          │
                   ▼          ▼
            ┌──────────┐  ┌──────────┐
            │ Postgres │  │ Keycloak │
            │   16     │  │          │
            └──────────┘  └──────────┘
```

| Environment | Notes |
| --- | --- |
| Local | `deploy/docker-compose.yml` (Postgres, Keycloak); `./gradlew :backend:app:bootRun`; `npm run dev` |
| CI | `./gradlew verify` — compiles every module, unit + Testcontainers integration tests, ArchUnit fitness rules |
| Staging | Production topology, synthetic tenants |
| Production | Region per tenant `data_region` (see open question OQ-2) |

No credentials are committed. Configuration is typed `@ConfigurationProperties`;
an ArchUnit rule bans raw `System.getenv` outside the `app` module.

---

## 11. Build and toolchain

| | |
| --- | --- |
| Backend | JDK 21 (Temurin), Gradle 8.11.1, versions centralised in `gradle/libs.versions.toml` |
| Frontend | Node 20+, Vite 6, strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Contract | OpenAPI document → `openapi-typescript` client |
| Tests | JUnit 5, AssertJ, jqwik, Testcontainers, ArchUnit; Vitest + Testing Library |

`./gradlew verify` is the single gate. It includes the architecture fitness
functions, so an architectural violation is a build failure rather than a code
review argument.

---

## 12. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Two languages, two toolchains | Generated API client; matched strictness settings; one `verify` gate per side |
| R2 | Elimination rules misunderstood late | E1–E9 specified per class with strategy and state model before implementation; property-based invariants |
| R3 | Consolidation run duration grows with group size | Set-based SQL from the start; monthly grain; stage-level metrics from day one |
| R4 | Design fidelity erodes as features land | Tokens as the single source; no third-party component set to fight |
| R5 | RLS accidentally bypassed by a new code path | `FORCE` policies, unprivileged runtime role, ArchUnit ban on `DriverManager` |
| R6 | Local GAAP scope expands per jurisdiction | Framework treated as data, not an enum branch (see OQ-1) |

---

## 13. Open questions

| # | Question | Status |
| --- | --- | --- |
| OQ-1 | GAAP framework coverage | **Resolved 2026-08-30:** Ind AS, IFRS, US GAAP, **and local GAAP per jurisdiction**. The V1 `engagement.reporting_framework` CHECK allows only the first three — a follow-up migration must add local-GAAP support as data rather than a widened enum. Tracked in LLD §4.9. |
| OQ-2 | Data residency — is `ap-south-1` a hard requirement or a default? | **Open.** `tenant.data_region` records it per tenant; the architecture supports either answer. A hard requirement adds region-pinned storage, backup and job placement. Needed before production topology is fixed. |
| OQ-3 | Reporting read replica | Deferred until reporting load is measured |

---

## 14. Build order

Following the design handoff's own recommendation:

1. Shell, navigation, routing
2. Manage Teams (`access`) — exercises the full authorization model early
3. Engagement Setup and Legal Entity Master
4. Financial Data Layer (`upload`) — ingestion, ledger
5. Reporting & Analytics
6. Remaining modules — fx, intercompany, gaap, consolidation
7. Collaboration layer

Two items from the handoff are scaffolding and must be replaced before any
release: the sample data (entities, TB figures, users, tasks), and the
`image-slot.js` placeholders.

One item is a known prototype shortcut: the `extClient` flag that greys out the
Favorites rail is a local boolean and **must be wired to the signed-in user's
role** — `Role.isExternal()` is the intended source.
