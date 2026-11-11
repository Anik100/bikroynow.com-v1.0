import './globals.css';
import dynamic from 'next/dynamic';
import { Inter } from 'next/font/google';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { LanguageProvider } from '../context/LanguageContext';
import PageTransition from '../components/PageTransition';

const AiSupportWidget = dynamic(() => import('../components/AiSupportWidget'), {
  ssr: false,
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
  adjustFontFallback: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bikroynow.com';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'BikroyNow.com - Buy & Sell Electronics & More in Bangladesh',
    template: '%s | BikroyNow.com',
  },
  description: "BikroyNow.com is Bangladesh's trusted online marketplace to buy and sell used mobiles, laptops, routers, bikes, and electronics safely and fast.",
  keywords: [
    // Brand Variations
    'BikroyNow', 'bikroynow.com', 'bikroy now', 'বিক্রয়নও', 'বিক্রয় নাও', 'bikroyhut', 'bikroy marketplace',

    // Bengali Search Terms (বাংলা সার্চ)
    'বাই সেল বাংলাদেশ', 'পুরাতন জিনিস ক্রয় বিক্রয়', 'পুরাতন মোবাইল কেনা বেচা', 'সেকেন্ড হ্যান্ড ল্যাপটপ',
    'ব্যবহৃত রাউটার দাম', 'পুরাতন গাড়ি বিক্রি', 'সেকেন্ড হ্যান্ড বাইক বিডি', 'অনলাইন মার্কেটপ্লেস বাংলাদেশ',
    'ফ্রি বিজ্ঞাপন পোস্ট', 'বাসা ভাড়া ও জমি বিক্রয়', 'চাকরির খবর বাংলাদেশ', 'ইলেকট্রনিক্স কেনাবেচা টাঙ্গাইল',
    'ব্যবহৃত ফোন কিনুন', 'পুরোনো জিনিস বেচাকেনা', 'সেরা মার্কেটপ্লেস বিডি', 'অনলাইন কেনাবেচা',

    // Banglish Search Terms (বাংলিশ সার্চ)
    'puraton jinish kroy bikroy', 'purano mobile bikroy', 'puraton phone kinbo', 'second hand laptop dam',
    'used router price bd', 'purano bike becha kena', 'online buy sell bangladesh', 'free ad post bd',
    'tangail buy sell', 'dhaka used electronics', 'kom dame used phone', 'bhalo classified website',
    'basha bhara ad', 'chakri khobor bangladesh', 'used gari bikroy', 'puran jinis sell', 'becha kena bd',

    // English Search Terms (ইংরেজি সার্চ)
    'buy and sell Bangladesh', 'used mobile phone bd', 'second hand laptops bangladesh',
    'used router price in bangladesh', 'online marketplace bd', 'free classified ads bangladesh',
    'electronics tangail', 'buy second hand electronics', 'used cars and bikes bd',
    'post free ad in bangladesh', 'classifieds marketplace bangladesh', 'sell fast bd'
  ],
  authors: [{ name: 'BikroyNow Team', url: siteUrl }],
  creator: 'BikroyNow',
  publisher: 'BikroyNow',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'BikroyNow.com - Buy & Sell Electronics & More in Bangladesh',
    description: "BikroyNow.com is Bangladesh's trusted online marketplace to buy and sell used mobiles, laptops, routers, bikes, and electronics safely and fast.",
    url: siteUrl,
    siteName: 'BikroyNow',
    locale: 'bn_BD',
    type: 'website',
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'BikroyNow.com Orange Marketplace Logo',
      },
      {
        url: `${siteUrl}/icon.svg`,
        width: 512,
        height: 512,
        type: 'image/svg+xml',
        alt: 'BikroyNow.com Orange Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BikroyNow.com - Buy & Sell Electronics & More in Bangladesh',
    description: "BikroyNow.com is Bangladesh's trusted online marketplace to buy and sell used mobiles, laptops, routers, bikes, and electronics safely and fast.",
    images: [`${siteUrl}/opengraph-image`],
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png?v=2', sizes: '16x16', type: 'image/png' },
      { url: '/icon.svg?v=2', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico?v=2'],
  },
  manifest: '/manifest.json',
  verification: {
    google: 'fhC9HvJp-lIaXm3VnKC1W_EtPwoGY6dHeXWSTgYiAm0',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F59E0B',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'BikroyNow',
      description: 'The largest online marketplace in Bangladesh to buy and sell anything.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/ads?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
      inLanguage: ['bn', 'en'],
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'BikroyNow.com',
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+8809612488488',
        email: 'support@bikroynow.com',
        contactType: 'customer support',
        areaServed: 'BD',
        availableLanguage: ['bn', 'en'],
      },
    },
    {
      '@type': 'LocalBusiness',
      '@id': `${siteUrl}/#localbusiness`,
      name: 'BikroyNow.com',
      url: 'https://www.bikroynow.com',
      image: `${siteUrl}/og-image.png`,
      logo: `${siteUrl}/icon.svg`,
      description: "BikroyNow.com is Bangladesh's trusted online marketplace to buy and sell used mobiles, laptops, routers, bikes, and electronics safely and fast.",
      telephone: '+8809612488488',
      email: 'support@bikroynow.com',
      priceRange: 'BDT',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Nagarpur',
        addressLocality: 'Nagarpur',
        addressRegion: 'Tangail',
        addressCountry: 'BD',
      },
      areaServed: {
        '@type': 'Country',
        name: 'Bangladesh',
      },
      sameAs: [
        'https://www.facebook.com/profile.php?id=61592653021446',
      ],
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn" className={inter.variable}>
      <head>
        <meta name="google-site-verification" content="fhC9HvJp-lIaXm3VnKC1W_EtPwoGY6dHeXWSTgYiAm0" />
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico?v=2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=2" />
        <link rel="icon" href="/icon.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=2" />
        <link rel="manifest" href="/manifest.json?v=2" />
        <meta name="theme-color" content="#F59E0B" />
        <meta name="msapplication-TileColor" content="#F59E0B" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Instant Pre-paint Style: Guarantees 0ms flicker on slider reload via CSS variable */}
        <script
          id="featured-slider-prepaint-script"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var p = localStorage.getItem('bikroynow_slider_page') || sessionStorage.getItem('bikroynow_slider_page');
                  if (p !== null && p !== undefined) {
                    var idx = parseInt(p, 10);
                    if (!isNaN(idx) && idx >= 0) {
                      document.documentElement.style.setProperty('--slider-page', idx);
                      document.documentElement.style.setProperty('--slider-transition', 'none');
                    }
                  }
                } catch(e) {}
              })();
            `
          }}
        />
      </head>
      <body className={`${inter.className} ${inter.variable}`}>
        <LanguageProvider>
          <Navbar />
          <main style={{ minHeight: 'calc(100vh - 200px)' }}>
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          <Footer />
          <AiSupportWidget />
        </LanguageProvider>
      </body>
    </html>
  );
}
