import { h } from "preact";

interface Player {
  id: string;
  name: string;
  user_id?: string | null;
}

interface PlayerPickerProps {
  players: Player[];
  selectedPlayerId: string | null;
  votedPlayerIds: string[];
  linkedPlayerId?: string | null;
  onSelectPlayer: (playerId: string) => void;
}

export function PlayerPicker({
  players,
  selectedPlayerId,
  votedPlayerIds,
  linkedPlayerId,
  onSelectPlayer,
}: PlayerPickerProps) {
  return (
    <div class="space-y-3">
      <label class="block font-label text-sm uppercase tracking-wider text-ink-primary font-bold">
        1. Select Your Character / Player Name
      </label>

      {linkedPlayerId && (
        <div class="p-2 border border-ink-primary/40 bg-parchment-secondary/40 text-xs font-serif text-ink-primary rounded flex items-center justify-between">
          <span>🔒 Locked to your linked account player</span>
        </div>
      )}

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {players.map((p) => {
          const isSelected = selectedPlayerId === p.id;
          const hasVoted = votedPlayerIds.includes(p.id);
          const isLocked = Boolean(linkedPlayerId && linkedPlayerId !== p.id);

          return (
            <button
              key={p.id}
              type="button"
              disabled={isLocked}
              onClick={() => !isLocked && onSelectPlayer(p.id)}
              class={`btn-frame p-3 text-left border-2 font-serif text-sm transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "border-ink-primary bg-ink-primary text-parchment-base font-bold shadow-md transform -translate-y-0.5"
                  : isLocked
                  ? "border-ink-primary/20 bg-parchment-base/40 text-ink-primary/40 cursor-not-allowed opacity-50"
                  : "border-ink-primary/60 bg-parchment-base text-ink-primary hover:border-ink-primary hover:bg-parchment-secondary cursor-pointer"
              }`}
            >
              <div class="flex items-center justify-between gap-1">
                <span class="truncate font-bold">{p.name}</span>
                {isSelected && <span class="text-xs">✓</span>}
              </div>
              <div class="mt-1 flex items-center gap-1 text-[11px] font-label uppercase tracking-wider">
                {hasVoted ? (
                  <span class={isSelected ? "text-parchment-base/80" : "text-rust-ink"}>
                    ● Voted
                  </span>
                ) : (
                  <span class={isSelected ? "text-parchment-base/60" : "text-ink-primary/50"}>
                    ○ Not voted
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
