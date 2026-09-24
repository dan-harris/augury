import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { supabase } = context.locals;
  await supabase.auth.signOut();
  return context.redirect("/");
};
