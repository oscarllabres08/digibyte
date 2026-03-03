-- Add live_bracket_visible column to registration_settings table
ALTER TABLE registration_settings 
ADD COLUMN IF NOT EXISTS live_bracket_visible boolean DEFAULT true;

-- Update existing rows to have live_bracket_visible = true if null
UPDATE registration_settings 
SET live_bracket_visible = true 
WHERE live_bracket_visible IS NULL;
