export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ab_experiments: {
        Row: {
          auto_select_winner: boolean
          completed_at: string | null
          confidence_threshold: number
          created_at: string
          hypothesis: string | null
          id: string
          min_sample_per_variant: number
          name: string
          primary_metric: string
          started_at: string | null
          status: string
          traffic_split: Json
          winner_variant_id: string | null
        }
        Insert: {
          auto_select_winner?: boolean
          completed_at?: string | null
          confidence_threshold?: number
          created_at?: string
          hypothesis?: string | null
          id?: string
          min_sample_per_variant?: number
          name: string
          primary_metric?: string
          started_at?: string | null
          status?: string
          traffic_split?: Json
          winner_variant_id?: string | null
        }
        Update: {
          auto_select_winner?: boolean
          completed_at?: string | null
          confidence_threshold?: number
          created_at?: string
          hypothesis?: string | null
          id?: string
          min_sample_per_variant?: number
          name?: string
          primary_metric?: string
          started_at?: string | null
          status?: string
          traffic_split?: Json
          winner_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_experiments_winner"
            columns: ["winner_variant_id"]
            isOneToOne: false
            referencedRelation: "ab_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_variants: {
        Row: {
          created_at: string
          delivered_count: number
          experiment_id: string
          fail_count: number
          id: string
          is_winner: boolean
          reply_count: number
          send_count: number
          template_id: string
          variant_label: string
        }
        Insert: {
          created_at?: string
          delivered_count?: number
          experiment_id: string
          fail_count?: number
          id?: string
          is_winner?: boolean
          reply_count?: number
          send_count?: number
          template_id: string
          variant_label: string
        }
        Update: {
          created_at?: string
          delivered_count?: number
          experiment_id?: string
          fail_count?: number
          id?: string
          is_winner?: boolean
          reply_count?: number
          send_count?: number
          template_id?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "ab_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_variants_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      blacklist: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          phone: string
          reason: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          phone: string
          reason?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          ab_experiment_id: string | null
          completed_at: string | null
          created_at: string
          daily_limit: number
          description: string | null
          failed_count: number
          id: string
          jitter_max: number
          jitter_min: number
          name: string
          per_account_limit: number
          presence_max_sec: number
          presence_min_sec: number
          scheduled_date: string | null
          segment_id: string | null
          send_window_end: number
          send_window_start: number
          sent_count: number
          status: string
          template_id: string | null
          total_recipients: number
          updated_at: string
        }
        Insert: {
          ab_experiment_id?: string | null
          completed_at?: string | null
          created_at?: string
          daily_limit?: number
          description?: string | null
          failed_count?: number
          id?: string
          jitter_max?: number
          jitter_min?: number
          name: string
          per_account_limit?: number
          presence_max_sec?: number
          presence_min_sec?: number
          scheduled_date?: string | null
          segment_id?: string | null
          send_window_end?: number
          send_window_start?: number
          sent_count?: number
          status?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          ab_experiment_id?: string | null
          completed_at?: string | null
          created_at?: string
          daily_limit?: number
          description?: string | null
          failed_count?: number
          id?: string
          jitter_max?: number
          jitter_min?: number
          name?: string
          per_account_limit?: number
          presence_max_sec?: number
          presence_min_sec?: number
          scheduled_date?: string | null
          segment_id?: string | null
          send_window_end?: number
          send_window_start?: number
          sent_count?: number
          status?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ab_experiment_id_fkey"
            columns: ["ab_experiment_id"]
            isOneToOne: false
            referencedRelation: "ab_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "contact_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_segments: {
        Row: {
          contact_count: number
          created_at: string
          description: string | null
          filter_rules: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          contact_count?: number
          created_at?: string
          description?: string | null
          filter_rules?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          contact_count?: number
          created_at?: string
          description?: string | null
          filter_rules?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          is_blacklisted: boolean
          last_contacted_at: string | null
          name: string | null
          phone: string
          source: string
          tags: string[]
          total_messages_sent: number
          total_replies: number
        }
        Insert: {
          company?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          is_blacklisted?: boolean
          last_contacted_at?: string | null
          name?: string | null
          phone: string
          source?: string
          tags?: string[]
          total_messages_sent?: number
          total_replies?: number
        }
        Update: {
          company?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          is_blacklisted?: boolean
          last_contacted_at?: string | null
          name?: string | null
          phone?: string
          source?: string
          tags?: string[]
          total_messages_sent?: number
          total_replies?: number
        }
        Relationships: []
      }
      message_queue: {
        Row: {
          assigned_account_id: string | null
          attempt_count: number
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          message_body: string | null
          message_template: string
          recipient_name: string | null
          recipient_phone: string
          scheduled_for: string
          sent_at: string | null
          status: string
          variant_id: string | null
        }
        Insert: {
          assigned_account_id?: string | null
          attempt_count?: number
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          message_body?: string | null
          message_template: string
          recipient_name?: string | null
          recipient_phone: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          variant_id?: string | null
        }
        Update: {
          assigned_account_id?: string | null
          attempt_count?: number
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          message_body?: string | null
          message_template?: string
          recipient_name?: string | null
          recipient_phone?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_assigned_account_id_fkey"
            columns: ["assigned_account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ab_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          preview_text: string | null
          total_delivered: number
          total_replied: number
          total_sent: number
          updated_at: string
          usage_count: number
          variables: Json
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          preview_text?: string | null
          total_delivered?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
          usage_count?: number
          variables?: Json
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          preview_text?: string | null
          total_delivered?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
          usage_count?: number
          variables?: Json
        }
        Relationships: []
      }
      send_logs: {
        Row: {
          account_id: string
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          queue_item_id: string
          status: string
          variant_id: string | null
        }
        Insert: {
          account_id: string
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          queue_item_id: string
          status: string
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          queue_item_id?: string
          status?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "send_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_logs_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "message_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_logs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ab_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      wa_accounts: {
        Row: {
          connection_status: string
          cooldown_until: string | null
          created_at: string
          daily_limit: number
          display_name: string
          id: string
          is_archived: boolean
          last_connected_at: string | null
          last_message_at: string | null
          messages_sent_today: number
          pairing_qr: string | null
          phone_number: string
          session_data: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          connection_status?: string
          cooldown_until?: string | null
          created_at?: string
          daily_limit?: number
          display_name: string
          id?: string
          is_archived?: boolean
          last_connected_at?: string | null
          last_message_at?: string | null
          messages_sent_today?: number
          pairing_qr?: string | null
          phone_number: string
          session_data?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          connection_status?: string
          cooldown_until?: string | null
          created_at?: string
          daily_limit?: number
          display_name?: string
          id?: string
          is_archived?: boolean
          last_connected_at?: string | null
          last_message_at?: string | null
          messages_sent_today?: number
          pairing_qr?: string | null
          phone_number?: string
          session_data?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      daily_reset: { Args: never; Returns: undefined }
      user_role: { Args: never; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
