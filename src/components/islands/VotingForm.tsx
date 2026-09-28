import { actions } from "astro:actions";
import { useState } from "preact/hooks";
import { Icon } from "../Icon";
import { SectionHeading } from "../SectionHeading";
import { DayCard } from "./DayCard";
import { DayPicker } from "./DayPicker";
import { PlayerPicker } from "./PlayerPicker";

interface Player {
  id: string;
  name: string;
  user_id?: string | null;
}

interface VotingFormProps {
  sessionId: string;
  weekStart: string;
  candidateDays: number[];
  players: Player[];
  playerVotesMap: Record<string, number[]>;
  votedPlayerIds: string[];
  linkedPlayerId?: string | null;
  onVoteSubmitted?: () => void;
}

export function VotingForm({
  sessionId,
  weekStart,
  candidateDays,
  players,
  playerVotesMap,
  votedPlayerIds,
  linkedPlayerId,
  onVoteSubmitted,
}: VotingFormProps) {
  const initialPlayerId = linkedPlayerId || (players.length > 0 ? players[0].id : null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initialPlayerId);
  const [selectedDays, setSelectedDays] = useState<number[]>(() => {
    if (initialPlayerId && playerVotesMap[initialPlayerId]) {
      return playerVotesMap[initialPlayerId];
    }
    return [];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Update selected days when player changes
  const handleSelectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setFeedback(null);
    const existing = playerVotesMap[playerId] || [];
    setSelectedDays(existing);
  };

  const handleToggleDay = (dayIndex: number) => {
    setFeedback(null);
    setSelectedDays((prev) => {
      if (prev.includes(dayIndex)) {
        return prev.filter((d) => d !== dayIndex);
      } else {
        return [...prev, dayIndex].sort((a, b) => a - b);
      }
    });
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!selectedPlayerId) {
      setFeedback({ type: "error", message: "Please select a character/player." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await actions.submitVotes({
        sessionId,
        playerId: selectedPlayerId,
        days: selectedDays,
      });

      if (res.error) {
        setFeedback({ type: "error", message: res.error.message || "Failed to submit votes." });
      } else if (res.data && !res.data.success) {
        setFeedback({ type: "error", message: (res.data as any).error || "Failed to submit votes." });
      } else {
        setFeedback({
          type: "success",
          message: selectedDays.length > 0
            ? "Votes submitted successfully!"
            : "Response submitted (voted all-no / unavailable).",
        });

        if (onVoteSubmitted) {
          onVoteSubmitted();
        } else {
          // Default reload fallback for M3
          setTimeout(() => {
            window.location.reload();
          }, 600);
        }
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-11">
      <section class="flex flex-col gap-8">
        <SectionHeading title="Players" />

        {feedback && (
          <div
            class={`p-3 text-sm font-serif font-bold flex items-center gap-2 text-ink-primary ${
              feedback.type === "success"
                ? "bg-sage-paper"
                : "bg-rust-paper/40"
            }`}
          >
            {feedback.type === "success" ? "✓ " : <Icon name="spikes" class="size-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* 1. Player Picker */}
        <PlayerPicker
          players={players}
          selectedPlayerId={selectedPlayerId}
          votedPlayerIds={votedPlayerIds}
          linkedPlayerId={linkedPlayerId}
          onSelectPlayer={handleSelectPlayer}
        />
      </section>

      <section class="flex flex-col gap-8">
        <SectionHeading title="Availability" />

        {/* 2. Day Picker */}
        <div class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {candidateDays.map((dayIndex) => {
              const isSelected = selectedDays.includes(dayIndex);
              const availablePlayers = players.filter((player) => {
                if (player.id === selectedPlayerId) {
                  return selectedDays.includes(dayIndex);
                }
                return (playerVotesMap[player.id] || []).includes(dayIndex);
              });
              const availablePlayersText = availablePlayers
                .map((player) => player.name)
                .join(", ");

              return (
                <DayCard
                  key={dayIndex}
                  dayIndex={dayIndex}
                  weekStart={weekStart}
                  isSelected={isSelected}
                  disabled={!selectedPlayerId || isSubmitting}
                  onClick={() => handleToggleDay(dayIndex)}
                  availablePlayersText={availablePlayersText}
                  voteCount={availablePlayers.length}
                  totalPlayers={players.length}
                />
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p class="font-serif text-xs italic text-ink-primary/70">
            {selectedDays.length === 0
              ? "No days selected = submitting as 'unavailable for all days'."
              : `Selected ${selectedDays.length} candidate day${selectedDays.length === 1 ? "" : "s"}.`}
          </p>

          <button
            type="submit"
            disabled={!selectedPlayerId || isSubmitting}
            class="border-button border-2 border-ink-primary bg-ink-primary px-6 py-2.5 font-label uppercase text-sm tracking-widest text-parchment-base hover:bg-parchment-secondary hover:text-ink-primary font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {isSubmitting ? "Submitting..." : "Submit Votes"}
          </button>
        </div>
      </section>
    </form>
  );
}
