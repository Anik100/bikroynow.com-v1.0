import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function syncUserProfile(user) {
  if (!user || !user.id || !user.email) return;
  try {
    const fullName = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.email.split('@')[0];
    const avatarUrl = user.user_metadata?.avatar_url || 
                      user.user_metadata?.picture || 
                      null;

    // Fast upsert profile record
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email.toLowerCase().trim(),
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Profile sync exception (non-fatal):', err);
  }
}

