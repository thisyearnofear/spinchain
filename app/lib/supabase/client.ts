import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// New Supabase API keys (publishable + secret). Legacy anon/service_role
// JWT keys are deprecated (end of 2026) and no longer read.
// Dashboard: Settings > API Keys. RLS policies are unchanged — new keys
// resolve to the same postgres roles (anon/authenticated/service_role).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Browser-side Supabase client (uses publishable key + RLS).
 * Returns null if not configured — callers should fall back to localStorage.
 */
export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined") return null;
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return browserClient;
}

/**
 * Server-side Supabase client (uses secret key, bypasses RLS).
 * For API routes and server components only. Never expose to the browser.
 */
export function getServerClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  if (typeof window !== "undefined") return null;
  if (!serverClient) {
    serverClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false },
    });
  }
  return serverClient;
}
