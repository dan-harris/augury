import "../.astro/types.d.ts";

declare namespace App {
  interface Locals {
    supabase: import("@supabase/supabase-js").SupabaseClient<
      import("./lib/supabase/types").Database
    >;
    user: import("@supabase/supabase-js").User | null;
  }
}
