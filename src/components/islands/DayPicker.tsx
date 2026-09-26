import { formatDayDate, getDayShortName } from "../../lib/weeks";
import { Checkbox } from "../Checkbox";

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
              class={`p-3.5 border-2 text-left font-serif transition-all flex items-center justify-between cursor-pointer rounded-[255px_5px_225px_3px/2px_255px_3px_25px] hover:bg-sage-block ${
                isSelected
                  ? "border-ink-primary bg-sage-paper shadow-sm"
                  : "border-ink-primary/60 bg-parchment-base hover:border-ink-primary"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div>
                <span class="font-label text-xs uppercase tracking-widest block opacity-75">
                  {dayShort}
                </span>
                <span class="font-serif font-bold">
                  {formattedDate.split(", ")[1] || formattedDate}
                </span>
              </div>
              <Checkbox
                checked={isSelected}
                disabled={disabled}
                tabIndex={-1}
                class="pointer-events-none"
                readOnly
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

