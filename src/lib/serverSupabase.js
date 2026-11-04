import { createClient } from '@supabase/supabase-js';

/**
 * Returns a reliable Supabase server client.
 * Disables Next.js App Router Data Caching via custom global fetch with cache: 'no-store',
 * ensuring all database reads/writes reflect the live database in real time.
 */
export function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !apiKey) return null;
  return createClient(supabaseUrl, apiKey, {
    auth: { persistSession: false },
    global: {
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          cache: 'no-store',
          next: { revalidate: 0 }
        });
      }
    }
  });
}
