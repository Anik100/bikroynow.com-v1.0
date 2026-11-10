import { createClient } from '@supabase/supabase-js';


const CANONICAL_BASE = 'https://www.bikroynow.com';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || CANONICAL_BASE;

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
        if (data.user_id) {
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user_id)
              .maybeSingle();
            if (prof) data.profiles = prof;
          } catch (e) {}
        }
        return data;
      }
    }
  } catch (err) {
    console.error('Error fetching ad for SEO from Supabase:', err);
  }

  // Fallback to local server store
  if (typeof window === 'undefined') {
    try {
      const { getGlobalListings } = await import('./globalListingsStore');
      const localList = getGlobalListings();
      const found = localList.find((item) => String(item.id) === String(id));
      if (found) return found;
    } catch (err) {}
  }

  return null;
}

/**
 * Programmatic SEO Engine for BikroyNow listings
 * Generates:
 * - seo_title: [Product Name] - Price in [Location] | BikroyNow (<60 chars)
 * - meta_description: High-CTR bilingual description (140-160 chars)
 * - seo_slug: [condition]-[model]-[location]
 * - schema_json: Schema.org Product markup with offer, price, condition, availability
 * - enriched_content: Structured specification box and buyer safety checklist
 * - bilingual_keywords: Natural keywords in EN & BN
 */
