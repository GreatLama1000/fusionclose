# Fusion Close — Low Level Design (LLD)

**Product:** Fusion Close
**Version:** 1.0
**Date:** 2026-08-30
**Status:** For review
**Audience:** Engineering, and client / auditor review

Companion document: [HLD.md](HLD.md). Terms, module list and security model are
defined there and not repeated.

**Part A — Backend (Java)** · §1–§10
**Part B — Frontend (React + TypeScript)** · §11–§21

Conventions used below: `snake_case` for database identifiers, package root
`com.suvicorp.fusionclose`, API base path `/api/v1`. Money is a decimal **string**
on the wire in every DTO. Periods are `YYYY-MM`.

---

# Part A — Backend

## 1. Package and module layout

```
backend/
├── app/                     the only deployable
│   ├── FusionCloseApplication.java
│   ├── config/              @ConfigurationProperties, security wiring
│   ├── resources/db/migration/   Flyway
│   └── test/                ArchitectureRulesTest, ModularityTest
├── api/                     controllers, DTOs, OpenAPI. No queries.
├── common/
│   ├── common-core/         Money, FiscalPeriod, Scenario, Identifiers
│   ├── common-security/     TenantContext, Role, SectionAccess
│   └── common-persistence/  jOOQ + JPA config, RLS arming, outbox
└── modules/<module>/
    ├── <module>/            public API: service interfaces, DTOs, events
    └── <module>/internal/   entities, jOOQ repositories, implementations
```

Per-module rule: **JPA entities live in `..internal..`** and never cross a module
boundary. Modules publish DTOs or events. Enforced by ArchUnit.

## 2. Shared kernel — signatures

Framework-free by enforced rule (`coreStaysFrameworkFree`).

```java
public final class Money implements Comparable<Money>, Serializable {
    public static final int CALC_SCALE = 8;
    public static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

    public static Money of(BigDecimal amount, Currency currency);
    public static Money of(String amount, String isoCode);
    public static Money zero(Currency currency);

    public BigDecimal amount();               // working scale; never rendered
    public BigDecimal presentationAmount();   // currency fraction digits
    public Currency currency();

    public Money plus(Money other);           // CurrencyMismatchException if differing
    public Money minus(Money other);
    public Money negated();
    public Money abs();
    public Money times(BigDecimal ratio);     // ownership %, NCI share, markup
    public Money dividedBy(BigDecimal divisor);
    public List<Money> allocate(List<BigDecimal> weights);   // sums back exactly
}

public record FiscalPeriod(YearMonth yearMonth) implements Comparable<FiscalPeriod> {
    public static FiscalPeriod of(int year, int month);
    public static FiscalPeriod parse(String key);   // YYYY-MM
    public String key();
    public LocalDate firstDay();
    public LocalDate lastDay();     // FX closing rate / BS position date
    public FiscalPeriod next();
    public FiscalPeriod previous(); // seeds every stateful register
}

public enum Scenario { ACTUAL, BUDGET, FORECAST, RESTATED }

public final class Identifiers {
    public record TenantId(UUID value) {}
    public record WorkspaceId(UUID value) {}
    public record EngagementId(UUID value) {}
    public record LegalEntityId(UUID value) {}
    public record UserId(UUID value) {}
    public record ConsolidationRunId(UUID value) {}
}
```

### 2.1 Security kernel

```java
public final class TenantContext {
    public static void set(TenantId tenantId);          // token claim only
    public static Optional<TenantId> current();
    public static TenantId require();                   // MissingTenantException
    public static <T> T callAs(TenantId t, Callable<T> work) throws Exception;
    public static void clear();                         // always, pools are reused
}

public enum Role {
    SUPER_USER("Super User", 50), REVIEWER("Reviewer", 40),
    EDITOR_PREPARER("Editor/Preparer", 30), CLIENT("Client", 20), VIEWER("Viewer", 10);
    public boolean isExternal();                        // CLIENT or VIEWER
    public static Role narrower(Role left, Role right);
}

public enum SectionAccess {
    NONE, VIEW, EDIT;
    public boolean allowsRead();
    public boolean allowsWrite();
    public static SectionAccess narrower(SectionAccess l, SectionAccess r);
}
```

## 3. Persistence infrastructure (`common-persistence`)

### 3.1 RLS arming

Every transaction begins by pushing the bound tenant onto the connection.

```java
@Component
final class TenantConnectionInitializer implements TransactionSynchronization {
    // On transaction begin:
    //   SET LOCAL app.current_tenant = ?
    // SET LOCAL, not SET: the value is discarded at commit/rollback, so a
    // pooled connection cannot carry one tenant's context into another's request.
}
```

Failure modes and their intended behaviour:

| Situation | Result |
| --- | --- |
| No tenant bound, tenant-scoped query runs | `app_current_tenant()` returns NULL → zero rows |
| Missed `WHERE tenant_id = ?` in hand-written SQL | RLS filters it anyway → zero rows |
| Code opens its own connection | ArchUnit failure (`noDirectDriverManagerAccess`) |
| Application connects as table owner | `FORCE ROW LEVEL SECURITY` still applies policies |

### 3.2 Transactional outbox

Domain events are written in the same transaction as the state change and
published after commit, so a committed lock or run always produces its audit
event and notification.

```
 outbox_event(id, tenant_id, aggregate_type, aggregate_id, event_type,
              payload jsonb, occurred_at, published_at NULL)
```

A JobRunr recurring job drains unpublished rows. At-least-once delivery;
consumers are idempotent on `(aggregate_id, event_type, occurred_at)`.

## 4. Data model

V1 (`V1__tenancy_and_row_level_security.sql`) is in the repository and creates
`tenant`, `workspace`, `engagement`, `accounting_period`, `audit_event`, the
`app_current_tenant()` function, RLS policies and grants. The tables below are
the designed forward migrations.

Every business table carries `tenant_id uuid NOT NULL REFERENCES tenant (id)`,
`created_at`, `updated_at`, RLS enabled + forced, and a `tenant_isolation` policy
identical in shape to V1. This is not repeated per table.

### 4.1 V1 — existing (reference)

| Table | Key columns | Notes |
| --- | --- | --- |
| `tenant` | `id` PK, `slug` UNIQUE | `data_region` default `ap-south-1`; `status` ACTIVE/SUSPENDED/CLOSED |
| `workspace` | `id` PK, UNIQUE `(tenant_id, name)` | `logo_asset_key` |
| `engagement` | `id` PK, UNIQUE `(tenant_id, workspace_id, name)` | `reporting_framework` CHECK IND_AS/IFRS/US_GAAP; `presentation_currency char(3)`; `reporting_entity_id` nullable until the LE master exists; `status` DRAFT→IN_PROGRESS→REVIEW→PUBLISHED→ARCHIVED |
| `accounting_period` | `id` PK, UNIQUE `(tenant_id, engagement_id, period_key, scenario)` | `status` OPEN/SOFT_CLOSED/LOCKED; CHECK `accounting_period_lock_is_attributed` |
| `audit_event` | `id` bigint identity PK | append-only trigger; `previous_hash`, `entry_hash` |

### 4.2 V2 — entity master

