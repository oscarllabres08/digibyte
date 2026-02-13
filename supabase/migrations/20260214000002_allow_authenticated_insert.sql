-- Ensure authenticated users can insert teams (for admin panel)
-- This is in addition to the public policy, ensuring admin can add teams

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authenticated users can insert teams" ON teams;

-- Create policy that allows authenticated users to insert teams
CREATE POLICY "Authenticated users can insert teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (true);
