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
      employees: {
        Row: {
          active: boolean
          contract_type: string | null
          created_at: string
          department: string | null
          email: string | null
          employee_number: string | null
          end_date: string | null
          first_name: string
          function_title: string | null
          hire_date: string | null
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          contract_type?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employee_number?: string | null
          end_date?: string | null
          first_name: string
          function_title?: string | null
          hire_date?: string | null
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          contract_type?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employee_number?: string | null
          end_date?: string | null
          first_name?: string
          function_title?: string | null
          hire_date?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          follow_up_notes: string | null
          id: string
          involved_firm: string | null
          location: string | null
          observed_at: string
          reporter_employee_id: string | null
          reporter_id: string | null
          severity: Database["public"]["Enums"]["report_severity"]
          status: Database["public"]["Enums"]["report_status"]
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          follow_up_notes?: string | null
          id?: string
          involved_firm?: string | null
          location?: string | null
          observed_at?: string
          reporter_employee_id?: string | null
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["report_severity"]
          status?: Database["public"]["Enums"]["report_status"]
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          follow_up_notes?: string | null
          id?: string
          involved_firm?: string | null
          location?: string | null
          observed_at?: string
          reporter_employee_id?: string | null
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["report_severity"]
          status?: Database["public"]["Enums"]["report_status"]
          title?: string
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_employee_id_fkey"
            columns: ["reporter_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_observations: {
        Row: {
          action_taken: string | null
          area: string | null
          company_action: string | null
          created_at: string
          hazards: string[]
          id: string
          improvement_proposal: string | null
          involved_party: string | null
          location: string | null
          observed_date: string
          observed_time: string | null
          plant: string | null
          reporter_function: string | null
          reporter_id: string | null
          reporter_name: string
          risks: string[]
          situation_description: string | null
          status: Database["public"]["Enums"]["report_status"]
          type: Database["public"]["Enums"]["safety_observation_type"]
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          area?: string | null
          company_action?: string | null
          created_at?: string
          hazards?: string[]
          id?: string
          improvement_proposal?: string | null
          involved_party?: string | null
          location?: string | null
          observed_date?: string
          observed_time?: string | null
          plant?: string | null
          reporter_function?: string | null
          reporter_id?: string | null
          reporter_name: string
          risks?: string[]
          situation_description?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          type: Database["public"]["Enums"]["safety_observation_type"]
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          area?: string | null
          company_action?: string | null
          created_at?: string
          hazards?: string[]
          id?: string
          improvement_proposal?: string | null
          involved_party?: string | null
          location?: string | null
          observed_date?: string
          observed_time?: string | null
          plant?: string | null
          reporter_function?: string | null
          reporter_id?: string | null
          reporter_name?: string
          risks?: string[]
          situation_description?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          type?: Database["public"]["Enums"]["safety_observation_type"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "hse_manager" | "manager" | "operator"
      report_severity: "laag" | "middel" | "hoog" | "kritiek"
      report_status: "open" | "in_behandeling" | "opgevolgd" | "gesloten"
      report_type:
        | "mos"
        | "stop"
        | "ao_ehbo"
        | "werkplekinspectie"
        | "kwaliteit"
        | "klacht"
        | "andere"
      safety_observation_type: "mos" | "stop"
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
      app_role: ["admin", "hse_manager", "manager", "operator"],
      report_severity: ["laag", "middel", "hoog", "kritiek"],
      report_status: ["open", "in_behandeling", "opgevolgd", "gesloten"],
      report_type: [
        "mos",
        "stop",
        "ao_ehbo",
        "werkplekinspectie",
        "kwaliteit",
        "klacht",
        "andere",
      ],
      safety_observation_type: ["mos", "stop"],
    },
  },
} as const
