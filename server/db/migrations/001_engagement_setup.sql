-- Engagement Setup: Legal Entity Master + Engagement Configuration.
-- `engagement` is owned by V1 (see docs/design/LLD.md §4.1). The FK is attached
-- only when that table exists, so this file also runs against a bare dev database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS legal_entity_master (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id           uuid NOT NULL,
    le_code                 text NOT NULL CHECK (le_code <> ''),
    le_name                 text NOT NULL CHECK (le_name <> ''),
    parent_code             text,
    entity_type             text NOT NULL,
    country                 text NOT NULL,
    ownership_direct_pct    numeric(9,6) NOT NULL DEFAULT 0 CHECK (ownership_direct_pct BETWEEN 0 AND 100),
    ownership_indirect_pct  numeric(9,6) NOT NULL DEFAULT 0 CHECK (ownership_indirect_pct BETWEEN 0 AND 100),
    ownership_total_pct     numeric(9,6) NOT NULL CHECK (ownership_total_pct BETWEEN 0 AND 100),
    nci_pct                 numeric(9,6) CHECK (nci_pct BETWEEN 0 AND 100),
    consolidation_pct       numeric(9,6) CHECK (consolidation_pct BETWEEN 0 AND 100),
    consolidation_method    text NOT NULL,
    consolidation_structure text,
    local_currency          text NOT NULL,
    functional_currency     text NOT NULL,
    reporting_currency      text NOT NULL,
    classification          text,
    fiscal_year_end         text NOT NULL,
    primary_gaap            text NOT NULL,
    secondary_gaap          text,
    acquisition_date        date,
    disposal_date           date,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (engagement_id, le_code),
    CHECK (parent_code IS NULL OR parent_code <> le_code),
    CHECK (disposal_date IS NULL OR acquisition_date IS NULL OR disposal_date >= acquisition_date),
    -- a parent must be an entity of the same engagement; codes may be renamed in place
    FOREIGN KEY (engagement_id, parent_code)
        REFERENCES legal_entity_master (engagement_id, le_code) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS legal_entity_master_parent_idx ON legal_entity_master (engagement_id, parent_code);

CREATE TABLE IF NOT EXISTS engagement_config (
    engagement_id uuid PRIMARY KEY,
    -- answers keyed by form field; the form is branch-heavy so this stays schemaless
    config        jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
    version       integer NOT NULL DEFAULT 1,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF to_regclass('engagement') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_entity_master_engagement_fk') THEN
            ALTER TABLE legal_entity_master ADD CONSTRAINT legal_entity_master_engagement_fk
                FOREIGN KEY (engagement_id) REFERENCES engagement (id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'engagement_config_engagement_fk') THEN
            ALTER TABLE engagement_config ADD CONSTRAINT engagement_config_engagement_fk
                FOREIGN KEY (engagement_id) REFERENCES engagement (id);
        END IF;
    END IF;
END $$;
