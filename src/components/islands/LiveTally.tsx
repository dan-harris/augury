import { useEffect, useState } from "preact/hooks";
import { createBrowserClient } from "../../lib/supabase/browser";
import { getBestDay, getClosestDay, getProgressCopy, getViableDays, type TallyRow } from "../../lib/viability";
import { formatDayDate } from "../../lib/weeks";
import { Icon } from "../Icon";

interface Player {
  id: string;
  name: string;
}

interface LiveTallyProps {
  sessionId: string;
  weekStart: string;
  candidateDays: number[];
  viabilityThreshold: number;
  initialStatus: "open" | "confirmed" | "closed";
  initialConfirmedDay?: number | null;
  initialTallies: TallyRow[];
  initialVotedPlayerIds: string[];
  players: Player[];
  isAdmin?: boolean;
}

export function LiveTally({
  sessionId,
  weekStart,
  candidateDays,
  viabilityThreshold,
  initialStatus,
  initialConfirmedDay,
  initialTallies,
  initialVotedPlayerIds,
  players,
  isAdmin: _isAdmin = false,
}: LiveTallyProps) {
  const [status, setStatus] = useState(initialStatus);
  const [confirmedDay, setConfirmedDay] = useState(initialConfirmedDay);
  const [tallies, setTallies] = useState<TallyRow[]>(initialTallies);
  const [votedPlayerIds, setVotedPlayerIds] = useState<string[]>(initialVotedPlayerIds);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Computed viability logic
  const viableDays = getViableDays(tallies, viabilityThreshold);
  const bestDay = getBestDay(tallies, viabilityThreshold);
  const closest = getClosestDay(tallies, viabilityThreshold);

  // Map player ID to player object
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Re-fetch fresh tallies, vote responses, and session status from Supabase
  const refreshData = async () => {
    try {
      const supabase = createBrowserClient();

      // Fetch session status
      const { data: sess } = await supabase
        .from("sessions")
        .select("status, confirmed_day")
        .eq("id", sessionId)
        .single();

      if (sess) {
        setStatus(sess.status);
        setConfirmedDay(sess.confirmed_day);
      }

      // Fetch tallies
      const { data: tallyData } = await supabase
        .from("session_day_tallies")
        .select("day, yes_count, voter_ids, viable")
        .eq("session_id", sessionId);

      if (tallyData) {
        const formatted: TallyRow[] = tallyData.map((t: any) => ({
          day: Number(t.day),
          yes_count: Number(t.yes_count),
          voter_ids: Array.isArray(t.voter_ids) ? t.voter_ids : [],
          viable: Boolean(t.viable),
        }));
        setTallies(formatted);
      }

      // Fetch vote responses
      const { data: responses } = await supabase
        .from("vote_responses")
        .select("player_id")
        .eq("session_id", sessionId);

      if (responses) {
        setVotedPlayerIds(responses.map((r: any) => r.player_id));
      }
    } catch (err) {
      console.error("Failed to refresh live tally data:", err);
    }
  };

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserClient>;
    try {
      supabase = createBrowserClient();
    } catch {
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = () => {
      if (channel) return;

      channel = supabase
        .channel(`session-${sessionId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "votes", filter: `session_id=eq.${sessionId}` },
          () => refreshData()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "vote_responses", filter: `session_id=eq.${sessionId}` },
          () => refreshData()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
          () => refreshData()
        )
        .subscribe((status: string) => {
          setIsLiveConnected(status === "SUBSCRIBED");
        });
    };

    const cleanupSubscription = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
        setIsLiveConnected(false);
      }
    };

    setupSubscription();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cleanupSubscription();
      } else {
        setupSubscription();
        refreshData();
      }
    };

    const handlePageHide = () => {
      cleanupSubscription();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cleanupSubscription();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [sessionId]);

  const votedPlayers = players.filter((p) => votedPlayerIds.includes(p.id));
  const notVotedPlayers = players.filter((p) => !votedPlayerIds.includes(p.id));

  return (
    <div class="space-y-8">
      {/* Realtime Live Indicator Banner */}
      <div class="flex items-center justify-between text-xs font-label uppercase tracking-widest text-ink-primary/70 border-b border-ink-primary/30 pb-2">
        <span class="font-bold">Session Tally Board</span>
        <div class="flex items-center gap-1.5">
          <span class={`w-2 h-2 rounded-full ${isLiveConnected ? "bg-green-600 animate-pulse" : "bg-ink-primary/40"}`} />
          <span>{isLiveConnected ? "Realtime Live" : "Connecting..."}</span>
        </div>
      </div>

      {/* Confirmed / Closed State Banner */}
      {status === "confirmed" && (
        <div class="p-6 border-2 border-green-800 bg-green-100/90 text-green-950 rounded-md text-center shadow-md">
          <div class="flex justify-center mb-2"><Icon name="dice" class="size-12 text-green-950" /></div>
          <h2 class="font-gothic text-3xl sm:text-4xl text-green-950 m-0 leading-none">
            Session Confirmed!
          </h2>
          <p class="font-serif text-lg text-green-900 mt-2 font-bold">
            {confirmedDay !== null && confirmedDay !== undefined
              ? `${formatDayDate(weekStart, confirmedDay)} it is!`
              : "Session locked & confirmed."}
          </p>
        </div>
      )}

      {status === "closed" && (
        <div class="p-6 border-2 border-ink-primary/40 bg-parchment-secondary/40 text-ink-primary text-center rounded-md">
          <div class="flex justify-center mb-2"><Icon name="scroll" class="size-10 text-ink-primary" /></div>
          <h2 class="font-gothic text-2xl text-ink-primary m-0">
            Session Closed Without a Pick
          </h2>
          <p class="font-serif text-sm opacity-80 mt-1">
            This poll was closed by the admin.
          </p>
        </div>
      )}

      {/* Best Day / Viability Summary */}
      {status === "open" && (
        <div class="p-4 border-2 border-ink-primary bg-parchment-secondary/40 rounded-md">
          {viableDays.length > 0 ? (
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="font-label text-xs uppercase tracking-widest text-green-900 bg-green-200 px-2 py-0.5 rounded font-bold">
                  ✓ Viable Days Found
                </span>
                <p class="font-serif text-sm font-bold text-ink-primary mt-1">
                  Suggested Best Day: {bestDay !== null ? formatDayDate(weekStart, bestDay) : "None"} ({tallies.find(t => t.day === bestDay)?.yes_count || 0} votes)
                </p>
              </div>
              <span class="font-serif text-xs italic text-ink-primary/80">
                {viableDays.length} day{viableDays.length === 1 ? "" : "s"} met the threshold of {viabilityThreshold}
              </span>
            </div>
          ) : closest ? (
            <div>
              <span class="font-label text-xs uppercase tracking-widest text-rust-ink bg-rust-paper/60 px-2 py-0.5 rounded font-bold">
                No Viable Days Yet
              </span>
              <p class="font-serif text-sm text-ink-primary mt-1">
                Closest day is <strong class="font-bold">{formatDayDate(weekStart, closest.day)}</strong> with {closest.yes_count} of {viabilityThreshold} needed.
              </p>
            </div>
          ) : (
            <p class="font-serif text-sm text-ink-primary/80 italic">
              No votes submitted yet. Viability threshold is {viabilityThreshold} players.
            </p>
          )}
        </div>
      )}

      {/* Per-Day Tally Cards */}
      <div class="space-y-4">
        <h3 class="font-label uppercase tracking-widest text-ink-primary font-bold">
          Per-Day Availability Tally
        </h3>

        <div class="space-y-3">
          {candidateDays.map((dayIndex) => {
            const tally = tallies.find((t) => t.day === dayIndex) || { day: dayIndex, yes_count: 0, voter_ids: [] };
            const isViable = tally.yes_count >= viabilityThreshold;
            const isBest = bestDay === dayIndex && tally.yes_count > 0;
            const isConfirmed = status === "confirmed" && confirmedDay === dayIndex;

            const voterNames = tally.voter_ids
              .map((id) => playerMap.get(id)?.name)
              .filter(Boolean);

            const progressPct = Math.min(100, Math.round((tally.yes_count / viabilityThreshold) * 100));

            return (
              <div
                key={dayIndex}
                class={`p-4 border-2 rounded-md transition-all ${
                  isConfirmed
                    ? "border-green-800 bg-green-100/90 shadow-md"
                    : isViable
                    ? "border-green-800 bg-green-50/60"
                    : "border-ink-primary/60 bg-parchment-base"
                }`}
              >
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-primary/20 pb-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="font-serif font-bold text-lg text-ink-primary">
                      {formatDayDate(weekStart, dayIndex)}
                    </span>
                    {isBest && status === "open" && (
                      <span class="font-label text-[10px] uppercase tracking-wider px-2 py-0.5 bg-ink-primary text-parchment-base rounded font-bold">
                        ★ Best Day
                      </span>
                    )}
                    {isConfirmed && (
                      <span class="font-label text-[10px] uppercase tracking-wider px-2 py-0.5 bg-green-800 text-green-50 rounded font-bold">
                        ✓ Confirmed
                      </span>
                    )}
                  </div>

                  <div class="font-label text-xs uppercase tracking-wider text-ink-primary font-bold flex items-center gap-2">
                    <span>{tally.yes_count} {tally.yes_count === 1 ? "Vote" : "Votes"}</span>
                    <span class="text-ink-primary/50">&bull;</span>
                    <span class={isViable ? "text-green-800" : "text-ink-primary/70"}>
                      {getProgressCopy(tally.yes_count, viabilityThreshold)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div class="w-full bg-ink-primary/10 rounded-full h-2 overflow-hidden mb-3">
                  <div
                    class={`h-2 transition-all duration-300 ${isViable ? "bg-green-800" : "bg-ink-primary"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Voters List */}
                <div class="font-serif text-xs text-ink-primary/80">
                  <span class="font-bold mr-1">Available Players:</span>
                  {voterNames.length > 0 ? (
                    <span class="italic">{voterNames.join(", ")}</span>
                  ) : (
                    <span class="italic text-ink-primary/50">None yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Social Pressure List: Voted vs Not-Yet-Voted */}
      <div class="grid sm:grid-cols-2 gap-4 pt-4 border-t-2 border-ink-primary/30">
        {/* Voted List */}
        <div class="border border-ink-primary/40 p-4 rounded bg-parchment-base">
          <h4 class="font-label text-xs uppercase tracking-wider text-ink-primary font-bold mb-2 flex items-center justify-between">
            <span>Submitted Responses</span>
            <span class="text-xs px-2 py-0.5 bg-ink-primary/10 rounded">{votedPlayers.length} / {players.length}</span>
          </h4>
          {votedPlayers.length > 0 ? (
            <ul class="space-y-1 font-serif text-xs text-ink-primary">
              {votedPlayers.map((p) => (
                <li key={p.id} class="flex items-center gap-1.5">
                  <span class="text-green-800 font-bold">✓</span> {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p class="font-serif italic text-xs text-ink-primary/60">No players have voted yet.</p>
          )}
        </div>

        {/* Not Yet Voted List */}
        <div class="border border-ink-primary/40 p-4 rounded bg-parchment-base">
          <h4 class="font-label text-xs uppercase tracking-wider text-rust-ink font-bold mb-2 flex items-center justify-between">
            <span>Pending Responses</span>
            <span class="text-xs px-2 py-0.5 bg-rust-paper/60 rounded">{notVotedPlayers.length} / {players.length}</span>
          </h4>
          {notVotedPlayers.length > 0 ? (
            <ul class="space-y-1 font-serif text-xs text-ink-primary/80">
              {notVotedPlayers.map((p) => (
                <li key={p.id} class="flex items-center gap-1.5 opacity-80">
                  <span class="text-rust-ink">○</span> {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p class="font-serif italic text-xs text-green-800 font-bold">Everyone has submitted their votes!</p>
          )}
        </div>
      </div>
    </div>
  );
}
