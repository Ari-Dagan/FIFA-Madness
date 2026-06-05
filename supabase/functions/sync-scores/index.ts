import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FOOTBALL_DATA_API_KEY = Deno.env.get('FOOTBALL_DATA_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Normalize team names from football-data.org to match our DB
const TEAM_ALIASES: Record<string, string> = {
  'Turkey': 'Türkiye',
  "Côte d'Ivoire": 'Ivory Coast',
  'Congo DR': 'Congo DR',
  'DR Congo': 'Congo DR',
  'Democratic Republic of Congo': 'Congo DR',
  'Congo, DR': 'Congo DR',
  'Cape Verde Islands': 'Cape Verde',
  'Curacao': 'Curaçao',
  'United States': 'USA',
  'USA': 'USA',
  'Korea Republic': 'South Korea',
  'Bosnia and Herzegovina': 'Bosnia and Herzegovina',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Scotland': 'Scotland',
  'England': 'England',
  'Croatia': 'Croatia',
};

function normalize(name: string): string {
  return TEAM_ALIASES[name] ?? name;
}

interface FDScore {
  home: number | null;
  away: number | null;
}

interface FDMatch {
  status: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    fullTime: FDScore;
    halfTime: FDScore;
  };
  minute?: number;
}

interface OurMatch {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_utc: string;
}

Deno.serve(async (_req) => {
  if (!FOOTBALL_DATA_API_KEY) {
    return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_API_KEY not set' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: matches, error: matchError } = await supabase
    .from('matches')
    .select('id, home_team, away_team, kickoff_utc');

  if (matchError) {
    return new Response(JSON.stringify({ error: matchError.message }), { status: 500 });
  }

  // Only poll during active windows: 0–3h after kickoff
  const now = new Date();
  const activeMatches = (matches as OurMatch[]).filter(m => {
    const kickoff = new Date(m.kickoff_utc);
    const msElapsed = now.getTime() - kickoff.getTime();
    return msElapsed > -5 * 60 * 1000 && msElapsed < 3 * 60 * 60 * 1000;
  });

  if (activeMatches.length === 0) {
    return new Response(
      JSON.stringify({ message: 'No active match windows', checked: (matches as OurMatch[]).length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fetch all WC matches from football-data.org
  const fdRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY },
  });

  if (!fdRes.ok) {
    return new Response(
      JSON.stringify({ error: 'football-data.org request failed', httpStatus: fdRes.status }),
      { status: 502 }
    );
  }

  const { matches: fdMatches }: { matches: FDMatch[] } = await fdRes.json();
  let synced = 0;
  let skipped = 0;

  for (const ourMatch of activeMatches) {
    const fdMatch = fdMatches.find(m =>
      normalize(m.homeTeam.name) === ourMatch.home_team &&
      normalize(m.awayTeam.name) === ourMatch.away_team
    );

    if (!fdMatch) { skipped++; continue; }

    const status = fdMatch.status;
    if (status === 'TIMED' || status === 'SCHEDULED') continue;

    const isLive = status === 'IN_PLAY' || status === 'PAUSED' || status === 'EXTRA_TIME' || status === 'PENALTY_SHOOTOUT';
    const isFinished = status === 'FINISHED';

    if (!isLive && !isFinished) continue;

    const homeScore = fdMatch.score.fullTime.home ?? fdMatch.score.halfTime.home ?? 0;
    const awayScore = fdMatch.score.fullTime.away ?? fdMatch.score.halfTime.away ?? 0;

    let outcome: string | null = null;
    if (isFinished) {
      if (homeScore > awayScore) outcome = 'home';
      else if (awayScore > homeScore) outcome = 'away';
      else outcome = 'draw';
    }

    // Don't overwrite manually-entered finished results
    const { data: existing } = await supabase
      .from('results')
      .select('status, entered_by')
      .eq('match_id', ourMatch.id)
      .single();

    if (existing?.status === 'finished' && existing?.entered_by !== null) {
      // Admin manually entered a final result — respect it
      continue;
    }

    const { error: upsertError } = await supabase
      .from('results')
      .upsert({
        match_id: ourMatch.id,
        home_score: homeScore,
        away_score: awayScore,
        outcome,
        status: isFinished ? 'finished' : 'live',
        entered_by: null, // null = auto-synced
        entered_at: new Date().toISOString(),
      }, { onConflict: 'match_id' });

    if (upsertError) continue;

    // Grade picks only on final result
    if (isFinished && outcome) {
      const { data: picks } = await supabase
        .from('picks')
        .select('id, pick')
        .eq('match_id', ourMatch.id);

      if (picks?.length) {
        await Promise.all(
          (picks as { id: string; pick: string }[]).map(p =>
            supabase.from('picks').update({ is_correct: p.pick === outcome }).eq('id', p.id)
          )
        );
      }
    }

    synced++;
  }

  return new Response(
    JSON.stringify({ message: 'Sync complete', synced, skipped, activeWindows: activeMatches.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
