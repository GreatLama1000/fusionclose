-- Engagement Configuration is now saved one row per legal entity (the LE Names picked in field A1),
-- still as jsonb. Key changes from (engagement_id) to (engagement_id, le_name).

ALTER TABLE engagement_config ADD COLUMN IF NOT EXISTS le_name text;

-- rows saved before this migration belong to the entity named in their answers
UPDATE engagement_config
   SET le_name = COALESCE(NULLIF(config ->> 'entity_name', ''), '(unassigned)')
 WHERE le_name IS NULL;

ALTER TABLE engagement_config ALTER COLUMN le_name SET NOT NULL;
ALTER TABLE engagement_config ADD CONSTRAINT engagement_config_le_name_check CHECK (le_name <> '');
ALTER TABLE engagement_config ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE engagement_config DROP CONSTRAINT engagement_config_pkey;
ALTER TABLE engagement_config ADD PRIMARY KEY (engagement_id, le_name);
