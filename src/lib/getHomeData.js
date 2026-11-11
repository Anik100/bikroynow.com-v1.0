import { getServerSupabase } from './serverSupabase';
import { getGlobalFeaturedAds } from './globalFeaturedAdsStore';
import { getGlobalListings } from './globalListingsStore';
import { cleanupExpiredMembershipsAndBoosts } from './membershipManagerHelper';
import { sortPremiumListings, sortFeaturedAds } from './utils';

/**
 * Server-side data fetcher for the BikroyNow Homepage.
 * Supplies initialFeaturedAds and initialListings directly during SSR / ISR,
 * eliminating the 4.1s LCP request discovery wait and avoiding CLS skeleton shifts.
 */
export async function getHomeData() {
  let featuredAds = [];
  let listings = [];
  const deletedListingIds = new Set();

  try {
    // Purge expired memberships and boosts in the background
    try {
      await cleanupExpiredMembershipsAndBoosts();
    } catch (e) {
      // Non-critical, continue
    }

    const supabase = getServerSupabase({ revalidate: 60 });

    if (supabase) {
      try {
        const [featuredRes, dbRes, profilesRes, delSettingRes] = await Promise.all([
          supabase
            .from('featured_ads')
            .select(`
              *,
              listing:listing_id (
                id, title, price, location, images, user_id, status, promotion_type
              )
            `)
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('listings')
            .select('*')
            .neq('status', 'deleted')
            .order('created_at', { ascending: false })
            .limit(60),
          supabase
            .from('profiles')
            .select('id, email, membership_type, membership_expires_at'),
          supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'deleted_listing_ids')
            .maybeSingle()
        ]);

        if (delSettingRes?.data?.value) {
          try {
            const arr = JSON.parse(delSettingRes.data.value);
            if (Array.isArray(arr)) {
              arr.forEach(id => deletedListingIds.add(String(id)));
            }
          } catch (e) {}
        }

        const profilesMap = new Map();
        if (profilesRes?.data) {
          profilesRes.data.forEach(p => profilesMap.set(p.id, p));
        }

        const now = new Date();

        if (Array.isArray(featuredRes?.data)) {
          featuredAds = featuredRes.data.filter(ad => {
            if (!ad.is_active || !ad.listing || ad.listing.error || ad.listing.status === 'deleted') return false;
            const listingId = String(ad.listing_id || ad.listing.id);
            if (deletedListingIds.has(listingId)) return false;

            if (ad.listing.user_id) {
              const prof = profilesMap.get(ad.listing.user_id);
              if (!prof || !prof.membership_type || prof.membership_type === 'free') return false;
              if (prof.membership_expires_at && new Date(prof.membership_expires_at) <= now) return false;
              ad.listing.profiles = prof;
            }
            return true;
          });
        }

        if (Array.isArray(dbRes?.data)) {
          listings = dbRes.data
            .filter(l => !deletedListingIds.has(String(l.id)) && (l.status === 'active' || l.status === 'approved'))
            .map(l => ({
              ...l,
              profiles: profilesMap.get(l.user_id) || l.profiles || null
            }));
        }
      } catch (err) {
        console.error('getHomeData Supabase error:', err);
      }
    }

    // Fallback to global file-backed stores if database is empty or unreachable
    if (featuredAds.length === 0) {
      try {
        const globalFeatured = getGlobalFeaturedAds().filter(
          f => f.is_active && !deletedListingIds.has(String(f.listing_id))
        );
        if (globalFeatured.length > 0) {
          featuredAds = globalFeatured;
        }
      } catch (e) {}
    }

    if (listings.length === 0) {
      try {
        const globalAds = getGlobalListings().filter(
          l => !deletedListingIds.has(String(l.id)) && l.status !== 'deleted'
        );
        if (globalAds.length > 0) {
          listings = globalAds;
        }
      } catch (e) {}
    }

    featuredAds = sortFeaturedAds(featuredAds);
    listings = sortPremiumListings(listings);
  } catch (error) {
    console.error('getHomeData execution error:', error);
  }

  return {
    initialFeaturedAds: featuredAds,
    initialListings: listings
  };
}