```sql
CREATE TABLE legal_entity (
    id                      uuid PRIMARY KEY,
    tenant_id               uuid NOT NULL REFERENCES tenant (id),
    engagement_id           uuid NOT NULL REFERENCES engagement (id),
    le_code                 text NOT NULL,
    le_name                 text NOT NULL,
    parent_entity_id        uuid REFERENCES legal_entity (id),
    entity_type             text NOT NULL,      -- PARENT, SUBSIDIARY, ASSOCIATE, JV, BRANCH, SPE
    country                 char(2) NOT NULL,
    ownership_direct_pct    numeric(9,6) NOT NULL DEFAULT 0,
    ownership_indirect_pct  numeric(9,6) NOT NULL DEFAULT 0,
    ownership_total_pct     numeric(9,6) NOT NULL,
    nci_pct                 numeric(9,6) NOT NULL DEFAULT 0,
    consolidation_pct       numeric(9,6) NOT NULL,
    consolidation_method    text NOT NULL,      -- FULL, EQUITY, PROPORTIONATE, NOT_CONSOLIDATED
    consolidation_structure text,               -- sub-consolidation grouping
    local_currency          char(3) NOT NULL,
    functional_currency     char(3) NOT NULL,
    reporting_currency      char(3) NOT NULL,
    entity_classification   text,
    fiscal_year_end         char(5) NOT NULL,   -- MM-DD
    primary_gaap            text NOT NULL,
    secondary_gaap          text,
    acquisition_date        date,
    disposal_date           date,
    UNIQUE (tenant_id, engagement_id, le_code),
    CONSTRAINT ownership_total_is_consistent
        CHECK (ownership_total_pct >= ownership_direct_pct),
    CONSTRAINT nci_complements_consolidation
        CHECK (consolidation_method <> 'FULL' OR nci_pct = 100 - ownership_total_pct)
);
CREATE INDEX legal_entity_parent_idx ON legal_entity (engagement_id, parent_entity_id);
```

The 18 columns match the Legal Entity Master grid in the design exactly, in that
order. `parent_entity_id` self-reference plus `consolidation_structure` is what
lets the ownership graph and the sub-consolidation grouping differ — they are not
the same tree.

Ownership graph invariants (asserted in tests, not just constraints): acyclic;
exactly one entity with `parent_entity_id IS NULL` per engagement matching
`engagement.reporting_entity_id`; indirect percentage equals the product of the
chain to the reporting entity.

### 4.3 V3 — chart of accounts and FSLI

| Table | Key columns | Notes |
| --- | --- | --- |
| `group_account` | UNIQUE `(engagement_id, account_code)` | `account_type` (ASSET/LIABILITY/EQUITY/INCOME/EXPENSE), `normal_balance` (DR/CR) |
| `fsli` | UNIQUE `(engagement_id, fsli_code)` | `parent_fsli_id` self-ref, `statement` (BS/IS/OCI/CF/SOCE), `sort_order`, `sign_convention` |
| `mapping_set` | UNIQUE `(engagement_id, name)` | versioned; `effective_from period_key` |
| `account_mapping` | UNIQUE `(mapping_set_id, source_account, legal_entity_id)` | `group_account_id`, `fsli_id`; `legal_entity_id` NULL = applies to all |

Mapping sets are versioned and period-effective. Re-mapping never rewrites
history: a run records the `mapping_set_id` it used.

### 4.4 V4 — ingestion staging

| Table | Key columns | Notes |
| --- | --- | --- |
| `ingestion_batch` | `id` PK | `legal_entity_id`, `period_key`, `scenario`, `kind` (TB/JE), `frequency` (MONTHLY/QUARTERLY/ANNUAL), `source_file_key`, `row_count`, `status` (UPLOADED/PARSING/VALIDATED/FAILED/COMMITTED/REVERSED), `uploaded_by`, `committed_at` |
| `ingestion_row` | `(batch_id, row_no)` PK | raw cells as `jsonb`, `parsed_account`, `parsed_debit`, `parsed_credit`, `error_code` |
| `ingestion_finding` | `id` PK | `batch_id`, `severity` (ERROR/WARNING/INFO), `code`, `row_no` NULL for batch-level, `message`, `context jsonb` |

Staging is never skipped. A batch is parsed and validated in full before any
figure reaches `ledger`, and a committed batch is reversible by reference rather
than by deletion.

### 4.5 V5 — ledger facts

```sql
CREATE TABLE tb_fact (
    id                uuid PRIMARY KEY,
    tenant_id         uuid NOT NULL REFERENCES tenant (id),
    engagement_id     uuid NOT NULL REFERENCES engagement (id),
    legal_entity_id   uuid NOT NULL REFERENCES legal_entity (id),
    period_key        char(7) NOT NULL,
    scenario          text    NOT NULL,
    group_account_id  uuid NOT NULL REFERENCES group_account (id),
    currency          char(3) NOT NULL,          -- local currency of the entity
    amount            numeric(28,8) NOT NULL,    -- signed; DR positive
    source_batch_id   uuid REFERENCES ingestion_batch (id),
    UNIQUE (tenant_id, engagement_id, legal_entity_id, period_key,
            scenario, group_account_id, currency)
);
CREATE INDEX tb_fact_lookup_idx
    ON tb_fact (engagement_id, period_key, scenario, legal_entity_id);
```

`numeric(28,8)` matches `Money.CALC_SCALE`. Signed amounts with debit-positive
convention: a single sign rule everywhere is cheaper to reason about than a
debit/credit column pair.

| Table | Purpose |
| --- | --- |
| `topside_je` | Header: `je_number`, `period_key`, `scenario`, `purpose`, `status` (DRAFT/POSTED/REVERSED), `prepared_by`, `approved_by` |
| `topside_je_line` | `(je_id, line_no)`, `legal_entity_id`, `group_account_id`, `currency`, `amount`, `memo` |
| `je_balance_check` | Deferred constraint helper: a POSTED JE must sum to zero per currency |

### 4.6 V6 — FX

| Table | Key columns | Notes |
| --- | --- | --- |
| `fx_rate` | UNIQUE `(engagement_id, from_ccy, to_ccy, period_key, rate_type)` | `rate_type` CLOSING/AVERAGE/HISTORICAL/OPENING, `rate numeric(20,10)`, `source`, `entered_by` |
| `fx_translation_result` | UNIQUE `(run_id, legal_entity_id, group_account_id, period_key)` | `local_amount`, `rate_used`, `rate_type_used`, `translated_amount`, `cta_amount` |

Rate selection is per FSLI class, not per account: balance sheet at CLOSING,
income statement at AVERAGE, equity and pre-acquisition reserves at HISTORICAL.
The residual lands in CTA within OCI. Every translated figure stores the rate and
rate type actually used — that is what makes a translation explainable a year
later.

### 4.7 V7 — intercompany

