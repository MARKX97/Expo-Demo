export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      work_order_attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          position: number
          size_bytes: number
          storage_path: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id: string
          mime_type: string
          position: number
          size_bytes: number
          storage_path: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          position?: number
          size_bytes?: number
          storage_path?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_attachments_work_order_id_fkey"
            columns: ["work_order_id"]
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assignee_id: string
          closed_at: string | null
          created_at: string
          created_by: string
          description: string
          elevator_area: string
          elevator_code: string
          id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          resolution: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          version: number
        }
        Insert: {
          assignee_id: string
          closed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          elevator_area: string
          elevator_code: string
          id: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          resolution?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          assignee_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          elevator_area?: string
          elevator_code?: string
          id?: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          resolution?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assignee_id_fkey"
            columns: ["assignee_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_profile_summary: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      can_read_work_order: {
        Args: { p_work_order_id: string }
        Returns: boolean
      }
      close_work_order: {
        Args: { p_expected_version: number; p_id: string; p_resolution: string }
        Returns: {
          assignee_id: string
          closed_at: string
          id: string
          resolution: string
          started_at: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          version: number
        }[]
      }
      create_work_order: {
        Args: {
          p_assignee_id: string
          p_attachments: Json
          p_description: string
          p_elevator_area: string
          p_elevator_code: string
          p_id: string
          p_priority: Database["public"]["Enums"]["work_order_priority"]
        }
        Returns: {
          assignee_id: string
          closed_at: string
          id: string
          resolution: string
          started_at: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          version: number
        }[]
      }
      current_user_is_supervisor: { Args: never; Returns: boolean }
      list_active_engineers: {
        Args: never
        Returns: {
          display_name: string
          id: string
        }[]
      }
      reassign_work_order: {
        Args: {
          p_assignee_id: string
          p_expected_version: number
          p_id: string
        }
        Returns: {
          assignee_id: string
          closed_at: string
          id: string
          resolution: string
          started_at: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          version: number
        }[]
      }
      start_work_order: {
        Args: { p_expected_version: number; p_id: string }
        Returns: {
          assignee_id: string
          closed_at: string
          id: string
          resolution: string
          started_at: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          version: number
        }[]
      }
    }
    Enums: {
      app_role: "elevator_supervisor" | "elevator_engineer"
      work_order_priority: "normal" | "urgent"
      work_order_status: "assigned" | "in_progress" | "closed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["elevator_supervisor", "elevator_engineer"],
      work_order_priority: ["normal", "urgent"],
      work_order_status: ["assigned", "in_progress", "closed"],
    },
  },
} as const
