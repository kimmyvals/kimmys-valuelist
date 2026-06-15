export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      contact_messages: {
        Row: { body: string; created_at: string; id: string; replied_at: string | null; reply: string | null; status: string; subject: string; updated_at: string; user_id: string; username: string }
        Insert: { body: string; created_at?: string; id?: string; replied_at?: string | null; reply?: string | null; status?: string; subject: string; updated_at?: string; user_id: string; username: string }
        Update: { body?: string; created_at?: string; id?: string; replied_at?: string | null; reply?: string | null; status?: string; subject?: string; updated_at?: string; user_id?: string; username?: string }
        Relationships: []
      }
      daily_scores: {
        Row: { created_at: string; game_date: string; id: string; score: number; user_id: string; username: string }
        Insert: { created_at?: string; game_date: string; id?: string; score: number; user_id: string; username: string }
        Update: { created_at?: string; game_date?: string; id?: string; score?: number; user_id?: string; username?: string }
        Relationships: []
      }
      game_saves: {
        Row: { created_at: string; data: Json; game_key: string; id: string; updated_at: string; user_id: string }
        Insert: { created_at?: string; data?: Json; game_key: string; id?: string; updated_at?: string; user_id: string }
        Update: { created_at?: string; data?: Json; game_key?: string; id?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      profiles: {
        Row: { created_at: string; id: string; updated_at: string; user_id: string; username: string }
        Insert: { created_at?: string; id?: string; updated_at?: string; user_id: string; username: string }
        Update: { created_at?: string; id?: string; updated_at?: string; user_id?: string; username?: string }
        Relationships: []
      }
      skin_value_history: {
        Row: { changed_at: string; id: string; skin_id: string; value: number }
        Insert: { changed_at?: string; id?: string; skin_id: string; value: number }
        Update: { changed_at?: string; id?: string; skin_id?: string; value?: number }
        Relationships: [{ foreignKeyName: "skin_value_history_skin_id_fkey"; columns: ["skin_id"]; isOneToOne: false; referencedRelation: "skins"; referencedColumns: ["id"] }]
      }
      skins: {
        Row: { amount_unboxed: string | null; created_at: string; demand: number | null; id: string; image_url: string | null; kt_sv_demand: number | null; kt_trend: string | null; kt_value: number | null; name: string; nickname: string | null; notes: string | null; rarity: string; season: string; section: string; sv_value: number | null; trend: string | null; updated_at: string; value: number; weapon_type: string }
        Insert: { amount_unboxed?: string | null; created_at?: string; demand?: number | null; id?: string; image_url?: string | null; kt_sv_demand?: number | null; kt_trend?: string | null; kt_value?: number | null; name: string; nickname?: string | null; notes?: string | null; rarity?: string; season?: string; section?: string; sv_value?: number | null; trend?: string | null; updated_at?: string; value?: number; weapon_type?: string }
        Update: { amount_unboxed?: string | null; created_at?: string; demand?: number | null; id?: string; image_url?: string | null; kt_sv_demand?: number | null; kt_trend?: string | null; kt_value?: number | null; name?: string; nickname?: string | null; notes?: string | null; rarity?: string; season?: string; section?: string; sv_value?: number | null; trend?: string | null; updated_at?: string; value?: number; weapon_type?: string }
        Relationships: []
      }
      sync_state: {
        Row: { exotics_count: number | null; id: string; last_error: string | null; last_synced_at: string | null; main_count: number | null }
        Insert: { exotics_count?: number | null; id: string; last_error?: string | null; last_synced_at?: string | null; main_count?: number | null }
        Update: { exotics_count?: number | null; id?: string; last_error?: string | null; last_synced_at?: string | null; main_count?: number | null }
        Relationships: []
      }
      user_roles: {
        Row: { created_at: string; id: string; role: Database["public"]["Enums"]["app_role"]; user_id: string }
        Insert: { created_at?: string; id?: string; role: Database["public"]["Enums"]["app_role"]; user_id: string }
        Update: { created_at?: string; id?: string; role?: Database["public"]["Enums"]["app_role"]; user_id?: string }
        Relationships: []
      }
    }
    Views: {
      value_history: {
        Row: { changed_at: string | null; id: string | null; skin_id: string | null; value: number | null }
        Insert: { changed_at?: string | null; id?: string | null; skin_id?: string | null; value?: number | null }
        Update: { changed_at?: string | null; id?: string | null; skin_id?: string | null; value?: number | null }
        Relationships: [{ foreignKeyName: "skin_value_history_skin_id_fkey"; columns: ["skin_id"]; isOneToOne: false; referencedRelation: "skins"; referencedColumns: ["id"] }]
      }
    }
    Functions: { email_for_username: { Args: { _username: string }; Returns: string } }
    Enums: { app_role: "editor" | "admin" }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> =
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]

export const Constants = { public: { Enums: { app_role: ["editor", "admin"] } } } as const
