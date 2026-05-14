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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          current_total_savings: number
          estimated_electricity: number
          estimated_gas: number
          estimated_water: number
          fixed_costs: number
          id: string
          initial_budget: number
          initial_total_assets: number
          last_monthly_reset_logical_date: string | null
          last_salary_cycle_logical_date: string | null
          monthly_income: number
          payday: number
          payday_rule: Database["public"]["Enums"]["payday_rule"]
          surplus_mode: Database["public"]["Enums"]["surplus_mode"]
          target_amount: number
          target_anchor_logical_date: string
          target_date: string
          target_duration_months: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_total_savings: number
          estimated_electricity: number
          estimated_gas: number
          estimated_water: number
          fixed_costs: number
          id: string
          initial_budget: number
          initial_total_assets: number
          last_monthly_reset_logical_date?: string | null
          last_salary_cycle_logical_date?: string | null
          monthly_income: number
          payday: number
          payday_rule: Database["public"]["Enums"]["payday_rule"]
          surplus_mode: Database["public"]["Enums"]["surplus_mode"]
          target_amount: number
          target_anchor_logical_date: string
          target_date: string
          target_duration_months: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_total_savings?: number
          estimated_electricity?: number
          estimated_gas?: number
          estimated_water?: number
          fixed_costs?: number
          id?: string
          initial_budget?: number
          initial_total_assets?: number
          last_monthly_reset_logical_date?: string | null
          last_salary_cycle_logical_date?: string | null
          monthly_income?: number
          payday?: number
          payday_rule?: Database["public"]["Enums"]["payday_rule"]
          surplus_mode?: Database["public"]["Enums"]["surplus_mode"]
          target_amount?: number
          target_anchor_logical_date?: string
          target_date?: string
          target_duration_months?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          logical_date: string
          memo: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          utility_type: Database["public"]["Enums"]["utility_type"] | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          logical_date: string
          memo?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          utility_type?: Database["public"]["Enums"]["utility_type"] | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          logical_date?: string
          memo?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          utility_type?: Database["public"]["Enums"]["utility_type"] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_special_transaction_and_decrement_savings: {
        Args: { p_amount: number; p_logical_date: string; p_memo: string }
        Returns: {
          amount: number
          created_at: string
          id: string
          logical_date: string
          memo: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          utility_type: Database["public"]["Enums"]["utility_type"] | null
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_own_transaction_and_restore_savings: {
        Args: { p_transaction_id: string }
        Returns: {
          amount: number
          created_at: string
          id: string
          logical_date: string
          memo: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          utility_type: Database["public"]["Enums"]["utility_type"] | null
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_own_data_atomic: { Args: never; Returns: number }
    }
    Enums: {
      payday_rule: "BEFORE" | "AFTER" | "FIXED"
      surplus_mode: "STRICT" | "YUTORI"
      transaction_type: "NORMAL" | "SPECIAL"
      utility_type: "ELECTRICITY" | "GAS" | "WATER"
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
    Enums: {
      payday_rule: ["BEFORE", "AFTER", "FIXED"],
      surplus_mode: ["STRICT", "YUTORI"],
      transaction_type: ["NORMAL", "SPECIAL"],
      utility_type: ["ELECTRICITY", "GAS", "WATER"],
    },
  },
} as const
