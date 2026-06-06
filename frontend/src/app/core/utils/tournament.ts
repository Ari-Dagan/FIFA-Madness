// First match: Mexico vs. Canada, Jun 11 2026 19:00 UTC (3:00 PM ET)
export const TOURNAMENT_LOCK_TIME = new Date('2026-06-11T19:00:00Z');

export function isTournamentStarted(): boolean {
  return new Date() >= TOURNAMENT_LOCK_TIME;
}

export function formatLockTime(): string {
  return TOURNAMENT_LOCK_TIME.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  });
}
