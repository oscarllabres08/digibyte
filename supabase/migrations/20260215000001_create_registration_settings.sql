-- Create registration_settings table
-- This table will have a single row to control registration status
CREATE TABLE IF NOT EXISTS registration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_registration_active boolean DEFAULT true,
  player_registration_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default settings (both active by default) only if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM registration_settings LIMIT 1) THEN
    INSERT INTO registration_settings (team_registration_active, player_registration_active)
    VALUES (true, true);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE registration_settings ENABLE ROW LEVEL SECURITY;

-- Registration settings policies
CREATE POLICY "Anyone can view registration settings"
  ON registration_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can update registration settings"
  ON registration_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_registration_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_registration_settings_timestamp
  BEFORE UPDATE ON registration_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_registration_settings_updated_at();
