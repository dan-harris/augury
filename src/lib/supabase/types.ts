export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_invites: {
        Row: {
          created_at: string;
          expires_at: string;
          group_id: string;
          id: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          group_id: string;
          id?: string;
          token: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          group_id?: string;
          id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_invites_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_admins: {
        Row: {
          group_id: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_admins_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_creators: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug_id: string;
          viability_threshold: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug_id: string;
          viability_threshold?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug_id?: string;
          viability_threshold?: number;
        };
        Relationships: [];
      };
      players: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          name: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          name: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "players_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          candidate_days: number[];
          confirmed_day: number | null;
          created_at: string;
          group_id: string;
          id: string;
          status: Database["public"]["Enums"]["session_status"];
          week_start: string;
        };
        Insert: {
          candidate_days: number[];
          confirmed_day?: number | null;
          created_at?: string;
          group_id: string;
          id: string;
          status?: Database["public"]["Enums"]["session_status"];
          week_start: string;
        };
        Update: {
          candidate_days?: number[];
          confirmed_day?: number | null;
          created_at?: string;
          group_id?: string;
          id?: string;
          status?: Database["public"]["Enums"]["session_status"];
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      vote_responses: {
        Row: {
          player_id: string;
          session_id: string;
          updated_at: string;
        };
        Insert: {
          player_id: string;
          session_id: string;
          updated_at?: string;
        };
        Update: {
          player_id?: string;
          session_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vote_responses_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vote_responses_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "session_day_tallies";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "vote_responses_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      votes: {
        Row: {
          day: number;
          player_id: string;
          session_id: string;
        };
        Insert: {
          day: number;
          player_id: string;
          session_id: string;
        };
        Update: {
          day?: number;
          player_id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "votes_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "session_day_tallies";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "votes_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      session_day_tallies: {
        Row: {
          day: number | null;
          session_id: string | null;
          viable: boolean | null;
          voter_ids: string[] | null;
          yes_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string };
      create_group: { Args: { p_name: string }; Returns: string };
      is_group_admin: { Args: { p_group_id: string }; Returns: boolean };
      submit_votes: {
        Args: { p_days: number[]; p_player_id: string; p_session_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      session_status: "open" | "confirmed" | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      session_status: ["open", "confirmed", "closed"],
    },
  },
} as const;
