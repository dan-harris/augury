import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

let client: ReturnType<typeof createSupabaseBrowserClient<Database>> | undefined;

export function createBrowserClient() {
  if (client) return client;

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }

  client = createSupabaseBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}
