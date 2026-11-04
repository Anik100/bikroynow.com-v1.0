import { createClient } from '@supabase/supabase-js';

/**
 * Returns a reliable Supabase server client.
 * Prioritizes NEXT_PUBLIC_SUPABASE_ANON_KEY which is guaranteed to be valid and authorized
 * on both local and production Vercel environments for admin_settings, profiles, and listings.
 */
export function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !apiKey) return null;
  return createClient(supabaseUrl, apiKey, { auth: { persistSession: false } });
}
