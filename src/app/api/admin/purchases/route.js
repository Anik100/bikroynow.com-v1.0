import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateGlobalListing } from '../../../../lib/globalListingsStore';
import { getGlobalFeaturedAds, saveGlobalFeaturedAds } from '../../../../lib/globalFeaturedAdsStore';
import { activateUserMembership } from '../../../../lib/membershipManagerHelper';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const serverSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // 1. Fetch purchase record
    const { data: purchase, error: purErr } = await serverSupabase
      .from('membership_purchases')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (purErr || !purchase) {
      return NextResponse.json({ error: 'Purchase not found: ' + (purErr?.message || '') }, { status: 404 });
    }

    if (status === 'approved') {
      // Fetch package details
      const { data: pkg } = await serverSupabase
        .from('membership_packages')
        .select('*')
        .eq('id', purchase.package_id)
        .maybeSingle();

      const packageName = pkg?.name_en || purchase.package_name || 'Boost';
      const duration = pkg?.duration || (purchase.listing_id ? 15 : 1);
      const durationUnit = pkg?.duration_unit || (purchase.listing_id ? 'days' : 'month');

      // Automatically activate user membership, boost all their ads, and insert into top slider if qualified
      await activateUserMembership({
        userEmail: purchase.user_email,
        packageName,
        duration,
        durationUnit,
        packageObj: pkg,
        listingId: purchase.listing_id || null
      });
    } else if (status === 'pending' || status === 'rejected') {
      // AUTOMATICALLY REVERT BOOST & REMOVE FROM SLIDER WHEN RESET OR REJECTED!
      if (purchase.listing_id) {
        const revertUpdates = {
          promotion_type: null,
          is_verified: false,
          is_featured: false
        };

        await serverSupabase
          .from('listings')
          .update(revertUpdates)
          .eq('id', purchase.listing_id);

        updateGlobalListing(purchase.listing_id, revertUpdates);

        await serverSupabase
          .from('featured_ads')
          .delete()
          .eq('listing_id', purchase.listing_id);

        const curFeatured = getGlobalFeaturedAds().filter(f => String(f.listing_id) !== String(purchase.listing_id));
        saveGlobalFeaturedAds(curFeatured);
      }

      // Revert user profile membership back to free and remove their ads from slider
      if (purchase.user_email) {
        const { data: prof } = await serverSupabase
          .from('profiles')
          .select('id')
          .ilike('email', purchase.user_email.trim())
          .maybeSingle();

        if (prof) {
          await serverSupabase
            .from('profiles')
            .update({
              membership_type: 'free',
              membership_expires_at: null
            })
            .eq('id', prof.id);

          const revertUpdates = {
            promotion_type: null,
            is_verified: false,
            is_featured: false
          };

          await serverSupabase
            .from('listings')
            .update(revertUpdates)
            .eq('user_id', prof.id);

          const { data: uListings } = await serverSupabase
            .from('listings')
            .select('id')
            .eq('user_id', prof.id);

          if (uListings && uListings.length > 0) {
            const uIds = new Set(uListings.map(l => String(l.id)));
            for (const lId of uIds) {
              await serverSupabase.from('featured_ads').delete().eq('listing_id', lId);
            }
            const curFeatured = getGlobalFeaturedAds().filter(f => !uIds.has(String(f.listing_id)));
            saveGlobalFeaturedAds(curFeatured);
          }
        }
      }
    }

    // Update status in membership_purchases
    const { data: updatedPurchase, error: updateErr } = await serverSupabase
      .from('membership_purchases')
      .update({ status })
      .eq('id', id)
      .select();

    return NextResponse.json({ 
      success: true, 
      status, 
      updated: Boolean(updatedPurchase && updatedPurchase.length > 0),
      error: updateErr?.message || null 
    });
  } catch (err) {
    console.error('Error in /api/admin/purchases:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
