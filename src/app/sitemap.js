import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const CANONICAL_BASE = 'https://www.bikroynow.com';
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || CANONICAL_BASE;

/**
 * Builds the dynamic array of valid sitemap URLs
 */
export async function buildSitemapData() {
  const now = new Date();

  // 1. Static core routes
  const staticRoutes = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/ads`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/sell-fast`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/membership`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about-us`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/stay-safe`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // 2. High-Value Category Landing Routes
  const mainCategories = [
    'Mobile Phones',
    'Computers',
    'Electronics',
    'Vehicles',
    'Property',
    'Jobs',
    'অন্যান্য',
  ];

  const categoryRoutes = mainCategories.map((cat) => ({
    url: `${baseUrl}/ads?category=${encodeURIComponent(cat)}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.85,
  }));

  // 3. High-Value Location Landing Routes
  const majorLocations = [
    'Dhaka',
    'Chattogram',
    'Rajshahi',
    'Khulna',
    'Barishal',
    'Sylhet',
    'Rangpur',
    'Mymensingh',
    'Tangail',
    'Gazipur',
    'Narayanganj',
    'Cumilla',
    'Bogura',
  ];

  const locationRoutes = majorLocations.map((loc) => ({
    url: `${baseUrl}/ads?location=${encodeURIComponent(loc)}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.85,
  }));

  // 4. Dynamic active ad listings (excluding sold, deleted, or pending)
  let adRoutes = [];
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let listings = [];
    const deletedIds = new Set();

    if (supabaseUrl && anonKey) {
      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });

      // Fetch blacklist of permanently deleted ads
      try {
        const { data: setRow } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'deleted_listing_ids')
          .maybeSingle();
        if (setRow?.value) {
          const parsed = JSON.parse(setRow.value);
          if (Array.isArray(parsed)) parsed.forEach((id) => deletedIds.add(String(id)));
        }
      } catch (e) {}

      // Fetch active & approved listings only
      const { data } = await supabase
        .from('listings')
        .select('id, created_at, status')
        .or('status.eq.active,status.eq.approved')
        .limit(3000);

      if (Array.isArray(data) && data.length > 0) {
        listings = data.filter(
          (item) => item.status !== 'deleted' && !deletedIds.has(String(item.id))
        );
      }
    }

    // Fallback to local server store if Supabase unavailable
    if (listings.length === 0 && typeof window === 'undefined') {
      try {
        const { getGlobalListings } = await import('../lib/globalListingsStore');
        const local = getGlobalListings();
        listings = local.filter((l) => (l.status === 'active' || l.status === 'approved') && !deletedIds.has(String(l.id)));
      } catch (e) {}
    }

    adRoutes = listings.map((ad) => ({
      url: `${baseUrl}/ad/${ad.id}`,
      lastModified: ad.created_at ? new Date(ad.created_at) : now,
      changeFrequency: 'daily',
      priority: 0.9,
    }));
  } catch (err) {
    console.error('Error generating dynamic sitemap ad routes:', err);
  }

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...locationRoutes,
    ...adRoutes,
  ];
}

export default async function sitemap() {
  return await buildSitemapData();
}