| Table | Purpose | State model |
| --- | --- | --- |
| `ic_transaction` | Declared intercompany balances and flows: `entity_from`, `entity_to`, `nature`, `txn_currency`, `amount`, `period_key`, `class_hint` | Input |
| `ic_match` | `(class, entity_pair, nature, txn_currency)` grouping with `matched_amount`, `residual_amount`, `tolerance_applied`, `difference_owner_entity_id` | Per run |
| `ic_urp_register` | E3 unrealised profit in inventory: `entity_pair`, `opening_urp`, `additions`, `realised`, `closing_urp` | **Stateful, carried forward** |
| `ic_asset_transfer_register` | E4 one row per transferred asset: `asset_ref`, `transfer_date`, `unrealised_profit`, `remaining_useful_life_months`, `catch_up_posted_to_date` | **Stateful, asset-level, lives until the asset leaves the group** |
| `ic_investment_registration` | E5 capital consolidation computed once at acquisition: `investee_id`, `cost_of_investment`, `net_assets_at_acquisition`, `goodwill`, `nci_at_acquisition` | **Standing entry, re-posted each period** |
| `ic_associate_register` | E7 pro-rata under Ind AS 28.28: `investor_pct`, `unrealised_profit`, `eliminated_portion` | **Stateful, pro-rata** |
| `ic_provision_register` | E8 intragroup provisions and impairments | **Stateful, full reversal** |
| `ic_intransit_adjustment` | E9 cut-off normalisation; always adjusts the **receiving** entity | Pre-elimination |

### 4.8 V8 — consolidation

| Table | Purpose |
| --- | --- |
| `consolidation_run` | `id`, `engagement_id`, `period_key`, `scenario`, `mapping_set_id`, `status` (QUEUED/RUNNING/SUCCEEDED/FAILED/SUPERSEDED), `started_at`, `finished_at`, `triggered_by`, `input_fingerprint` |
| `consolidation_stage_result` | `(run_id, stage)`, `status`, `duration_ms`, `row_count`, `findings jsonb` |
| `consolidation_posting` | Every posting the engine makes: `run_id`, `stage`, `rule_code` (E1…E9, FX, GAAP, NCI), `legal_entity_id`, `group_account_id`, `fsli_id`, `currency`, `amount`, `explanation jsonb` |
| `consolidated_fact` | Output grain: `(run_id, fsli_id, legal_entity_id NULL for group, period_key, scenario)` → `amount`, `group_share`, `nci_share` |

A run is **immutable once complete**. Re-running supersedes rather than mutates,
so a published statement always has an intact lineage. `input_fingerprint` is a
hash over the committed batch ids, FX rates, mapping set version and register
states — an identical fingerprint means an identical result, which makes
re-running cheap to reason about.

`consolidation_posting` is the audit answer to "why is this number what it is":
every posting names the rule that produced it.

### 4.9 V9 — GAAP conversion and local GAAP (OQ-1)

Framework coverage is Ind AS, IFRS, US GAAP **and local GAAP per jurisdiction**.
V1's `engagement.reporting_framework` CHECK admits only the first three, so
widening the enum is the wrong fix — jurisdictional GAAP is open-ended.

```sql
CREATE TABLE reporting_framework (
    code            text PRIMARY KEY,      -- IND_AS, IFRS, US_GAAP, LOCAL_IN, LOCAL_DE, …
    display_name    text NOT NULL,
    jurisdiction    char(2),               -- NULL for the three global frameworks
    is_global       boolean NOT NULL DEFAULT false
);

ALTER TABLE engagement DROP CONSTRAINT engagement_reporting_framework_check;
ALTER TABLE engagement
    ADD CONSTRAINT engagement_framework_fk
    FOREIGN KEY (reporting_framework) REFERENCES reporting_framework (code);
```

| Table | Purpose |
| --- | --- |
| `gaap_adjustment_rule` | `from_framework`, `to_framework`, `rule_code`, `fsli_id`, `basis`, `active_from period_key` |
| `gaap_adjustment` | Per run and entity: `rule_code`, `amount`, `deferred_tax_amount`, `narrative` |

Reference data seeds the three global frameworks plus the local frameworks a
tenant actually uses; `supported-frameworks` in `application.yml` becomes the
tenant-level allow-list rather than a global constant.

## 5. REST API

Base `/api/v1`. Bearer JWT. `application/json`. Money as string. All list
endpoints are cursor-paginated (`?cursor=&limit=`, max 500).

### 5.1 Endpoint contracts

| Method | Path | Purpose | Required grant |
| --- | --- | --- | --- |
| GET | `/me` | Session, role, effective permissions, section ACLs | authenticated |
| GET | `/workspaces` | Workspaces in tenant | authenticated |
| GET | `/engagements` | List; filter `workspaceId`, `status` | authenticated |
| POST | `/engagements` | Create | SUPER_USER |
| GET | `/engagements/{id}` | Detail incl. framework, presentation currency | read on engagement |
| PATCH | `/engagements/{id}` | Name, framework, currency, reporting entity | SUPER_USER |
| GET | `/engagements/{id}/periods` | Periods with lock state | read |
| POST | `/engagements/{id}/periods/{periodKey}/lock` | Lock | REVIEWER+ |
| POST | `/engagements/{id}/periods/{periodKey}/unlock` | Unlock; reason mandatory | SUPER_USER |
| GET | `/engagements/{id}/entities` | Legal entity master (18 columns) | read |
| POST | `/engagements/{id}/entities` | Create entity | EDITOR_PREPARER+ |
| PATCH | `/entities/{id}` | Update; rejected if any period LOCKED and field affects figures | EDITOR_PREPARER+ |
| POST | `/engagements/{id}/entities/import` | Bulk workbook import | EDITOR_PREPARER+ |
| GET | `/engagements/{id}/entities/graph` | Ownership graph + computed indirect % | read |
| GET | `/engagements/{id}/accounts` | Group CoA | read |
| GET | `/engagements/{id}/fsli` | FSLI taxonomy tree | read |
| GET | `/engagements/{id}/mapping-sets` | Versions | read |
| PUT | `/mapping-sets/{id}/mappings` | Bulk upsert (FSLI mapper drag-drop) | EDITOR_PREPARER+ |
| POST | `/engagements/{id}/ingestion/batches` | `multipart/form-data`; returns batch id | EDITOR_PREPARER+ |
| GET | `/ingestion/batches/{id}` | Status, counts, findings summary | read |
| GET | `/ingestion/batches/{id}/rows` | Paged staged rows with per-row errors | read |
| POST | `/ingestion/batches/{id}/commit` | Promote staged rows to `tb_fact` | EDITOR_PREPARER+ |
| POST | `/ingestion/batches/{id}/reverse` | Reverse a committed batch | REVIEWER+ |
| GET | `/engagements/{id}/tb` | TB grid; filters `periodKey`, `scenario`, `entityIds`, `accountFrom/To` | read |
| PATCH | `/tb/cells` | Inline cell edit (batch of edits) | EDIT on section, period not LOCKED |
| GET | `/engagements/{id}/journals` | Top-side JEs | read |
| POST | `/engagements/{id}/journals` | Create draft JE | EDITOR_PREPARER+ |
| POST | `/journals/{id}/post` | Post; must balance per currency | REVIEWER+ |
| POST | `/journals/{id}/reverse` | Reverse | REVIEWER+ |
| GET | `/engagements/{id}/fx-rates` | Rate table for period | read |
| PUT | `/engagements/{id}/fx-rates` | Bulk upsert | EDITOR_PREPARER+ |
| GET | `/engagements/{id}/ic/transactions` | IC declarations | read |
| GET | `/engagements/{id}/ic/matches` | Match results, residuals, owners | read |
| PATCH | `/ic/matches/{id}` | Set difference owner, tolerance override | EDITOR_PREPARER+ |
| GET | `/engagements/{id}/ic/registers/{class}` | E3/E4/E5/E7/E8 register contents | read |
| POST | `/engagements/{id}/consolidation-runs` | Queue a run | EDITOR_PREPARER+ |
| GET | `/consolidation-runs/{id}` | Status, stage results | read |
| GET | `/consolidation-runs/{id}/postings` | Filter `stage`, `ruleCode`, `entityId` | read |
| GET | `/consolidation-runs/{id}/facts` | Consolidated facts by FSLI | read |
| GET | `/engagements/{id}/statements/{statement}` | BS / IS / OCI / CF / SOCE, hierarchical | read on section |
| GET | `/engagements/{id}/notes` | Notes and disclosures tree | read on section |
| PUT | `/notes/{id}` | Edit note body | EDIT on section |
| GET | `/engagements/{id}/bridges` | Bridge / movement reports | read |
| POST | `/engagements/{id}/exports` | Queue export (`XLSX_LINKED`, `XLSX_DELINKED`, `PDF`) | read + export grant |
| GET | `/exports/{id}` | Status and download URL | read |
| GET | `/engagements/{id}/comments` | Comments; filter route, resolved | read |
| POST | `/engagements/{id}/comments` | Create anchored comment | read |
| GET | `/engagements/{id}/tasks` | PMO assignments | read |
| GET | `/engagements/{id}/team` | Members, roles, overrides, section ACLs | read |
| PUT | `/engagements/{id}/team/{userId}` | Role, overrides | SUPER_USER |
| PUT | `/engagements/{id}/section-acl` | Group section ACLs | SUPER_USER |
| GET | `/engagements/{id}/audit` | Audit trail, filterable | REVIEWER+ |
| GET | `/engagements/{id}/audit/verify` | Verify hash chain; returns first break if any | SUPER_USER |

