import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Team = {
  id: string;
  team_name: string;
  team_captain: string;
  team_members: string[];
  team_photo?: string;
  fb?: string;
  contact_no: string;
  paid: boolean;
  created_at: string;
};

export type Tournament = {
  id: string;
  title: string;
  description?: string;
  rules?: string;
  status: string;
  start_date?: string;
  created_at: string;
};

export type Champion = {
  id: string;
  team_id: string;
  tournament_id: string;
  position: number;
  week?: number;
  year?: number;
  created_at: string;
  teams?: Team;
};

export type Bracket = {
  id: string;
  tournament_id: string;
  team1_id?: string;
  team2_id?: string;
  round: number;
  match_number: number;
  winner_id?: string;
  created_at: string;
};
