import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings, deleteGlobalListing, updateGlobalListing } from '../../../lib/globalListingsStore';
import { deleteChatsForListing } from '../../../lib/chatsStore';
import { notifySearchEngines } from '../../../lib/seoPinger';
import { cleanupExpiredMembershipsAndBoosts } from '../../../lib/membershipManagerHelper';

export const dynamic = 'force-dynamic';

// In-memory high-speed cache for super-fast public responses (< 5ms)
let cachedListings = null;
let cacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds cache

export async function GET(req) {
  try {
    // Automatically purge expired memberships/boosts
    await cleanupExpiredMembershipsAndBoosts();

    const { searchParams } = new URL(req.url);
    const includeAll = searchParams.get('all') === 'true' || searchParams.get('include_pending') === 'true';
    const statusParam = searchParams.get('status');
    const userId = searchParams.get('user_id');
    const userEmail = searchParams.get('user_email');

    const now = Date.now();
    const isPublicDefault = !includeAll && !statusParam && !userId;

    // Serve from ultra-fast in-memory cache for public feed if valid
    if (isPublicDefault && cachedListings && (now - cacheTime < CACHE_TTL_MS)) {
      return NextResponse.json({ listings: cachedListings }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'X-Cache': 'HIT'
        }
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let dbListings = [];
    let featuredSet = new Set();

    if (supabaseUrl && serviceRoleKey) {
      try {
        const serverSupabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // Parallel execution of featured ads, listings, and profiles
        const [featuredRes, dbRes, profilesRes] = await Promise.all([
          serverSupabase
            .from('featured_ads')
            .select('listing_id')
            .eq('is_active', true),
          serverSupabase
            .from('listings')
            .select('*')
            .neq('status', 'deleted')
            .order('created_at', { ascending: false })
            .limit(100),
          serverSupabase
            .from('profiles')
            .select('id, email, membership_type, membership_expires_at')
        ]);

        const profilesMap = new Map();
        if (profilesRes?.data) {
          profilesRes.data.forEach(p => profilesMap.set(p.id, p));
        }

        if (featuredRes?.data) {
          featuredRes.data.forEach(f => featuredSet.add(f.listing_id));
        }

        if (Array.isArray(dbRes?.data)) {
          dbListings = dbRes.data.map(l => ({
            ...l,
            profiles: profilesMap.get(l.user_id) || l.profiles || null
          }));
        }
      } catch (e) {
        console.error('Database query error:', e);
      }
    }

    // Merge featured ads from global file store
    try {
      const globalFeatured = getGlobalFeaturedAds().filter(f => f.is_active);
      globalFeatured.forEach(f => featuredSet.add(f.listing_id));
    } catch (e) {}

    // Merge DB listings with server-side globalListingsStore
    const globalAds = getGlobalListings();
    const existingIds = new Set(dbListings.map(i => i.id));
    const extraAds = globalAds.filter(ad => !existingIds.has(ad.id) && ad.status !== 'deleted');

    const combinedListings = [...extraAds, ...dbListings].map(item => {
      const isFeatured = Boolean(item.is_featured || featuredSet.has(item.id));
      const userProf = item.profiles;
      const hasMembership = userProf &&
        userProf.membership_type &&
        userProf.membership_type.toLowerCase() !== 'free' &&
        (!userProf.membership_expires_at || new Date(userProf.membership_expires_at) > new Date());

      const promoType = item.promotion_type || (hasMembership ? userProf.membership_type : (isFeatured ? 'Premium Featured' : null));

      return {
        ...item,
        status: item.status || 'active',
        is_featured: isFeatured,
        is_verified: Boolean(item.is_verified || hasMembership || isFeatured),
        promotion_type: promoType
      };
    });

    let result = combinedListings;

    if (userId) {
      // My Ads: see user's own listings regardless of status (active, pending, rejected)
      result = combinedListings.filter(item => {
        if (item.status === 'deleted') return false;
        const matchId = String(item.user_id) === String(userId);
        const matchEmail = userEmail && item.user_email && item.user_email.toLowerCase() === userEmail.toLowerCase();
        return matchId || matchEmail;
      });
      if (statusParam) {
        result = result.filter(item => item.status === statusParam);
      }
    } else if (includeAll) {
      // Admin dashboard: see all listings (pending, active, rejected)
      result = combinedListings.filter(item => item.status !== 'deleted');
    } else if (statusParam) {
      result = combinedListings.filter(item => item.status === statusParam && item.status !== 'deleted');
    } else {
      // PUBLIC USERS (Home, Ads, Search):
      // STRICT MODERATION FILTER: Only show verified active ads!
      // Pending, rejected, or deleted ads are strictly hidden!
      result = combinedListings.filter(item => (item.status === 'active' || item.status === 'approved') && item.status !== 'deleted');
    }

    // Cache ONLY the public feed
    if (isPublicDefault) {
      cachedListings = result;
      cacheTime = now;
    }

    return NextResponse.json({ listings: result }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Cache': 'MISS'
      }
    });
  } catch (err) {
    console.error('API route exception:', err);
    const globalAds = getGlobalListings().filter(item => item.status === 'active' || item.status === 'approved');
    return NextResponse.json({ listings: globalAds });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });

    const nowIso = new Date().toISOString();
    const updates = { status };
    if (status === 'active') {
      updates.created_at = nowIso;
      notifySearchEngines(id);
    }

    updateGlobalListing(id, updates);
    cachedListings = null;
    cacheTime = 0;

    let dbUpdated = false;
    let dbError = null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const serverSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
        const { data, error } = await serverSupabase.from('listings').update(updates).eq('id', id).select();
        if (error) {
          dbError = error.message;
        } else if (data && data.length > 0) {
          dbUpdated = true;
        }
      } catch (err) {
        dbError = err.message;
      }
    }

    return NextResponse.json({ success: true, status, dbUpdated, dbError });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 });

    const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // 1. Delete from global persistent store
    deleteGlobalListing(id);
    deleteChatsForListing(id);

    // 2. Invalidate in-memory cache
    cachedListings = null;
    cacheTime = 0;

    // 3. Delete from Supabase DB
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const serverSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
        
        try {
          await serverSupabase.from('featured_ads').delete().eq('listing_id', id);
        } catch (e) {}

        try {
          await serverSupabase.from('favorites').delete().eq('listing_id', id);
        } catch (e) {}

        if (isValidUUID(id)) {
          const { error: delErr } = await serverSupabase.from('listings').delete().eq('id', id);
          if (delErr) {
            console.error('Hard delete error from Supabase, applying soft delete status=deleted:', delErr);
            await serverSupabase.from('listings').update({ status: 'deleted' }).eq('id', id);
          }
        }
      } catch (sbErr) {
        console.error('Error deleting from Supabase:', sbErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Listing deleted successfully' });
  } catch (err) {
    console.error('API /api/listings DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
