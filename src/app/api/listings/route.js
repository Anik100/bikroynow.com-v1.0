import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings, deleteGlobalListing } from '../../../lib/globalListingsStore';

export const dynamic = 'force-dynamic';

// In-memory high-speed cache for super-fast responses (< 5ms)
let cachedListings = null;
let cacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds cache

export async function GET(req) {
  try {
    const now = Date.now();

    // Serve from ultra-fast in-memory cache if valid
    if (cachedListings && (now - cacheTime < CACHE_TTL_MS)) {
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

        // Parallel execution of featured ads and listings RPC to cut database latency in half
        const [featuredRes, rpcRes] = await Promise.all([
          serverSupabase
            .from('featured_ads')
            .select('listing_id')
            .eq('is_active', true),
          serverSupabase.rpc('get_listings_v2')
        ]);

        if (featuredRes?.data) {
          featuredSet = new Set(featuredRes.data.map(f => f.listing_id));
        }

        if (!rpcRes?.error && Array.isArray(rpcRes?.data)) {
          dbListings = rpcRes.data;
        } else {
          // Fallback if RPC is not available
          const { data: listings } = await serverSupabase
            .from('listings')
            .select('*')
            .neq('status', 'deleted')
            .order('created_at', { ascending: false })
            .limit(50);

          if (Array.isArray(listings)) {
            dbListings = listings;
          }
        }
      } catch (e) {
        console.error('Database query error:', e);
      }
    }

    // Merge DB listings with server-side globalListingsStore
    const globalAds = getGlobalListings();
    const existingIds = new Set(dbListings.map(i => i.id));
    const extraAds = globalAds.filter(ad => !existingIds.has(ad.id) && ad.status !== 'deleted');

    const combinedListings = [...extraAds, ...dbListings].map(item => ({ 
      ...item, 
      status: item.status || 'active',
      is_featured: Boolean(item.is_featured || featuredSet.has(item.id))
    }));

    // Update in-memory cache
    cachedListings = combinedListings;
    cacheTime = now;

    return NextResponse.json({ listings: combinedListings }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Cache': 'MISS'
      }
    });
  } catch (err) {
    console.error('API route exception:', err);
    const globalAds = getGlobalListings();
    return NextResponse.json({ listings: globalAds });
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

    // 2. Invalidate in-memory cache
    cachedListings = null;
    cacheTime = 0;

    // 3. Delete from Supabase DB if valid UUID
    if (isValidUUID(id)) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && serviceRoleKey) {
        try {
          const serverSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
          await serverSupabase.from('listings').delete().eq('id', id);
        } catch (sbErr) {
          console.error('Error deleting from Supabase:', sbErr);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Listing deleted successfully' });
  } catch (err) {
    console.error('API /api/listings DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
