/**
 * Viability and tally calculation helpers for Augury session polls.
 */

export interface TallyRow {
  day: number;
  yes_count: number;
  voter_ids: string[];
  viable?: boolean;
}

/**
 * Returns array of day indices that meet or exceed the viability threshold.
 */
export function getViableDays(tallies: TallyRow[], threshold: number): number[] {
  return tallies
    .filter((t) => t.yes_count >= threshold)
    .map((t) => t.day)
    .sort((a, b) => a - b);
}

/**
 * Returns best day index (most votes, earliest-in-week tiebreak).
 * Returns null if no positive votes exist.
 */
export function getBestDay(tallies: TallyRow[], _threshold: number): number | null {
  if (!tallies || tallies.length === 0) return null;

  let maxVotes = 0;
  let best: number | null = null;

  // Sort tallies by day ascending to ensure earliest day tiebreak
  const sorted = [...tallies].sort((a, b) => a.day - b.day);

  for (const t of sorted) {
    if (t.yes_count > maxVotes) {
      maxVotes = t.yes_count;
      best = t.day;
    }
  }

  return best;
}

/**
 * Formats progress copy, e.g. "3 of 4 needed".
 */
export function getProgressCopy(yesCount: number, threshold: number): string {
  if (yesCount >= threshold) {
    return `${yesCount} votes (viable!)`;
  }
  return `${yesCount} of ${threshold} needed`;
}

/**
 * Returns closest day when nothing is viable yet, or null if empty.
 */
export function getClosestDay(
  tallies: TallyRow[],
  threshold: number
): { day: number; yes_count: number } | null {
  const viable = getViableDays(tallies, threshold);
  if (viable.length > 0) return null; // Viable day exists

  if (!tallies || tallies.length === 0) return null;

  const sorted = [...tallies].sort((a, b) => a.day - b.day);
  let maxVotes = -1;
  let closest: TallyRow | null = null;

  for (const t of sorted) {
    if (t.yes_count > maxVotes) {
      maxVotes = t.yes_count;
      closest = t;
    }
  }

  if (!closest || closest.yes_count === 0) return null;

  return { day: closest.day, yes_count: closest.yes_count };
}
