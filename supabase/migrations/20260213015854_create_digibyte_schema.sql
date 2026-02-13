/*
  # Digibyte Computer Shop Tournament System

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `team_name` (text, unique)
      - `team_captain` (text)
      - `team_members` (text array)
      - `team_photo` (text, URL)
      - `fb` (text, Facebook contact)
      - `contact_no` (text)
      - `paid` (boolean, default false)
      - `created_at` (timestamp)
      - `created_by` (uuid, references auth.users)
    
    - `tournaments`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `rules` (text)
      - `status` (text, active/completed)
      - `start_date` (timestamp)
      - `created_at` (timestamp)
    
    - `champions`
      - `id` (uuid, primary key)
      - `team_id` (uuid, references teams)
      - `tournament_id` (uuid, references tournaments)
      - `position` (integer, 1=champion, 2=first runner up, 3=second runner up)
      - `week` (integer)
      - `year` (integer)
      - `created_at` (timestamp)
    
    - `brackets`
      - `id` (uuid, primary key)
      - `tournament_id` (uuid, references tournaments)
      - `team1_id` (uuid, references teams)
      - `team2_id` (uuid, references teams)
      - `round` (integer)
      - `match_number` (integer)
      - `winner_id` (uuid, references teams)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Public can read tournaments and champions
    - Public can insert teams (registration)
    - Authenticated users (admin) can manage all data
*/

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text UNIQUE NOT NULL,
  team_captain text NOT NULL,
  team_members text[] DEFAULT '{}',
  team_photo text,
  fb text,
  contact_no text NOT NULL,
  paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  rules text,
  status text DEFAULT 'active',
  start_date timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create champions table
CREATE TABLE IF NOT EXISTS champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  position integer NOT NULL,
  week integer,
  year integer,
  created_at timestamptz DEFAULT now()
);

-- Create brackets table
CREATE TABLE IF NOT EXISTS brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  team1_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  team2_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  round integer NOT NULL,
  match_number integer NOT NULL,
  winner_id uuid REFERENCES teams(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE champions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brackets ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Anyone can view teams"
  ON teams FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can register a team"
  ON teams FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete teams"
  ON teams FOR DELETE
  TO authenticated
  USING (true);

-- Tournaments policies
CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage tournaments"
  ON tournaments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Champions policies
CREATE POLICY "Anyone can view champions"
  ON champions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage champions"
  ON champions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Brackets policies
CREATE POLICY "Anyone can view brackets"
  ON brackets FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage brackets"
  ON brackets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);