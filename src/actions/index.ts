import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const server = {
  requestMagicLink: defineAction({
    input: z.object({
      email: z.string().email("Please enter a valid email address."),
      next: z.string().optional().default("/"),
    }),
    handler: async (input, context) => {
      const { supabase } = context.locals;
      const requestUrl = new URL(context.request.url);

      let nextPath = input.next || "/";
      if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
        nextPath = "/";
      }

      const emailRedirectTo = new URL(
        `/auth/confirm?next=${encodeURIComponent(nextPath)}`,
        requestUrl.origin,
      ).toString();

      const { error } = await supabase.auth.signInWithOtp({
        email: input.email,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),
};