### 5.2 DTO shapes

```jsonc
// GET /me
{
  "userId": "0191c…",
  "displayName": "Priya N.",
  "role": "EDITOR_PREPARER",
  "external": false,
  "tenant": { "id": "…", "name": "SUVI Corp", "dataRegion": "ap-south-1" },
  "permissions": ["PUBLISH_STATEMENTS"],           // per-user overrides only
  "sectionAcl": { "notes.related-party": "VIEW" }, // absent = fall back to role
  "mfaEnabled": true,
  "passwordRotationRequired": false
}
```

```jsonc
// GET /engagements/{id}/entities  → items[]
{
  "id": "…", "leCode": "UK01", "leName": "ClientCo UK Ltd",
  "parentEntityId": "…", "entityType": "SUBSIDIARY", "country": "GB",
  "ownership": { "directPct": "80.000000", "indirectPct": "0.000000", "totalPct": "80.000000" },
  "nciPct": "20.000000", "consolidationPct": "100.000000",
  "consolidationMethod": "FULL", "consolidationStructure": "EMEA_SUB",
  "currencies": { "local": "GBP", "functional": "GBP", "reporting": "INR" },
  "entityClassification": "OPERATING", "fiscalYearEnd": "03-31",
  "gaap": { "primary": "IFRS", "secondary": "IND_AS" },
  "acquisitionDate": "2024-04-01", "disposalDate": null
}
```

```jsonc
// POST /engagements/{id}/ingestion/batches  (multipart: file + meta)
// meta:
{ "legalEntityId": "…", "periodKey": "2026-06", "scenario": "ACTUAL",
  "kind": "TB", "frequency": "MONTHLY" }
// 202 Accepted:
{ "batchId": "…", "status": "PARSING", "jobId": "…" }
```

```jsonc
// GET /ingestion/batches/{id}
{ "batchId": "…", "status": "VALIDATED",
  "rowCount": 4821, "errorCount": 0, "warningCount": 3,
  "findings": [ { "severity": "WARNING", "code": "ACCOUNT_UNMAPPED",
                  "rowNo": 118, "message": "Account 640210 has no group mapping",
                  "context": { "account": "640210" } } ],
  "controlTotals": { "debit": "18420000.00", "credit": "18420000.00", "currency": "GBP" } }
```

```jsonc
// PATCH /tb/cells
{ "edits": [ { "legalEntityId": "…", "periodKey": "2026-06", "scenario": "ACTUAL",
               "groupAccountId": "…", "amount": "12500.00", "reason": "Reclass per client email" } ] }
// 200:
{ "applied": 1, "rejected": [] }
```

```jsonc
// POST /engagements/{id}/consolidation-runs
{ "periodKey": "2026-06", "scenario": "ACTUAL", "mappingSetId": "…" }
// 202:
{ "runId": "…", "status": "QUEUED", "inputFingerprint": "sha256:…" }

// GET /consolidation-runs/{id}
{ "runId": "…", "status": "SUCCEEDED",
  "stages": [
    { "stage": "VALIDATE_INPUTS",  "status": "SUCCEEDED", "durationMs": 240,  "rowCount": 0 },
    { "stage": "TRANSLATE_FX",     "status": "SUCCEEDED", "durationMs": 1830, "rowCount": 48210 },
    { "stage": "NORMALISE_E9",     "status": "SUCCEEDED", "durationMs": 310,  "rowCount": 42 },
    { "stage": "ELIMINATE",        "status": "SUCCEEDED", "durationMs": 2940, "rowCount": 1183 },
    { "stage": "CONVERT_GAAP",     "status": "SUCCEEDED", "durationMs": 760,  "rowCount": 96 },
    { "stage": "ALLOCATE_NCI",     "status": "SUCCEEDED", "durationMs": 410,  "rowCount": 620 },
    { "stage": "ASSEMBLE_OUTPUT",  "status": "SUCCEEDED", "durationMs": 1120, "rowCount": 8940 }
  ] }
```

```jsonc
// GET /consolidation-runs/{id}/postings  → items[]
{ "postingId": "…", "stage": "ELIMINATE", "ruleCode": "E3",
  "legalEntityId": "…", "fsliId": "…", "currency": "INR",
  "amount": "-1840000.00",
  "explanation": { "basis": "closing URP", "sourcePair": ["IN01","UK01"],
                   "markupPct": "18.000000", "openingUrp": "1420000.00" } }
```

### 5.3 Error envelope

Uniform, no stack traces, no framework leakage (`server.error.include-*: never`).

```jsonc
{ "code": "PERIOD_LOCKED",
  "message": "2026-06 ACTUAL is locked; unlock is required before figures can change",
  "requestId": "01J9…",
  "details": { "periodKey": "2026-06", "lockedBy": "Sarah K.", "lockedAt": "2026-08-14T09:12:00Z" } }
```

## 6. Error and validation catalogue

