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
      employee_evaluations: {
        Row: {
          created_at: string
          employee_id: string
          employee_name: string
          evaluated_on: string
          evaluator_id: string | null
          evaluator_name: string
          evaluator_signature: string | null
          id: string
          location: string
          notes: string | null
          scores: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          employee_name: string
          evaluated_on?: string
          evaluator_id?: string | null
          evaluator_name: string
          evaluator_signature?: string | null
          id?: string
          location: string
          notes?: string | null
          scores?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          employee_name?: string
          evaluated_on?: string
          evaluator_id?: string | null
          evaluator_name?: string
          evaluator_signature?: string | null
          id?: string
          location?: string
          notes?: string | null
          scores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          contract_type: string | null
          created_at: string
          department: string | null
          email: string | null
          employee_number: string | null
          employer: string | null
          end_date: string | null
          first_name: string
          function_title: string | null
          hire_date: string | null
          id: string
          last_name: string
          last_synced_at: string | null
          monday_board_id: number | null
          monday_item_id: number | null
          nickname: string | null
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
          employer?: string | null
          end_date?: string | null
          first_name: string
          function_title?: string | null
          hire_date?: string | null
          id?: string
          last_name: string
          last_synced_at?: string | null
          monday_board_id?: number | null
          monday_item_id?: number | null
          nickname?: string | null
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
          employer?: string | null
          end_date?: string | null
          first_name?: string
          function_title?: string | null
          hire_date?: string | null
          id?: string
          last_name?: string
          last_synced_at?: string | null
          monday_board_id?: number | null
          monday_item_id?: number | null
          nickname?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      form_drafts: {
        Row: {
          created_at: string
          form_key: string
          form_type: string
          id: string
          last_saved_at: string
          payload: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          form_key?: string
          form_type: string
          id?: string
          last_saved_at?: string
          payload?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          form_key?: string
          form_type?: string
          id?: string
          last_saved_at?: string
          payload?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monday_sync_events: {
        Row: {
          employee_id: string | null
          error: string | null
          event_type: string | null
          id: string
          monday_board_id: number | null
          monday_item_id: number | null
          payload: Json
          received_at: string
          status: string
        }
        Insert: {
          employee_id?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          monday_board_id?: number | null
          monday_item_id?: number | null
          payload: Json
          received_at?: string
          status: string
        }
        Update: {
          employee_id?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          monday_board_id?: number | null
          monday_item_id?: number | null
          payload?: Json
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monday_sync_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
          details: Json
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
          details?: Json
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
          details?: Json
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
      risk_analyses: {
        Row: {
          analysis_type: Database["public"]["Enums"]["risk_analysis_type"]
          created_at: string
          created_by: string | null
          current_version: number
          department: string | null
          description: string | null
          id: string
          risk_method: Database["public"]["Enums"]["risk_method"]
          status: Database["public"]["Enums"]["risk_analysis_status"]
          title: string
          updated_at: string
          workpost: string | null
        }
        Insert: {
          analysis_type?: Database["public"]["Enums"]["risk_analysis_type"]
          created_at?: string
          created_by?: string | null
          current_version?: number
          department?: string | null
          description?: string | null
          id?: string
          risk_method?: Database["public"]["Enums"]["risk_method"]
          status?: Database["public"]["Enums"]["risk_analysis_status"]
          title: string
          updated_at?: string
          workpost?: string | null
        }
        Update: {
          analysis_type?: Database["public"]["Enums"]["risk_analysis_type"]
          created_at?: string
          created_by?: string | null
          current_version?: number
          department?: string | null
          description?: string | null
          id?: string
          risk_method?: Database["public"]["Enums"]["risk_method"]
          status?: Database["public"]["Enums"]["risk_analysis_status"]
          title?: string
          updated_at?: string
          workpost?: string | null
        }
        Relationships: []
      }
      risk_analysis_items: {
        Row: {
          activity: string | null
          created_at: string
          hazard: string
          id: string
          measure_types: Database["public"]["Enums"]["risk_measure_type"][]
          measures: string | null
          notes: string | null
          position: number
          residual_b: number | null
          residual_e: number | null
          residual_r: number | null
          residual_w: number | null
          risk_description: string | null
          score_b: number | null
          score_e: number | null
          score_r: number | null
          score_w: number | null
          updated_at: string
          version_id: string
        }
        Insert: {
          activity?: string | null
          created_at?: string
          hazard: string
          id?: string
          measure_types?: Database["public"]["Enums"]["risk_measure_type"][]
          measures?: string | null
          notes?: string | null
          position?: number
          residual_b?: number | null
          residual_e?: number | null
          residual_r?: number | null
          residual_w?: number | null
          risk_description?: string | null
          score_b?: number | null
          score_e?: number | null
          score_r?: number | null
          score_w?: number | null
          updated_at?: string
          version_id: string
        }
        Update: {
          activity?: string | null
          created_at?: string
          hazard?: string
          id?: string
          measure_types?: Database["public"]["Enums"]["risk_measure_type"][]
          measures?: string | null
          notes?: string | null
          position?: number
          residual_b?: number | null
          residual_e?: number | null
          residual_r?: number | null
          residual_w?: number | null
          risk_description?: string | null
          score_b?: number | null
          score_e?: number | null
          score_r?: number | null
          score_w?: number | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_analysis_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "risk_analysis_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_analysis_sessions: {
        Row: {
          analysis_id: string
          created_at: string
          created_by: string | null
          given_at: string | null
          given_by: string | null
          given_by_name: string | null
          id: string
          location: string | null
          notes: string | null
          scheduled_at: string | null
          signing_token: string
          status: Database["public"]["Enums"]["risk_session_status"]
          updated_at: string
          version_id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          created_by?: string | null
          given_at?: string | null
          given_by?: string | null
          given_by_name?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          scheduled_at?: string | null
          signing_token?: string
          status?: Database["public"]["Enums"]["risk_session_status"]
          updated_at?: string
          version_id: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          created_by?: string | null
          given_at?: string | null
          given_by?: string | null
          given_by_name?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          scheduled_at?: string | null
          signing_token?: string
          status?: Database["public"]["Enums"]["risk_session_status"]
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_analysis_sessions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "risk_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_analysis_sessions_given_by_fkey"
            columns: ["given_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_analysis_sessions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "risk_analysis_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_analysis_signatures: {
        Row: {
          employee_id: string
          id: string
          session_id: string
          sign_method: Database["public"]["Enums"]["risk_sign_method"]
          signature_data: string
          signed_at: string
          signed_by_user_id: string | null
        }
        Insert: {
          employee_id: string
          id?: string
          session_id: string
          sign_method?: Database["public"]["Enums"]["risk_sign_method"]
          signature_data: string
          signed_at?: string
          signed_by_user_id?: string | null
        }
        Update: {
          employee_id?: string
          id?: string
          session_id?: string
          sign_method?: Database["public"]["Enums"]["risk_sign_method"]
          signature_data?: string
          signed_at?: string
          signed_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_analysis_signatures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_analysis_signatures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "risk_analysis_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_analysis_versions: {
        Row: {
          analysis_id: string
          change_notes: string | null
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          version_number: number
        }
        Insert: {
          analysis_id: string
          change_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          version_number: number
        }
        Update: {
          analysis_id?: string
          change_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_analysis_versions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "risk_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_session_participants: {
        Row: {
          employee_id: string
          session_id: string
        }
        Insert: {
          employee_id: string
          session_id: string
        }
        Update: {
          employee_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_session_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "risk_analysis_sessions"
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
          photos: Json
          plant: string | null
          public_token: string
          reporter_function: string | null
          reporter_id: string | null
          reporter_name: string
          risks: string[]
          signature_data_url: string | null
          signer_function: string | null
          signer_name: string | null
          situation_description: string | null
          status: Database["public"]["Enums"]["report_status"]
          submitted_via: string
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
          photos?: Json
          plant?: string | null
          public_token?: string
          reporter_function?: string | null
          reporter_id?: string | null
          reporter_name: string
          risks?: string[]
          signature_data_url?: string | null
          signer_function?: string | null
          signer_name?: string | null
          situation_description?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_via?: string
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
          photos?: Json
          plant?: string | null
          public_token?: string
          reporter_function?: string | null
          reporter_id?: string | null
          reporter_name?: string
          risks?: string[]
          signature_data_url?: string | null
          signer_function?: string | null
          signer_name?: string | null
          situation_description?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_via?: string
          type?: Database["public"]["Enums"]["safety_observation_type"]
          updated_at?: string
        }
        Relationships: []
      }
      toolbox_session_participants: {
        Row: {
          added_at: string
          employee_id: string
          session_id: string
        }
        Insert: {
          added_at?: string
          employee_id: string
          session_id: string
        }
        Update: {
          added_at?: string
          employee_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_session_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolbox_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "toolbox_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          given_at: string | null
          given_by_employee_id: string | null
          id: string
          location: string | null
          notes: string | null
          scheduled_at: string | null
          signing_token: string
          status: Database["public"]["Enums"]["toolbox_session_status"]
          toolbox_id: string
          updated_at: string
          version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          given_at?: string | null
          given_by_employee_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          scheduled_at?: string | null
          signing_token?: string
          status?: Database["public"]["Enums"]["toolbox_session_status"]
          toolbox_id: string
          updated_at?: string
          version_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          given_at?: string | null
          given_by_employee_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          scheduled_at?: string | null
          signing_token?: string
          status?: Database["public"]["Enums"]["toolbox_session_status"]
          toolbox_id?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_sessions_given_by_employee_id_fkey"
            columns: ["given_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolbox_sessions_toolbox_id_fkey"
            columns: ["toolbox_id"]
            isOneToOne: false
            referencedRelation: "toolboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolbox_sessions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "toolbox_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_signatures: {
        Row: {
          employee_id: string
          id: string
          session_id: string
          sign_method: Database["public"]["Enums"]["toolbox_sign_method"]
          signature_data: string
          signed_at: string
          signed_by_user_id: string | null
        }
        Insert: {
          employee_id: string
          id?: string
          session_id: string
          sign_method: Database["public"]["Enums"]["toolbox_sign_method"]
          signature_data: string
          signed_at?: string
          signed_by_user_id?: string | null
        }
        Update: {
          employee_id?: string
          id?: string
          session_id?: string
          sign_method?: Database["public"]["Enums"]["toolbox_sign_method"]
          signature_data?: string
          signed_at?: string
          signed_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_signatures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolbox_signatures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "toolbox_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_versions: {
        Row: {
          change_notes: string | null
          content: Json
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          toolbox_id: string
          version_number: number
        }
        Insert: {
          change_notes?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          toolbox_id: string
          version_number: number
        }
        Update: {
          change_notes?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          toolbox_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_versions_toolbox_id_fkey"
            columns: ["toolbox_id"]
            isOneToOne: false
            referencedRelation: "toolboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      toolboxes: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          current_version: number
          description: string | null
          id: string
          status: Database["public"]["Enums"]["toolbox_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["toolbox_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["toolbox_status"]
          title?: string
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
        | "kwaliteitscontrole"
      risk_analysis_status: "draft" | "published" | "archived"
      risk_analysis_type: "werkpost" | "tra" | "lmra" | "rie"
      risk_measure_type: "technical" | "organizational" | "human"
      risk_method: "fine_kinney" | "kans_ernst"
      risk_session_status: "planned" | "in_progress" | "completed" | "cancelled"
      risk_sign_method: "kiosk" | "qr" | "login"
      safety_observation_type: "mos" | "stop"
      toolbox_session_status:
        | "planned"
        | "in_progress"
        | "completed"
        | "cancelled"
      toolbox_sign_method: "kiosk" | "qr" | "login"
      toolbox_status: "draft" | "published" | "archived"
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
        "kwaliteitscontrole",
      ],
      risk_analysis_status: ["draft", "published", "archived"],
      risk_analysis_type: ["werkpost", "tra", "lmra", "rie"],
      risk_measure_type: ["technical", "organizational", "human"],
      risk_method: ["fine_kinney", "kans_ernst"],
      risk_session_status: ["planned", "in_progress", "completed", "cancelled"],
      risk_sign_method: ["kiosk", "qr", "login"],
      safety_observation_type: ["mos", "stop"],
      toolbox_session_status: [
        "planned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      toolbox_sign_method: ["kiosk", "qr", "login"],
      toolbox_status: ["draft", "published", "archived"],
    },
  },
} as const
