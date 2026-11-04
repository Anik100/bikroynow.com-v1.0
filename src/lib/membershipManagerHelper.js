import { createClient } from '@supabase/supabase-js';
import { getGlobalListings, updateGlobalListing } from './globalListingsStore';
import { getGlobalFeaturedAds, saveGlobalFeaturedAds } from './globalFeaturedAdsStore';
import crypto from 'crypto';

/**
 * Checks whether a package qualifies to be shown in the Top Featured Slider
 */
export function doesPackageQualifyForSlider(packageName, packageObj = null) {
  if (!packageName) return false;
  const name = String(packageName).toLowerCase();

  if (packageObj?.is_featured || packageObj?.show_in_slider) return true;

  // Packages with top slider privilege:
  // - Gold Member
  // - Business Partner / Enterprise
  // - 15-Day Mega Boost
  // - 7-Day Super Boost
  if (
    name.includes('gold') ||
    name.includes('business') ||
    name.includes('partner') ||
    name.includes('mega') ||
    name.includes('super') ||
    name.includes('enterprise') ||
    name.includes('slider') ||
    name.includes('banner')
  ) {
    return true;
  }

  // Check features array if present
  if (Array.isArray(packageObj?.features)) {
    const featureText = JSON.stringify(packageObj.features).toLowerCase();
    if (
      featureText.includes('slider') ||
      featureText.includes('banner') ||
      featureText.includes('home partner') ||
      featureText.includes('top position')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Computes expiration date based on duration and unit
 */
export function calculateExpiryDate(duration, durationUnit) {
  const expiresAt = new Date();
  const d = parseInt(duration, 10) || 30;
  const unit = String(durationUnit || '').toLowerCase();

  if (unit === 'month' || unit === 'months') {
    expiresAt.setMonth(expiresAt.getMonth() + d);
  } else if (unit === 'year' || unit === 'years') {
    expiresAt.setFullYear(expiresAt.getFullYear() + d);
  } else {
    // Default to days
    expiresAt.setDate(expiresAt.getDate() + d);
  }
  return expiresAt;
}

/**
 * Automatically activates user membership, boosts their posted ads,
 * and places qualifying ads into the homepage Top Slider.
 */
export async function activateUserMembership({
  userId = null,
  userEmail = null,
  packageName = 'Boost',
  duration = 30,
  durationUnit = 'days',
  packageObj = null,
  listingId = null
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverSupabase = (supabaseUrl && serviceRoleKey)
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;

  const expiresAt = calculateExpiryDate(duration, durationUnit);
  const expiresIso = expiresAt.toISOString();
  const qualifiesForSlider = doesPackageQualifyForSlider(packageName, packageObj);

  let targetUserId = userId;
  let targetUserEmail = userEmail;

  // 1. Update user profile in Supabase
  if (serverSupabase) {
    try {
      let profileQuery = serverSupabase.from('profiles').select('id, email');
      if (targetUserId) {
        profileQuery = profileQuery.eq('id', targetUserId);
      } else if (targetUserEmail) {
        profileQuery = profileQuery.ilike('email', targetUserEmail.trim());
      }
      const { data: prof } = await profileQuery.maybeSingle();
      if (prof) {
        targetUserId = prof.id;
        targetUserEmail = prof.email;
        await serverSupabase
          .from('profiles')
          .update({
            membership_type: packageName,
            membership_expires_at: expiresIso
          })
          .eq('id', prof.id);
      }
    } catch (e) {
      console.error('Error updating profile in activateUserMembership:', e);
    }
  }

  // 2. Automatically boost user's posted ads
  const listingUpdates = {
    status: 'active',
    is_verified: true,
    promotion_type: packageName,
    is_featured: qualifiesForSlider,
    created_at: new Date().toISOString()
  };

  // Update in Supabase
  if (serverSupabase) {
    try {
      if (listingId) {
        await serverSupabase
          .from('listings')
          .update(listingUpdates)
          .eq('id', listingId);
      } else if (targetUserId) {
        await serverSupabase
          .from('listings')
          .update(listingUpdates)
          .eq('user_id', targetUserId)
          .neq('status', 'deleted');
      }
    } catch (e) {
      console.error('Error updating listings in activateUserMembership:', e);
    }
  }

  // Update in server global listings store
  try {
    const globalListings = getGlobalListings();
    for (const ad of globalListings) {
      const match = (listingId && String(ad.id) === String(listingId)) ||
        (targetUserId && String(ad.user_id) === String(targetUserId)) ||
        (targetUserEmail && ad.user_email && ad.user_email.toLowerCase() === targetUserEmail.toLowerCase());
      if (match && ad.status !== 'deleted') {
        updateGlobalListing(ad.id, {
          ...listingUpdates,
          profiles: {
            membership_type: packageName,
            membership_expires_at: expiresIso
          }
        });
      }
    }
  } catch (e) {}

  // 3. If package qualifies for Top Slider, automatically insert into featured_ads
  if (qualifiesForSlider) {
    try {
      let adsToFeature = [];
      if (listingId) {
        adsToFeature = [listingId];
      } else {
        if (serverSupabase && targetUserId) {
          const { data: dbAds } = await serverSupabase
            .from('listings')
            .select('id')
            .eq('user_id', targetUserId)
            .eq('status', 'active');
          if (dbAds) adsToFeature = dbAds.map(a => a.id);
        }
        const globalAds = getGlobalListings().filter(a =>
          (String(a.user_id) === String(targetUserId) || (targetUserEmail && a.user_email === targetUserEmail)) &&
          a.status === 'active'
        );
        for (const g of globalAds) {
          if (!adsToFeature.includes(g.id)) adsToFeature.push(g.id);
        }
      }

      // Add to globalFeaturedAdsStore
      const currentFeatured = getGlobalFeaturedAds();
      for (const adId of adsToFeature) {
        if (!currentFeatured.some(f => String(f.listing_id) === String(adId))) {
          currentFeatured.push({
            id: crypto.randomUUID(),
            listing_id: adId,
            is_active: true,
            sort_order: 0,
            created_at: new Date().toISOString()
          });
        }
      }
      saveGlobalFeaturedAds(currentFeatured);

      // Add to Supabase featured_ads table
      if (serverSupabase) {
        for (const adId of adsToFeature) {
          try {
            await serverSupabase.from('featured_ads').upsert({
              listing_id: adId,
              is_active: true,
              sort_order: 0
            }, { onConflict: 'listing_id' });
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('Error adding to slider in activateUserMembership:', e);
    }
  }

  return { success: true, expiresAt: expiresIso, qualifiesForSlider };
}

let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 20000; // Run at most once every 20 seconds to prevent DB stress

/**
 * Automatically inspects memberships and boosts:
 * - If expired: removes from Top Slider immediately
 * - Reverts promotion_type to null & membership_type to 'free'
 */
export async function cleanupExpiredMembershipsAndBoosts() {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanupTime = now;

  const nowIso = new Date().toISOString();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverSupabase = (supabaseUrl && serviceRoleKey)
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;

  try {
    const expiredUserIds = new Set();

    // 1. Check Supabase profiles with expired memberships
    if (serverSupabase) {
      try {
        const { data: expiredProfiles } = await serverSupabase
          .from('profiles')
          .select('id, email, membership_expires_at')
          .not('membership_expires_at', 'is', null)
          .lt('membership_expires_at', nowIso);

        if (Array.isArray(expiredProfiles) && expiredProfiles.length > 0) {
          for (const p of expiredProfiles) {
            expiredUserIds.add(p.id);
            await serverSupabase
              .from('profiles')
              .update({ membership_type: 'free', membership_expires_at: null })
              .eq('id', p.id);
          }
        }
      } catch (e) {}
    }

    // 2. Check global listings store for expired ads
    const globalAds = getGlobalListings();
    for (const ad of globalAds) {
      const expiresAt = ad.profiles?.membership_expires_at;
      const isExpired = expiresAt && new Date(expiresAt) <= new Date();
      const isUserExpired = ad.user_id && expiredUserIds.has(ad.user_id);

      if (isExpired || isUserExpired) {
        if (ad.promotion_type || ad.is_featured) {
          updateGlobalListing(ad.id, {
            promotion_type: null,
            is_featured: false,
            is_verified: false,
            profiles: {
              ...(ad.profiles || {}),
              membership_type: 'free',
              membership_expires_at: null
            }
          });
        }
      }
    }

    // 3. Clean up featured_ads (Top Slider!)
    // Automatically purge any item whose listing is expired, deleted or non-existent
    const featuredList = getGlobalFeaturedAds();
    const validFeatured = [];
    const idsToRemove = [];

    const listingsMap = new Map();
    if (serverSupabase) {
      try {
        const { data: dbListings } = await serverSupabase
          .from('listings')
          .select('id, user_id, status, promotion_type, created_at, profiles:user_id(membership_type, membership_expires_at)');
        if (dbListings) {
          dbListings.forEach(l => listingsMap.set(l.id, l));
        }
      } catch (e) {}
    }
    globalAds.forEach(g => {
      if (!listingsMap.has(g.id)) listingsMap.set(g.id, g);
    });

    for (const item of featuredList) {
      const listing = listingsMap.get(item.listing_id);
      if (!listing || listing.status === 'deleted') {
        idsToRemove.push(item.listing_id);
        continue;
      }

      // Check if creator's membership is expired
      const profExpiry = listing.profiles?.membership_expires_at;
      if (profExpiry && new Date(profExpiry) <= new Date()) {
        idsToRemove.push(item.listing_id);
        continue;
      }

      validFeatured.push(item);
    }

    if (idsToRemove.length > 0) {
      saveGlobalFeaturedAds(validFeatured);
      if (serverSupabase) {
        for (const remId of idsToRemove) {
          try {
            await serverSupabase.from('featured_ads').delete().eq('listing_id', remId);
            await serverSupabase.from('listings').update({ is_featured: false, promotion_type: null }).eq('id', remId);
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error('Error in cleanupExpiredMembershipsAndBoosts:', err);
  }
}
