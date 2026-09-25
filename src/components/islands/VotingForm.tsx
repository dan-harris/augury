import { actions } from "astro:actions";
import { useState } from "preact/hooks";
import { Icon } from "../Icon";
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
    <form onSubmit={handleSubmit} class="space-y-6 border-2 border-ink-primary p-6 rounded-md bg-parchment-secondary/30">
      <h2 class="font-label text-xl uppercase tracking-widest text-ink-primary border-b border-ink-primary/40 pb-2 mb-4 font-bold flex items-center gap-2">
        <span class="flex items-center gap-1.5">
          <Icon name="dice" class="size-8 inline mt-0.5" />{" "}
          Submit Availability Poll
        </span>
      </h2>

      {feedback && (
        <div
          class={`p-3 text-sm font-serif font-bold border-2 rounded flex items-center gap-2 ${
            feedback.type === "success"
              ? "border-green-800 bg-green-100 text-green-900"
              : "border-rust-ink bg-rust-paper/40 text-rust-ink"
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

      {/* 2. Day Picker */}
      <DayPicker
        weekStart={weekStart}
        candidateDays={candidateDays}
        selectedDays={selectedDays}
        onToggleDay={handleToggleDay}
        disabled={!selectedPlayerId || isSubmitting}
      />

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
          class="btn-frame border-2 border-ink-primary bg-ink-primary px-6 py-2.5 font-label uppercase text-sm tracking-widest text-parchment-base hover:bg-parchment-secondary hover:text-ink-primary font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {isSubmitting ? "Submitting..." : "Submit Votes"}
        </button>
      </div>
    </form>
  );
}