| Code | HTTP | Raised by | Meaning |
| --- | --- | --- | --- |
| `UNAUTHENTICATED` | 401 | security | Missing or invalid token |
| `FORBIDDEN` | 403 | security | Narrowest grant denies the action |
| `SECTION_HIDDEN` | 404 | reporting | Section ACL is `NONE` — deliberately indistinguishable from absent |
| `MISSING_TENANT` | 500 | persistence | Internal bug: tenant-scoped work with no tenant bound |
| `PERIOD_LOCKED` | 409 | tenancy | Write attempted against a locked period |
| `UNLOCK_REASON_REQUIRED` | 422 | tenancy | Unlock without an attributed reason |
| `CURRENCY_MISMATCH` | 422 | core | Arithmetic across currencies attempted |
| `FX_RATE_MISSING` | 422 | fx | No rate for `(pair, period, rateType)` |
| `OWNERSHIP_CYCLE` | 422 | entitymaster | Ownership graph is not acyclic |
| `OWNERSHIP_INCONSISTENT` | 422 | entitymaster | Total < direct, or NCI ≠ 100 − total under FULL |
| `NO_REPORTING_ENTITY` | 422 | entitymaster | Engagement has no root entity |
| `ACCOUNT_UNMAPPED` | 422 | ingestion | Source account has no group mapping (warning at parse, error at commit) |
| `TB_OUT_OF_BALANCE` | 422 | ingestion | Debits ≠ credits for the batch |
| `DUPLICATE_BATCH` | 409 | ingestion | Same entity/period/scenario/kind already committed |
| `WORKBOOK_UNREADABLE` | 422 | ingestion | Not a parseable workbook |
| `UPLOAD_TOO_LARGE` | 413 | api | Exceeds `UPLOAD_MAX_FILE_SIZE` |
| `JE_UNBALANCED` | 422 | ledger | Posted JE does not sum to zero per currency |
| `IC_TOLERANCE_EXCEEDED` | 422 | intercompany | Residual beyond tolerance with no difference owner |
| `IC_REGISTER_GAP` | 422 | intercompany | Opening register state missing for a stateful class |
| `PRIOR_PERIOD_NOT_CLOSED` | 409 | consolidation | Stateful classes need the previous period approved |
| `RUN_SUPERSEDED` | 409 | consolidation | Result requested from a superseded run |
| `RUN_IN_PROGRESS` | 409 | consolidation | Concurrent run for the same period/scenario |
| `FRAMEWORK_UNSUPPORTED` | 422 | gaap | Framework not in the tenant allow-list |
| `EXPORT_FAILED` | 500 | reporting | Export generation failed; retryable |
| `AUDIT_CHAIN_BROKEN` | 500 | audit | Verification found a break — treat as an incident |

Validation happens in three places deliberately: Zod in the browser (fast
feedback), Bean Validation on DTOs (contract), and domain invariants plus
database constraints (truth). The last layer is the only one trusted.

## 7. Sequence flows

### 7.1 Trial balance upload to commit

```
UI            api            ingestion        JobRunr        ledger        audit
 │             │                 │               │              │            │
 ├─POST batch──►                 │               │              │            │
 │             ├─createBatch()──►│               │              │            │
 │             │                 ├─store file────┤              │            │
 │             │                 ├─enqueue parse─►              │            │
 │◄─202 batchId┤                 │               │              │            │
 │             │                 │        ┌──────┴──────┐       │            │
 │             │                 │◄───────┤ parse job   │       │            │
 │             │                 │  fastexcel stream    │       │            │
 │             │                 ├─ insert ingestion_row│       │            │
 │             │                 ├─ validate: balance,  │       │            │
 │             │                 │   mapping, duplicates│       │            │
 │             │                 ├─ findings ──────────►│       │            │
 │             │                 │        status=VALIDATED       │            │
 ├─GET batch───►─────────────────►                      │       │            │
 │◄─findings───┤                 │                      │       │            │
 ├─POST commit─►                 │                      │       │            │
 │             ├─commit()───────►│  tx: period not LOCKED?      │            │
 │             │                 ├─ upsert tb_fact ────────────►│            │
 │             │                 ├─ status=COMMITTED            │            │
 │             │                 ├─ outbox event ──────────────────────────►│
 │◄─200────────┤                 │                              │  append,   │
 │             │                 │                              │  hash-chain│
```

Commit is one transaction. Either every staged row lands in `tb_fact` and the
batch is `COMMITTED`, or nothing changes.

### 7.2 Consolidation run

```
 orchestrator (consolidation module)                        modules used
 │
 ├─ 1 VALIDATE_INPUTS ─ periods, rates, mappings, registers   tenancy, fx,
 │                       prior period approved?               chartofaccounts
 ├─ 2 TRANSLATE_FX ──── per FSLI class rate selection;        fx
 │                       CTA to OCI; store rate used
 ├─ 3 NORMALISE_E9 ──── in-transit / cut-off; adjust the      intercompany
 │                       RECEIVING entity only
 ├─ 4 ELIMINATE ─────── E1, E2 (auto-match, tolerance)        intercompany
 │                       E2 → hands capitalised charges to E4
 │                       E3 URP carry-forward + reversal
 │                       E4 asset register + depreciation catch-up
 │                       E5 standing investment entry
 │                       E6 dividends; group share out, NCI stays;
 │                          declared-unpaid also creates an E1 pair
 │                       E7 associates pro-rata (Ind AS 28.28);
 │                          balances and gross revenue NOT eliminated
 │                       E8 intragroup provisions, full reversal
 ├─ 5 CONVERT_GAAP ──── framework adjustments + deferred tax  gaap
 ├─ 6 ALLOCATE_NCI ──── Money.allocate(group, nci) so parts   consolidation
 │                       sum back exactly
 └─ 7 ASSEMBLE_OUTPUT ─ consolidated_fact per FSLI;           reporting
                         run marked SUCCEEDED and immutable
```

Each stage writes `consolidation_stage_result` and its own
`consolidation_posting` rows tagged with `rule_code`. A stage is idempotent on
`(run_id, stage)`, so a worker restart re-runs the stage cleanly.

### 7.3 Period lock

```
 UI ─POST lock─► api ─► tenancy
                          ├─ any run in progress?          → RUN_IN_PROGRESS
                          ├─ any batch not committed?      → warn, allow
                          ├─ UPDATE accounting_period SET status='LOCKED',
                          │   locked_at=now(), locked_by=:actor, lock_reason=:reason
                          │   (DB check refuses a lock without actor + timestamp)
                          └─ outbox → audit_event (append-only, hash-chained)
```

## 8. Background jobs (JobRunr)

| Job | Trigger | Idempotency key | Retry |
| --- | --- | --- | --- |
| `ParseIngestionBatchJob` | On upload | `batchId` | 3, exponential; then `status=FAILED` with findings |
| `CommitIngestionBatchJob` | On commit request when large | `batchId` | 3 |
| `ConsolidationRunJob` | On run request; also scheduled | `runId` + stage | Per stage, 2 attempts |
| `GenerateExportJob` | On export request | `exportId` | 3 |
| `DrainOutboxJob` | Recurring, 5s | `outboxEventId` | Until published |
| `VerifyAuditChainJob` | Recurring, nightly | `tenantId` + date | Alert on break |
| `FxRateReminderJob` | Recurring, close calendar | `engagementId` + period | — |

Every job payload carries `tenantId`; the worker wraps execution in
`TenantContext.callAs(tenantId, …)`. Dashboard disabled in production
(`org.jobrunr.dashboard.enabled: false`); worker count via `JOBRUNR_WORKERS`.

## 9. Summarised modules

### 9.1 `identity`
Users, invitations, role assignment, per-user permission overrides. Keycloak owns
credentials, MFA and password rotation; this module owns the engagement-facing
projection (display name, initials, avatar key, role, overrides). Effective grant
computation lives here: `Role.narrower` ∩ overrides ∩ `SectionAccess.narrower`.

