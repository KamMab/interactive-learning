"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

/** Browser client for sign-in. Returns null until auth is turned on. */
export function browserSupabase(): SupabaseClient | null {
  if (!AUTH_ENABLED || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
