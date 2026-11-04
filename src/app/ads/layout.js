const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bikroynow.com';

export const metadata = {
  title: 'সব ধরণের বিজ্ঞাপন দেখুন | All Classified Ads in Bangladesh | BikroyNow',
  description: 'বাংলাদেশে নতুন ও পুরাতন মোবাইল ফোন, ব্যবহৃত ল্যাপটপ, গাড়ি, বাইক, ইলেক্ট্রনিক্স এবং ফ্ল্যাট কেনাবেচা করুন। Browse thousands of verified classified listings on BikroyNow.',
  keywords: [
    'সব বিজ্ঞাপন', 'all classified ads bd', 'পুরাতন পণ্য ক্রয় বিক্রয়', 'buy and sell bangladesh',
    'used mobile dhaka', 'second hand laptop bd', 'car sale bangladesh', 'tangail buy sell',
    'bikroynow ads', 'online marketplace bangladesh'
  ],
  alternates: {
    canonical: `${siteUrl}/ads`,
  },
  openGraph: {
    title: 'সব ধরণের বিজ্ঞাপন দেখুন | All Classified Ads in Bangladesh | BikroyNow',
    description: 'Browse thousands of verified mobile phones, electronics, vehicles, and laptops for sale in Bangladesh.',
    url: `${siteUrl}/ads`,
    siteName: 'BikroyNow',
    locale: 'bn_BD',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Classified Ads in Bangladesh | BikroyNow',
    description: 'Browse thousands of verified mobile phones, electronics, vehicles, and laptops for sale in Bangladesh.',
  },
};

export default function AdsLayout({ children }) {
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'All Classified Ads in Bangladesh - BikroyNow',
    url: `${siteUrl}/ads`,
    description: 'Browse thousands of verified mobile phones, electronics, vehicles, and laptops for sale in Bangladesh.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'BikroyNow',
      url: siteUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      {children}
    </>
  );
}