### 9.2 `tenancy`
Tenants, workspaces, engagements, accounting periods, lock transitions. Owns the
only code path that may change `accounting_period.status`.

### 9.3 `entitymaster`
Legal entity CRUD and bulk import, ownership graph computation (indirect % as the
product of the chain), consolidation structure grouping, acyclicity and
completeness checks. Structure grouping is separate from the ownership tree
because sub-consolidations do not follow ownership.

### 9.4 `chartofaccounts`
Group CoA, FSLI taxonomy with sign conventions, versioned period-effective
mapping sets. Backs the drag-to-map FSLI screen; a mapping change never rewrites
committed history.

### 9.5 `collaboration`
Text-anchored comments (route, location, quoted text, offsets), threads, presence,
notifications. Anchors survive edits by storing the quote alongside offsets and
re-anchoring on the quote when offsets drift.

### 9.6 `pmo`
Assignments, task lists, close calendar, my-tasks projection. Tasks reference
engagement, period and route so the UI can deep-link.

### 9.7 `audit`
Append-only writer and chain verifier.

```java
public interface AuditWriter {
    void record(AuditEvent event);   // computes entry_hash over previous_hash + canonical payload
}
public interface AuditVerifier {
    VerificationResult verify(TenantId tenant, Instant from, Instant to);  // first break, if any
}
```

Grants are `SELECT, INSERT` only; a trigger raises on UPDATE and DELETE. There is
no application code path that can amend history — deliberately.

## 10. Backend test strategy

| Layer | Instrument | What it proves |
| --- | --- | --- |
| Shared kernel | JUnit 5 + AssertJ | `Money` arithmetic, currency refusal, presentation rounding |
| Shared kernel | **jqwik** (property-based) | `allocate()` parts always sum to the original at presentation scale, for arbitrary weights and amounts; translation then allocation commutes within tolerance |
| Architecture | ArchUnit | No `double`/`float` field anywhere; core stays framework-free; api never queries; no `DriverManager`; entities in `..internal..`; no raw `System.getenv`; core fields final |
| Modularity | Spring Modulith `ModularityTest` | No cycles, no undeclared cross-module dependency |
| Persistence + RLS | Testcontainers Postgres | With tenant A bound, tenant B's rows are invisible; unset tenant returns zero rows; a query missing `WHERE tenant_id` still returns nothing |
| Audit | Testcontainers | UPDATE and DELETE on `audit_event` raise; chain verification detects a tampered row |
| Period lock | Integration | Every figure-changing endpoint returns `PERIOD_LOCKED` when locked; unlock without reason rejected |
| Ingestion | Integration + fixture workbooks | Out-of-balance rejected; unmapped account warns at parse and blocks at commit; duplicate batch rejected; commit is atomic |
| FX | Unit + property | Rate type per FSLI class; CTA is the residual and lands in OCI; rate used is recorded |
| Intercompany | Unit per class, property for invariants | E9 adjusts only the receiver; E1/E2 residual routed to the difference owner; E3 opening = prior closing; E4 catch-up over remaining life; E6 NCI share survives; E7 eliminates only the investor's interest and leaves balances and gross revenue alone; E8 fully reverses |
| Consolidation | Integration on a reference group | **The consolidated balance sheet balances**; group + NCI = total for every FSLI; identical `input_fingerprint` produces identical facts; stage restart is idempotent |
| API | MockMvc / WebTestClient | Contract shapes, error envelope, authorization matrix per endpoint × role |
| Authorization | Table-driven integration | The narrowest-of-three rule, including that a `CLIENT` cannot widen access by group |

Reference group fixture: a parent with a full subsidiary, a partly-owned
subsidiary with NCI, an associate, a foreign entity in a different functional
currency, and at least one asset transfer and one inventory URP outstanding at
period start. Every engine test runs against it.

---

# Part B — Frontend

## 11. Project structure

```
frontend/src/
├── main.tsx                app bootstrap
├── app/
│   ├── router.tsx           route table, lazy boundaries
│   ├── providers.tsx        QueryClient, auth, toast, error boundary
│   └── shell/               AppShell, SideNav, TopBar, Breadcrumbs, CommandPalette
├── features/
│   ├── home/  workspace/  command/
│   ├── engagement/          Engagement Setup: LE master, configuration
│   ├── financial-data-layer/  TB, JE, FSLI mapping
│   ├── fx/  ice/  consolidation/  gaap/
│   ├── reporting/           statements, notes, bridges, single-entity FS
│   ├── disclosure/          disclosure library, sentinel
│   ├── pmo/  teams/  settings/  guide/
├── shared/
│   ├── tokens/tokens.css
│   ├── ui/                  Surface, Card, Button, Field, Toggle, Pill, Toast, Modal…
│   ├── grid/                DataGrid, useColumnState, useSelectionAnchor, useFullscreen
│   ├── api/                 generated/  client.ts  queryKeys.ts  errors.ts
│   ├── auth/                session.ts  useGrant.ts  Gate.tsx
│   ├── money/               format.ts (decimal.js, display only)
│   └── hooks/
└── test-setup.ts
```

Aliases: `@` → `src`, `@shared`, `@features` (already configured in
`vite.config.ts`).

## 12. Route map and screen inventory

Route keys match the prototype. All routes lazy-load; the grid stack is a separate
chunk (`manualChunks.grid`) loaded only on data-heavy routes.

| Route | Screen | Notes |
| --- | --- | --- |
| `home` | Landing | Canvas-animated hero; full-bleed, `padding: 8px` |
| `workspace` | My Workspace | Tile grid of engagements |
| `command` | Command Center | Close status overview |
| `engagement` | Engagement Setup | Tabs: Legal Entity Master, Engagement Configuration; ingestion steps for TB and Top-side JE with frequency selectors |
| `upload` | Financial Data Layer | Tabs: `tb` Trial Balance, `je` Journal Entries, `fsli` FSLI Mapping |
| `master` | Master Data | Reference data |
| `consol` | Consolidation Cycle | Stepper root |
| `fx` | Currency Translation | Rate matrix, translation results, fullscreen grid |
| `ice` | Intercompany (ICE) | Matching, residuals, registers E1–E9 |
| `gaap` | GAAP Conversion | Framework switch, adjustment list |
| `buscomb` | PPA Accounting | Business combination |
| `proforma` | Proformas | |
| `carve` | Divestiture | |
| `repanalytics` | Reporting & Analytics | Statement faces, notes editor, comment overlay |
| `reporting` | Reporting Hub | |
| `bridges` | Bridge Reports | |
| `fs` | Single-Entity FS | |
| `sentinel` | Disclosure Sentinel | |
| `disclib` | Disclosure insights | Library menu → detail views |
| `intake` | Project Intake Form | |
| `pmo` | Manage Assignments | `mytasks` is the same route with `pmoMine` on |
| `mytasks` | My Tasks | |
| `access` | Manage Teams | Members, roles, overrides, Section ACL tab |
| `assistant` | AI Assistant | |
| `userguide` | User Instructions | |
| `feedback` | Feedback Form | |
| `reachus` | Reach Us | Modal, not a page |
| `config` | Settings | |

Stepper order: `consol → gaap → reporting → fs → bridges`.

Nav sections: Top, Workspace, Engagement Setup, Projects, Module Integration,
Output & Reporting, Reporting & Analytics, Delivery, Teams, Disclosure insights,
Bottom.

