import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalFeaturedAds, saveGlobalFeaturedAds } from '../../../../lib/globalFeaturedAdsStore';
import { getGlobalListings } from '../../../../lib/globalListingsStore';
import { cleanupExpiredMembershipsAndBoosts } from '../../../../lib/membershipManagerHelper';
import { sortFeaturedAds } from '../../../../lib/utils';
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
    // 0. Automatically clean up any expired memberships/boosts from top slider
    await cleanupExpiredMembershipsAndBoosts();

    const supabase = getSupabaseClient();
    let featured = getGlobalFeaturedAds();

    // 1. Fetch listings map to attach to each featured item
    let listingsMap = new Map();

    if (supabase) {
      try {
        const [listingsRes, profilesRes, dbFeaturedRes] = await Promise.all([
          supabase.from('listings').select('id, title, price, location, images, user_id, status, promotion_type').neq('status', 'deleted'),
          supabase.from('profiles').select('id, email, membership_type, membership_expires_at'),
          supabase.from('featured_ads').select('*').eq('is_active', true)
        ]);

        const profilesMap = new Map();
        if (profilesRes.data) {
          profilesRes.data.forEach(p => profilesMap.set(p.id, p));
        }

        if (listingsRes.data) {
          listingsRes.data.forEach(l => {
            l.profiles = profilesMap.get(l.user_id) || null;
            listingsMap.set(l.id, l);
          });
        }

        if (dbFeaturedRes?.data) {
          featured = dbFeaturedRes.data;
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

    const now = new Date();
    const populated = featured
      .map(item => ({
        ...item,
        listing: listingsMap.get(item.listing_id) || null
      }))
      .filter(item => {
        if (!item.is_active || !item.listing || item.listing.status === 'deleted') return false;
        
        // If the listing belongs to a user, check their membership status
        if (item.listing.user_id) {
          const prof = item.listing.profiles;
          if (!prof || !prof.membership_type || prof.membership_type === 'free') {
            return false;
          }
          if (prof.membership_expires_at && new Date(prof.membership_expires_at) <= now) {
            return false;
          }
        }
        return true;
      })
      ;

    const sortedPopulated = sortFeaturedAds(populated);
    return NextResponse.json({ success: true, data: sortedPopulated });
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

      let inDb = false;
      if (supabase) {
        try {
          const { data } = await supabase.from('featured_ads').select('id').eq('listing_id', listing_id).maybeSingle();
          if (data?.id) inDb = true;
        } catch (e) {}
      }

      const existingIndex = currentFeatured.findIndex(item => item.listing_id === listing_id);
      if (existingIndex >= 0 || inDb) {
        // Remove from featured
        if (existingIndex >= 0) {
          currentFeatured.splice(existingIndex, 1);
          saveGlobalFeaturedAds(currentFeatured);
        }

        if (supabase) {
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
      let sbItem = null;
      if (supabase && (id || listing_id)) {
        try {
          const updates = {};
          if (typeof is_active === 'boolean') updates.is_active = is_active;
          if (typeof sort_order === 'number') updates.sort_order = sort_order;

          let query = supabase.from('featured_ads').update(updates);
          if (id) query = query.eq('id', id);
          else if (listing_id) query = query.eq('listing_id', listing_id);
          const { data } = await query.select().maybeSingle();
          if (data) sbItem = data;
        } catch (e) {}
      }

      const target = currentFeatured.find(i => i.id === id || i.listing_id === listing_id);
      if (target) {
        if (typeof is_active === 'boolean') target.is_active = is_active;
        if (typeof sort_order === 'number') target.sort_order = sort_order;
        saveGlobalFeaturedAds(currentFeatured);
      }

      return NextResponse.json({ success: true, item: sbItem || target || { id, is_active, sort_order } });
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
