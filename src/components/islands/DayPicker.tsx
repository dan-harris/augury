import { DayCard } from "./DayCard";

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
            <DayCard
              key={dayIndex}
              dayIndex={dayIndex}
              weekStart={weekStart}
              isSelected={isSelected}
              disabled={disabled}
              onClick={() => onToggleDay(dayIndex)}
              availablePlayersText={availablePlayersText}
            />
          );
        })}
      </div>
    </div>
  );
}

