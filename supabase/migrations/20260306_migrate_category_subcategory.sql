-- Migrate case_type to category + subcategory

-- ============================================================
-- Step 1: Add new columns to reports
-- ============================================================
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Migrate existing data from case_type
UPDATE reports
SET
  category = SPLIT_PART(case_type, '-', 1),
  subcategory = NULLIF(SPLIT_PART(case_type, '-', 2), '')
WHERE case_type IS NOT NULL AND category IS NULL;

-- Drop old column
ALTER TABLE reports DROP COLUMN IF EXISTS case_type;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_category_subcategory ON reports(category, subcategory);

-- ============================================================
-- Step 2: Add new columns to cases
-- ============================================================
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Migrate existing data from case_type
UPDATE cases
SET
  category = SPLIT_PART(case_type, '-', 1),
  subcategory = NULLIF(SPLIT_PART(case_type, '-', 2), '')
WHERE case_type IS NOT NULL AND category IS NULL;

-- Drop old column
ALTER TABLE cases DROP COLUMN IF EXISTS case_type;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category);
CREATE INDEX IF NOT EXISTS idx_cases_category_subcategory ON cases(category, subcategory);

-- ============================================================
-- Step 3: Update reports.structured JSONB structure
-- ============================================================
-- Note: This only updates the column structure
-- Actual data migration for structured.case_types → structured.category/subcategory
-- will be handled by application code during AI re-analysis

-- Add comments
COMMENT ON COLUMN reports.category IS '대분류: 형사, 민사, 가사, 부동산, 노동, 행정';
COMMENT ON COLUMN reports.subcategory IS '소분류: 폭행, 사기, 이혼 등';
COMMENT ON COLUMN cases.category IS '대분류: 형사, 민사, 가사, 부동산, 노동, 행정';
COMMENT ON COLUMN cases.subcategory IS '소분류: 폭행, 사기, 이혼 등';

-- ============================================================
-- Step 4: Verification queries (run manually to check)
-- ============================================================
-- Uncomment to run verification:

-- Check reports migration
-- SELECT category, subcategory, COUNT(*)
-- FROM reports
-- WHERE category IS NOT NULL
-- GROUP BY category, subcategory
-- ORDER BY category, subcategory;

-- Check cases migration
-- SELECT category, subcategory, COUNT(*)
-- FROM cases
-- WHERE category IS NOT NULL
-- GROUP BY category, subcategory
-- ORDER BY category, subcategory;

-- Check for unmigrated records (should be empty)
-- SELECT id, case_type FROM reports WHERE category IS NULL;
-- SELECT id, case_type FROM cases WHERE category IS NULL;
