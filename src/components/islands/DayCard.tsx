import { formatDayDate, getDayShortName } from "../../lib/weeks";
import { Checkbox } from "../Checkbox";

export interface DayCardProps {
  dayIndex: number;
  weekStart: string;
  isSelected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  availablePlayersText?: string;
}

export function DayCard({
  dayIndex,
  weekStart,
  isSelected = false,
  disabled = false,
  onClick,
  availablePlayersText = "",
}: DayCardProps) {
  const formattedDate = formatDayDate(weekStart, dayIndex);
  const dayShort = getDayShortName(dayIndex);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onClick?.()}
      class={`p-3.5 border-2 text-left font-serif transition-all flex items-start min-h-24 justify-between cursor-pointer rounded-[255px_5px_225px_3px/2px_255px_3px_25px] ${
        isSelected
          ? "border-ink-primary bg-sage-paper shadow-sm"
          : "border-ink-primary/60 bg-parchment-base hover:border-ink-primary"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-sage-block"}`}
    >
      <div>
        <span class="font-label text-xs uppercase tracking-widest block opacity-75">
          {dayShort}
        </span>
        <span class="font-serif font-bold block">
          {formattedDate.split(", ")[1] || formattedDate}
        </span>
        <span class="font-serif text-xs text-ink-primary/70 block mt-0.5">
          {availablePlayersText}
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
}
