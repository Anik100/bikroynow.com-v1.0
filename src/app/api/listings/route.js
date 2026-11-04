import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings, deleteGlobalListing, updateGlobalListing } from '../../../lib/globalListingsStore';
import { getGlobalFeaturedAds } from '../../../lib/globalFeaturedAdsStore';
import { deleteChatsForListing } from '../../../lib/chatsStore';
import { notifySearchEngines } from '../../../lib/seoPinger';
import { cleanupExpiredMembershipsAndBoosts } from '../../../lib/membershipManagerHelper';

export const dynamic = 'force-dynamic';

// In-memory high-speed cache for super-fast public responses (< 5ms)
let cachedListings = null;
let cacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds cache

const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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
    const deletedListingIds = new Set();

    if (supabaseUrl && serviceRoleKey) {
      try {
        const serverSupabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // Parallel execution of featured ads, listings, profiles, and deleted listings blacklist
        const [featuredRes, dbRes, profilesRes, delSettingRes] = await Promise.all([
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
            .select('id, email, membership_type, membership_expires_at'),
          serverSupabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'deleted_listing_ids')
            .maybeSingle()
        ]);

        if (delSettingRes?.data?.value) {
          try {
            const arr = JSON.parse(delSettingRes.data.value);
            if (Array.isArray(arr)) {
              arr.forEach(id => deletedListingIds.add(String(id)));
            }
          } catch (e) {}
        }

        const profilesMap = new Map();
        if (profilesRes?.data) {
          profilesRes.data.forEach(p => profilesMap.set(p.id, p));
        }

        if (featuredRes?.data) {
          featuredRes.data.forEach(f => featuredSet.add(f.listing_id));
        }

        if (Array.isArray(dbRes?.data)) {
          dbListings = dbRes.data
            .filter(l => !deletedListingIds.has(String(l.id)) && l.status !== 'deleted')
            .map(l => ({
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
    // NOTE: If Supabase returned listings, never resurrect deleted or orphan UUID ads from disk!
    const globalAds = getGlobalListings();
    const existingIds = new Set(dbListings.map(i => String(i.id)));
    const extraAds = globalAds.filter(ad => {
      const idStr = String(ad.id);
      if (deletedListingIds.has(idStr)) return false;
      if (ad.status === 'deleted') return false;
      if (existingIds.has(idStr)) return false;
      // If DB has active listings, ignore stale UUID ads from disk
      if (dbListings.length > 0 && isValidUUID(idStr)) return false;
      return true;
    });

    const combinedListings = [...extraAds, ...dbListings]
      .filter(item => !deletedListingIds.has(String(item.id)) && item.status !== 'deleted')
      .map(item => {
        const userProf = item.profiles;
        const isFree = !userProf || !userProf.membership_type || userProf.membership_type.toLowerCase() === 'free';
        const isExpired = userProf?.membership_expires_at && new Date(userProf.membership_expires_at) <= new Date();
        const hasMembership = Boolean(!isFree && !isExpired);

        // If user profile is free or expired, promotions & slider privileges are completely revoked
        let promoType = null;
        if (hasMembership) {
          promoType = item.promotion_type || userProf.membership_type;
        }

        const isFeatured = Boolean(featuredSet.has(item.id)) && (hasMembership || !item.user_id);

        return {
          ...item,
          status: item.status || 'active',
          is_featured: isFeatured,
          is_verified: Boolean(item.is_verified && hasMembership),
          promotion_type: promoType,
          profiles: hasMembership ? userProf : (userProf ? { ...userProf, membership_type: 'free', membership_expires_at: null } : null)
        };
      });

    let result = combinedListings;

    if (userId) {
      // My Ads: see user's own listings regardless of status (active, pending, rejected)
      result = combinedListings.filter(item => {
        if (item.status === 'deleted' || deletedListingIds.has(String(item.id))) return false;
        const matchId = String(item.user_id) === String(userId);
        const matchEmail = userEmail && item.user_email && item.user_email.toLowerCase() === userEmail.toLowerCase();
        return matchId || matchEmail;
      });
      if (statusParam) {
        result = result.filter(item => item.status === statusParam);
      }
    } else if (includeAll) {
      // Admin dashboard: see all listings (pending, active, rejected)
      result = combinedListings.filter(item => item.status !== 'deleted' && !deletedListingIds.has(String(item.id)));
    } else if (statusParam) {
      result = combinedListings.filter(item => item.status === statusParam && item.status !== 'deleted' && !deletedListingIds.has(String(item.id)));
    } else {
      // PUBLIC USERS (Home, Ads, Search):
      // STRICT MODERATION FILTER: Only show verified active ads!
      // Pending, rejected, or deleted ads are strictly hidden!
      result = combinedListings.filter(item => (item.status === 'active' || item.status === 'approved') && item.status !== 'deleted' && !deletedListingIds.has(String(item.id)));
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
      updates.is_verified = true;
      notifySearchEngines(id);
    } else if (status === 'rejected' || status === 'pending') {
      updates.is_verified = false;
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

    // 1. Delete from global persistent store
    deleteGlobalListing(id);
    deleteChatsForListing(id);

    // 2. Invalidate in-memory cache
    cachedListings = null;
    cacheTime = 0;

    // 3. Delete from Supabase DB & blacklist permanently in admin_settings
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
          // Soft delete in listings first
          try {
            await serverSupabase.from('listings').update({ status: 'deleted' }).eq('id', id);
          } catch (e) {}

          // Hard delete from listings
          try {
            await serverSupabase.from('listings').delete().eq('id', id);
          } catch (delErr) {
            console.error('Hard delete error from Supabase:', delErr);
          }
        }

        // Add to permanent deleted blacklist in admin_settings
        try {
          const { data: setRow } = await serverSupabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'deleted_listing_ids')
            .maybeSingle();
          let currentDeleted = [];
          if (setRow?.value) {
            try { currentDeleted = JSON.parse(setRow.value); } catch (e) {}
          }
          if (!currentDeleted.includes(id)) {
            currentDeleted.push(id);
            await serverSupabase.from('admin_settings').upsert({
              key: 'deleted_listing_ids',
              value: JSON.stringify(currentDeleted)
            }, { onConflict: 'key' });
          }
        } catch (e) {}
      } catch (sbErr) {
        console.error('Error deleting from Supabase:', sbErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Listing deleted permanently' });
  } catch (err) {
    console.error('API /api/listings DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
