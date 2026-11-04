import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from './globalListingsStore';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bikroynow.com';

/**
 * Server-side ad fetcher for SEO & Schema markup
 */
export async function getAdForSeo(id) {
  if (!id) return null;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && anonKey) {
      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });

      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (data && !error) {
        return data;
      }
    }
  } catch (err) {
    console.error('Error fetching ad for SEO from Supabase:', err);
  }

  // Fallback to local server store
  try {
    const localList = getGlobalListings();
    const found = localList.find((item) => String(item.id) === String(id));
    if (found) return found;
  } catch (err) {}

  return null;
}

/**
 * Builds automated, high-ranking MetaData for an individual ad
 */
export function buildAdMetadata(ad, id) {
  if (!ad) {
    return {
      title: 'বিজ্ঞাপন বিবরণী | BikroyNow.com',
      description: 'বাংলাদেশে ব্যবহৃত ও নতুন পণ্য সহজে কেনাবেচা করুন BikroyNow-এ।',
      robots: { index: false, follow: true },
    };
  }

  const titleClean = (ad.title || '').trim();
  const priceFormatted = Number(ad.price || 0).toLocaleString();
  const locationClean = (ad.location || 'Bangladesh').trim();
  const conditionClean = ad.condition || 'Used';
  const categoryClean = ad.category_id || 'Classified';

  const seoTitle = `${titleClean} - দাম ৳${priceFormatted} | ${locationClean} | BikroyNow`;
  
  const rawDesc = (ad.description || '').replace(/\s+/g, ' ').trim();
  const seoDescription = `${conditionClean} ${titleClean} কিনুন ${locationClean} থেকে মাত্র ৳${priceFormatted} টাকায়। ${rawDesc ? rawDesc.slice(0, 140) + '...' : ''} সরাসরি বিক্রেতার সাথে যোগাযোগ করুন BikroyNow-এ।`;

  const coverImage = (Array.isArray(ad.images) && ad.images.length > 0)
    ? ad.images[0]
    : `${siteUrl}/icon.svg`;

  const adUrl = `${siteUrl}/ad/${id}`;

  const keywords = [
    titleClean,
    `${titleClean} price in bd`,
    `${titleClean} in ${locationClean}`,
    `${titleClean} দাম কত`,
    `${conditionClean} ${titleClean}`,
    `buy ${titleClean} bangladesh`,
    `used ${categoryClean} in ${locationClean}`,
    `${locationClean} buy and sell`,
    'bikroynow',
    'অনলাইন কেনাবেচা বাংলাদেশ'
  ];

  return {
    title: seoTitle,
    description: seoDescription,
    keywords,
    alternates: {
      canonical: adUrl,
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: adUrl,
      siteName: 'BikroyNow',
      locale: 'bn_BD',
      type: 'article',
      images: [
        {
          url: coverImage,
          width: 800,
          height: 600,
          alt: `${titleClean} - BikroyNow`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: seoDescription,
      images: [coverImage],
    },
    robots: {
      index: ad.status === 'active' || ad.status === 'approved',
      follow: true,
      googleBot: {
        index: ad.status === 'active' || ad.status === 'approved',
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

/**
 * Builds Google Product + Breadcrumbs JSON-LD Schema
 */
export function buildAdJsonLd(ad, id) {
  if (!ad) return null;

  const titleClean = (ad.title || '').trim();
  const price = Number(ad.price || 0);
  const locationClean = (ad.location || 'Bangladesh').trim();
  const adUrl = `${siteUrl}/ad/${id}`;
  const images = Array.isArray(ad.images) && ad.images.length > 0 ? ad.images : [`${siteUrl}/icon.svg`];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${adUrl}#product`,
        name: titleClean,
        image: images,
        description: ad.description || `${titleClean} for sale on BikroyNow in ${locationClean}`,
        category: ad.category_id || 'Classified',
        itemCondition: ad.condition === 'New' 
          ? 'https://schema.org/NewCondition' 
          : 'https://schema.org/UsedCondition',
        offers: {
          '@type': 'Offer',
          url: adUrl,
          priceCurrency: 'BDT',
          price: price,
          priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          itemCondition: ad.condition === 'New' 
            ? 'https://schema.org/NewCondition' 
            : 'https://schema.org/UsedCondition',
          availability: ad.status === 'active' || ad.status === 'approved' 
            ? 'https://schema.org/InStock' 
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: 'BikroyNow Verified Seller',
            url: siteUrl,
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${adUrl}#breadcrumbs`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: ad.category_id || 'All Ads',
            item: `${siteUrl}/ads?category=${encodeURIComponent(ad.category_id || '')}`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: titleClean,
            item: adUrl,
          },
        ],
      },
    ],
  };
}
