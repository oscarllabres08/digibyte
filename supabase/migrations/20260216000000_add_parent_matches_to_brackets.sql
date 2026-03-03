-- Add parent_match1 and parent_match2 columns to brackets table
-- These columns track which matches feed into the current match
-- Used for bracket progression and team assignment

ALTER TABLE brackets
ADD COLUMN IF NOT EXISTS parent_match1 integer,
ADD COLUMN IF NOT EXISTS parent_match2 integer;

-- Add comment for documentation
COMMENT ON COLUMN brackets.parent_match1 IS 'Match number in previous round that feeds team1';
COMMENT ON COLUMN brackets.parent_match2 IS 'Match number in previous round that feeds team2';
