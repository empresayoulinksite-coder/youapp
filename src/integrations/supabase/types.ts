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
      bookings: {
        Row: {
          booked_services: Json | null
          change_amount: number | null
          created_at: string
          customer_notes: string | null
          ends_at: string
          id: string
          payment_amount_1: number | null
          payment_amount_2: number | null
          payment_method: string | null
          payment_method_2: string | null
          service_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          store_id: string
          subscription_id: string | null
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booked_services?: Json | null
          change_amount?: number | null
          created_at?: string
          customer_notes?: string | null
          ends_at: string
          id?: string
          payment_amount_1?: number | null
          payment_amount_2?: number | null
          payment_method?: string | null
          payment_method_2?: string | null
          service_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          store_id: string
          subscription_id?: string | null
          total_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booked_services?: Json | null
          change_amount?: number | null
          created_at?: string
          customer_notes?: string | null
          ends_at?: string
          id?: string
          payment_amount_1?: number | null
          payment_amount_2?: number | null
          payment_method?: string | null
          payment_method_2?: string | null
          service_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          store_id?: string
          subscription_id?: string | null
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "client_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          half_two_menu_item_id: string | null
          half_two_name: string | null
          id: string
          menu_item_id: string
          notes: string | null
          pizza_addons: Json | null
          pizza_crust_id: string | null
          pizza_crust_name: string | null
          pizza_crust_price: number | null
          pizza_flavors: Json | null
          pizza_size_id: string | null
          pizza_size_name: string | null
          quantity: number
          selected_size: string | null
          store_id: string
          unit_price_override: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          half_two_menu_item_id?: string | null
          half_two_name?: string | null
          id?: string
          menu_item_id: string
          notes?: string | null
          pizza_addons?: Json | null
          pizza_crust_id?: string | null
          pizza_crust_name?: string | null
          pizza_crust_price?: number | null
          pizza_flavors?: Json | null
          pizza_size_id?: string | null
          pizza_size_name?: string | null
          quantity?: number
          selected_size?: string | null
          store_id: string
          unit_price_override?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          half_two_menu_item_id?: string | null
          half_two_name?: string | null
          id?: string
          menu_item_id?: string
          notes?: string | null
          pizza_addons?: Json | null
          pizza_crust_id?: string | null
          pizza_crust_name?: string | null
          pizza_crust_price?: number | null
          pizza_flavors?: Json | null
          pizza_size_id?: string | null
          pizza_size_name?: string | null
          quantity?: number
          selected_size?: string | null
          store_id?: string
          unit_price_override?: number | null
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
      cash_registers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_balance: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_transactions: {
        Row: {
          amount: number
          cash_register_id: string
          created_at: string
          id: string
          reason: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          cash_register_id: string
          created_at?: string
          id?: string
          reason?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          expires_at: string
          id: string
          notes: string | null
          plan_id: string | null
          services_total: number
          services_used: number
          started_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_user_id?: string | null
          expires_at: string
          id?: string
          notes?: string | null
          plan_id?: string | null
          services_total: number
          services_used?: number
          started_at?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          expires_at?: string
          id?: string
          notes?: string | null
          plan_id?: string | null
          services_total?: number
          services_used?: number
          started_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_store_id_fkey"
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
      gym_classes: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          instructor: string | null
          is_active: boolean
          name: string
          position: number
          starts_at: string
          store_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          instructor?: string | null
          is_active?: boolean
          name: string
          position?: number
          starts_at: string
          store_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          instructor?: string | null
          is_active?: boolean
          name?: string
          position?: number
          starts_at?: string
          store_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      gym_members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          joined_at: string
          notes: string | null
          phone: string | null
          plan_id: string | null
          store_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          joined_at?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          store_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          store_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gym_plans: {
        Row: {
          billing_period: string
          created_at: string
          description: string | null
          features: string[]
          highlight: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          price: number
          store_id: string
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          description?: string | null
          features?: string[]
          highlight?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          price?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          description?: string | null
          features?: string[]
          highlight?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          price?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      gym_workout_exercises: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          position: number
          reps: string
          rest_seconds: number | null
          sets: number
          updated_at: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          position?: number
          reps?: string
          rest_seconds?: number | null
          sets?: number
          updated_at?: string
          workout_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          position?: number
          reps?: string
          rest_seconds?: number | null
          sets?: number
          updated_at?: string
          workout_id?: string
        }
        Relationships: []
      }
      gym_workouts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          member_id: string
          position: number
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          member_id: string
          position?: number
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          member_id?: string
          position?: number
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      home_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          is_ecommerce: boolean
          label: string
          matches: string[]
          position: number
          slug: string
          tint: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_ecommerce?: boolean
          label: string
          matches?: string[]
          position?: number
          slug: string
          tint?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_ecommerce?: boolean
          label?: string
          matches?: string[]
          position?: number
          slug?: string
          tint?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          available_days: number[]
          available_end: string | null
          available_start: string | null
          created_at: string
          id: string
          is_available: boolean
          is_pizza: boolean
          name: string
          position: number
          store_id: string
        }
        Insert: {
          available_days?: number[]
          available_end?: string | null
          available_start?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          is_pizza?: boolean
          name: string
          position?: number
          store_id: string
        }
        Update: {
          available_days?: number[]
          available_end?: string | null
          available_start?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          is_pizza?: boolean
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
      menu_item_size_prices: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          menu_item_id: string
          pizza_size_id: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          menu_item_id: string
          pizza_size_id: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          menu_item_id?: string
          pizza_size_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
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
          colors: string[]
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
          sizes: string[]
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          colors?: string[]
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
          sizes?: string[]
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          colors?: string[]
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
          sizes?: string[]
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          emoji: string | null
          id: string
          image_url: string | null
          is_read: boolean
          link: string | null
          order_id: string | null
          post_id: string | null
          store_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean
          link?: string | null
          order_id?: string | null
          post_id?: string | null
          store_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean
          link?: string | null
          order_id?: string | null
          post_id?: string | null
          store_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          emoji: string | null
          half_two_menu_item_id: string | null
          half_two_name: string | null
          id: string
          image_url: string | null
          menu_item_id: string | null
          name: string
          notes: string | null
          order_id: string
          pizza_addons: Json | null
          pizza_crust_id: string | null
          pizza_crust_name: string | null
          pizza_crust_price: number | null
          pizza_flavors: Json | null
          pizza_size_id: string | null
          pizza_size_name: string | null
          quantity: number
          selected_size: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          half_two_menu_item_id?: string | null
          half_two_name?: string | null
          id?: string
          image_url?: string | null
          menu_item_id?: string | null
          name: string
          notes?: string | null
          order_id: string
          pizza_addons?: Json | null
          pizza_crust_id?: string | null
          pizza_crust_name?: string | null
          pizza_crust_price?: number | null
          pizza_flavors?: Json | null
          pizza_size_id?: string | null
          pizza_size_name?: string | null
          quantity?: number
          selected_size?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          emoji?: string | null
          half_two_menu_item_id?: string | null
          half_two_name?: string | null
          id?: string
          image_url?: string | null
          menu_item_id?: string | null
          name?: string
          notes?: string | null
          order_id?: string
          pizza_addons?: Json | null
          pizza_crust_id?: string | null
          pizza_crust_name?: string | null
          pizza_crust_price?: number | null
          pizza_flavors?: Json | null
          pizza_size_id?: string | null
          pizza_size_name?: string | null
          quantity?: number
          selected_size?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          customer_cpf: string | null
          customer_notes: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_type: string
          discount: number
          id: string
          order_number: number | null
          payment_method: string | null
          ready_at: string | null
          status: string
          store_emoji: string | null
          store_id: string
          store_image_url: string | null
          store_name: string
          store_slug: string
          store_whatsapp: string | null
          table_number: number | null
          total: number
          updated_at: string
          user_id: string
          whatsapp_message: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_notes?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_type?: string
          discount?: number
          id?: string
          order_number?: number | null
          payment_method?: string | null
          ready_at?: string | null
          status?: string
          store_emoji?: string | null
          store_id: string
          store_image_url?: string | null
          store_name: string
          store_slug: string
          store_whatsapp?: string | null
          table_number?: number | null
          total?: number
          updated_at?: string
          user_id: string
          whatsapp_message: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_notes?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_type?: string
          discount?: number
          id?: string
          order_number?: number | null
          payment_method?: string | null
          ready_at?: string | null
          status?: string
          store_emoji?: string | null
          store_id?: string
          store_image_url?: string | null
          store_name?: string
          store_slug?: string
          store_whatsapp?: string | null
          table_number?: number | null
          total?: number
          updated_at?: string
          user_id?: string
          whatsapp_message?: string
        }
        Relationships: []
      }
      pizza_addons: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          price: number
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          price?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          price?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_addons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_crusts: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          price: number
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          price?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          price?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_crusts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_sizes: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          max_flavors: number
          name: string
          position: number
          slices: number
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_flavors?: number
          name: string
          position?: number
          slices?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_flavors?: number
          name?: string
          position?: number
          slices?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_sizes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
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
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          feed_category_id: string | null
          gallery_urls: string[]
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          position: number
          price: number
          promo_prices: Json
          show_duration: boolean
          show_price: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          feed_category_id?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          position?: number
          price?: number
          promo_prices?: Json
          show_duration?: boolean
          show_price?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          feed_category_id?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          position?: number
          price?: number
          promo_prices?: Json
          show_duration?: boolean
          show_price?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_feed_category_id_fkey"
            columns: ["feed_category_id"]
            isOneToOne: false
            referencedRelation: "store_feed_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_label: string
          id: string
          is_active: boolean
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
          is_active?: boolean
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
          is_active?: boolean
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
      store_delivery_areas: {
        Row: {
          created_at: string
          fee: number
          id: string
          is_active: boolean
          neighborhood: string
          store_id: string
        }
        Insert: {
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          neighborhood: string
          store_id: string
        }
        Update: {
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          neighborhood?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_delivery_areas_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_feed_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_feed_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_feed_favorites: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_feed_favorites_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "store_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      store_feed_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_feed_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "store_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      store_feed_posts: {
        Row: {
          caption: string
          category_id: string | null
          created_at: string
          id: string
          image_urls: string[]
          is_active: boolean
          likes_count: number
          position: number
          show_services_cta: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          caption?: string
          category_id?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          is_active?: boolean
          likes_count?: number
          position?: number
          show_services_cta?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          caption?: string
          category_id?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          is_active?: boolean
          likes_count?: number
          position?: number
          show_services_cta?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_feed_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_feed_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_feed_posts_store_id_fkey"
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
      store_owners: {
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
        Relationships: [
          {
            foreignKeyName: "store_owners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_printer_settings: {
        Row: {
          auto_print: boolean
          created_at: string
          drinks_category_ids: string[]
          kitchen_always_full: boolean
          kitchen_category_ids: string[]
          printer_cashier: string | null
          printer_drinks: string | null
          printer_kitchen: string | null
          printer_orders: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          auto_print?: boolean
          created_at?: string
          drinks_category_ids?: string[]
          kitchen_always_full?: boolean
          kitchen_category_ids?: string[]
          printer_cashier?: string | null
          printer_drinks?: string | null
          printer_kitchen?: string | null
          printer_orders?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          auto_print?: boolean
          created_at?: string
          drinks_category_ids?: string[]
          kitchen_always_full?: boolean
          kitchen_category_ids?: string[]
          printer_cashier?: string | null
          printer_drinks?: string | null
          printer_kitchen?: string | null
          printer_orders?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_reels: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          id: string
          is_active: boolean
          position: number
          store_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          is_active?: boolean
          position?: number
          store_id: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          is_active?: boolean
          position?: number
          store_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_reels_store_id_fkey"
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
      store_staff: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          role: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          role?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          role?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_tables: {
        Row: {
          created_at: string
          id: string
          label: string
          number: number
          status: Database["public"]["Enums"]["store_table_status"]
          store_id: string
          type: Database["public"]["Enums"]["store_table_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          number: number
          status?: Database["public"]["Enums"]["store_table_status"]
          store_id: string
          type?: Database["public"]["Enums"]["store_table_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          number?: number
          status?: Database["public"]["Enums"]["store_table_status"]
          store_id?: string
          type?: Database["public"]["Enums"]["store_table_type"]
          updated_at?: string
        }
        Relationships: []
      }
      store_waiter_permissions: {
        Row: {
          auto_print_orders: boolean
          can_cancel_orders: boolean
          can_edit_orders: boolean
          created_at: string
          id: string
          updated_at: string
          waiter_id: string
        }
        Insert: {
          auto_print_orders?: boolean
          can_cancel_orders?: boolean
          can_edit_orders?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          waiter_id: string
        }
        Update: {
          auto_print_orders?: boolean
          can_cancel_orders?: boolean
          can_edit_orders?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          waiter_id?: string
        }
        Relationships: []
      }
      store_waiters: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          pin: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          pin: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          pin?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          about: string | null
          address: string | null
          always_open: boolean
          auto_accept_bookings: boolean
          auto_accept_orders: boolean
          benefit_delivery_enabled: boolean
          benefit_delivery_subtitle: string
          benefit_delivery_title: string
          benefit_protection_enabled: boolean
          benefit_protection_subtitle: string
          benefit_protection_title: string
          benefit_return_enabled: boolean
          benefit_return_subtitle: string
          benefit_return_title: string
          booking_mode: string
          category: string
          cep: string | null
          city: string | null
          created_at: string
          delivery_enabled: boolean
          delivery_fee: string
          delivery_time: string
          distance: string
          emoji: string
          feed_enabled: boolean
          free_delivery: boolean
          hours: string | null
          id: string
          image_url: string | null
          is_hidden: boolean
          is_paused: boolean
          is_pizzeria: boolean
          lat: number | null
          lng: number | null
          min_order: number
          name: string
          neighborhood: string | null
          payment_methods: string | null
          payment_methods_list: string[]
          pickup_enabled: boolean
          promo: string | null
          rating: number
          reels_enabled: boolean
          route_url: string | null
          show_route: boolean
          slot_minutes: number
          slug: string
          store_type: string
          time_analise_balcao_max: number
          time_analise_balcao_min: number
          time_analise_delivery_max: number
          time_analise_delivery_min: number
          time_producao_balcao_max: number
          time_producao_balcao_min: number
          time_producao_delivery_max: number
          time_producao_delivery_min: number
          time_pronto_balcao_max: number
          time_pronto_balcao_min: number
          time_pronto_delivery_max: number
          time_pronto_delivery_min: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          about?: string | null
          address?: string | null
          always_open?: boolean
          auto_accept_bookings?: boolean
          auto_accept_orders?: boolean
          benefit_delivery_enabled?: boolean
          benefit_delivery_subtitle?: string
          benefit_delivery_title?: string
          benefit_protection_enabled?: boolean
          benefit_protection_subtitle?: string
          benefit_protection_title?: string
          benefit_return_enabled?: boolean
          benefit_return_subtitle?: string
          benefit_return_title?: string
          booking_mode?: string
          category: string
          cep?: string | null
          city?: string | null
          created_at?: string
          delivery_enabled?: boolean
          delivery_fee?: string
          delivery_time?: string
          distance?: string
          emoji?: string
          feed_enabled?: boolean
          free_delivery?: boolean
          hours?: string | null
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          is_paused?: boolean
          is_pizzeria?: boolean
          lat?: number | null
          lng?: number | null
          min_order?: number
          name: string
          neighborhood?: string | null
          payment_methods?: string | null
          payment_methods_list?: string[]
          pickup_enabled?: boolean
          promo?: string | null
          rating?: number
          reels_enabled?: boolean
          route_url?: string | null
          show_route?: boolean
          slot_minutes?: number
          slug: string
          store_type?: string
          time_analise_balcao_max?: number
          time_analise_balcao_min?: number
          time_analise_delivery_max?: number
          time_analise_delivery_min?: number
          time_producao_balcao_max?: number
          time_producao_balcao_min?: number
          time_producao_delivery_max?: number
          time_producao_delivery_min?: number
          time_pronto_balcao_max?: number
          time_pronto_balcao_min?: number
          time_pronto_delivery_max?: number
          time_pronto_delivery_min?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          about?: string | null
          address?: string | null
          always_open?: boolean
          auto_accept_bookings?: boolean
          auto_accept_orders?: boolean
          benefit_delivery_enabled?: boolean
          benefit_delivery_subtitle?: string
          benefit_delivery_title?: string
          benefit_protection_enabled?: boolean
          benefit_protection_subtitle?: string
          benefit_protection_title?: string
          benefit_return_enabled?: boolean
          benefit_return_subtitle?: string
          benefit_return_title?: string
          booking_mode?: string
          category?: string
          cep?: string | null
          city?: string | null
          created_at?: string
          delivery_enabled?: boolean
          delivery_fee?: string
          delivery_time?: string
          distance?: string
          emoji?: string
          feed_enabled?: boolean
          free_delivery?: boolean
          hours?: string | null
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          is_paused?: boolean
          is_pizzeria?: boolean
          lat?: number | null
          lng?: number | null
          min_order?: number
          name?: string
          neighborhood?: string | null
          payment_methods?: string | null
          payment_methods_list?: string[]
          pickup_enabled?: boolean
          promo?: string | null
          rating?: number
          reels_enabled?: boolean
          route_url?: string | null
          show_route?: boolean
          slot_minutes?: number
          slug?: string
          store_type?: string
          time_analise_balcao_max?: number
          time_analise_balcao_min?: number
          time_analise_delivery_max?: number
          time_analise_delivery_min?: number
          time_producao_balcao_max?: number
          time_producao_balcao_min?: number
          time_producao_delivery_max?: number
          time_producao_delivery_min?: number
          time_pronto_balcao_max?: number
          time_pronto_balcao_min?: number
          time_pronto_delivery_max?: number
          time_pronto_delivery_min?: number
          updated_at?: string
          whatsapp?: string | null
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
      subscription_plan_services: {
        Row: {
          plan_id: string
          service_id: string
        }
        Insert: {
          plan_id: string
          service_id: string
        }
        Update: {
          plan_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          price: number
          store_id: string
          total_services: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          price?: number
          store_id: string
          total_services: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          price?: number
          store_id?: string
          total_services?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_store_id_fkey"
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
      welcome_modal: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
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
      can_manage_store_orders: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      get_active_subscriptions_for_users: {
        Args: { _store_id: string; _user_ids: string[] }
        Returns: {
          expires_at: string
          plan_name: string
          services_remaining: number
          services_total: number
          services_used: number
          status: string
          subscription_id: string
          user_id: string
        }[]
      }
      get_booking_customers: {
        Args: { _store_id: string }
        Returns: {
          display_name: string
          phone: string
          user_id: string
        }[]
      }
      get_my_subscriptions: {
        Args: never
        Returns: {
          expires_at: string
          plan_id: string
          plan_name: string
          services_remaining: number
          services_total: number
          services_used: number
          status: string
          store_emoji: string
          store_id: string
          store_image_url: string
          store_name: string
          store_slug: string
          subscription_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_store_owner: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_store_staff: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      normalize_phone: { Args: { _phone: string }; Returns: string }
      verify_waiter_pin: {
        Args: { _full_name: string; _pin: string; _store_id: string }
        Returns: {
          auto_print_orders: boolean
          can_cancel_orders: boolean
          can_edit_orders: boolean
          full_name: string
          waiter_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      store_table_status: "livre" | "ocupada" | "fechando_conta"
      store_table_type: "mesa" | "comanda"
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
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      store_table_status: ["livre", "ocupada", "fechando_conta"],
      store_table_type: ["mesa", "comanda"],
    },
  },
} as const
