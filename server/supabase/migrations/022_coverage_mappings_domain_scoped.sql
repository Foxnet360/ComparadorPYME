-- Migration: coverage_mappings domain-scoped uniqueness
-- Created: 2026-07-22
--
-- 1. Backfill domain='pyme' where it is missing.
-- 2. Deduplicate rows with the same (domain, COALESCE(insurer_name,''), raw_name)
--    using a deterministic tie-breaker: highest user_corrected, then highest
--    correction_count, then most recent updated_at, then lowest id.
-- 3. Validate that no duplicates remain.
-- 4. Drop the old unique index.
--
-- Rollback:
--   CREATE UNIQUE INDEX idx_coverage_mappings_unique
--   ON coverage_mappings(raw_name, COALESCE(insurer_name,''));
--   DROP INDEX IF EXISTS idx_coverage_mappings_domain_unique;

BEGIN;

-- 1. Backfill domain for rows that predate the domain column.
UPDATE coverage_mappings
SET domain = 'pyme'
WHERE domain IS NULL OR domain = '';

-- 2. Deduplicate with deterministic survivor selection and merge correction_count.
WITH ranked AS (
  SELECT
    id,
    domain,
    COALESCE(insurer_name, '') AS insurer_name_norm,
    raw_name,
    user_corrected,
    correction_count,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY domain, COALESCE(insurer_name, ''), raw_name
      ORDER BY
        user_corrected DESC,
        correction_count DESC,
        updated_at DESC,
        id ASC
    ) AS rn
  FROM coverage_mappings
),
to_delete AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
),
survivors AS (
  SELECT
    r.domain,
    r.insurer_name_norm,
    r.raw_name,
    SUM(r.correction_count) AS total_correction_count,
    BOOL_OR(r.user_corrected) AS any_user_corrected
  FROM ranked r
  GROUP BY r.domain, r.insurer_name_norm, r.raw_name
)
UPDATE coverage_mappings cm
SET
  correction_count = s.total_correction_count,
  user_corrected = s.any_user_corrected
FROM survivors s
WHERE cm.domain = s.domain
  AND COALESCE(cm.insurer_name, '') = s.insurer_name_norm
  AND cm.raw_name = s.raw_name
  AND cm.id NOT IN (SELECT id FROM to_delete);

DELETE FROM coverage_mappings
WHERE id IN (SELECT id FROM to_delete);

-- 3. Validate uniqueness before applying the new index.
DO $$
DECLARE
  total_count BIGINT;
  distinct_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM coverage_mappings;
  SELECT COUNT(DISTINCT domain || ':' || COALESCE(insurer_name, '') || ':' || raw_name)
    INTO distinct_count FROM coverage_mappings;

  IF total_count != distinct_count THEN
    RAISE EXCEPTION
      'coverage_mappings still has duplicates after dedup (total=%, distinct=%)',
      total_count, distinct_count;
  END IF;
END $$;

-- 4. Drop the old unique index so the new domain-scoped index can replace it.
DROP INDEX IF EXISTS idx_coverage_mappings_unique;

COMMIT;
