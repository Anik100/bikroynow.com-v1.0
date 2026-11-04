import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateGlobalListing } from '../../../../lib/globalListingsStore';
import { getGlobalFeaturedAds, saveGlobalFeaturedAds } from '../../../../lib/globalFeaturedAdsStore';
import { activateUserMembership, revokeUserMembershipAndBoosts } from '../../../../lib/membershipManagerHelper';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && serviceRoleKey)
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : null;

    // Instant activation directly from user purchase
    if (body.action === 'instant_activate') {
      const { user_email, package_id, package_name, duration, duration_unit, packageObj, listing_id, transaction_id, sender_number, payment_method, price, screenshot_url } = body;

      const res = await activateUserMembership({
        userEmail: user_email,
        packageName: package_name,
        duration: duration || 30,
        durationUnit: duration_unit || 'days',
        packageObj,
        listingId: listing_id || null
      });

      if (serverSupabase && user_email) {
        try {
          await serverSupabase.from('membership_purchases').insert([{
            user_email: user_email.trim(),
            package_id: package_id || null,
            package_name: package_name || 'Membership',
            price: price || 0,
            payment_method: payment_method || 'bkash',
            sender_number: sender_number || '01700000000',
            transaction_id: transaction_id || ('TXN-' + Date.now()),
            screenshot_url: screenshot_url || null,
            status: 'approved',
            listing_id: listing_id || null
          }]);
        } catch (e) {}
      }

      return NextResponse.json({ success: true, message: 'Membership activated instantly and ads boosted', ...res });
    }

    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    if (!serverSupabase) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

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
    } else if (status === 'pending' || status === 'rejected' || status === 'cancelled') {
      // AUTOMATICALLY REVERT MEMBERSHIP, BOOSTS & REMOVE ALL ADS FROM SLIDER
      await revokeUserMembershipAndBoosts({
        userId: purchase.user_id || null,
        userEmail: purchase.user_email || null,
        listingId: purchase.listing_id || null
      });
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
