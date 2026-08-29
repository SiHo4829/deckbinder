export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      card_keywords: {
        Row: {
          card_id: string
          keyword_id: string
        }
        Insert: {
          card_id: string
          keyword_id: string
        }
        Update: {
          card_id?: string
          keyword_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_keywords_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_keywords_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      card_sets: {
        Row: {
          code: string
          created_at: string
          game_id: string
          id: string
          name_ja: string
          name_ko: string | null
          released_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          game_id: string
          id?: string
          name_ja: string
          name_ko?: string | null
          released_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          game_id?: string
          id?: string
          name_ja?: string
          name_ko?: string | null
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_sets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          attribute: string | null
          base_code: string | null
          block_number: number | null
          card_type: string | null
          code: string
          colors: string[] | null
          cost: number | null
          counter: number | null
          created_at: string
          effect_text: string | null
          game_id: string
          id: string
          illustration_type: string | null
          image_url: string | null
          life: number | null
          name_en: string | null
          name_ja: string | null
          name_ko: string | null
          power: number | null
          rarity: string | null
          set_id: string | null
          source_image_url: string | null
          sub_type: string | null
          traits: string[] | null
          trigger_text: string | null
          updated_at: string
        }
        Insert: {
          attribute?: string | null
          base_code?: string | null
          block_number?: number | null
          card_type?: string | null
          code: string
          colors?: string[] | null
          cost?: number | null
          counter?: number | null
          created_at?: string
          effect_text?: string | null
          game_id: string
          id?: string
          illustration_type?: string | null
          image_url?: string | null
          life?: number | null
          name_en?: string | null
          name_ja?: string | null
          name_ko?: string | null
          power?: number | null
          rarity?: string | null
          set_id?: string | null
          source_image_url?: string | null
          sub_type?: string | null
          traits?: string[] | null
          trigger_text?: string | null
          updated_at?: string
        }
        Update: {
          attribute?: string | null
          base_code?: string | null
          block_number?: number | null
          card_type?: string | null
          code?: string
          colors?: string[] | null
          cost?: number | null
          counter?: number | null
          created_at?: string
          effect_text?: string | null
          game_id?: string
          id?: string
          illustration_type?: string | null
          image_url?: string | null
          life?: number | null
          name_en?: string | null
          name_ja?: string | null
          name_ko?: string | null
          power?: number | null
          rarity?: string | null
          set_id?: string | null
          source_image_url?: string | null
          sub_type?: string | null
          traits?: string[] | null
          trigger_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_set_same_game_fk"
            columns: ["set_id", "game_id"]
            isOneToOne: false
            referencedRelation: "card_sets"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      games: {
        Row: {
          code: string
          copy_limit: number
          created_at: string
          deck_size: number
          hand_size: number
          id: string
          name_ja: string
          name_ko: string
        }
        Insert: {
          code: string
          copy_limit: number
          created_at?: string
          deck_size: number
          hand_size: number
          id?: string
          name_ja: string
          name_ko: string
        }
        Update: {
          code?: string
          copy_limit?: number
          created_at?: string
          deck_size?: number
          hand_size?: number
          id?: string
          name_ja?: string
          name_ko?: string
        }
        Relationships: []
      }
      keywords: {
        Row: {
          code: string
          created_at: string
          game_id: string
          id: string
          label_ja: string | null
          label_ko: string
        }
        Insert: {
          code: string
          created_at?: string
          game_id: string
          id?: string
          label_ja?: string | null
          label_ko: string
        }
        Update: {
          code?: string
          created_at?: string
          game_id?: string
          id?: string
          label_ja?: string | null
          label_ko?: string
        }
        Relationships: [
          {
            foreignKeyName: "keywords_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          author_name: string | null
          content_md: string
          created_at: string
          id: string
          published_at: string | null
          slug: string
          summary: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          content_md: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug: string
          summary?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          content_md?: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string
          summary?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      card_facets: {
        Args: { p_game_code?: string }
        Returns: {
          card_count: number
          facet: string
          value: string
        }[]
      }
      search_cards: {
        Args: {
          p_attribute?: string
          p_card_type?: string
          p_cursor?: string
          p_cursor_id?: string
          p_game_code?: string
          p_keyword_codes?: string[]
          p_limit?: number
          p_q?: string
          p_rarity?: string
          p_set_id?: string
        }
        Returns: {
          attribute: string
          card_type: string
          code: string
          id: string
          image_url: string
          name_ja: string
          name_ko: string
          rarity: string
          set_id: string
          sub_type: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

