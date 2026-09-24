import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "./lib/supabase/server";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerClient(context.cookies, context.request.headers);
  context.locals.supabase = supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  context.locals.user = user;

  const url = new URL(context.request.url);

  // Enforce auth on /admin/** (subpaths of /admin)
  if (url.pathname.startsWith("/admin/") && !user) {
    return context.redirect("/admin");
  }

  return next();
});
