import { Icon } from "../Icon";
import { Radio } from "../Radio";
import { RadioGroup } from "../RadioGroup";

interface Player {
  id: string;
  name: string;
  user_id?: string | null;
}

interface PlayerPickerProps {
  players: Player[];
  selectedPlayerId: string | null;
  votedPlayerIds?: string[];
  linkedPlayerId?: string | null;
  onSelectPlayer: (playerId: string) => void;
}

export function PlayerPicker({
  players,
  selectedPlayerId,
  linkedPlayerId,
  onSelectPlayer,
}: PlayerPickerProps) {
  return (
    <RadioGroup>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {players.map((p) => {
          const isSelected = selectedPlayerId === p.id;
          const isLocked = Boolean(linkedPlayerId && linkedPlayerId !== p.id);
          const isLinkedPlayer = Boolean(linkedPlayerId && linkedPlayerId === p.id);

          return (
            <label
              key={p.id}
              class={`p-3.5 text-left font-serif transition-all flex items-center gap-3 rounded-[255px_5px_225px_3px/2px_255px_3px_25px] ${
                isSelected 
                  ? "border-ink-primary"
                  : isLocked
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
            >
              <Radio
                name="player_selection"
                value={p.id}
                checked={isSelected}
                disabled={isLocked}
                onChange={() => !isLocked && onSelectPlayer(p.id)}
                class="pointer-events-none"
              />
              <div class="flex flex-col min-w-0 flex-1">
                <span class="truncate font-bold text-lg leading-none">{p.name}</span>
                {isLinkedPlayer && (
                  <span class="text-[11px] font-serif italic text-ink-primary/70 flex items-center gap-1 mt-0.5">
                    <Icon name="chest" class="size-3.5 shrink-0" />
                    Locked to your linked account player
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </RadioGroup>
  );
}
