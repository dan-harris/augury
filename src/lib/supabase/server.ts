import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "./types";

export function createServerClient(
  cookies: AstroCookies,
  env?: { PUBLIC_SUPABASE_URL?: string; PUBLIC_SUPABASE_ANON_KEY?: string },
) {
  const supabaseUrl = env?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env?.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }

  return createSupabaseServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        if (typeof cookies.getAll === "function") {
          return cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        }
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
