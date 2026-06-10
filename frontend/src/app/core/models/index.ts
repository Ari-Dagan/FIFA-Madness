export interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Pool {
  id: string;
  name: string;
  join_code: string;
  admin_id: string;
  is_locked: boolean;
  tiebreaker_mode: 'usa_goals' | 'total_goals' | 'none';
  created_at: string;
}

export interface PoolMember {
  id: string;
  pool_id: string;
  user_id: string;
  tiebreaker_value?: number;
  joined_at: string;
  profiles?: Profile;
}

export interface Match {
  id: string;
  match_number: number;
  group_letter: string;
  home_team: string;
  away_team: string;
  home_team_flag?: string;
  away_team_flag?: string;
  kickoff_utc: string;
  kickoff_et: string;
  network: string;
  venue?: string;
  city?: string;
}

export interface Result {
  id: string;
  match_id: string;
  home_score?: number;
  away_score?: number;
  outcome?: Outcome;
  status?: 'live' | 'finished';
  entered_by?: string | null;
  entered_at: string;
}

export interface Pick {
  id: string;
  pool_id: string;
  user_id: string;
  match_id: string;
  pick: Outcome;
  is_correct?: boolean;
  updated_at: string;
}

export interface LeaderboardEntry {
  pool_id: string;
  user_id: string;
  display_name: string;
  tiebreaker_value?: number;
  correct_picks: number;
  total_picks: number;
  rank: number;
  max_possible_points: number;
  points_behind_leader: number;
  still_alive: boolean;
  pending_picks: number;
}

export interface PoolMessage {
  id: string;
  pool_id: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
}

export type Outcome = 'home' | 'draw' | 'away';
export type Network = 'FOX' | 'FS1' | 'TUBI' | 'FOX/TUBI' | 'TBD';