export function generateProgrammaticSeo(ad, id) {
  if (!ad) return null;

  const titleClean = (ad.title || '').trim();
  const price = Number(ad.price || 0);
  const priceFormatted = price.toLocaleString('en-US');
  const locationClean = (ad.location || ad.district || ad.division || 'Bangladesh').trim();
  const condition = (ad.condition || 'Used').trim();
  const isNew = condition.toLowerCase() === 'new';
  const categoryClean = (ad.category_id || 'Classified').trim();
  const canonicalUrl = `${CANONICAL_BASE}/ad/${id}`;

  // 1. High-CTR SEO Title Generation (<60 chars target)
  // Example Title: "[Product Name] - Price in [City] | BikroyNow"
  const suffix = ` - Price in ${locationClean} | BikroyNow`;
  let seo_title = `${titleClean}${suffix}`;

  if (seo_title.length > 58) {
    const maxTitleLen = Math.max(15, 58 - suffix.length);
    const shortTitle = titleClean.length > maxTitleLen ? `${titleClean.slice(0, maxTitleLen - 1).trim()}…` : titleClean;
    seo_title = `${shortTitle}${suffix}`;
  }

  if (seo_title.length > 60) {
    seo_title = `${seo_title.slice(0, 57).trim()}…`;
  }

  // 2. High-CTR Bilingual Meta Description (140 to 160 chars target)
  // Structure: [Location]-এ ভালো কন্ডিশনে ব্যবহৃত [Product] কিনুন মাত্র ৳[Price] টাকায়। Check condition, photos, and buy safely on BikroyNow.
  const condPhraseBn = isNew ? 'নতুন' : 'ভালো কন্ডিশনে ব্যবহৃত';
  const ctaEn = isNew 
    ? ' Check specs, original photos & buy safely on BikroyNow.'
    : ' Check photos, specs & buy safely on BikroyNow.';
  
  const baseBn = `${locationClean}-এ ${condPhraseBn} ${titleClean} কিনুন মাত্র ৳${priceFormatted} টাকায়।`;
  let meta_description = `${baseBn}${ctaEn}`;

  if (meta_description.length > 160) {
    const allowedBn = 160 - ctaEn.length;
    const truncatedTitle = titleClean.slice(0, Math.max(15, allowedBn - (locationClean.length + condPhraseBn.length + 30))).trim();
    meta_description = `${locationClean}-এ ${condPhraseBn} ${truncatedTitle}… কিনুন মাত্র ৳${priceFormatted} টাকায়।${ctaEn}`;
  } else if (meta_description.length < 140) {
    const expandedCta = isNew
      ? ' আসল ছবি ও বিবরণ দেখে সরাসরি কিনুন। Buy safely on BikroyNow.'
      : ' আসল ছবি দেখে সরাসরি বিক্রেতার সাথে যোগাযোগ করুন। Buy safely on BikroyNow.';
    const expanded = `${baseBn}${expandedCta}`;
    if (expanded.length <= 160) {
      meta_description = expanded;
    }
  }

  // 3. Dynamic Slug & URL Optimization
  const stopWords = new Set(['a', 'an', 'the', 'and', 'in', 'for', 'of', 'at', 'by', 'with', 'on', 'to']);
  const slugTitle = titleClean
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(w => !stopWords.has(w))
    .join('-');

  const slugLocation = locationClean
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .join('-');

  const slugCondition = condition.toLowerCase();
  const seo_slug = `${slugCondition}-${slugTitle}-${slugLocation}`.replace(/-+/g, '-').replace(/^-|-$/g, '');

  // 4. Schema.org Product Structured Data
  // Strict decimal price formatting to ensure Google does not misinterpret thousands as decimals
  const formattedPriceString = price.toFixed(2);
  const coverImage = (Array.isArray(ad.images) && ad.images.length > 0)
    ? ad.images[0]
    : `${CANONICAL_BASE}/icon.svg`;

  const schema_json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    name: titleClean,
    image: Array.isArray(ad.images) && ad.images.length > 0 ? ad.images : [coverImage],
    description: meta_description,
    sku: String(id),
    category: categoryClean,
    brand: {
      '@type': 'Brand',
      name: ad.brand || 'BikroyNow Verified',
    },
    itemCondition: isNew ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BDT',
      price: formattedPriceString,
      priceValidUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      itemCondition: isNew ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      availability: (ad.status === 'active' || ad.status === 'approved') 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: formattedPriceString,
        priceCurrency: 'BDT',
        valueAddedTaxIncluded: true,
      },
      seller: {
        '@type': 'Organization',
        name: 'BikroyNow Verified Seller',
        url: CANONICAL_BASE,
      },
    },
  };

  // 5. Bilingual Keywords
  const bilingual_keywords = [
    titleClean,
    `${titleClean} price in Bangladesh`,
    `${titleClean} price in ${locationClean}`,
    `${condition} ${titleClean}`,
    `${condPhraseBn} ${titleClean}`,
    `${titleClean} দাম কত`,
    `${titleClean} কিনুন`,
    `buy ${titleClean} online`,
    `${categoryClean} in ${locationClean}`,
    `BikroyNow ${locationClean}`,
    'অনলাইন বাজার বাংলাদেশ',
    'BikroyNow classified ads'
  ];

  // 6. Content Enrichment (Structured specs & safety guidelines)
  const rawDesc = (ad.description || '').trim();
  const wordCount = rawDesc.split(/\s+/).filter(Boolean).length;
  const isBrief = wordCount < 30;

  const enriched_content = {
    isBrief,
    wordCount,
    specs: [
      { labelBn: 'পণ্যের নাম', labelEn: 'Product Name', value: titleClean },
      { labelBn: 'ক্যাটাগরি', labelEn: 'Category', value: categoryClean },
      { labelBn: 'পণ্যের অবস্থা', labelEn: 'Condition', value: isNew ? 'নতুন (Brand New)' : 'ব্যবহৃত (Used)' },
      { labelBn: 'অবস্থান / এলাকা', labelEn: 'Location', value: locationClean },
      { labelBn: 'মূল্য (টাকা)', labelEn: 'Price', value: `৳${priceFormatted} BDT` },
    ],
    safetyTipBn: 'পণ্যটি সামনাসামনি দেখে যাচাই করে সরাসরি লেনদেন করুন। অগ্রিম কোনো টাকা পাঠাবেন না।',
    safetyTipEn: 'Meet the seller in person, inspect the item thoroughly, and pay directly. Never send advance money.'
  };

  return {
    seo_title,
    meta_description,
    seo_slug,
    schema_json,
    enriched_content,
    bilingual_keywords
  };
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

  const progSeo = generateProgrammaticSeo(ad, id);
  const canonicalUrl = `${CANONICAL_BASE}/ad/${id}`;
  const titleClean = (ad.title || '').trim();
  const coverImage = (Array.isArray(ad.images) && ad.images.length > 0)
    ? ad.images[0]
    : `${CANONICAL_BASE}/icon.svg`;

  return {
    title: {
      absolute: progSeo.seo_title,
    },
    description: progSeo.meta_description,
    keywords: progSeo.bilingual_keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: progSeo.seo_title,
      description: progSeo.meta_description,
      url: canonicalUrl,
      siteName: 'BikroyNow',
      locale: 'bn_BD',
      type: 'website',
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
      title: progSeo.seo_title,
      description: progSeo.meta_description,
      images: [coverImage],
    },
    other: {
      'og:type': 'product',
      'product:price:amount': Number(ad.price || 0).toFixed(2),
      'product:price:currency': 'BDT',
      'product:availability': (ad.status === 'active' || ad.status === 'approved') ? 'in stock' : 'out of stock',
      'product:condition': (ad.condition || 'Used').toLowerCase() === 'new' ? 'new' : 'used',
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

  const progSeo = generateProgrammaticSeo(ad, id);
  const canonicalUrl = `${CANONICAL_BASE}/ad/${id}`;
  const titleClean = (ad.title || '').trim();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      progSeo.schema_json,
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumbs`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: CANONICAL_BASE,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: ad.category_id || 'All Ads',
            item: `${CANONICAL_BASE}/ads?category=${encodeURIComponent(ad.category_id || '')}`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: titleClean,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };
}
