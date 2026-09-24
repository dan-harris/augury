import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { nanoid } from "nanoid";
import { composeSlug } from "../lib/slugs";
import { createServerClient } from "../lib/supabase/server";

export const server = {
  requestMagicLink: defineAction({
    input: z.object({
      email: z.string().email("Please enter a valid email address."),
      next: z.string().optional().default("/"),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
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

  createGroup: defineAction({
    accept: "form",
    input: z.object({
      name: z.string().trim().min(1, "Group name is required."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { data, error } = await supabase.rpc("create_group", {
        p_name: input.name,
      });

      if (error) {
        if (error.message.includes("Unauthorized") || error.message.includes("group creator")) {
          return { success: false, error: "Only allowlisted group creators can create campaign groups." };
        }
        return { success: false, error: error.message };
      }

      const slugId = data as string;
      const composedSlug = composeSlug(input.name, slugId);
      return { success: true, slugId, redirectUrl: `/admin/${composedSlug}` };
    },
  }),

  updateGroup: defineAction({
    accept: "form",
    input: z.object({
      groupId: z.string().uuid("Invalid group ID."),
      name: z.string().trim().min(1, "Group name cannot be empty.").optional(),
      viabilityThreshold: z.coerce
        .number()
        .int()
        .min(1, "Viability threshold must be at least 1.")
        .optional(),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const updates: Record<string, any> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.viabilityThreshold !== undefined) updates.viability_threshold = input.viabilityThreshold;

      if (Object.keys(updates).length === 0) {
        return { success: true };
      }

      const { error } = await supabase
        .from("groups")
        .update(updates)
        .eq("id", input.groupId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  addPlayer: defineAction({
    accept: "form",
    input: z.object({
      groupId: z.string().uuid("Invalid group ID."),
      name: z.string().trim().min(1, "Player name is required."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { data, error } = await supabase
        .from("players")
        .insert({ group_id: input.groupId, name: input.name })
        .select()
        .single();

      if (error) {
        if (
          error.code === "23505" ||
          error.message.includes("unique") ||
          error.message.includes("players_group_id_name_key")
        ) {
          return { success: false, error: "A player with this name already exists in this group." };
        }
        return { success: false, error: error.message };
      }

      return { success: true, player: data };
    },
  }),

  renamePlayer: defineAction({
    accept: "form",
    input: z.object({
      playerId: z.string().uuid("Invalid player ID."),
      name: z.string().trim().min(1, "Player name is required."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { error } = await supabase
        .from("players")
        .update({ name: input.name })
        .eq("id", input.playerId);

      if (error) {
        if (
          error.code === "23505" ||
          error.message.includes("unique") ||
          error.message.includes("players_group_id_name_key")
        ) {
          return { success: false, error: "A player with this name already exists in this group." };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  removePlayer: defineAction({
    accept: "form",
    input: z.object({
      playerId: z.string().uuid("Invalid player ID."),
      confirmed: z
        .preprocess((val) => val === "true" || val === true, z.boolean())
        .optional()
        .default(false),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);

      if (!input.confirmed) {
        const { data: openResponses } = await supabase
          .from("vote_responses")
          .select("session_id, sessions!inner(status)")
          .eq("player_id", input.playerId)
          .eq("sessions.status", "open");

        if (openResponses && openResponses.length > 0) {
          return {
            success: false,
            requiresConfirmation: true,
            playerId: input.playerId,
            error: "This player has submitted votes for open sessions. Removing them will delete their votes.",
          };
        }
      }

      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", input.playerId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  createInvite: defineAction({
    accept: "form",
    input: z.object({
      groupId: z.string().uuid("Invalid group ID."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const token = nanoid(21);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("admin_invites")
        .insert({
          group_id: input.groupId,
          token,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const requestUrl = new URL(context.request.url);
      const inviteUrl = new URL(`/admin/join?token=${token}`, requestUrl.origin).toString();

      return { success: true, invite: data, token, url: inviteUrl };
    },
  }),

  revokeInvite: defineAction({
    accept: "form",
    input: z.object({
      inviteId: z.string().uuid("Invalid invite ID."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { error } = await supabase
        .from("admin_invites")
        .delete()
        .eq("id", input.inviteId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  acceptInvite: defineAction({
    accept: "form",
    input: z.object({
      token: z.string().min(1, "Invite token is required."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { data: groupId, error } = await supabase.rpc("accept_invite", {
        p_token: input.token,
      });

      if (error) {
        if (error.message.includes("Invalid invite token")) {
          return { success: false, error: "Invalid invite token." };
        }
        if (error.message.includes("Invite token expired")) {
          return { success: false, error: "This invite link has expired." };
        }
        if (error.message.includes("Unauthorized")) {
          return { success: false, error: "You must be signed in to accept an invite." };
        }
        return { success: false, error: error.message };
      }

      const { data: group } = await supabase
        .from("groups")
        .select("name, slug_id")
        .eq("id", groupId)
        .single();

      let redirectUrl = "/admin";
      if (group) {
        redirectUrl = `/admin/${composeSlug(group.name, group.slug_id)}`;
      }

      return { success: true, groupId, redirectUrl };
    },
  }),

  removeAdmin: defineAction({
    accept: "form",
    input: z.object({
      groupId: z.string().uuid("Invalid group ID."),
      userId: z.string().uuid("Invalid user ID."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { error } = await supabase
        .from("group_admins")
        .delete()
        .eq("group_id", input.groupId)
        .eq("user_id", input.userId);

      if (error) {
        if (error.message.includes("last admin") || error.message.includes("Cannot remove the last admin")) {
          return { success: false, error: "A group must always have at least one admin." };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  createSession: defineAction({
    accept: "form",
    input: z.object({
      groupId: z.string().uuid("Invalid group ID."),
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid week start date format."),
      candidateDays: z
        .array(z.coerce.number().int().min(0).max(6))
        .min(1, "Select at least one candidate day."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const sessionId = nanoid(10);

      const { data: group } = await supabase
        .from("groups")
        .select("name, slug_id")
        .eq("id", input.groupId)
        .single();

      if (!group) {
        return { success: false, error: "Group not found." };
      }

      const { error } = await supabase.from("sessions").insert({
        id: sessionId,
        group_id: input.groupId,
        week_start: input.weekStart,
        candidate_days: input.candidateDays,
        status: "open",
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const canonicalSlug = composeSlug(group.name, group.slug_id);
      return {
        success: true,
        sessionId,
        redirectUrl: `/g/${canonicalSlug}/${sessionId}`,
      };
    },
  }),

  updateSession: defineAction({
    accept: "form",
    input: z.object({
      sessionId: z.string().min(1, "Invalid session ID."),
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      candidateDays: z.array(z.coerce.number().int().min(0).max(6)).min(1).optional(),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const updates: Record<string, any> = {};
      if (input.weekStart) updates.week_start = input.weekStart;
      if (input.candidateDays) updates.candidate_days = input.candidateDays;

      if (Object.keys(updates).length === 0) {
        return { success: true };
      }

      // Note: shrinking candidate_days can leave orphaned votes rows for removed days.
      // session_day_tallies view unnests s.candidate_days so orphaned votes are invisible and harmless.
      const { error } = await supabase
        .from("sessions")
        .update(updates)
        .eq("id", input.sessionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  submitVotes: defineAction({
    accept: "form",
    input: z.object({
      sessionId: z.string().min(1, "Invalid session ID."),
      playerId: z.string().uuid("Invalid player ID."),
      days: z.preprocess((val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return [Number(val)];
          }
        }
        return val;
      }, z.array(z.coerce.number().int().min(0).max(6))),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { error } = await supabase.rpc("submit_votes", {
        p_session_id: input.sessionId,
        p_player_id: input.playerId,
        p_days: input.days,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  linkPlayerToUser: defineAction({
    accept: "form",
    input: z.object({
      playerId: z.string().uuid("Invalid player ID."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { error } = await supabase.rpc("link_player", {
        p_player_id: input.playerId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  unlinkPlayerFromUser: defineAction({
    accept: "form",
    input: z.object({
      playerId: z.string().uuid("Invalid player ID."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { error } = await supabase.rpc("unlink_player", {
        p_player_id: input.playerId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  confirmSession: defineAction({
    accept: "form",
    input: z.object({
      sessionId: z.string().min(1, "Invalid session ID."),
      day: z.coerce.number().int().min(0).max(6),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);

      const { data: session } = await supabase
        .from("sessions")
        .select("candidate_days")
        .eq("id", input.sessionId)
        .single();

      if (!session) {
        return { success: false, error: "Session not found." };
      }

      if (!session.candidate_days.includes(input.day)) {
        return { success: false, error: "Selected day is not a candidate day for this session." };
      }

      const { error } = await supabase
        .from("sessions")
        .update({
          status: "confirmed",
          confirmed_day: input.day,
        })
        .eq("id", input.sessionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),

  closeSession: defineAction({
    accept: "form",
    input: z.object({
      sessionId: z.string().min(1, "Invalid session ID."),
    }),
    handler: async (input, context) => {
      const supabase = createServerClient(context.cookies, context.request.headers);
      const { error } = await supabase
        .from("sessions")
        .update({
          status: "closed",
          confirmed_day: null,
        })
        .eq("id", input.sessionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    },
  }),
};

