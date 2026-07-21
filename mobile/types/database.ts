/**
 * Hand-written placeholder for the Supabase schema types.
 * Once a real Supabase project exists, replace this with the generated types:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 * Shape matches supabase/schema.sql.
 */
export type KosherLevel = "not_kosher" | "kosher" | "strictly_kosher";
export type ApprovalMode = "auto_accept" | "host_approves";
export type DinnerStatus = "published" | "cancelled" | "past";
export type RsvpStatus = "pending" | "approved" | "declined" | "cancelled";
export type PaymentStatus = "not_required" | "pending" | "paid" | "refunded";
export type SponsorStatus = "waitlisted" | "active";
export type ReportTargetType = "profile" | "dinner";
export type ReportStatus = "open" | "reviewed" | "actioned";
export type PotluckCategory = "food" | "drink" | "supplies" | "money" | "other";
export type DonationStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string | null;
          email: string | null;
          name: string;
          photo_url: string | null;
          age: number | null;
          gender: string | null;
          origin: string | null;
          kosher_level: KosherLevel | null;
          dietary_prefs: string | null;
          interests: string[];
          fun_fact: string | null;
          is_attendee: boolean;
          is_host: boolean;
          is_sponsor: boolean;
          verification_tier: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      host_details: {
        Row: {
          profile_id: string;
          bio: string | null;
          home_vibe: string | null;
          dinners_hosted_count: number;
        };
        Insert: Partial<Database["public"]["Tables"]["host_details"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["host_details"]["Row"]>;
      };
      sponsor_details: {
        Row: {
          profile_id: string;
          why_i_give: string | null;
          budget_ceiling: number | null;
          monthly_budget: number | null;
          location_pref: string | null;
          dinner_type_prefs: string[];
          status: SponsorStatus;
        };
        Insert: Partial<Database["public"]["Tables"]["sponsor_details"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["sponsor_details"]["Row"]>;
      };
      dinners: {
        Row: {
          id: string;
          host_id: string;
          date: string;
          start_time: string;
          capacity: number;
          area: string;
          exact_address: string | null;
          kosher_level: KosherLevel;
          cost_per_head: number;
          is_free: boolean;
          description: string;
          approval_mode: ApprovalMode;
          budget_needed: number | null;
          seeking_sponsorship: boolean;
          dinner_type_tags: string[];
          sponsor_approved: boolean;
          amount_funded: number;
          status: DinnerStatus;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dinners"]["Row"]> & {
          host_id: string;
          date: string;
          start_time: string;
          capacity: number;
          area: string;
          kosher_level: KosherLevel;
          description: string;
        };
        Update: Partial<Database["public"]["Tables"]["dinners"]["Row"]>;
      };
      sponsor_donations: {
        Row: {
          id: string;
          dinner_id: string;
          host_id: string;
          sponsor_id: string;
          donor_legal_name: string;
          donor_receipt_email: string;
          amount: number;
          currency: string;
          status: DonationStatus;
          stripe_payment_id: string | null;
          message: string | null;
          anonymous: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sponsor_donations"]["Row"]> & {
          dinner_id: string;
          host_id: string;
          sponsor_id: string;
          donor_legal_name: string;
          donor_receipt_email: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["sponsor_donations"]["Row"]>;
      };
      rsvps: {
        Row: {
          id: string;
          dinner_id: string;
          attendee_id: string;
          status: RsvpStatus;
          payment_status: PaymentStatus;
          stripe_payment_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["rsvps"]["Row"]> & {
          dinner_id: string;
          attendee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["rsvps"]["Row"]>;
      };
      potluck_items: {
        Row: {
          id: string;
          dinner_id: string;
          name: string;
          category: PotluckCategory;
          quantity_needed: number;
          is_money_request: boolean;
          money_amount: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["potluck_items"]["Row"]> & {
          dinner_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["potluck_items"]["Row"]>;
      };
      potluck_claims: {
        Row: {
          id: string;
          item_id: string;
          attendee_id: string;
          quantity: number;
          contribution_amount: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["potluck_claims"]["Row"]> & {
          item_id: string;
          attendee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["potluck_claims"]["Row"]>;
      };
      messages: {
        Row: {
          id: string;
          dinner_id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          dinner_id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          reason: string;
          status: ReportStatus;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reports"]["Row"]> & {
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Row"]>;
      };
    };
  };
}
