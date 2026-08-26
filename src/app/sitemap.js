import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from '../lib/globalListingsStore';

export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bikroynow.com';
  const now = new Date();

  // Static core routes
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
      priority: 0.9,
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

  // Fetch active dynamic ad listings
  let adRoutes = [];
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let listings = [];
    if (supabaseUrl && anonKey) {
      const supabase = createClient(supabaseUrl, anonKey);
      const { data } = await supabase
        .from('listings')
        .select('id, created_at, status')
        .eq('status', 'active')
        .limit(1000);
      if (Array.isArray(data) && data.length > 0) {
        listings = data;
      }
    }

    if (listings.length === 0) {
      listings = getGlobalListings().filter(l => l.status === 'active');
    }

    adRoutes = listings.map((ad) => ({
      url: `${baseUrl}/ad/${ad.id}`,
      lastModified: ad.created_at ? new Date(ad.created_at) : now,
      changeFrequency: 'daily',
      priority: 0.8,
    }));
  } catch (err) {
    console.error('Error generating sitemap ad routes:', err);
  }

  return [...staticRoutes, ...adRoutes];
}
