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
      cart_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          notes: string | null
          quantity: number
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          notes?: string | null
          quantity?: number
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          notes?: string | null
          quantity?: number
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      club_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_order: number
          starts_at: string | null
          store_ids: string[]
          title: string
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order?: number
          starts_at?: string | null
          store_ids?: string[]
          title: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order?: number
          starts_at?: string | null
          store_ids?: string[]
          title?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          name: string
          position: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          position?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          position?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_variations: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          menu_item_id: string
          name: string
          original_price: number | null
          position: number
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          menu_item_id: string
          name: string
          original_price?: number | null
          position?: number
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          menu_item_id?: string
          name?: string
          original_price?: number | null
          position?: number
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_variations_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          emoji: string
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          original_price: number | null
          position: number
          price: number
          promo: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          original_price?: number | null
          position?: number
          price: number
          promo?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          original_price?: number | null
          position?: number
          price?: number
          promo?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cep: string | null
          city: string | null
          complement: string | null
          cpf: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          profile_completed: boolean
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          profile_completed?: boolean
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          profile_completed?: boolean
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_label: string
          id: string
          min_order: number
          store_id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_label: string
          id?: string
          min_order?: number
          store_id: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_label?: string
          id?: string
          min_order?: number
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_hours: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          is_active: boolean
          opens_at: string
          store_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          id?: string
          is_active?: boolean
          opens_at: string
          store_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          opens_at?: string
          store_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_reviews: {
        Row: {
          author_name: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          about: string | null
          address: string | null
          category: string
          cep: string | null
          city: string | null
          created_at: string
          delivery_fee: string
          delivery_time: string
          distance: string
          emoji: string
          free_delivery: boolean
          hours: string | null
          id: string
          image_url: string | null
          min_order: number
          name: string
          neighborhood: string | null
          payment_methods: string | null
          promo: string | null
          rating: number
          slug: string
          store_type: string
          updated_at: string
        }
        Insert: {
          about?: string | null
          address?: string | null
          category: string
          cep?: string | null
          city?: string | null
          created_at?: string
          delivery_fee?: string
          delivery_time?: string
          distance?: string
          emoji?: string
          free_delivery?: boolean
          hours?: string | null
          id?: string
          image_url?: string | null
          min_order?: number
          name: string
          neighborhood?: string | null
          payment_methods?: string | null
          promo?: string | null
          rating?: number
          slug: string
          store_type?: string
          updated_at?: string
        }
        Update: {
          about?: string | null
          address?: string | null
          category?: string
          cep?: string | null
          city?: string | null
          created_at?: string
          delivery_fee?: string
          delivery_time?: string
          distance?: string
          emoji?: string
          free_delivery?: boolean
          hours?: string | null
          id?: string
          image_url?: string | null
          min_order?: number
          name?: string
          neighborhood?: string | null
          payment_methods?: string | null
          promo?: string | null
          rating?: number
          slug?: string
          store_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string
          cta_label: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          media_type: string
          media_url: string
          position: number
          store_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          media_type?: string
          media_url: string
          position?: number
          store_id?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          media_type?: string
          media_url?: string
          position?: number
          store_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_addresses: {
        Row: {
          cep: string | null
          city: string | null
          complement: string | null
          created_at: string
          icon: string
          id: string
          is_default: boolean
          label: string
          lat: number | null
          lng: number | null
          neighborhood: string | null
          number: string | null
          reference: string | null
          state: string | null
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          number?: string | null
          reference?: string | null
          state?: string | null
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          number?: string | null
          reference?: string | null
          state?: string | null
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_coupons: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          redeemed_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
