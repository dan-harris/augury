import { describe, expect, it } from "vitest";
import {
  getBestDay,
  getClosestDay,
  getProgressCopy,
  getViableDays,
  type TallyRow,
} from "./viability";

describe("viability logic", () => {
  const sampleTallies: TallyRow[] = [
    { day: 0, yes_count: 2, voter_ids: ["p1", "p2"] },
    { day: 1, yes_count: 4, voter_ids: ["p1", "p2", "p3", "p4"] },
    { day: 3, yes_count: 4, voter_ids: ["p1", "p2", "p3", "p4"] },
    { day: 4, yes_count: 1, voter_ids: ["p1"] },
  ];

  it("identifies viable days meeting threshold", () => {
    expect(getViableDays(sampleTallies, 4)).toEqual([1, 3]);
    expect(getViableDays(sampleTallies, 5)).toEqual([]);
    expect(getViableDays(sampleTallies, 2)).toEqual([0, 1, 3]);
  });

  it("calculates best day with earliest-in-week tiebreak", () => {
    // day 1 and day 3 both have 4 votes; day 1 is earlier in week
    expect(getBestDay(sampleTallies, 4)).toBe(1);

    const singleTop: TallyRow[] = [
      { day: 0, yes_count: 1, voter_ids: [] },
      { day: 3, yes_count: 3, voter_ids: [] },
    ];
    expect(getBestDay(singleTop, 4)).toBe(3);
  });

  it("returns null for best day if no positive votes exist", () => {
    const zeroVotes: TallyRow[] = [
      { day: 0, yes_count: 0, voter_ids: [] },
      { day: 1, yes_count: 0, voter_ids: [] },
    ];
    expect(getBestDay(zeroVotes, 4)).toBeNull();
  });

  it("formats progress copy", () => {
    expect(getProgressCopy(3, 4)).toBe("3 of 4 needed");
    expect(getProgressCopy(4, 4)).toBe("4 votes (viable!)");
  });

  it("calculates closest day when nothing is viable", () => {
    // Threshold = 5, no day meets 5. Day 1 and Day 3 have 4 votes, Day 1 is earlier.
    expect(getClosestDay(sampleTallies, 5)).toEqual({ day: 1, yes_count: 4 });

    // If a day is viable, getClosestDay returns null
    expect(getClosestDay(sampleTallies, 4)).toBeNull();

    // If zero votes everywhere
    const zeroVotes: TallyRow[] = [
      { day: 0, yes_count: 0, voter_ids: [] },
    ];
    expect(getClosestDay(zeroVotes, 4)).toBeNull();
  });
});
