-- Fix RLS policies to work with authenticated users
-- This ensures authenticated users (admin) can update and delete teams

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Authenticated users can update teams" ON teams;
DROP POLICY IF EXISTS "Allow team updates" ON teams;

-- Create policy that allows authenticated users to update teams
CREATE POLICY "Authenticated users can update teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Authenticated users can delete teams" ON teams;
DROP POLICY IF EXISTS "Allow team deletes" ON teams;

-- Create policy that allows authenticated users to delete teams
CREATE POLICY "Authenticated users can delete teams"
  ON teams FOR DELETE
  TO authenticated
  USING (true);
