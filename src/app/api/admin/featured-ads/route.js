import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalFeaturedAds, saveGlobalFeaturedAds } from '../../../../lib/globalFeaturedAdsStore';
import { getGlobalListings } from '../../../../lib/globalListingsStore';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return null;
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    let featured = getGlobalFeaturedAds();

    // 1. Fetch listings map to attach to each featured item
    let listingsMap = new Map();

    if (supabase) {
      try {
        const { data: dbListings } = await supabase
          .from('listings')
          .select('id, title, price, location, images, user_id, status');
        if (dbListings) {
          dbListings.forEach(l => listingsMap.set(l.id, l));
        }

        // Also fetch from db featured_ads if available
        const { data: dbFeatured } = await supabase
          .from('featured_ads')
          .select('*');
        if (dbFeatured && dbFeatured.length > 0) {
          // Merge unique entries
          const merged = [...dbFeatured];
          featured.forEach(localItem => {
            if (!merged.some(m => m.listing_id === localItem.listing_id)) {
              merged.push(localItem);
            }
          });
          featured = merged;
          saveGlobalFeaturedAds(featured);
        }
      } catch (e) {
        console.error('Error fetching db listings for featured ads:', e);
      }
    }

    const fallbackListings = getGlobalListings();
    fallbackListings.forEach(l => {
      if (!listingsMap.has(l.id)) {
        listingsMap.set(l.id, l);
      }
    });

    const populated = featured
      .map(item => ({
        ...item,
        listing: listingsMap.get(item.listing_id) || null
      }))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return NextResponse.json({ success: true, data: populated });
  } catch (err) {
    console.error('GET /api/admin/featured-ads error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, listing_id, id, is_active, sort_order } = body;
    const supabase = getSupabaseClient();
    let currentFeatured = getGlobalFeaturedAds();

    if (action === 'toggle') {
      if (!listing_id) {
        return NextResponse.json({ error: 'listing_id is required' }, { status: 400 });
      }

      const existingIndex = currentFeatured.findIndex(item => item.listing_id === listing_id);
      if (existingIndex >= 0) {
        // Remove from featured
        const removedItem = currentFeatured[existingIndex];
        currentFeatured.splice(existingIndex, 1);
        saveGlobalFeaturedAds(currentFeatured);

        if (supabase && removedItem.id) {
          try {
            await supabase.from('featured_ads').delete().eq('listing_id', listing_id);
          } catch (e) {}
        }

        return NextResponse.json({
          success: true,
          action: 'removed',
          listing_id,
          message: 'Removed from slider'
        });
      } else {
        // Add to featured
        const nextSort = currentFeatured.length > 0 ? Math.max(...currentFeatured.map(i => i.sort_order || 0)) + 1 : 0;
        const newItem = {
          id: crypto.randomUUID(),
          listing_id,
          is_active: true,
          sort_order: nextSort,
          created_at: new Date().toISOString()
        };

        currentFeatured.push(newItem);
        saveGlobalFeaturedAds(currentFeatured);

        if (supabase) {
          try {
            await supabase.from('featured_ads').upsert({
              listing_id,
              is_active: true,
              sort_order: nextSort
            }, { onConflict: 'listing_id' });
          } catch (e) {}
        }

        return NextResponse.json({
          success: true,
          action: 'added',
          item: newItem,
          message: 'Added to slider'
        });
      }
    }

    if (action === 'update') {
      const target = currentFeatured.find(i => i.id === id || i.listing_id === listing_id);
      if (target) {
        if (typeof is_active === 'boolean') target.is_active = is_active;
        if (typeof sort_order === 'number') target.sort_order = sort_order;
        saveGlobalFeaturedAds(currentFeatured);

        if (supabase && target.id) {
          try {
            await supabase.from('featured_ads').update({
              is_active: target.is_active,
              sort_order: target.sort_order
            }).eq('id', target.id);
          } catch (e) {}
        }

        return NextResponse.json({ success: true, item: target });
      }
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (action === 'delete') {
      const updated = currentFeatured.filter(i => i.id !== id && i.listing_id !== listing_id);
      saveGlobalFeaturedAds(updated);

      if (supabase) {
        try {
          if (id) await supabase.from('featured_ads').delete().eq('id', id);
          if (listing_id) await supabase.from('featured_ads').delete().eq('listing_id', listing_id);
        } catch (e) {}
      }

      return NextResponse.json({ success: true, message: 'Deleted' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/admin/featured-ads error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
