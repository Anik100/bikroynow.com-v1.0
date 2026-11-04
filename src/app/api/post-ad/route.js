import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { saveGlobalListing } from '../../../lib/globalListingsStore';
import { getGlobalFeaturedAds, saveGlobalFeaturedAds } from '../../../lib/globalFeaturedAdsStore';
import { doesPackageQualifyForSlider } from '../../../lib/membershipManagerHelper';
import { notifySearchEngines } from '../../../lib/seoPinger';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body || !body.title || !body.category_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && anonKey) 
      ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
      : null;

    let validUserId = body.user_id;
    let userProfile = null;

    if (serverSupabase) {
      try {
        const { data: allProfs } = await serverSupabase.from('profiles').select('id, email, membership_type, membership_expires_at');
        if (allProfs && allProfs.length > 0) {
          const cleanUser = String(body.user_id || '').toLowerCase().trim();
          let matched = allProfs.find(p => p.id === body.user_id || p.email?.toLowerCase() === cleanUser);
          if (!matched) {
            matched = allProfs.find(p => p.email && 'user-' + p.email.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanUser);
          }
          if (matched) {
            validUserId = matched.id;
            userProfile = matched;
          } else {
            validUserId = allProfs[0].id;
            userProfile = allProfs[0];
          }
        }
      } catch (e) {}
    }

    const adId = isValidUUID(body.id) ? body.id : crypto.randomUUID();

    // Check if user has an active non-expired membership
    const hasActiveMembership = userProfile &&
      userProfile.membership_type &&
      userProfile.membership_type.toLowerCase() !== 'free' &&
      (!userProfile.membership_expires_at || new Date(userProfile.membership_expires_at) > new Date());

    const qualifiesForSlider = hasActiveMembership && doesPackageQualifyForSlider(userProfile.membership_type);

    const initialStatus = hasActiveMembership ? 'active' : (body.status || 'pending');
    const initialPromotion = hasActiveMembership ? userProfile.membership_type : (body.promotion_type || null);
    const initialVerified = hasActiveMembership ? true : Boolean(body.is_verified);
    const initialFeatured = qualifiesForSlider ? true : Boolean(body.is_featured);

    const newAd = {
      id: adId,
      user_id: validUserId,
      title: body.title.trim(),
      description: body.description || '',
      price: parseFloat(body.price) || 0,
      category_id: body.category_id,
      location: body.location || 'Dhaka',
      condition: body.condition || 'Used',
      contact_phone: body.contact_phone || '01700000000',
      images: Array.isArray(body.images) && body.images.length > 0 
        ? body.images 
        : ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'],
      status: initialStatus,
      promotion_type: initialPromotion,
      is_verified: initialVerified,
      is_featured: initialFeatured,
      created_at: new Date().toISOString(),
      profiles: userProfile ? {
        membership_type: userProfile.membership_type,
        membership_expires_at: userProfile.membership_expires_at
      } : undefined
    };

    // 1. Save to server-side global listings store
    saveGlobalListing(newAd);

    // 2. If qualifies for Top Slider, add to featured_ads store
    if (qualifiesForSlider) {
      try {
        const curFeatured = getGlobalFeaturedAds();
        if (!curFeatured.some(f => String(f.listing_id) === String(adId))) {
          curFeatured.push({
            id: crypto.randomUUID(),
            listing_id: adId,
            is_active: true,
            sort_order: 0,
            created_at: new Date().toISOString()
          });
          saveGlobalFeaturedAds(curFeatured);
        }
      } catch (e) {}
    }

    // 3. Insert to Supabase DB (exclude non-column fields like is_featured and profiles)
    if (serverSupabase) {
      try {
        const { is_featured, profiles, ...dbPayload } = newAd;
        const { data: inserted, error: sbErr } = await serverSupabase.from('listings').insert([dbPayload]).select();
        if (sbErr) {
          console.error('Supabase listings insert error:', sbErr);
        } else if (inserted && inserted.length > 0) {
          if (qualifiesForSlider) {
            try {
              await serverSupabase.from('featured_ads').upsert({
                listing_id: inserted[0].id,
                is_active: true,
                sort_order: 0
              }, { onConflict: 'listing_id' });
            } catch (e) {}
          }
          notifySearchEngines(inserted[0].id);
          return NextResponse.json({ success: true, ad: { ...inserted[0], is_featured: Boolean(qualifiesForSlider) } });
        }
      } catch (sbErr) {
        console.error('Supabase async insert error:', sbErr);
      }
    }

    notifySearchEngines(newAd.id);
    return NextResponse.json({ success: true, ad: newAd });
  } catch (err) {
    console.error('API /api/post-ad error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
