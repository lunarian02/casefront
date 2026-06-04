-- Migrate recording_case_links: case_type → category + subcategory

-- Add new columns
ALTER TABLE recording_case_links
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Migrate existing data
UPDATE recording_case_links
SET
  category = SPLIT_PART(case_type, '-', 1),
  subcategory = NULLIF(SPLIT_PART(case_type, '-', 2), '')
WHERE case_type IS NOT NULL AND category IS NULL;

-- Drop old column
ALTER TABLE recording_case_links DROP COLUMN IF EXISTS case_type;

-- Add comments
COMMENT ON COLUMN recording_case_links.category IS '대분류: 형사, 민사, 가사, 부동산, 노동, 행정';
COMMENT ON COLUMN recording_case_links.subcategory IS '소분류: 폭행, 사기, 이혼 등';
