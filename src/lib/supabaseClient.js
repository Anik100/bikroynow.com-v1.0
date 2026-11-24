import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  }
});

// Parse JWT payload safely in browser
export function parseJwt(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Instant synchronous user resolution from URL OAuth hash or localStorage (0ms delay)
export function getInstantUser() {
  if (typeof window === 'undefined') return null;
  try {
    // 0. If arriving from Google OAuth redirect with hash #access_token=...
    if (window.location.hash && window.location.hash.includes('access_token=')) {
      try {
        const hashStr = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
        const hashParams = new URLSearchParams(hashStr);
        const accessToken = hashParams.get('access_token');
        if (accessToken) {
          const payload = parseJwt(accessToken);
          if (payload && payload.sub) {
            const expiresIn = parseInt(hashParams.get('expires_in') || '3600', 10);
            const userObj = {
              id: payload.sub,
              aud: payload.aud || 'authenticated',
              role: payload.role || 'authenticated',
              email: payload.email,
              phone: payload.phone || '',
              user_metadata: payload.user_metadata || {},
              app_metadata: payload.app_metadata || {},
              created_at: payload.created_at || new Date().toISOString()
            };
            try {
              const storageKey = 'sb-avuvqvjhppbnprdgkfmx-auth-token';
              const sessionPayload = {
                access_token: accessToken,
                refresh_token: hashParams.get('refresh_token') || accessToken,
                expires_in: expiresIn,
                expires_at: Math.round(Date.now() / 1000) + expiresIn,
                token_type: 'bearer',
                user: userObj
              };
              localStorage.setItem(storageKey, JSON.stringify(sessionPayload));
            } catch (_) {}
            return userObj;
          }
        }
      } catch (_) {}
    }

    // 1. Scan localStorage specifically for Supabase auth tokens
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            // Check expiration: if token is expired, do NOT consider user logged in
            if (parsed?.expires_at && typeof parsed.expires_at === 'number') {
              if (parsed.expires_at * 1000 < Date.now()) {
                continue;
              }
            }
            if (parsed?.user?.id) return parsed.user;
            if (parsed?.currentSession?.user?.id) return parsed.currentSession.user;
            if (parsed?.session?.user?.id) return parsed.session.user;
            if (Array.isArray(parsed) && parsed[0]?.user?.id) return parsed[0].user;
          } catch (e) {}
        }
      }
    }
    // 2. Fallback to demo user
    const localUser = localStorage.getItem('bikroynow_demo_user');
    if (localUser) {
      try {
        const parsedDemo = JSON.parse(localUser);
        if (parsedDemo?.id) return parsedDemo;
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

// Seamlessly consumes OAuth access_token from URL hash, registers session with Supabase client, and cleans URL
export async function consumeUrlOAuthHash() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token=')) return null;

  try {
    const hashStr = hash.startsWith('#') ? hash.substring(1) : hash;
    const hashParams = new URLSearchParams(hashStr);
    const accessToken = hashParams.get('access_token');
    if (!accessToken) return null;

    const refreshToken = hashParams.get('refresh_token');
    const expiresIn = parseInt(hashParams.get('expires_in') || '3600', 10);
    const effectiveRefreshToken = refreshToken || accessToken;

    const payload = parseJwt(accessToken);
    let activeUser = null;

    if (payload && payload.sub) {
      activeUser = {
        id: payload.sub,
        aud: payload.aud || 'authenticated',
        role: payload.role || 'authenticated',
        email: payload.email,
        phone: payload.phone || '',
        user_metadata: payload.user_metadata || {},
        app_metadata: payload.app_metadata || {},
        created_at: payload.created_at || new Date().toISOString()
      };

      try {
        const storageKey = 'sb-avuvqvjhppbnprdgkfmx-auth-token';
        const sessionPayload = {
          access_token: accessToken,
          refresh_token: effectiveRefreshToken,
          expires_in: expiresIn,
          expires_at: Math.round(Date.now() / 1000) + expiresIn,
          token_type: 'bearer',
          user: activeUser
        };
        localStorage.setItem(storageKey, JSON.stringify(sessionPayload));
      } catch (e) {}
    }

    // Set session in Supabase client using non-empty refresh_token fallback
    try {
      const { data: authData } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: effectiveRefreshToken
      });
      if (authData?.session?.user) {
        activeUser = authData.session.user;
      }
    } catch (e) {
      console.warn('setSession warning (non-fatal):', e);
    }

    // Strip hash from address bar cleanly
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {}

    return activeUser;
  } catch (err) {
    console.warn('consumeUrlOAuthHash exception:', err);
    return null;
  }
}

// Resilient async session and user resolver that prevents premature timeouts on mobile networks
export async function getOrFetchUser(timeoutMs = 4000) {
  // 1. Instant synchronous check
  const instant = getInstantUser();
  if (instant) return instant;

  // 2. Supabase async getSession
  try {
    const sessionPromise = supabase.auth.getSession().then(({ data }) => data?.session?.user || null).catch(() => null);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), timeoutMs));
    const user = await Promise.race([sessionPromise, timeoutPromise]);
    if (user) return user;
  } catch (e) {}

  // 3. Fallback re-check
  return getInstantUser();
}

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
