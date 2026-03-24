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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      aeronautical_charts: {
        Row: {
          airport_icao: string
          chart_name: string
          chart_type: string
          chart_url: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          airport_icao: string
          chart_name: string
          chart_type?: string
          chart_url: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          airport_icao?: string
          chart_name?: string
          chart_type?: string
          chart_url?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: []
      }
      aircraft: {
        Row: {
          created_at: string
          description: string | null
          family: string
          id: string
          multiplier: number
          name: string
          price: number
          seats: number
          type_code: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          family: string
          id?: string
          multiplier?: number
          name: string
          price?: number
          seats: number
          type_code: string
        }
        Update: {
          created_at?: string
          description?: string | null
          family?: string
          id?: string
          multiplier?: number
          name?: string
          price?: number
          seats?: number
          type_code?: string
        }
        Relationships: []
      }
      base_transfer_requests: {
        Row: {
          current_base: string
          id: string
          notes: string | null
          requested_at: string
          requested_base: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          current_base: string
          id?: string
          notes?: string | null
          requested_at?: string
          requested_base: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          current_base?: string
          id?: string
          notes?: string | null
          requested_at?: string
          requested_base?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      bases: {
        Row: {
          created_at: string
          icao_code: string
          id: string
          multiplier: number
          name: string
        }
        Insert: {
          created_at?: string
          icao_code: string
          id?: string
          multiplier?: number
          name: string
        }
        Update: {
          created_at?: string
          icao_code?: string
          id?: string
          multiplier?: number
          name?: string
        }
        Relationships: []
      }
      career_requests: {
        Row: {
          departure_base: string | null
          id: string
          notes: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          routing_rule: string | null
          status: string
          user_id: string
        }
        Insert: {
          departure_base?: string | null
          id?: string
          notes?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          routing_rule?: string | null
          status?: string
          user_id: string
        }
        Update: {
          departure_base?: string | null
          id?: string
          notes?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          routing_rule?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      departure_bases: {
        Row: {
          created_at: string
          icao_code: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          icao_code: string
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          icao_code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      dispatch_legs: {
        Row: {
          aircraft_id: string
          assigned_at: string
          assigned_by: string | null
          callsign: string
          completed_at: string | null
          dispatch_group_id: string | null
          id: string
          leg_number: number
          livery: string | null
          route_id: string
          status: string
          tail_number: string | null
          user_id: string
        }
        Insert: {
          aircraft_id: string
          assigned_at?: string
          assigned_by?: string | null
          callsign: string
          completed_at?: string | null
          dispatch_group_id?: string | null
          id?: string
          leg_number: number
          livery?: string | null
          route_id: string
          status?: string
          tail_number?: string | null
          user_id: string
        }
        Update: {
          aircraft_id?: string
          assigned_at?: string
          assigned_by?: string | null
          callsign?: string
          completed_at?: string | null
          dispatch_group_id?: string | null
          id?: string
          leg_number?: number
          livery?: string | null
          route_id?: string
          status?: string
          tail_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_legs_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_legs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      notams: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          priority: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          title?: string
        }
        Relationships: []
      }
      pireps: {
        Row: {
          aircraft_id: string
          arrival_airport: string
          cargo_weight_kg: number | null
          departure_airport: string
          dispatch_leg_id: string | null
          flight_number: string
          flight_time_hrs: number
          flight_time_mins: number
          fuel_used: number | null
          id: string
          landing_rate: number | null
          money_earned: number | null
          passengers: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          route_id: string | null
          status: string
          submitted_at: string
          tail_number: string | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          aircraft_id: string
          arrival_airport: string
          cargo_weight_kg?: number | null
          departure_airport: string
          dispatch_leg_id?: string | null
          flight_number: string
          flight_time_hrs: number
          flight_time_mins?: number
          fuel_used?: number | null
          id?: string
          landing_rate?: number | null
          money_earned?: number | null
          passengers?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_id?: string | null
          status?: string
          submitted_at?: string
          tail_number?: string | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          aircraft_id?: string
          arrival_airport?: string
          cargo_weight_kg?: number | null
          departure_airport?: string
          dispatch_leg_id?: string | null
          flight_number?: string
          flight_time_hrs?: number
          flight_time_mins?: number
          fuel_used?: number | null
          id?: string
          landing_rate?: number | null
          money_earned?: number | null
          passengers?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_id?: string | null
          status?: string
          submitted_at?: string
          tail_number?: string | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pireps_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pireps_dispatch_leg_id_fkey"
            columns: ["dispatch_leg_id"]
            isOneToOne: false
            referencedRelation: "dispatch_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pireps_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_aircraft_family: string | null
          base_airport: string | null
          callsign: string
          created_at: string
          discord_id: string | null
          discord_username: string | null
          id: string
          ifc_username: string | null
          is_approved: boolean
          money: number
          name: string
          rank: string
          simbrief_pid: string | null
          total_flights: number
          total_hours: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          active_aircraft_family?: string | null
          base_airport?: string | null
          callsign: string
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          id?: string
          ifc_username?: string | null
          is_approved?: boolean
          money?: number
          name: string
          rank?: string
          simbrief_pid?: string | null
          total_flights?: number
          total_hours?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          active_aircraft_family?: string | null
          base_airport?: string | null
          callsign?: string
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          id?: string
          ifc_username?: string | null
          is_approved?: boolean
          money?: number
          name?: string
          rank?: string
          simbrief_pid?: string | null
          total_flights?: number
          total_hours?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      ranks: {
        Row: {
          created_at: string
          id: string
          min_hours: number
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          min_hours?: number
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          min_hours?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      registration_approvals: {
        Row: {
          base_airport: string
          callsign: string
          email: string
          id: string
          ifc_username: string | null
          name: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          simbrief_pid: string | null
          status: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          base_airport?: string
          callsign: string
          email: string
          id?: string
          ifc_username?: string | null
          name: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          simbrief_pid?: string | null
          status?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          base_airport?: string
          callsign?: string
          email?: string
          id?: string
          ifc_username?: string | null
          name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          simbrief_pid?: string | null
          status?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      route_catalog: {
        Row: {
          aircraft: string | null
          arr_icao: string
          created_at: string
          dep_icao: string
          duration_mins: number | null
          duration_raw: string | null
          flight_number: string
          id: string
          livery: string | null
          lmt: string | null
          remarks: string | null
          route_type: string | null
        }
        Insert: {
          aircraft?: string | null
          arr_icao: string
          created_at?: string
          dep_icao: string
          duration_mins?: number | null
          duration_raw?: string | null
          flight_number: string
          id?: string
          livery?: string | null
          lmt?: string | null
          remarks?: string | null
          route_type?: string | null
        }
        Update: {
          aircraft?: string | null
          arr_icao?: string
          created_at?: string
          dep_icao?: string
          duration_mins?: number | null
          duration_raw?: string | null
          flight_number?: string
          id?: string
          livery?: string | null
          lmt?: string | null
          remarks?: string | null
          route_type?: string | null
        }
        Relationships: []
      }
      routes: {
        Row: {
          arrival_airport: string
          created_at: string
          departure_airport: string
          distance_nm: number
          estimated_time_hrs: number
          flight_number: string
          id: string
        }
        Insert: {
          arrival_airport: string
          created_at?: string
          departure_airport: string
          distance_nm: number
          estimated_time_hrs: number
          flight_number: string
          id?: string
        }
        Update: {
          arrival_airport?: string
          created_at?: string
          departure_airport?: string
          distance_nm?: number
          estimated_time_hrs?: number
          flight_number?: string
          id?: string
        }
        Relationships: []
      }
      saved_flight_plans: {
        Row: {
          aircraft_reg: string | null
          aircraft_type: string | null
          alternate_icao: string | null
          block_fuel: string | null
          callsign: string | null
          created_at: string
          cruise_altitude: string | null
          destination_icao: string
          distance_nm: string | null
          est_time_enroute: string | null
          flight_number: string | null
          id: string
          ofp_id: string
          origin_icao: string
          pax_count: string | null
          route: string | null
          user_id: string
        }
        Insert: {
          aircraft_reg?: string | null
          aircraft_type?: string | null
          alternate_icao?: string | null
          block_fuel?: string | null
          callsign?: string | null
          created_at?: string
          cruise_altitude?: string | null
          destination_icao: string
          distance_nm?: string | null
          est_time_enroute?: string | null
          flight_number?: string | null
          id?: string
          ofp_id: string
          origin_icao: string
          pax_count?: string | null
          route?: string | null
          user_id: string
        }
        Update: {
          aircraft_reg?: string | null
          aircraft_type?: string | null
          alternate_icao?: string | null
          block_fuel?: string | null
          callsign?: string | null
          created_at?: string
          cruise_altitude?: string | null
          destination_icao?: string
          distance_nm?: string | null
          est_time_enroute?: string | null
          flight_number?: string | null
          id?: string
          ofp_id?: string
          origin_icao?: string
          pax_count?: string | null
          route?: string | null
          user_id?: string
        }
        Relationships: []
      }
      type_ratings: {
        Row: {
          acquired_at: string
          aircraft_id: string
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          acquired_at?: string
          aircraft_id: string
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          acquired_at?: string
          aircraft_id?: string
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "type_ratings_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_fleet: {
        Row: {
          aircraft_id: string
          assigned_to: string | null
          created_at: string
          current_location: string | null
          id: string
          livery: string | null
          maintenance_until: string | null
          status: string
          tail_number: string
          total_flights: number
          total_hours: number
        }
        Insert: {
          aircraft_id: string
          assigned_to?: string | null
          created_at?: string
          current_location?: string | null
          id?: string
          livery?: string | null
          maintenance_until?: string | null
          status?: string
          tail_number: string
          total_flights?: number
          total_hours?: number
        }
        Update: {
          aircraft_id?: string
          assigned_to?: string | null
          created_at?: string
          current_location?: string | null
          id?: string
          livery?: string | null
          maintenance_until?: string | null
          status?: string
          tail_number?: string
          total_flights?: number
          total_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "virtual_fleet_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_maintenance_release: { Args: never; Returns: undefined }
      complete_aircraft_flight: {
        Args: {
          p_arrival_airport: string
          p_flight_hours?: number
          p_tail_number: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "pilot"
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
      app_role: ["admin", "pilot"],
    },
  },
} as const
