import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { saveGlobalListing } from '../../../lib/globalListingsStore';
import { getGlobalFeaturedAds, saveGlobalFeaturedAds } from '../../../lib/globalFeaturedAdsStore';
import { doesPackageQualifyForSlider } from '../../../lib/membershipManagerHelper';
import { notifySearchEngines } from '../../../lib/seoPinger';
import crypto from 'crypto';

// Helper to prevent database operations from hanging API requests
const withTimeout = (promise, ms, fallback) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
  ]).catch((err) => {
    console.warn(`[API /api/post-ad] Async operation bypassed (${err?.message || 'timeout'}):`, err);
    return fallback;
  });
};

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body || !body.title || !body.category_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && serviceRoleKey) 
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : null;

    let validUserId = isValidUUID(body.user_id) ? body.user_id : null;
    let userProfile = null;
    const rawUserEmail = typeof body.user_email === 'string' ? body.user_email.trim().toLowerCase() : '';
    const validUserEmail = (rawUserEmail && rawUserEmail !== 'user@bikroynow.com') ? rawUserEmail : '';

    if (serverSupabase && (validUserId || validUserEmail)) {
      try {
        const query = validUserId
          ? serverSupabase.from('profiles').select('id, email, membership_type, membership_expires_at').eq('id', validUserId).maybeSingle()
          : serverSupabase.from('profiles').select('id, email, membership_type, membership_expires_at').eq('email', validUserEmail).maybeSingle();

        const profRes = await withTimeout(query, 3500, { data: null });
        if (profRes?.data) {
          validUserId = profRes.data.id;
          userProfile = profRes.data;
        }
      } catch (e) {
        console.warn('Profile lookup bypassed:', e);
      }
    }

    if (!isValidUUID(validUserId)) {
      return NextResponse.json({ error: 'Authentication required. Please login to post an ad.' }, { status: 401 });
    }

    const adId = isValidUUID(body.id) ? body.id : crypto.randomUUID();

    // Check if ad verification is required from admin settings (default: true)
    let verificationRequired = true;
    if (serverSupabase) {
      try {
        const settingRes = await withTimeout(
          serverSupabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'ad_verification_required')
            .maybeSingle(),
          3000,
          { data: null }
        );
        if (settingRes?.data && (settingRes.data.value === 'false' || settingRes.data.value === false)) {
          verificationRequired = false;
        }
      } catch (e) {
        console.error('Error checking verification setting:', e);
      }
    }

    // Check if user has an active non-expired membership
    const hasActiveMembership = userProfile &&
      userProfile.membership_type &&
      userProfile.membership_type.toLowerCase() !== 'free' &&
      (!userProfile.membership_expires_at || new Date(userProfile.membership_expires_at) > new Date());

    const adminEmails = [
      'anikh0000@gmail.com',
      'anikh00000@gmail.com',
      'anikh00@gmail.com',
      'aunik008@gmail.com',
      'aunik003@gmail.com',
      'anikhossain99999@gmail.com',
      'admin@bikroynow.com'
    ];
    const isUserAdmin = adminEmails.includes(rawUserEmail) ||
      rawUserEmail.includes('admin') ||
      userProfile?.role === 'admin';

    // 5 FREE ADS LIMIT PER MONTH (Strict: deleting ads does not restore quota!)
    if (!hasActiveMembership && !isUserAdmin && serverSupabase) {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

      // 1. Count listings created this month (including status 'deleted')
      const { data: monthListings } = await serverSupabase
        .from('listings')
        .select('id, created_at, status')
        .eq('user_id', validUserId)
        .gte('created_at', startOfMonth);

      const listingCount = Array.isArray(monthListings) ? monthListings.length : 0;

      // 2. Check audit log in admin_settings
      const settingKey = `ad_usage_${monthKey}_${validUserId}`;
      const { data: settingData } = await serverSupabase
        .from('admin_settings')
        .select('value')
        .eq('key', settingKey)
        .maybeSingle();

      let auditCount = 0;
      if (settingData && settingData.value) {
        try {
          const parsed = JSON.parse(settingData.value);
          auditCount = parseInt(parsed.count || 0, 10) || 0;
        } catch (_) {
          auditCount = parseInt(settingData.value || 0, 10) || 0;
        }
      }

      const totalUsed = Math.max(listingCount, auditCount);
      if (totalUsed >= 5) {
        return NextResponse.json({
          error: 'মাসিক ৫টি ফ্রি বিজ্ঞাপনের লিমিট শেষ হয়ে গেছে। বিজ্ঞাপন ডিলিট করলেও মাসিক ফ্রি কোটা পুনরুদ্ধার হয় না। আরও বিজ্ঞাপন দিতে মেম্বারশিপ প্যাকেজ গ্রহণ করুন।',
          code: 'MONTHLY_LIMIT_REACHED',
          limit: 5,
          used: totalUsed
        }, { status: 403 });
      }
    }

    const qualifiesForSlider = hasActiveMembership && doesPackageQualifyForSlider(userProfile.membership_type);

    // CRITICAL:
    // If verification is ON: ALL newly posted ads go to 'pending' for admin moderation.
    // If verification is OFF: ads go directly live ('active').
    const initialStatus = verificationRequired ? 'pending' : 'active';
    const initialPromotion = hasActiveMembership ? userProfile.membership_type : (body.promotion_type || null);
    const initialVerified = (!verificationRequired && hasActiveMembership) ? true : false;
    const initialFeatured = (!verificationRequired && qualifiesForSlider) ? true : false;

    const rawContactPhone = (body.contact_phone || '01700000000').trim();
    const cleanPhoneOnly = rawContactPhone.replace(/\|.*/, '').trim();
    const finalContactPhone = body.has_whatsapp === false ? `${cleanPhoneOnly}|nowa` : cleanPhoneOnly;

    const newAd = {
      id: adId,
      user_id: validUserId,
      title: body.title.trim(),
      description: body.description || '',
      price: parseFloat(body.price) || 0,
      category_id: body.category_id,
      location: body.location || 'Dhaka',
      condition: body.condition || 'Used',
      contact_phone: finalContactPhone,
      images: Array.isArray(body.images) && body.images.length > 0 
        ? body.images 
        : ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'],
      status: initialStatus,
      promotion_type: initialPromotion,
      is_verified: initialVerified,
      created_at: new Date().toISOString()
    };

    // 1. If verification is OFF and qualifies for Top Slider, add to featured_ads
    if (!verificationRequired && qualifiesForSlider) {
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

    // 2. Insert to Supabase DB with 5s timeout protection
    if (serverSupabase) {
      try {
        const insertRes = await withTimeout(
          serverSupabase
            .from('listings')
            .insert([newAd])
            .select(),
          5500,
          { data: null, error: new Error('Insert timed out') }
        );

        const inserted = insertRes?.data;
        const sbErr = insertRes?.error;

        if (sbErr) {
          console.error('Supabase listings insert error or timeout:', sbErr);
        } else if (inserted && inserted.length > 0) {
          // Record to persistent monthly audit in admin_settings
          try {
            const now = new Date();
            const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
            const settingKey = `ad_usage_${monthKey}_${validUserId}`;
            const { data: curSetting } = await serverSupabase
              .from('admin_settings')
              .select('value')
              .eq('key', settingKey)
              .maybeSingle();

            let curCount = 0;
            let adIds = [];
            if (curSetting?.value) {
              try {
                const parsed = JSON.parse(curSetting.value);
                curCount = parseInt(parsed.count || 0, 10) || 0;
                if (Array.isArray(parsed.ad_ids)) adIds = parsed.ad_ids;
              } catch (_) {
                curCount = parseInt(curSetting.value || 0, 10) || 0;
              }
            }
            curCount += 1;
            if (!adIds.includes(adId)) adIds.push(adId);

            await serverSupabase
              .from('admin_settings')
              .upsert({
                key: settingKey,
                value: JSON.stringify({ count: curCount, ad_ids: adIds, updated_at: new Date().toISOString() })
              }, { onConflict: 'key' });
          } catch (auditErr) {
            console.warn('Failed to record ad quota audit:', auditErr);
          }

          if (!verificationRequired && qualifiesForSlider) {
            serverSupabase.from('featured_ads').upsert({
              listing_id: inserted[0].id,
              is_active: true,
              sort_order: 0
            }, { onConflict: 'listing_id' }).catch(() => {});
          }
          // Real-Time Instant Indexing Hook
          notifySearchEngines(inserted[0].id);
          return NextResponse.json({ 
            success: true, 
            ad: { ...inserted[0], is_featured: Boolean(!verificationRequired && qualifiesForSlider) },
            status: inserted[0].status || initialStatus,
            autoApproved: initialStatus === 'active'
          });
        }
      } catch (sbErr) {
        console.error('Supabase async insert error:', sbErr);
      }
    }

    // 3. Fallback only if Supabase is unavailable or timed out
    if (initialStatus === 'active') {
      saveGlobalListing(newAd);
      notifySearchEngines(newAd.id);
    }

    return NextResponse.json({ 
      success: true, 
      ad: newAd,
      status: newAd.status,
      autoApproved: initialStatus === 'active'
    });
  } catch (err) {
    console.error('API /api/post-ad error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
