/**
 * Monday-anchored ISO week helpers for Augury sessions.
 */

/**
 * Returns YYYY-MM-DD string for the Monday of the ISO week containing the given date.
 */
export function weekStart(dateInput: Date | string = new Date()): string {
  const d = new Date(dateInput);
  // Get ISO day of week: Mon=1, Tue=2, ..., Sun=7
  const day = d.getDay();
  const isoDay = day === 0 ? 7 : day;
  
  // Calculate distance to Monday
  const diffToMonday = isoDay - 1;
  d.setDate(d.getDate() - diffToMonday);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dateNum = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${dateNum}`;
}

/**
 * Generates options for the next N Mondays starting from upcoming ISO week.
 */
export function getNextNWeeks(
  count = 8,
  startDate: Date | string = new Date()
): Array<{ value: string; label: string }> {
  const firstMondayStr = weekStart(startDate);
  const [year, month, day] = firstMondayStr.split("-").map(Number);
  
  const results: Array<{ value: string; label: string }> = [];
  
  for (let i = 0; i < count; i++) {
    const current = new Date(year, month - 1, day + i * 7);
    const val = weekStart(current);
    const label = formatWeekLabel(val);
    results.push({ value: val, label });
  }

  return results;
}

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SHORT_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Returns full name of day by 0-based index (0=Monday, 6=Sunday).
 */
export function getDayName(dayIndex: number): string {
  return DAY_NAMES[dayIndex] ?? "Unknown";
}

/**
 * Returns short name of day by 0-based index (0=Mon, 6=Sun).
 */
export function getDayShortName(dayIndex: number): string {
  return SHORT_DAY_NAMES[dayIndex] ?? "Unknown";
}

/**
 * Formats week start string (YYYY-MM-DD) into readable label, e.g. "Week of 29 Sep 2026".
 */
export function formatWeekLabel(weekStartStr: string): string {
  const [year, month, day] = weekStartStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const monthName = d.toLocaleDateString("en-US", { month: "short" });
  return `Week of ${day} ${monthName} ${year}`;
}

/**
 * Gets Date object for specific day index (0=Mon..6=Sun) given week start YYYY-MM-DD.
 */
export function getDateForDay(weekStartStr: string, dayIndex: number): Date {
  const [year, month, day] = weekStartStr.split("-").map(Number);
  return new Date(year, month - 1, day + dayIndex);
}

/**
 * Formats day date e.g. "Mon 29 Sep".
 */
export function formatDayDate(weekStartStr: string, dayIndex: number): string {
  const d = getDateForDay(weekStartStr, dayIndex);
  const dayName = getDayShortName(dayIndex);
  const dateNum = d.getDate();
  const monthName = d.toLocaleDateString("en-US", { month: "short" });
  return `${dayName}, ${dateNum} ${monthName}`;
}
