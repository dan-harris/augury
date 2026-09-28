import { formatDayDate, getDayShortName } from "../../lib/weeks";
import { Checkbox } from "../Checkbox";

export interface Player {
  id: string;
  name: string;
  user_id?: string | null;
}

interface DayPickerProps {
  weekStart: string;
  candidateDays: number[];
  selectedDays: number[];
  onToggleDay: (dayIndex: number) => void;
  disabled?: boolean;
  players?: Player[];
  playerVotesMap?: Record<string, number[]>;
  selectedPlayerId?: string | null;
}

export function DayPicker({
  weekStart,
  candidateDays,
  selectedDays,
  onToggleDay,
  disabled = false,
  players = [],
  playerVotesMap = {},
  selectedPlayerId = null,
}: DayPickerProps) {
  return (
    <div class="space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {candidateDays.map((dayIndex) => {
          const isSelected = selectedDays.includes(dayIndex);
          const formattedDate = formatDayDate(weekStart, dayIndex);
          const dayShort = getDayShortName(dayIndex);

          const availablePlayersText = players
            .filter((player) => {
              if (player.id === selectedPlayerId) {
                return selectedDays.includes(dayIndex);
              }
              return (playerVotesMap[player.id] || []).includes(dayIndex);
            })
            .map((player) => player.name)
            .join(", ");

          return (
            <button
              key={dayIndex}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onToggleDay(dayIndex)}
              class={`p-3.5 border-2 text-left font-serif transition-all flex items-start min-h-24 justify-between cursor-pointer rounded-[255px_5px_225px_3px/2px_255px_3px_25px] hover:bg-sage-block ${
                isSelected
                  ? "border-ink-primary bg-sage-paper shadow-sm"
                  : "border-ink-primary/60 bg-parchment-base hover:border-ink-primary"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
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
        })}
      </div>
    </div>
  );
}

