import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from '../../../lib/globalListingsStore';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let dbListings = [];
    let featuredSet = new Set();

    if (supabaseUrl && serviceRoleKey) {
      try {
        const serverSupabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // 1. Fetch featured ads ids on the server
        const { data: featuredData } = await serverSupabase
          .from('featured_ads')
          .select('listing_id')
          .eq('is_active', true);

        if (featuredData) {
          featuredSet = new Set(featuredData.map(f => f.listing_id));
        }

        // 2. Try calling the get_listings_v2 RPC (bypasses RLS using SECURITY DEFINER)
        const { data: rpcData, error: rpcErr } = await serverSupabase.rpc('get_listings_v2');

        if (!rpcErr && Array.isArray(rpcData)) {
          dbListings = rpcData;
        } else {
          // 3. Fallback to normal query if RPC is not created yet
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
      status: 'active',
      is_featured: item.is_featured || featuredSet.has(item.id)
    }));

    return NextResponse.json({ listings: combinedListings }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    });
  } catch (err) {
    console.error('API route exception:', err);
    const globalAds = getGlobalListings();
    return NextResponse.json({ listings: globalAds });
  }
}
