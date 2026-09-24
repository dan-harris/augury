import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "./types";

function parseCookieHeader(
  cookieHeader: string | null | undefined,
): { name: string; value: string }[] {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((cookieStr) => {
      const parts = cookieStr.split("=");
      const name = parts[0]?.trim();
      const value = parts.slice(1).join("=").trim();
      return { name: name || "", value: value || "" };
    })
    .filter((c) => c.name.length > 0);
}

export function createServerClient(
  cookies: AstroCookies,
  requestHeaders?: Headers,
  envOverride?: { PUBLIC_SUPABASE_URL?: string; PUBLIC_SUPABASE_ANON_KEY?: string },
) {
  const supabaseUrl = envOverride?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    envOverride?.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }

  return createSupabaseServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookieHeader = requestHeaders?.get("cookie");
        if (cookieHeader) {
          return parseCookieHeader(cookieHeader);
        }

        if (typeof (cookies as any).getAll === "function") {
          return (cookies as any).getAll().map((cookie: any) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        }

        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const cookieOptions = { ...options };
          if (
            supabaseUrl.startsWith("http://127.0.0.1") ||
            supabaseUrl.startsWith("http://localhost")
          ) {
            cookieOptions.secure = false;
          }
          cookies.set(name, value, cookieOptions);
        });
      },
    },
  });
}
