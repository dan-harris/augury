import { h } from "preact";
import { formatDayDate, getDayShortName } from "../../lib/weeks";

interface DayPickerProps {
  weekStart: string;
  candidateDays: number[];
  selectedDays: number[];
  onToggleDay: (dayIndex: number) => void;
  disabled?: boolean;
}

export function DayPicker({
  weekStart,
  candidateDays,
  selectedDays,
  onToggleDay,
  disabled = false,
}: DayPickerProps) {
  return (
    <div class="space-y-3">
      <label class="block font-label text-sm uppercase tracking-wider text-ink-primary font-bold">
        2. Select Days You Can Play (Multi-Select)
      </label>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {candidateDays.map((dayIndex) => {
          const isSelected = selectedDays.includes(dayIndex);
          const formattedDate = formatDayDate(weekStart, dayIndex);
          const dayShort = getDayShortName(dayIndex);

          return (
            <button
              key={dayIndex}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onToggleDay(dayIndex)}
              class={`btn-frame p-3.5 border-2 text-left font-serif transition-all flex items-center justify-between cursor-pointer ${
                isSelected
                  ? "border-ink-primary bg-ink-primary text-parchment-base shadow-sm"
                  : "border-ink-primary/60 bg-parchment-base text-ink-primary hover:border-ink-primary hover:bg-parchment-secondary"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div>
                <span class="font-label text-xs uppercase tracking-widest block opacity-75">
                  {dayShort}
                </span>
                <span class="font-serif text-base font-bold">{formattedDate.split(", ")[1] || formattedDate}</span>
              </div>
              <div
                class={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-xs ${
                  isSelected
                    ? "border-parchment-base bg-parchment-base text-ink-primary"
                    : "border-ink-primary/40 bg-transparent text-transparent"
                }`}
              >
                ✓
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
