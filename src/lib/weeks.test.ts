import { describe, expect, it } from "vitest";
import {
  formatDayDate,
  formatWeekLabel,
  getDateForDay,
  getDayName,
  getDayShortName,
  getNextNWeeks,
  weekStart,
} from "./weeks";

describe("weeks logic", () => {
  it("calculates weekStart correctly (anchored to Monday)", () => {
    // 2026-09-24 is a Thursday
    expect(weekStart(new Date(2026, 8, 24))).toBe("2026-09-21");
    // 2026-09-21 is a Monday
    expect(weekStart(new Date(2026, 8, 21))).toBe("2026-09-21");
    // 2026-09-27 is a Sunday
    expect(weekStart(new Date(2026, 8, 27))).toBe("2026-09-21");
    // 2026-09-28 is next Monday
    expect(weekStart(new Date(2026, 8, 28))).toBe("2026-09-28");
  });

  it("handles year boundary in weekStart", () => {
    // 2027-01-01 is Friday, week started 2026-12-28
    expect(weekStart(new Date(2027, 0, 1))).toBe("2026-12-28");
  });

  it("generates next N weeks", () => {
    const weeks = getNextNWeeks(3, new Date(2026, 8, 24)); // Sep 24, 2026
    expect(weeks.length).toBe(3);
    expect(weeks[0].value).toBe("2026-09-21");
    expect(weeks[1].value).toBe("2026-09-28");
    expect(weeks[2].value).toBe("2026-10-05");
  });

  it("formats day names and week labels", () => {
    expect(getDayName(0)).toBe("Monday");
    expect(getDayName(3)).toBe("Thursday");
    expect(getDayShortName(6)).toBe("Sun");
    expect(formatWeekLabel("2026-09-21")).toContain("Week of 21 Sep 2026");
    expect(formatDayDate("2026-09-21", 3)).toContain("Thu, 24 Sep");
  });

  it("returns correct Date for day index", () => {
    const d = getDateForDay("2026-09-21", 3);
    expect(d.getDate()).toBe(24);
    expect(d.getMonth()).toBe(8); // Sept
  });
});
