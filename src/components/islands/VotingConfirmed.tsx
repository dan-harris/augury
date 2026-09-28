import { SectionHeading } from "../SectionHeading";
import { DayCard } from "./DayCard";

interface Player {
  id: string;
  name: string;
  user_id?: string | null;
}

interface VotingConfirmedProps {
  weekStart: string;
  candidateDays: number[];
  confirmedDay?: number | null;
  players: Player[];
  playerVotesMap: Record<string, number[]>;
}

export function VotingConfirmed({
  weekStart,
  candidateDays,
  confirmedDay,
  players,
  playerVotesMap,
}: VotingConfirmedProps) {
  return (
    <section class="flex flex-col gap-8">
      <SectionHeading title="Availability" />

      <div class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {candidateDays.map((dayIndex) => {
            const availablePlayers = players.filter((player) =>
              (playerVotesMap[player.id] || []).includes(dayIndex)
            );
            const availablePlayersText = availablePlayers
              .map((player) => player.name)
              .join(", ");
            const isSelected = availablePlayers.length > 0;

            return (
              <DayCard
                key={dayIndex}
                dayIndex={dayIndex}
                weekStart={weekStart}
                isSelected={isSelected}
                disabled={dayIndex !== confirmedDay}
                availablePlayersText={availablePlayersText}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
