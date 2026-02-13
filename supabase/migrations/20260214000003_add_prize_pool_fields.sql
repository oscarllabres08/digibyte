-- Add prize pool fields to tournaments table
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS prize_1st text,
ADD COLUMN IF NOT EXISTS prize_2nd text,
ADD COLUMN IF NOT EXISTS prize_3rd text;
