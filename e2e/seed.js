import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "http://127.0.0.1:54321";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function seedTestData() {
  const groupId = "11111111-9999-4999-8999-111111111111";
  const slugId = "e2etst";
  const groupName = "E2E Campaign Group";

  // Upsert group
  await supabaseAdmin.from("groups").upsert({
    id: groupId,
    slug_id: slugId,
    name: groupName,
    viability_threshold: 2,
  });

  // Upsert players
  const player1Id = "22222222-9999-4999-8999-222222222222";
  const player2Id = "33333333-9999-4999-8999-333333333333";

  await supabaseAdmin.from("players").upsert([
    { id: player1Id, group_id: groupId, name: "Gimli Son of Gloin" },
    { id: player2Id, group_id: groupId, name: "Legolas Greenleaf" },
  ]);

  // Upsert session
  const sessionId = "e2esess100";
  await supabaseAdmin.from("sessions").upsert({
    id: sessionId,
    group_id: groupId,
    week_start: "2026-09-28",
    candidate_days: [0, 1, 3], // Mon, Tue, Thu
    status: "open",
  });

  return { groupId, slugId, groupName, player1Id, player2Id, sessionId };
}