## 13. Component trees (representative screens)

### 13.1 Shell

```
<AppShell>
├── <SideNav collapsed>            208px / 68px; sections collapsible
│   ├── <NavBrand>
│   ├── <NavSection>* → <NavItem>* (optional module toggle switch)
│   ├── <DarkModeToggle>
│   └── <NavFooter> Settings
├── <TopBar>
│   ├── <Breadcrumbs>              route chain + active tab pill, scroll-pinned right
│   ├── <CommandPaletteTrigger>    ⌘K
│   ├── <PresenceStack>
│   └── <UserMenu>
└── <RouteOutlet>                  Suspense + ErrorBoundary per route
```

### 13.2 `engagement` — Legal Entity Master

```
<EngagementSetupPage>
├── <StepPills>                    Set once | Recurring ingestion tags
│   ├── Legal Entity Master        (set once)
│   ├── Engagement Configuration   (set once)
│   ├── TB Load                    (recurring) + <FrequencySelect>
│   └── Top Side JE's upload       (recurring) + <FrequencySelect>
├── <LegalEntityToolbar>           search, column filters, add, import, fullscreen
└── <DataGrid>                     18 columns, sticky LE-code column
    ├── <EditableHeaderCell>*      rename persists to colNames
    ├── <FilterRow>
    └── <VirtualRows> → <Cell>*
```

### 13.3 `upload` — Trial Balance

```
<FinancialDataLayerPage>
├── <TabBar tb | je | fsli>
├── <PeriodScenarioBar>            period, scenario, entity multiselect
├── <UploadDropzone>               batch create; findings panel
├── <BatchFindings>                errors block commit, warnings do not
└── <TbGrid>                       virtualised rows and columns
    ├── <FrozenColumns>            entity, account
    ├── <EditableCell>             optimistic; rejects when period LOCKED
    └── <GridFooter>               control totals, debit/credit balance flag
```

### 13.4 `repanalytics` — statements and notes

```
<ReportingAnalyticsPage>
├── <StatementSwitch BS | IS | OCI | CF | SOCE>
├── <FaceTree>                     hierarchical FSLI rows, per-entity columns
├── <NotesEditor>                  reorderable blocks, lock treatments
│   ├── <NoteBlock>* → <LockBadge> <BodyCapToggle> <LevelControl>
├── <CommentOverlay>               text-anchored; quote + offsets
└── <FullscreenLayer>              z-index driven, not navigation
```

## 14. State model

| State kind | Home | Examples |
| --- | --- | --- |
| Server state | TanStack Query | Entities, TB pages, runs, statements, team, comments |
| Session | `shared/auth/session.ts` (oidc-client-ts + Zustand) | Tokens, user, role, permissions, section ACL |
| Cross-route UI state | Zustand store per feature | Nav collapsed, active tabs (`esTab`, `fdlTab`), module toggles, dark mode |
| Ephemeral view state | `useState` / `useReducer` in the screen | Selection anchor, drag target, fullscreen flag, rename buffer, column widths |
| Derived | `useMemo` selectors | Totals shown for reconciliation only, never a published figure |

Rules:

1. Nothing in Query that the server does not own.
2. Nothing in Zustand that Query owns — no manual copies of server data.
3. Fullscreen is a z-index state, never a route.
4. Persisted UI state (column widths, renamed headers, collapsed sections) goes to
   `localStorage` under `fusion-close:<userId>:<key>`, and is never trusted as
   input to a request.

## 15. API client and query keys

```ts
// generated from the backend OpenAPI document
import type { paths } from '@shared/api/generated/schema';

export const qk = {
  me: ['me'] as const,
  engagements: (workspaceId?: string) => ['engagements', { workspaceId }] as const,
  engagement: (id: string) => ['engagement', id] as const,
  periods: (engagementId: string) => ['engagement', engagementId, 'periods'] as const,
  entities: (engagementId: string, filters: EntityFilters) =>
    ['engagement', engagementId, 'entities', filters] as const,
  entityGraph: (engagementId: string) =>
    ['engagement', engagementId, 'entities', 'graph'] as const,
  tb: (engagementId: string, q: TbQuery) => ['engagement', engagementId, 'tb', q] as const,
  batch: (batchId: string) => ['ingestion', 'batch', batchId] as const,
  fxRates: (engagementId: string, periodKey: string) =>
    ['engagement', engagementId, 'fx-rates', periodKey] as const,
  icMatches: (engagementId: string, periodKey: string) =>
    ['engagement', engagementId, 'ic', 'matches', periodKey] as const,
  run: (runId: string) => ['run', runId] as const,
  runPostings: (runId: string, f: PostingFilters) => ['run', runId, 'postings', f] as const,
  statement: (engagementId: string, statement: Statement, q: StatementQuery) =>
    ['engagement', engagementId, 'statement', statement, q] as const,
  team: (engagementId: string) => ['engagement', engagementId, 'team'] as const,
  comments: (engagementId: string, route?: string) =>
    ['engagement', engagementId, 'comments', { route }] as const,
};
```

Key discipline: hierarchical and prefix-invalidatable. Committing a batch
invalidates `['engagement', id, 'tb']` and `['engagement', id, 'statement']`
wholesale rather than surgically — correctness over cleverness on a close screen.

Polling: `batch` and `run` use `refetchInterval` while status is non-terminal,
then stop. No websockets in v1; presence uses a short poll.

Defaults: `staleTime` 30s for reference data, 0 for figures; `retry` 1;
`refetchOnWindowFocus` true for run status, false for large grids.

## 16. Grid design for large trial balances

| Concern | Approach |
| --- | --- |
| Row volume | `@tanstack/react-virtual` row virtualisation; window of visible rows + overscan 12 |
| Column volume | Column virtualisation on entity-per-column views; frozen leading columns rendered outside the virtual window |
| Server paging | Cursor pagination, `limit` 500, infinite query; the virtualiser drives prefetch at 80% scroll |
| Cell edit | Optimistic mutation with rollback on error; `PERIOD_LOCKED` surfaces as a toast plus a row-level marker |
| Multi-select | `useSelectionAnchor` — shift extends from a stored anchor, ⌘/ctrl toggles; selection lives in component state, never in Query |
| Column state | `useColumnState` — widths, order, visibility, renamed headers; persisted to `localStorage` |
| Fullscreen | `useFullscreen` raises a z-index layer; scroll position preserved on exit |
| Totals | Server-supplied control totals; client-side sums are display aids marked as such |
| Formatting | `decimal.js` for grouping and scale only; the string from the API is the value of record |

Performance budget: 60fps scroll at 50k rows on a mid-range laptop; keystroke to
cell-render under 16ms; no layout thrash from measuring rows (fixed row height).

## 17. Design tokens and theming contract

`shared/tokens/tokens.css` is the only place a colour, radius, shadow or type size
is defined. Components consume custom properties; a literal hex in a component is
a review failure and is caught by a lint rule.

| Token group | Contents |
| --- | --- |
| Surface | Background ramp, card fill, inset well fill, hairline borders |
| Elevation | The dual soft-shadow pairs the neumorphic surface system depends on |
| Accent | Primary blue gradient stops, link colour, focus ring |
| Semantic | Success, warning, danger, info — used for findings and lock states |
| Type | Serif stack, size scale, weights, letter-spacing |
| Radius / spacing | Radius scale, spacing scale |
| Motion | Durations and easings for hover, panel, toast |

