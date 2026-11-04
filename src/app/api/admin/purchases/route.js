import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateGlobalListing } from '../../../../lib/globalListingsStore';

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
      const packageType = pkg?.type || (purchase.listing_id ? 'boost' : 'membership');

      if (packageType === 'boost' && purchase.listing_id) {
        const nowIso = new Date().toISOString();
        const listingUpdates = {
          status: 'active',
          is_verified: true,
          promotion_type: packageName,
          created_at: nowIso
        };

        await serverSupabase
          .from('listings')
          .update(listingUpdates)
          .eq('id', purchase.listing_id);

        updateGlobalListing(purchase.listing_id, listingUpdates);

        // If Mega Boost or business, add to featured_ads
        if (packageName.toLowerCase().includes('mega') || pkg?.color === 'business') {
          await serverSupabase
            .from('featured_ads')
            .upsert({ listing_id: purchase.listing_id, is_active: true, sort_order: 0 }, { onConflict: 'listing_id' });
        }
      }

      // Update user profile membership / boost status
      if (purchase.user_email) {
        const { data: profile } = await serverSupabase
          .from('profiles')
          .select('id')
          .ilike('email', purchase.user_email.trim())
          .maybeSingle();

        if (profile) {
          const expiresAt = new Date();
          const duration = pkg?.duration || 15;
          if (pkg?.duration_unit === 'month') {
            expiresAt.setMonth(expiresAt.getMonth() + duration);
          } else {
            expiresAt.setDate(expiresAt.getDate() + duration);
          }

          await serverSupabase
            .from('profiles')
            .update({
              membership_type: packageName,
              membership_expires_at: expiresAt.toISOString()
            })
            .eq('id', profile.id);
        }
      }
    } else if (status === 'pending' || status === 'rejected') {
      // AUTOMATICALLY REVERT BOOST WHEN RESET TO PENDING OR REJECTED!
      if (purchase.listing_id) {
        const revertUpdates = {
          promotion_type: null,
          is_verified: false
        };

        await serverSupabase
          .from('listings')
          .update(revertUpdates)
          .eq('id', purchase.listing_id);

        updateGlobalListing(purchase.listing_id, revertUpdates);

        // Remove from featured_ads slider immediately
        await serverSupabase
          .from('featured_ads')
          .delete()
          .eq('listing_id', purchase.listing_id);
      }

      // Revert user profile membership back to free
      if (purchase.user_email) {
        await serverSupabase
          .from('profiles')
          .update({
            membership_type: 'free',
            membership_expires_at: null
          })
          .ilike('email', purchase.user_email.trim());
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
