import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function syncUserProfile(user) {
  if (!user || !user.id || !user.email) return;
  try {
    const localName = typeof window !== 'undefined' ? localStorage.getItem('bkr_custom_name_' + user.id) : null;
    const fullName = localName || 
                     user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.email.split('@')[0];
    const avatarUrl = user.user_metadata?.avatar_url || 
                      user.user_metadata?.picture || 
                      null;

    // Check if profile already exists first so we don't overwrite user's custom name or phone
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) {
      // Profile exists: if localName exists and differs, sync it to database
      if (localName && existing.full_name !== localName) {
        await supabase.from('profiles').update({ full_name: localName }).eq('id', user.id);
      }
      return;
    }

    // New profile insert
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