Dark mode is a token override under a `[data-theme="dark"]` scope; components do
not branch on theme. The nav's dark-mode toggle sets the attribute and persists
the choice per user.

## 18. Form validation (Zod)

One schema per form, colocated with the feature, inferring the TypeScript type.
Client validation is for feedback only; the backend re-validates everything.

```ts
export const legalEntitySchema = z.object({
  leCode: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/),
  leName: z.string().min(1).max(200),
  parentEntityId: z.string().uuid().nullable(),
  entityType: z.enum(['PARENT','SUBSIDIARY','ASSOCIATE','JV','BRANCH','SPE']),
  country: z.string().length(2),
  ownershipDirectPct: decimalPct,          // string, 0–100, ≤6 dp
  ownershipIndirectPct: decimalPct,
  nciPct: decimalPct,
  consolidationPct: decimalPct,
  consolidationMethod: z.enum(['FULL','EQUITY','PROPORTIONATE','NOT_CONSOLIDATED']),
  consolidationStructure: z.string().max(60).nullable(),
  localCurrency: iso4217, functionalCurrency: iso4217, reportingCurrency: iso4217,
  entityClassification: z.string().max(60).nullable(),
  fiscalYearEnd: z.string().regex(/^\d{2}-\d{2}$/),
  primaryGaap: z.string(), secondaryGaap: z.string().nullable(),
  acquisitionDate: isoDate.nullable(), disposalDate: isoDate.nullable(),
}).refine(v => v.consolidationMethod !== 'FULL'
            || eqDec(add(v.ownershipDirectPct, v.ownershipIndirectPct, v.nciPct), '100'),
          { message: 'Ownership plus NCI must equal 100% under full consolidation',
            path: ['nciPct'] });

// decimalPct / iso4217 / isoDate live in shared/api/scalars.ts.
// Every monetary and percentage field is a STRING schema. No z.number() on a figure.
```

Server errors map onto fields by `details` path; unmapped codes surface as a form
banner using the message from the error envelope.

## 19. Authentication flow

```
 unauthenticated route hit
        │
        ▼
 oidc-client-ts → Keycloak authorization code + PKCE
        │
        ├─ MFA required?           → Keycloak TOTP challenge
        ├─ password rotation due?  → Keycloak required action (first login)
        ▼
 redirect back → token in memory, refresh via silent renew (hidden iframe)
        │
        ▼
 GET /me → role, permissions, sectionAcl → session store
        │
        ▼
 router resolves; nav sections filtered by grant
```

Details:

- Access token in memory only; refresh handled by silent renew. No token in
  `localStorage`.
- 401 from any request clears the session and returns to sign-in with a return
  path.
- Token refresh failure during an unsaved edit shows a re-authenticate modal
  rather than discarding the edit.
- The login screen (`Fusion Close Login`) covers sign-in, error state, and
  first-time password set; the states map onto Keycloak required actions.

## 20. Permission gating in the UI

```tsx
const grant = useGrant();

grant.role                                  // Role
grant.isExternal                            // Role.isExternal()
grant.can('PUBLISH_STATEMENTS')             // per-user override
grant.section('notes.related-party')         // 'NONE' | 'VIEW' | 'EDIT'
grant.canEditPeriod(periodKey)              // false when LOCKED

<Gate section="notes.related-party" require="EDIT">
  <NoteEditor …/>
</Gate>
```

Rules:

1. The UI hides and disables; the server decides. A hidden control has a matching
   server-side check.
2. `SECTION_HIDDEN` is returned as 404 by design — the UI must not distinguish
   "you may not see this" from "this does not exist".
3. The Favorites rail and cross-engagement navigation are suppressed for
   `grant.isExternal`. **This replaces the prototype's local `extClient`
   boolean** — the flag is a known prototype shortcut and must be wired to
   `Role.isExternal()`.
4. A locked period disables every figure-editing affordance and shows the lock
   holder and timestamp on hover.

## 21. Accessibility and keyboard model

| Area | Behaviour |
| --- | --- |
| Focus | Visible focus ring from tokens on every interactive element; never removed |
| Grid | Arrow keys move the active cell, Tab leaves the grid, Enter edits, Esc cancels, shift+arrow extends selection from the anchor, ⌘/ctrl+A selects the page |
| Fullscreen layer | Focus trapped, Esc exits, focus restored to the trigger |
| Modals and drawers | Focus trapped, labelled by their heading, Esc closes unless a form is dirty |
| Command palette | ⌘K opens, arrow keys navigate, Enter activates, Esc closes; results are a listbox |
| Nav | Landmark `<nav>`, section headers as buttons with `aria-expanded`, current route `aria-current="page"` |
| Tables | Real `<table>` semantics with `<th scope>`; virtualisation preserves row/column counts via `aria-rowcount` and `aria-colcount` |
| Announcements | Findings, lock changes and run completion announced via a polite live region |
| Contrast | Minimum 4.5:1 for body text and 3:1 for large text and UI borders — checked against the token ramp, which the neumorphic surfaces make easy to get wrong |
| Motion | All transitions respect `prefers-reduced-motion`; the canvas hero on `home` degrades to a static frame |
| Zoom | Layout usable to 200% zoom; grids scroll rather than clip |

## 22. Frontend test strategy

| Layer | Instrument | What it proves |
| --- | --- | --- |
| Units | Vitest | Money formatting, Zod schemas, grant resolution, selection-anchor reducer |
| Components | Testing Library | Grid keyboard model, editable header rename, lock-disabled affordances, Gate hiding |
| Contract | `openapi-typescript` + `tsc -b` | A backend contract change fails the build |
| Integration | Testing Library + MSW | Upload → findings → commit; run polling to completion; 401 recovery |
| Accessibility | `@testing-library/jest-dom` + axe on key screens | No violations on shell, LE master, TB grid, notes editor |
| Visual | Snapshot of token output | An unintended token change is visible in review |

`npm run lint` runs with `--max-warnings 0`. `npm run typecheck` is a gate, with
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on.

---

## 23. Traceability

| HLD driver | LLD sections |
| --- | --- |
| D1 exact figures | §2, §4.5, §7.2, §10 (property tests), §14, §18 |
| D2 tenant isolation | §3.1, §4, §10 (RLS tests) |
| D3 period locks | §4.1, §6, §7.3, §20 |
| D4 auditable rules | §4.7, §4.8, §7.2, §10 |
| D5 design fidelity | §11, §13, §17 |
| D6 large trial balances | §4.4, §8, §16 |
| D7 durable runs | §4.8, §8 |
| D8 server-side exports | §5.1 (`/exports`), §8 |

## 24. Open items carried from the HLD

| # | Item | Effect on this LLD |
| --- | --- | --- |
| OQ-2 | Data residency — hard requirement or default | If hard: region-pinned object store buckets, per-region job placement, and a residency check in `ExportService`. Section §8 and §5.1 `/exports` would gain a region assertion. Unresolved. |
| — | Sample data and `image-slot.js` placeholders from the handoff | Must be removed before any release; they are scaffolding |
| — | Prototype `extClient` boolean | Replaced by `Role.isExternal()` per §20 rule 3 |
