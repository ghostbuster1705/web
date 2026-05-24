export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          plan: "free" | "pro";
          scans_used_this_month: number;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          plan?: "free" | "pro";
          scans_used_this_month?: number;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      scans: {
        Row: {
          id: string;
          user_id: string;
          niche: string;
          city: string;
          status: "pending" | "running" | "done" | "error";
          result_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          niche: string;
          city: string;
          status: "pending" | "running" | "done" | "error";
          result_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scans"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          scan_id: string;
          business_name: string;
          website_url: string | null;
          phone: string | null;
          address: string | null;
          google_place_id: string | null;
          score: number | null;
          issues: Json;
          tech_stack: Json;
          page_speed: number | null;
          has_https: boolean | null;
          has_mobile: boolean | null;
          has_analytics: boolean | null;
          last_modified_year: number | null;
          outreach_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          scan_id: string;
          business_name: string;
          website_url?: string | null;
          phone?: string | null;
          address?: string | null;
          google_place_id?: string | null;
          score?: number | null;
          issues?: Json;
          tech_stack?: Json;
          page_speed?: number | null;
          has_https?: boolean | null;
          has_mobile?: boolean | null;
          has_analytics?: boolean | null;
          last_modified_year?: number | null;
          outreach_email?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
    };
  };
};
