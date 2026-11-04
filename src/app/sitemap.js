import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from '../lib/globalListingsStore';

export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bikroynow.com';
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

  // 2. High-Value Category Landing Routes (Clean 1-param URLs without XML ampersand issues)
  const mainCategories = [
    'Mobile Phones',
    'Computers',
    'Electronics',
    'Vehicles',
    'Property',
    'Jobs',
  ];

  const categoryRoutes = mainCategories.map((cat) => ({
    url: `${baseUrl}/ads?category=${encodeURIComponent(cat)}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.85,
  }));

  // 3. High-Value Location Landing Routes (Clean 1-param URLs without XML ampersand issues)
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
    'Comilla',
    'Bogra',
  ];

  const locationRoutes = majorLocations.map((loc) => ({
    url: `${baseUrl}/ads?location=${encodeURIComponent(loc)}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.85,
  }));

  // 4. Dynamic active ad listings
  let adRoutes = [];
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let listings = [];
    if (supabaseUrl && anonKey) {
      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
      const { data } = await supabase
        .from('listings')
        .select('id, created_at, status')
        .or('status.eq.active,status.eq.approved')
        .limit(2000);
      if (Array.isArray(data) && data.length > 0) {
        listings = data;
      }
    }

    if (listings.length === 0) {
      listings = getGlobalListings().filter((l) => l.status === 'active' || l.status === 'approved');
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
